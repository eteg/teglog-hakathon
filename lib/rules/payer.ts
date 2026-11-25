// Who pays (B18): claim deadline (Código Civil, art. 754), policy exclusions and deductible.
import type { Extraction } from "@/lib/ai/extraction-schema";
import type { EnrichedDelivery, PayerDecision } from "@/lib/graph/state";

import { HIDDEN_DAMAGE_CLAIM_DAYS } from "./config";
import { addDays, brl } from "./format";
import type { RuleResult } from "./types";

type PayerInput = {
  extraction: Pick<
    Extraction,
    "type" | "damage_visible_at_delivery" | "packaging_inadequate" | "during_loading_unloading"
  >;
  cost: number;
  delivery: EnrichedDelivery | null;
  /** When the report reached us (ISO). */
  reportedAt: string;
};

/** Types whose claim depends on the art. 754 protest. */
const CLAIM_TYPES = new Set(["damage", "loss", "discrepancy"]);

export function claimDeadline(input: PayerInput): string | null {
  if (!CLAIM_TYPES.has(input.extraction.type)) return null;
  const base = input.delivery?.deliveredAt ?? input.reportedAt;
  // Visible damage must be protested on delivery; hidden damage within 10 days.
  return input.extraction.damage_visible_at_delivery
    ? base.slice(0, 10)
    : addDays(base, HIDDEN_DAMAGE_CLAIM_DAYS);
}

export function decidePayer(input: PayerInput): RuleResult<PayerDecision> {
  const { extraction, cost, delivery } = input;
  const deadline = claimDeadline(input);
  const decide = (payer: PayerDecision["payer"], rule: string, reason: string) => ({
    result: { payer, claimDeadline: deadline },
    rule,
    reason,
  });

  if (deadline && input.reportedAt.slice(0, 10) > deadline) {
    return decide(
      "absorbed",
      "DEADLINE_MISSED",
      `Relato recebido depois do prazo de protesto (${deadline}); não há como cobrar.`,
    );
  }

  if (extraction.type === "refusal" || extraction.type === "redelivery" || extraction.type === "delay") {
    return decide("carrier", "DELIVERY_FAILURE", "Falha de entrega: custo atribuído à transportadora pelo contrato.");
  }

  if (extraction.packaging_inadequate) {
    return decide(
      "shipper",
      "RCTRC_PACKAGING_EXCLUSION",
      "Embalagem inadequada é excluída do RCTR-C; o custo é do embarcador.",
    );
  }

  const policy = delivery?.policy ?? null;
  if (extraction.during_loading_unloading && !policy?.coversLoadingUnloading) {
    return decide(
      "carrier",
      "LOADING_UNLOADING_NOT_COVERED",
      "Dano na carga/descarga e a apólice não tem essa cobertura adicional; cobrar a transportadora.",
    );
  }

  if (!policy) {
    return decide("carrier", "NO_POLICY", "Transporte sem apólice cadastrada; cobrar a transportadora.");
  }

  if (cost <= policy.deductible) {
    return decide(
      "carrier",
      "BELOW_DEDUCTIBLE",
      `Custo de ${brl(cost)} dentro da franquia de ${brl(policy.deductible)}; não compensa acionar o seguro.`,
    );
  }

  return decide(
    "insurer",
    "COVERED_ABOVE_DEDUCTIBLE",
    `Causa coberta e custo de ${brl(cost)} acima da franquia de ${brl(policy.deductible)}: acionar o RCTR-C; franquia cobrada da transportadora.`,
  );
}
