import { describe, expect, it } from "vitest";

import { calculateCost } from "@/lib/rules/cost";
import { delivery, extraction } from "../fixtures";

describe("calculateCost", () => {
  it.each([
    // type, affected, total in extraction, discrepancy value, expected cost, rule, estimated
    ["damage", 2, 10, null, 4_160, "COST_DAMAGE", false],
    ["damage", null, null, null, 20_800, "COST_DAMAGE", true],
    ["loss", 5, 10, null, 10_000, "COST_LOSS", false],
    ["refusal", null, null, null, 1_600, "COST_REFUSAL", false],
    ["redelivery", null, null, null, 850, "COST_REDELIVERY", false],
    ["discrepancy", null, null, 350, 350, "COST_DISCREPANCY", false],
    ["discrepancy", null, null, null, 2_000, "COST_DISCREPANCY_ESTIMATED", true],
    ["accident", null, null, null, 20_000, "COST_ACCIDENT", false],
  ] as const)("%s, %s/%s volumes → R$ %s", (type, affected, total, discrepancy, cost, rule, estimated) => {
    const r = calculateCost(
      extraction({ type, affected_volumes: affected, total_volumes: total, discrepancy_value: discrepancy }),
      delivery(),
    );
    expect(r.result.cost).toBe(cost);
    expect(r.result.estimated).toBe(estimated);
    expect(r.result.insuranceCost).toBe(120);
    expect(r.rule).toBe(rule);
  });

  it("without a delivery the cost is estimated and flagged", () => {
    const r = calculateCost(extraction(), null);
    expect(r.rule).toBe("COST_NO_DELIVERY");
    expect(r.result.estimated).toBe(true);
  });
});
