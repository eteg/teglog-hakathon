// Cost of an incident by type (B8). Defaults from docs/PLANO_DESENVOLVIMENTO.md, section 2.4.
import type { Extraction } from "@/lib/ai/extraction-schema";
import type { CostResult, EnrichedDelivery } from "@/lib/graph/state";

import { DISCREPANCY_FALLBACK_SHARE, REDELIVERY_FEE } from "./config";
import { brl } from "./format";
import type { RuleResult } from "./types";

const round = (v: number) => Math.round(v * 100) / 100;

export function calculateCost(
  extraction: Pick<Extraction, "type" | "affected_volumes" | "total_volumes" | "discrepancy_value">,
  delivery: EnrichedDelivery | null,
): RuleResult<CostResult> {
  if (!delivery) {
    const cost = extraction.discrepancy_value ?? 0;
    return {
      result: { cost, insuranceCost: 0, estimated: true },
      rule: "COST_NO_DELIVERY",
      reason: "Nota fiscal não encontrada na base de entregas; custo não pode ser calculado.",
    };
  }

  const total = delivery.volumes || extraction.total_volumes || 0;
  const affectedKnown = extraction.affected_volumes != null && total > 0;
  const share = affectedKnown ? Math.min(1, extraction.affected_volumes! / total) : 1;
  const insuranceCost = delivery.insuranceCost;
  const done = (cost: number, rule: string, reason: string, estimated = false): RuleResult<CostResult> => ({
    result: { cost: round(cost), insuranceCost, estimated },
    rule,
    reason: `${reason} Total: ${brl(round(cost))}.`,
  });

  switch (extraction.type) {
    case "damage":
      return done(
        (delivery.invoiceValue + delivery.freightCost) * share,
        "COST_DAMAGE",
        affectedKnown
          ? `Avaria em ${extraction.affected_volumes} de ${total} volumes: valor da NF e frete de retorno proporcionais.`
          : "Avaria sem número de volumes afetados: considerada a carga inteira.",
        !affectedKnown,
      );
    case "loss":
      return done(
        delivery.invoiceValue * share,
        "COST_LOSS",
        affectedKnown
          ? `Extravio de ${extraction.affected_volumes} de ${total} volumes: valor da NF proporcional.`
          : "Extravio sem número de volumes: considerada a carga inteira.",
        !affectedKnown,
      );
    case "refusal":
      return done(delivery.freightCost * 2, "COST_REFUSAL", "Recusa: frete de ida e de volta.");
    case "redelivery":
      return done(
        delivery.freightCost + REDELIVERY_FEE,
        "COST_REDELIVERY",
        `Reentrega: novo frete mais taxa fixa de ${brl(REDELIVERY_FEE)}.`,
      );
    case "discrepancy":
      return extraction.discrepancy_value != null
        ? done(extraction.discrepancy_value, "COST_DISCREPANCY", "Divergência: valor dos itens informado no relato.")
        : done(
            delivery.invoiceValue * DISCREPANCY_FALLBACK_SHARE,
            "COST_DISCREPANCY_ESTIMATED",
            `Divergência sem valor informado: estimada em ${DISCREPANCY_FALLBACK_SHARE * 100}% da NF.`,
            true,
          );
    case "accident":
      return done(delivery.invoiceValue, "COST_ACCIDENT", "Acidente: valor total da NF.");
  }
}
