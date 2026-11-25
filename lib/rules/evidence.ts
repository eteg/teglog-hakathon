// Minimum evidence per incident type (decide_evidence).
import type { EvidenceKind, Extraction } from "@/lib/ai/extraction-schema";

import type { RuleResult } from "./types";

type Requirement = { anyOf: EvidenceKind[]; label: string };

const REQUIRED: Record<Extraction["type"], Requirement[]> = {
  damage: [
    { anyOf: ["damage_photo"], label: "foto do dano" },
    { anyOf: ["invoice", "label"], label: "foto da nota fiscal ou da etiqueta" },
  ],
  loss: [{ anyOf: ["invoice", "label"], label: "foto da nota fiscal ou da etiqueta" }],
  discrepancy: [{ anyOf: ["invoice"], label: "foto da nota fiscal" }],
  accident: [{ anyOf: ["damage_photo", "location"], label: "foto do local ou da carga" }],
  refusal: [],
  redelivery: [],
  delay: [],
};

/** Evidence still missing, as labels for the message to the driver. */
export function missingEvidence(extraction: Pick<Extraction, "type" | "evidence">): RuleResult<string[]> {
  const received = new Set(extraction.evidence.filter((e) => e.legible).map((e) => e.kind));
  const missing = REQUIRED[extraction.type]
    .filter((r) => !r.anyOf.some((k) => received.has(k)))
    .map((r) => r.label);
  return missing.length
    ? { result: missing, rule: "EVIDENCE_MISSING", reason: `Falta: ${missing.join("; ")}.` }
    : { result: [], rule: "EVIDENCE_OK", reason: "Evidências mínimas recebidas." };
}
