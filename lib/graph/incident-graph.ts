// The incident graph (B3). Nodes only orchestrate: decisions come from lib/rules,
// outside access from IncidentPorts. See docs/PLANO_DESENVOLVIMENTO.md, section 2.
//
// Two entries:
//  - ezworker: the occurrence arrives already extracted (POST /api/webhook/ezworker);
//  - messages: a driver report is read by Claude (extract_multimodal, with one retry).
// Three pauses (interrupt): extraction failed, waiting for evidence, waiting for human review.
import { END, START, StateGraph, interrupt } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import { ezworkerToExtraction } from "@/lib/ai/ezworker-adapter";
import { ExtractionSchema, minConfidence } from "@/lib/ai/extraction-schema";
import { maskPii } from "@/lib/pii";
import { MAX_EXTRACTION_ATTEMPTS } from "@/lib/rules/config";
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
  type ReportMessage,
  type ReviewAnswer,
} from "./state";

type Update = Partial<IncidentStateType>;
type Node = (state: IncidentStateType) => Promise<Update> | Update;
export type NodeWrapper = (name: string, fn: Node) => Node;

const now = () => new Date().toISOString();

function decision(node: string, input: unknown, r: RuleResult<unknown>): Decision {
  return { node, rule: r.rule, input, output: r.result, reason: r.reason, at: now() };
}

/** Texts and transcripts in arrival order; images are sent separately. */
export function reportText(messages: ReportMessage[]): string {
  return messages
    .map((m, i) => {
      if (m.kind === "text") return `[${i + 1}] texto: ${m.text ?? ""}`;
      if (m.kind === "audio") {
        const t = m.transcript ?? "(transcrição indisponível)";
        return `[${i + 1}] áudio transcrito: ${t}${m.text ? `\n    legenda: ${m.text}` : ""}`;
      }
      return `[${i + 1}] imagem${m.text ? ` com legenda: ${m.text}` : ""}`;
    })
    .join("\n");
}

/** Invoice not in the delivery base: use the values the report itself carries. */
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

  // --- Entry: ezworker ------------------------------------------------------
  const fromEzworker = node("from_ezworker", (s) => {
    const e = ezworkerToExtraction(s.source!);
    return {
      reportedAt: s.source!.recebido_em ?? now(),
      maskedText: e.reason_text,
      rawExtraction: JSON.stringify(e),
      // The occurrence cannot be asked again: a single validation attempt.
      extractionAttempts: MAX_EXTRACTION_ATTEMPTS,
    };
  });

  // --- Entry: driver messages read by Claude --------------------------------
  const loadReport = node("load_report", async (s) => {
    const r = await ports.loadReport(s.reportId);
    await ports.setReportStatus(s.reportId, "processing");
    return { phone: r.phone, reportedAt: r.openedAt, messages: r.messages, maskedText: reportText(r.messages) };
  });

  const awaitTranscriptions = node("await_transcriptions", async (s) => {
    const pending = s.messages.filter((m) => m.kind === "audio" && m.transcriptStatus === "pending");
    if (!pending.length) return {};
    // Resumed by the transcription webhook, or by the timeout job with timedOut = true.
    const answer = interrupt<{ kind: "transcription"; pending: number[] }, { timedOut: boolean }>({
      kind: "transcription",
      pending: pending.map((m) => m.id),
    });
    const r = await ports.loadReport(s.reportId);
    return {
      messages: r.messages,
      maskedText: reportText(r.messages),
      transcriptionTimedOut: answer.timedOut,
      decisions: [
        decision("await_transcriptions", { pending: pending.length }, {
          result: { timedOut: answer.timedOut },
          rule: answer.timedOut ? "TRANSCRIPTION_TIMEOUT" : "TRANSCRIPTION_RECEIVED",
          reason: answer.timedOut
            ? "A transcrição não chegou no prazo; o caso segue com fotos e texto e vai para revisão."
            : "Transcrição dos áudios recebida.",
        }),
      ],
    };
  });

  const maskNode = node("mask_pii", (s) => {
    const { masked, map } = maskPii(s.maskedText, s.piiMap);
    const update: Update = { maskedText: masked, piiMap: map };
    if (s.source && s.rawExtraction) {
      // ezworker already extracted: mask the free text fields of its answer.
      const e = JSON.parse(s.rawExtraction);
      e.reason_text = masked;
      e.visible_text_in_images = (e.visible_text_in_images as string[]).map((t) => maskPii(t, map).masked);
      update.rawExtraction = JSON.stringify(e);
    }
    const count = Object.keys(map).length;
    update.decisions = [
      decision("mask_pii", { characters: s.maskedText.length }, {
        result: { masked: count },
        rule: count ? "PII_MASKED" : "NO_PII",
        reason: count ? `${count} dado(s) pessoal(is) trocado(s) por marcadores antes de seguir.` : "Nenhum dado pessoal encontrado no texto.",
      }),
    ];
    return update;
  });

  const extract = node("extract_multimodal", async (s) => {
    const attempt = s.extractionAttempts + 1;
    const images = await ports.loadImages(s.messages);
    const r = await ports.extract({ reportId: s.reportId, attempt, text: s.maskedText, images, previousErrors: s.validationErrors });
    return { extractionAttempts: attempt, rawExtraction: r.rawText, lastModelCallId: r.callId, validationErrors: r.error ? [r.error] : [] };
  });

  const validate = node("validate_schema", async (s) => {
    let errors = s.validationErrors;
    let extraction = null;
    if (s.rawExtraction !== null) {
      try {
        const parsed = ExtractionSchema.safeParse(JSON.parse(s.rawExtraction));
        if (parsed.success) extraction = parsed.data;
        else errors = parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`);
      } catch {
        errors = ["a resposta não é um JSON válido"];
      }
    }
    if (s.lastModelCallId !== null) await ports.recordSchemaResult(s.lastModelCallId, extraction !== null);
    const modelFailed = s.rawExtraction === null;
    const retry = s.extractionAttempts < MAX_EXTRACTION_ATTEMPTS;
    const r: RuleResult<unknown> = extraction
      ? { result: { valid: true, attempt: s.extractionAttempts }, rule: "SCHEMA_VALID", reason: s.source ? "Ocorrência do ezworker dentro do formato." : `Leitura válida na tentativa ${s.extractionAttempts}.` }
      : {
          result: { valid: false, attempt: s.extractionAttempts, errors },
          rule: `${modelFailed ? "MODEL_ERROR" : "SCHEMA"}_${retry ? "RETRY" : "FAILED"}`,
          reason: modelFailed
            ? `A chamada ao modelo falhou na tentativa ${s.extractionAttempts}${retry ? "; nova tentativa" : ""}.`
            : `Leitura fora do formato na tentativa ${s.extractionAttempts}: ${errors.slice(0, 3).join("; ")}.`,
        };
    return { extraction, validationErrors: extraction ? [] : errors, decisions: [decision("validate_schema", { attempt: s.extractionAttempts }, r)] };
  });

  const extractionFailed = node("extraction_failed", async (s) => {
    await ports.saveDecisions(s.reportId, null, s.decisions);
    await ports.setReportStatus(s.reportId, "waiting");
    // An analyst has to read the report by hand; nothing invalid is saved as an incident.
    return { status: "pending_review" as const };
  });

  // --- Shared decision path ---------------------------------------------------
  const signals = node("detect_injection_signals", (s) => {
    const e = s.extraction!;
    const r = detectInjectionSignals([e.reason_text, ...e.visible_text_in_images, s.maskedText], s.source?.instrucoes_ignoradas ?? []);
    return { injectionSignals: r.result, decisions: [decision("detect_injection_signals", { texts: e.visible_text_in_images.length + 1 }, r)] };
  });

  const normalize = node("normalize", async (s) => ({ entities: await ports.normalize(s.extraction!, s.phone) }));

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
    // After a resume, the list comes from whoever attached the evidence.
    // What the extraction says is missing wins; the minimum-evidence rule fills in when it says nothing.
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
    const input = {
      extraction: s.extraction,
      cost: s.cost?.cost ?? 0,
      deliveryFound: s.delivery !== null,
      injectionSignals: s.injectionSignals,
      transcriptionTimedOut: s.transcriptionTimedOut,
    };
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
    await ports.saveDecisions(s.reportId, saved.incidentId, s.decisions);
    await ports.setReportStatus(s.reportId, s.status === "registered" ? "done" : "waiting");
    return { incidentId: saved.incidentId, caseId: saved.caseId };
  });

  const awaitEvidence = node("await_evidence", (s) => {
    const answer = interrupt<{ kind: "evidence"; missing: string[] }, EvidenceAnswer>({ kind: "evidence", missing: s.missingEvidence });
    return { missingEvidence: answer.stillMissing, status: null };
  });

  const awaitReview = node("await_review", (s) => {
    const answer = interrupt<{ kind: "review"; reasons: string[] }, ReviewAnswer>({ kind: "review", reasons: s.reviewReasons });
    const corrected = answer.action === "correct" ? { ...s.extraction!, ...answer.fields } : s.extraction!;
    const changed = answer.action === "correct" ? Object.keys(answer.fields).filter((k) => JSON.stringify(answer.fields[k as keyof typeof answer.fields]) !== JSON.stringify(s.extraction![k as keyof typeof s.extraction])) : [];
    return {
      extraction: corrected,
      reviewed: true,
      decisions: [
        decision("await_review", { reviewer: answer.reviewer }, {
          result: { action: answer.action, changed },
          rule: changed.length ? "HUMAN_CORRECTED" : "HUMAN_CONFIRMED",
          reason: changed.length ? `${answer.reviewer} corrigiu: ${changed.join(", ")}. NF, custo e pagador recalculados.` : `${answer.reviewer} confirmou o registro.`,
        }),
      ],
    };
  });

  return new StateGraph(IncidentState)
    .addNode(...fromEzworker)
    .addNode(...loadReport)
    .addNode(...awaitTranscriptions)
    .addNode(...maskNode)
    .addNode(...extract)
    .addNode(...validate)
    .addNode(...extractionFailed)
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
    .addConditionalEdges(START, (s) => (s.source ? "from_ezworker" : "load_report"), ["from_ezworker", "load_report"])
    .addEdge("from_ezworker", "mask_pii")
    .addEdge("load_report", "await_transcriptions")
    .addEdge("await_transcriptions", "mask_pii")
    .addConditionalEdges("mask_pii", (s) => (s.source ? "validate_schema" : "extract_multimodal"), ["validate_schema", "extract_multimodal"])
    .addEdge("extract_multimodal", "validate_schema")
    .addConditionalEdges(
      "validate_schema",
      (s) => (s.extraction ? "detect_injection_signals" : s.extractionAttempts < MAX_EXTRACTION_ATTEMPTS ? "extract_multimodal" : "extraction_failed"),
      ["detect_injection_signals", "extract_multimodal", "extraction_failed"],
    )
    .addEdge("extraction_failed", END)
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
