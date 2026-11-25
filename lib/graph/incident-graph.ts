// The incident graph (B3). The occurrence arrives already extracted by ezworker
// (POST /api/webhook/ezworker); the graph only decides. Nodes orchestrate: decisions come
// from lib/rules, outside access from IncidentPorts. See docs/PLANO_DESENVOLVIMENTO.md, section 2.
// Two pauses (interrupt): waiting for evidence and waiting for human review.
import { END, START, StateGraph, interrupt } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import { ezworkerToExtraction } from "@/lib/ai/ezworker-adapter";
import { ExtractionSchema, minConfidence } from "@/lib/ai/extraction-schema";
import { maskPii } from "@/lib/pii";
import { calculateCost } from "@/lib/rules/cost";
import { missingEvidence } from "@/lib/rules/evidence";
import { detectInjectionSignals } from "@/lib/rules/injection-signals";
import { decidePayer } from "@/lib/rules/payer";
import { decideReview } from "@/lib/rules/review";
import type { RuleResult } from "@/lib/rules/types";

import type { IncidentPorts } from "./ports";
import {
  type Decision,
  type EnrichedDelivery,
  type EvidenceAnswer,
  IncidentState,
  type IncidentStateType,
  type ReviewAnswer,
} from "./state";

type Update = Partial<IncidentStateType>;
type Node = (state: IncidentStateType) => Promise<Update> | Update;
export type NodeWrapper = (name: string, fn: Node) => Node;

const now = () => new Date().toISOString();

function decision(node: string, input: unknown, r: RuleResult<unknown>): Decision {
  return { node, rule: r.rule, input, output: r.result, reason: r.reason, at: now() };
}

/** Invoice not in the delivery base: use the values the occurrence itself carries. */
function deliveryFromContext(s: IncidentStateType): EnrichedDelivery | null {
  const ctx = s.source?.contexto;
  if (!ctx?.valor_nf) return null;
  return {
    deliveryId: null,
    source: "report_context",
    invoiceNumber: s.extraction?.invoice_number ?? "",
    invoiceValue: ctx.valor_nf,
    volumes: s.extraction?.total_volumes ?? 0,
    freightCost: 0,
    insuranceCost: 0,
    deliveredAt: null,
    policy: ctx.apolice ? { deductible: ctx.apolice.franquia, coversLoadingUnloading: ctx.apolice.cobre_descarga } : null,
  };
}

export function buildIncidentGraph(
  ports: IncidentPorts,
  checkpointer: BaseCheckpointSaver,
  wrap: NodeWrapper = (_name, fn) => fn,
) {
  const node = (name: string, fn: Node) => [name, wrap(name, fn)] as const;

  const fromEzworker = node("from_ezworker", (s) => {
    const e = ezworkerToExtraction(s.source!);
    return { reportedAt: s.source!.recebido_em ?? now(), maskedText: e.reason_text, rawExtraction: JSON.stringify(e) };
  });

  const maskNode = node("mask_pii", (s) => {
    const { masked, map } = maskPii(s.maskedText, s.piiMap);
    const e = JSON.parse(s.rawExtraction!);
    e.reason_text = masked;
    e.visible_text_in_images = (e.visible_text_in_images as string[]).map((t) => maskPii(t, map).masked);
    const count = Object.keys(map).length;
    return {
      maskedText: masked,
      piiMap: map,
      rawExtraction: JSON.stringify(e),
      decisions: [
        decision("mask_pii", { characters: s.maskedText.length }, {
          result: { masked: count },
          rule: count ? "PII_MASKED" : "NO_PII",
          reason: count ? `${count} dado(s) pessoal(is) trocado(s) por marcadores antes de seguir.` : "Nenhum dado pessoal encontrado no texto.",
        }),
      ],
    };
  });

  const validate = node("validate_schema", (s) => {
    const parsed = ExtractionSchema.safeParse(JSON.parse(s.rawExtraction!));
    const errors = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`);
    const r: RuleResult<unknown> = parsed.success
      ? { result: { valid: true }, rule: "SCHEMA_VALID", reason: "Ocorrência do ezworker dentro do formato." }
      : { result: { valid: false, errors }, rule: "SCHEMA_FAILED", reason: `Ocorrência fora do formato: ${errors.slice(0, 3).join("; ")}.` };
    return { extraction: parsed.success ? parsed.data : null, validationErrors: errors, decisions: [decision("validate_schema", {}, r)] };
  });

  // Nothing invalid is saved as an incident; the decisions stay for whoever investigates.
  const invalid = node("invalid_occurrence", async (s) => {
    await ports.saveDecisions(s.threadId, null, s.decisions);
    return { status: "pending_review" as const };
  });

  const signals = node("detect_injection_signals", (s) => {
    const e = s.extraction!;
    const r = detectInjectionSignals([e.reason_text, ...e.visible_text_in_images], s.source?.instrucoes_ignoradas ?? []);
    return { injectionSignals: r.result, decisions: [decision("detect_injection_signals", { texts: e.visible_text_in_images.length + 1 }, r)] };
  });

  const normalize = node("normalize", async (s) => ({ entities: await ports.normalize(s.extraction!) }));

  const enrich = node("enrich", async (s) => {
    const fromBase = await ports.findDelivery(s.extraction!);
    const delivery = fromBase ?? deliveryFromContext(s);
    const r: RuleResult<unknown> = fromBase
      ? { result: { deliveryId: fromBase.deliveryId }, rule: "DELIVERY_FOUND", reason: `NF ${fromBase.invoiceNumber} encontrada na base de entregas.` }
      : delivery
        ? { result: { deliveryId: null }, rule: "DELIVERY_FROM_REPORT", reason: "NF fora da base de entregas; valor e apólice tirados do próprio relato." }
        : { result: { deliveryId: null }, rule: "DELIVERY_NOT_FOUND", reason: "NF não encontrada e o relato não traz valor; custo não pode ser calculado." };
    return { delivery, decisions: [decision("enrich", { invoice: s.extraction!.invoice_number }, r)] };
  });

  const cost = node("calculate_cost", (s) => {
    const r = calculateCost(s.extraction!, s.delivery);
    return { cost: r.result, decisions: [decision("calculate_cost", { type: s.extraction!.type, invoice: s.delivery?.invoiceNumber ?? null }, r)] };
  });

  const payer = node("decide_payer", (s) => {
    const input = { extraction: s.extraction!, cost: s.cost!.cost, delivery: s.delivery, reportedAt: s.reportedAt };
    const r = decidePayer(input);
    return { payer: r.result, decisions: [decision("decide_payer", { type: input.extraction.type, cost: input.cost, policy: s.delivery?.policy ?? null }, r)] };
  });

  const evidence = node("decide_evidence", (s) => {
    // After a resume, the list comes from whoever attached the evidence. Otherwise what
    // ezworker says is missing wins; the minimum-evidence rule fills in when it says nothing.
    const missing = s.evidenceRequested
      ? s.missingEvidence
      : s.extraction!.missing_evidence.length
        ? s.extraction!.missing_evidence
        : missingEvidence(s.extraction!).result;
    const waiting = missing.length > 0 && !s.evidenceRequested;
    const r: RuleResult<unknown> = !missing.length
      ? { result: [], rule: "EVIDENCE_OK", reason: "Evidências mínimas recebidas." }
      : waiting
        ? { result: missing, rule: "EVIDENCE_REQUESTED", reason: `Pedido ao motorista, numa única mensagem: ${missing.join("; ")}.` }
        : { result: missing, rule: "EVIDENCE_STILL_MISSING", reason: `Segue sem: ${missing.join("; ")}.` };
    return {
      missingEvidence: missing,
      evidenceRequested: s.evidenceRequested || waiting,
      status: waiting ? ("awaiting_evidence" as const) : null,
      decisions: [decision("decide_evidence", { type: s.extraction!.type }, r)],
    };
  });

  const review = node("decide_review", (s) => {
    if (s.status === "awaiting_evidence") return {};
    if (s.reviewed) {
      return {
        status: "registered" as const,
        reviewReasons: [],
        decisions: [decision("decide_review", {}, { result: { needsReview: false }, rule: "HUMAN_REVIEWED", reason: "Revisado por uma pessoa." })],
      };
    }
    const input = { extraction: s.extraction, cost: s.cost?.cost ?? 0, deliveryFound: s.delivery !== null, injectionSignals: s.injectionSignals };
    const r = decideReview(input);
    return {
      status: r.result.needsReview ? ("pending_review" as const) : ("registered" as const),
      reviewReasons: r.result.reasons,
      decisions: [
        decision("decide_review", { cost: input.cost, confidence: s.extraction ? minConfidence(s.extraction) : null, signals: s.injectionSignals.length }, r),
      ],
    };
  });

  const save = node("save_incident", async (s) => {
    // Second barrier (8.1): nothing invalid reaches the database.
    ExtractionSchema.parse(s.extraction);
    const saved = await ports.saveIncident(s);
    await ports.saveDecisions(s.threadId, saved.incidentId, s.decisions);
    return { incidentId: saved.incidentId, caseId: saved.caseId };
  });

  const awaitEvidence = node("await_evidence", (s) => {
    const answer = interrupt<{ kind: "evidence"; missing: string[] }, EvidenceAnswer>({ kind: "evidence", missing: s.missingEvidence });
    return { missingEvidence: answer.stillMissing, status: null };
  });

  const awaitReview = node("await_review", (s) => {
    const answer = interrupt<{ kind: "review"; reasons: string[] }, ReviewAnswer>({ kind: "review", reasons: s.reviewReasons });
    const fields = answer.action === "correct" ? answer.fields : {};
    const changed = Object.keys(fields).filter(
      (k) => JSON.stringify(fields[k as keyof typeof fields]) !== JSON.stringify(s.extraction![k as keyof typeof s.extraction]),
    );
    return {
      extraction: { ...s.extraction!, ...fields },
      reviewed: true,
      decisions: [
        decision("await_review", { reviewer: answer.reviewer }, {
          result: { action: answer.action, changed },
          rule: changed.length ? "HUMAN_CORRECTED" : "HUMAN_CONFIRMED",
          reason: changed.length
            ? `${answer.reviewer} corrigiu: ${changed.join(", ")}. NF, custo e pagador recalculados.`
            : `${answer.reviewer} confirmou o registro.`,
        }),
      ],
    };
  });

  return new StateGraph(IncidentState)
    .addNode(...fromEzworker)
    .addNode(...maskNode)
    .addNode(...validate)
    .addNode(...invalid)
    .addNode(...signals)
    .addNode(...normalize)
    .addNode(...enrich)
    .addNode(...cost)
    .addNode(...payer)
    .addNode(...evidence)
    .addNode(...review)
    .addNode(...save)
    .addNode(...awaitEvidence)
    .addNode(...awaitReview)
    .addEdge(START, "from_ezworker")
    .addEdge("from_ezworker", "mask_pii")
    .addEdge("mask_pii", "validate_schema")
    .addConditionalEdges("validate_schema", (s) => (s.extraction ? "detect_injection_signals" : "invalid_occurrence"), [
      "detect_injection_signals",
      "invalid_occurrence",
    ])
    .addEdge("invalid_occurrence", END)
    .addEdge("detect_injection_signals", "normalize")
    .addEdge("normalize", "enrich")
    .addEdge("enrich", "calculate_cost")
    .addEdge("calculate_cost", "decide_payer")
    .addEdge("decide_payer", "decide_evidence")
    .addEdge("decide_evidence", "decide_review")
    .addEdge("decide_review", "save_incident")
    .addConditionalEdges(
      "save_incident",
      (s) => (s.status === "awaiting_evidence" ? "await_evidence" : s.status === "pending_review" ? "await_review" : END),
      ["await_evidence", "await_review", END],
    )
    .addEdge("await_evidence", "decide_evidence")
    .addEdge("await_review", "normalize")
    .compile({ checkpointer });
}
