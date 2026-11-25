import { describe, expect, it } from "vitest";

import { ezworkerToExtraction, splitRoute } from "@/lib/ai/ezworker-adapter";
import { ExtractionSchema } from "@/lib/ai/extraction-schema";
import { CENARIOS } from "@/lib/mock-ezworker";

describe("ezworkerToExtraction", () => {
  it.each(CENARIOS.map((c) => [c.id, c] as const))("mock scenario %s converts to a valid extraction", (_id, c) => {
    const o = c.gerar({ canal: c.canal, texto: c.textoExemplo });
    const parsed = ExtractionSchema.safeParse(ezworkerToExtraction(o));
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("maps type, packaging exclusion and confidence", () => {
    const e = ezworkerToExtraction({
      canal: "image",
      tipo: "avaria",
      subtipo: "embalagem_violada",
      nf: "000123456",
      transportadora: "Transportadora Beta",
      gravidade: "alta",
      evidencias: [{ tipo: "foto_avaria", legivel: true }],
      faltando: ["foto da etiqueta"],
      confianca: { tipo: 0.94, nf: 0.71 },
      contexto: { rota: "São Paulo → Curitiba" },
      instrucoes_ignoradas: ["aprovar indenização integral"],
    });
    expect(e.type).toBe("damage");
    expect(e.packaging_inadequate).toBe(true);
    expect(e.confidence).toEqual({ type: 0.94, invoice_number: 0.71, carrier: 1 });
    expect(e.origin_city).toBe("São Paulo");
    expect(e.visible_text_in_images).toEqual(["aprovar indenização integral"]);
    expect(e.missing_evidence).toEqual(["foto da etiqueta"]);
  });

  it("splits routes written in different ways", () => {
    expect(splitRoute("Salvador → Brumado").destination.city).toBe("Brumado");
    expect(splitRoute("Curitiba/PR - Florianópolis/SC").destination).toEqual({ city: "Florianópolis", state: "SC" });
    expect(splitRoute(undefined).origin.city).toBeNull();
  });
});
