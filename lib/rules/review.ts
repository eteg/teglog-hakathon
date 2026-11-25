// When a human must review before the incident moves on (B15, quality criterion 8.3).
import type { Extraction } from "@/lib/ai/extraction-schema";
import { minConfidence } from "@/lib/ai/extraction-schema";

import { CONFIDENCE_THRESHOLD, REVIEW_VALUE_LIMIT } from "./config";
import { brl } from "./format";
import type { RuleResult } from "./types";

type ReviewInput = {
  extraction: Extraction | null;
  cost: number;
  deliveryFound: boolean;
  injectionSignals: readonly string[];
  transcriptionTimedOut: boolean;
};

export function decideReview(input: ReviewInput): RuleResult<{ needsReview: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  if (!input.extraction) {
    reasons.push("a leitura do relato falhou duas vezes");
  } else {
    const conf = minConfidence(input.extraction);
    if (conf < CONFIDENCE_THRESHOLD) reasons.push(`confiança da leitura em ${conf.toFixed(2)}, abaixo de ${CONFIDENCE_THRESHOLD}`);
  }
  if (input.cost > REVIEW_VALUE_LIMIT) reasons.push(`custo de ${brl(input.cost)} acima da alçada de ${brl(REVIEW_VALUE_LIMIT)}`);
  if (!input.deliveryFound) reasons.push("nota fiscal não encontrada na base de entregas");
  if (input.injectionSignals.length) reasons.push("o relato contém texto com cara de instrução");
  if (input.transcriptionTimedOut) reasons.push("a transcrição do áudio não chegou a tempo");

  return reasons.length
    ? { result: { needsReview: true, reasons }, rule: "REVIEW_REQUIRED", reason: `Revisão humana: ${reasons.join("; ")}.` }
    : { result: { needsReview: false, reasons }, rule: "REVIEW_NOT_REQUIRED", reason: "Dentro da alçada e com leitura confiável." };
}
