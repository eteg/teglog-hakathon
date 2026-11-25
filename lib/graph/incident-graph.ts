// The incident graph (B3). Nodes only orchestrate: decisions come from lib/rules,
// outside access from IncidentPorts. See docs/PLANO_DESENVOLVIMENTO.md, section 2.
import { END, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import { ExtractionSchema } from "@/lib/ai/extraction-schema";
import { MAX_EXTRACTION_ATTEMPTS } from "@/lib/rules/config";
import { calculateCost } from "@/lib/rules/cost";
import { decidePayer } from "@/lib/rules/payer";
import type { RuleResult } from "@/lib/rules/types";

import type { IncidentPorts } from "./ports";
import { type Decision, IncidentState, type IncidentStateType, type ReportMessage } from "./state";

type Node = (state: IncidentStateType) => Promise<Partial<IncidentStateType>> | Partial<IncidentStateType>;
export type NodeWrapper = (name: string, fn: Node) => Node;

function decision(node: string, input: unknown, r: RuleResult<unknown>): Decision {
  return { node, rule: r.rule, input, output: r.result, reason: r.reason, at: new Date().toISOString() };
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

export function buildIncidentGraph(
  ports: IncidentPorts,
  checkpointer: BaseCheckpointSaver,
  wrap: NodeWrapper = (_name, fn) => fn,
) {
  const node = (name: string, fn: Node) => [name, wrap(name, fn)] as const;

  const loadReport = node("load_report", async (s) => {
    const r = await ports.loadReport(s.reportId);
    await ports.setReportStatus(s.reportId, "processing");
    return { phone: r.phone, reportedAt: r.openedAt, messages: r.messages };
  });

  // T17 adds masking here; for now it only assembles the text.
  const maskPii = node("mask_pii", (s) => ({ maskedText: reportText(s.messages), piiMap: {} }));

  const extract = node("extract_multimodal", async (s) => {
    const attempt = s.extractionAttempts + 1;
    const images = await ports.loadImages(s.messages);
    const r = await ports.extract({
      reportId: s.reportId,
      attempt,
      text: s.maskedText,
      images,
      previousErrors: s.validationErrors,
    });
    return {
      extractionAttempts: attempt,
      rawExtraction: r.rawText,
      lastModelCallId: r.callId,
      validationErrors: r.error ? [r.error] : [],
    };
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
    await ports.recordSchemaResult(s.lastModelCallId, extraction !== null);
    const modelFailed = s.rawExtraction === null;
    const retry = s.extractionAttempts < MAX_EXTRACTION_ATTEMPTS;
    const r: RuleResult<unknown> = extraction
      ? { result: { valid: true, attempt: s.extractionAttempts }, rule: "SCHEMA_VALID", reason: `Leitura válida na tentativa ${s.extractionAttempts}.` }
      : {
          result: { valid: false, attempt: s.extractionAttempts, errors },
          rule: `${modelFailed ? "MODEL_ERROR" : "SCHEMA"}_${retry ? "RETRY" : "FAILED"}`,
          reason: modelFailed
            ? `A chamada ao modelo falhou na tentativa ${s.extractionAttempts}${retry ? "; nova tentativa" : ""}.`
            : `Leitura fora do formato na tentativa ${s.extractionAttempts}: ${errors.slice(0, 3).join("; ")}.`,
        };
    return {
      extraction,
      validationErrors: extraction ? [] : errors,
      decisions: [decision("validate_schema", { attempt: s.extractionAttempts }, r)],
    };
  });

  const normalize = node("normalize", async (s) => ({ entities: await ports.normalize(s.extraction!, s.phone) }));

  const enrich = node("enrich", async (s) => ({ delivery: await ports.findDelivery(s.extraction!) }));

  const cost = node("calculate_cost", (s) => {
    const r = calculateCost(s.extraction!, s.delivery);
    return { cost: r.result, decisions: [decision("calculate_cost", { type: s.extraction!.type, invoice: s.delivery?.invoiceNumber ?? null }, r)] };
  });

  const payer = node("decide_payer", (s) => {
    const input = { extraction: s.extraction!, cost: s.cost!.cost, delivery: s.delivery, reportedAt: s.reportedAt };
    const r = decidePayer(input);
    return {
      payer: r.result,
      decisions: [decision("decide_payer", { type: input.extraction.type, cost: input.cost, policy: s.delivery?.policy ?? null }, r)],
    };
  });

  const save = node("save_incident", async (s) => {
    // Second barrier (8.1): nothing invalid reaches the database.
    ExtractionSchema.parse(s.extraction);
    const status = "registered" as const;
    const incidentId = await ports.saveIncident({ ...s, status });
    await ports.saveDecisions(s.reportId, incidentId, s.decisions);
    await ports.setReportStatus(s.reportId, "done");
    return { incidentId, status };
  });

  // T16 replaces this with decide_review + interrupt().
  const failed = node("extraction_failed", async (s) => {
    await ports.saveDecisions(s.reportId, null, s.decisions);
    await ports.setReportStatus(s.reportId, "waiting");
    return { status: "pending_review" as const };
  });

  return new StateGraph(IncidentState)
    .addNode(...loadReport)
    .addNode(...maskPii)
    .addNode(...extract)
    .addNode(...validate)
    .addNode(...normalize)
    .addNode(...enrich)
    .addNode(...cost)
    .addNode(...payer)
    .addNode(...save)
    .addNode(...failed)
    .addEdge(START, "load_report")
    .addEdge("load_report", "mask_pii")
    .addEdge("mask_pii", "extract_multimodal")
    .addEdge("extract_multimodal", "validate_schema")
    .addConditionalEdges(
      "validate_schema",
      (s) => (s.extraction ? "normalize" : s.extractionAttempts < MAX_EXTRACTION_ATTEMPTS ? "extract_multimodal" : "extraction_failed"),
      ["normalize", "extract_multimodal", "extraction_failed"],
    )
    .addEdge("normalize", "enrich")
    .addEdge("enrich", "calculate_cost")
    .addEdge("calculate_cost", "decide_payer")
    .addEdge("decide_payer", "save_incident")
    .addEdge("save_incident", END)
    .addEdge("extraction_failed", END)
    .compile({ checkpointer });
}

