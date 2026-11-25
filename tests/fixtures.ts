import type { Extraction } from "@/lib/ai/extraction-schema";
import type { EnrichedDelivery } from "@/lib/graph/state";

export function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    type: "damage",
    reason_text: "Duas caixas de TV chegaram molhadas.",
    invoice_number: "123456",
    nfe_key: null,
    carrier_name: "Transportadora Beta",
    carrier_cnpj: null,
    origin_city: "São Paulo",
    origin_state: "SP",
    destination_city: "Curitiba",
    destination_state: "PR",
    product: "televisor",
    affected_volumes: 2,
    total_volumes: 10,
    discrepancy_value: null,
    damage_visible_at_delivery: true,
    packaging_inadequate: false,
    during_loading_unloading: false,
    occurred_at: null,
    evidence: [
      { media_index: 0, kind: "damage_photo", legible: true },
      { media_index: 1, kind: "label", legible: true },
    ],
    visible_text_in_images: [],
    missing_evidence: [],
    confidence: { type: 0.95, invoice_number: 0.9, carrier: 0.9 },
    ...overrides,
  };
}

export function delivery(overrides: Partial<EnrichedDelivery> = {}): EnrichedDelivery {
  return {
    deliveryId: 1,
    source: "delivery_base",
    invoiceNumber: "123456",
    invoiceValue: 20_000,
    volumes: 10,
    freightCost: 800,
    insuranceCost: 120,
    deliveredAt: "2026-11-20T14:10:00.000Z",
    policy: { deductible: 2_000, coversLoadingUnloading: false },
    ...overrides,
  };
}
