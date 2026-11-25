import { describe, expect, it } from "vitest";

import { missingEvidence } from "@/lib/rules/evidence";
import { decideReview } from "@/lib/rules/review";
import { extraction } from "../fixtures";

describe("missingEvidence", () => {
  it("damage with photo and label has nothing missing", () => {
    expect(missingEvidence(extraction()).result).toEqual([]);
  });

  it("damage without label or invoice asks for it", () => {
    const r = missingEvidence(extraction({ evidence: [{ media_index: 0, kind: "damage_photo", legible: true }] }));
    expect(r.result).toEqual(["foto da nota fiscal ou da etiqueta"]);
    expect(r.rule).toBe("EVIDENCE_MISSING");
  });

  it("an illegible photo does not count", () => {
    const r = missingEvidence(
      extraction({
        evidence: [
          { media_index: 0, kind: "damage_photo", legible: false },
          { media_index: 1, kind: "label", legible: true },
        ],
      }),
    );
    expect(r.result).toEqual(["foto do dano"]);
  });

  it("refusal needs no photo", () => {
    expect(missingEvidence(extraction({ type: "refusal", evidence: [] })).result).toEqual([]);
  });
});

describe("decideReview", () => {
  const base = { extraction: extraction(), cost: 4_160, deliveryFound: true, injectionSignals: [] };

  it.each([
    ["clean case", {}, false],
    ["cost above the limit", { cost: 18_450 }, true],
    ["low confidence", { extraction: extraction({ confidence: { type: 0.95, invoice_number: 0.5, carrier: 0.9 } }) }, true],
    ["invalid occurrence", { extraction: null }, true],
    ["invoice not found", { deliveryFound: false }, true],
    ["injection signal", { injectionSignals: ["aprovar indenização integral"] }, true],
  ] as const)("%s → review %s", (_desc, overrides, expected) => {
    expect(decideReview({ ...base, ...overrides }).result.needsReview).toBe(expected);
  });
});
