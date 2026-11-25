import { describe, expect, it } from "vitest";

import { countLeaks, measureMasking } from "@/lib/quality/pii";

describe("masking measurement", () => {
  it("counts masked samples and items", () => {
    const m = measureMasking(["CPF 529.982.247-25, placa ABC1D23", "fone (11) 98765-4321", "sem dado pessoal"]);
    expect(m).toMatchObject({ samples: 3, itemsMasked: 3, samplesFullyMasked: 2 });
  });

  it("counts leaks in stored text", () => {
    expect(countLeaks(["motorista [CPF_1]", "CPF 529.982.247-25", null])).toBe(1);
  });
});
