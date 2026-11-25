import { describe, expect, it } from "vitest";

import { decidePayer } from "@/lib/rules/payer";
import { delivery, extraction } from "../fixtures";

const onDeliveryDay = "2026-11-20T14:15:00.000Z";

describe("decidePayer", () => {
  it.each([
    // description, extraction overrides, cost, delivery overrides, reportedAt, payer, rule
    ["covered damage above deductible", {}, 4_160, {}, onDeliveryDay, "insurer", "COVERED_ABOVE_DEDUCTIBLE"],
    ["damage within deductible", {}, 1_500, {}, onDeliveryDay, "carrier", "BELOW_DEDUCTIBLE"],
    ["inadequate packaging", { packaging_inadequate: true }, 4_160, {}, onDeliveryDay, "shipper", "RCTRC_PACKAGING_EXCLUSION"],
    [
      "loading damage without extra coverage",
      { during_loading_unloading: true },
      4_160,
      {},
      onDeliveryDay,
      "carrier",
      "LOADING_UNLOADING_NOT_COVERED",
    ],
    [
      "loading damage with extra coverage",
      { during_loading_unloading: true },
      4_160,
      { policy: { deductible: 2_000, coversLoadingUnloading: true } },
      onDeliveryDay,
      "insurer",
      "COVERED_ABOVE_DEDUCTIBLE",
    ],
    ["no policy", {}, 4_160, { policy: null }, onDeliveryDay, "carrier", "NO_POLICY"],
    ["visible damage reported the next day", {}, 4_160, {}, "2026-11-21T09:00:00.000Z", "absorbed", "DEADLINE_MISSED"],
    [
      "hidden damage within 10 days",
      { damage_visible_at_delivery: false },
      4_160,
      {},
      "2026-11-29T09:00:00.000Z",
      "insurer",
      "COVERED_ABOVE_DEDUCTIBLE",
    ],
    [
      "hidden damage after 10 days",
      { damage_visible_at_delivery: false },
      4_160,
      {},
      "2026-12-01T09:00:00.000Z",
      "absorbed",
      "DEADLINE_MISSED",
    ],
    ["refusal", { type: "refusal" }, 1_600, {}, onDeliveryDay, "carrier", "DELIVERY_FAILURE"],
    ["redelivery", { type: "redelivery" }, 850, {}, onDeliveryDay, "carrier", "DELIVERY_FAILURE"],
  ] as const)("%s → %s", (_desc, ext, cost, del, reportedAt, payer, rule) => {
    const r = decidePayer({ extraction: extraction(ext), cost, delivery: delivery(del), reportedAt });
    expect(r.result.payer).toBe(payer);
    expect(r.rule).toBe(rule);
  });

  it("claim deadline: visible damage = delivery day, hidden = +10 days, refusal = none", () => {
    const base = { cost: 100, delivery: delivery(), reportedAt: onDeliveryDay };
    expect(decidePayer({ ...base, extraction: extraction() }).result.claimDeadline).toBe("2026-11-20");
    expect(
      decidePayer({ ...base, extraction: extraction({ damage_visible_at_delivery: false }) }).result.claimDeadline,
    ).toBe("2026-11-30");
    expect(decidePayer({ ...base, extraction: extraction({ type: "refusal" }) }).result.claimDeadline).toBeNull();
  });
});
