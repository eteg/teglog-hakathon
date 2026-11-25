// Converts the occurrence delivered by ezworker (Portuguese contract, lib/types.ts)
// into the graph's Extraction. The graph then validates it like any model output.
import type { Evidencia, OcorrenciaEzworker, TipoOcorrencia } from "@/lib/types";

import type { EvidenceKind, Extraction } from "./extraction-schema";

const TYPE: Record<TipoOcorrencia, Extraction["type"]> = {
  avaria: "damage",
  extravio: "loss",
  recusa: "refusal",
  reentrega: "redelivery",
  acidente: "accident",
  atraso: "delay",
};

const EVIDENCE: Partial<Record<Evidencia["tipo"], EvidenceKind>> = {
  foto_avaria: "damage_photo",
  foto_canhoto: "delivery_receipt",
  danfe: "invoice",
  etiqueta: "label",
  boletim_ocorrencia: "police_report",
};

const PACKAGING = new Set(["mau_acondicionamento", "embalagem_impropria", "embalagem_violada"]);
const LOADING = new Set(["carga_descarga", "avaria_descarga", "avaria_carga"]);

/** "São Paulo → Curitiba" or "Sao Paulo - Curitiba/PR" → city and UF of each end. */
export function splitRoute(route: string | undefined) {
  const parts = route?.split(/\s*(?:→|->|–|—| - )\s*/).filter(Boolean) ?? [];
  const end = (p?: string) => {
    if (!p) return { city: null, state: null };
    const [city, state] = p.split(/\s*[\/,]\s*/);
    return { city: city?.trim() || null, state: state?.trim().toUpperCase() || null };
  };
  return parts.length === 2 ? { origin: end(parts[0]), destination: end(parts[1]) } : { origin: end(), destination: end() };
}

const confidenceOf = (o: Omit<OcorrenciaEzworker, "local">, key: string) => o.confianca?.[key] ?? 1;

/** The location (`local`) is not part of the extraction; the map reads it from `casos`. */
export function ezworkerToExtraction(o: Omit<OcorrenciaEzworker, "local">): Extraction {
  const { origin, destination } = splitRoute(o.contexto?.rota);
  const reason = [o.resumo, o.transcricao].filter(Boolean).join("\n") || o.subtipo;
  return {
    type: TYPE[o.tipo],
    reason_text: reason,
    invoice_number: o.nf?.replace(/\D/g, "") || null,
    nfe_key: null,
    carrier_name: o.transportadora ?? null,
    carrier_cnpj: null,
    driver_name: o.contexto?.motorista ?? null,
    origin_city: origin.city,
    origin_state: origin.state,
    destination_city: destination.city,
    destination_state: destination.state,
    product: o.produto ?? null,
    affected_volumes: o.volumes_afetados ?? null,
    total_volumes: null,
    discrepancy_value: null,
    damage_visible_at_delivery: null,
    packaging_inadequate: o.tipo === "avaria" ? PACKAGING.has(o.subtipo) : null,
    during_loading_unloading: o.tipo === "avaria" ? LOADING.has(o.subtipo) : null,
    occurred_at: o.recebido_em ?? null,
    evidence: o.evidencias
      .filter((e) => e.tipo !== "texto" && e.tipo !== "audio_relato")
      .map((e, i) => ({ media_index: i, kind: EVIDENCE[e.tipo] ?? "other", legible: e.legivel })),
    visible_text_in_images: o.instrucoes_ignoradas ?? [],
    missing_evidence: o.faltando ?? [],
    confidence: {
      type: confidenceOf(o, "tipo"),
      invoice_number: confidenceOf(o, "nf"),
      carrier: confidenceOf(o, "transportadora"),
    },
  };
}
