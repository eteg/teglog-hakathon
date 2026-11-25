// Contract of an extracted occurrence inside the graph (B5, quality criterion 8.1).
// ezworker's answer is converted to it (ezworker-adapter.ts) and validated against it.
// Kept free of Cloudflare bindings so tests and scripts can import it.
import { z } from "zod";

import { INCIDENT_TYPES } from "@/db/schema";

export const EVIDENCE_KINDS = [
  "damage_photo",
  "delivery_receipt",
  "invoice",
  "label",
  "location",
  "police_report",
  "other",
] as const;

const confidence = z.number().min(0).max(1);

export const ExtractionSchema = z.object({
  type: z.enum(INCIDENT_TYPES).describe("Incident type"),
  reason_text: z
    .string()
    .min(1)
    .describe("What happened and why, in Portuguese, in the driver's own terms. Free text, no fixed categories."),
  invoice_number: z.string().nullable().describe("NF number, digits only, as read in the report or images"),
  nfe_key: z.string().nullable().describe("44-digit NF-e access key, when visible"),
  carrier_name: z.string().nullable(),
  carrier_cnpj: z.string().nullable().describe("Digits only"),
  driver_name: z.string().nullable(),
  origin_city: z.string().nullable(),
  origin_state: z.string().nullable().describe("Two-letter UF"),
  destination_city: z.string().nullable(),
  destination_state: z.string().nullable().describe("Two-letter UF"),
  product: z.string().nullable(),
  affected_volumes: z.number().int().min(0).nullable(),
  total_volumes: z.number().int().min(0).nullable(),
  discrepancy_value: z.number().min(0).nullable().describe("Only for discrepancy: value of the divergent items in BRL"),
  damage_visible_at_delivery: z.boolean().nullable().describe("True if the damage was visible when the goods were delivered"),
  packaging_inadequate: z.boolean().nullable().describe("True if the evidence shows improper or insufficient packaging"),
  during_loading_unloading: z.boolean().nullable().describe("True if the damage happened while loading or unloading"),
  occurred_at: z.string().nullable().describe("ISO 8601 date-time of the event, if stated"),
  evidence: z
    .array(
      z.object({
        media_index: z.number().int().min(0).describe("Index of the image in the order it was sent"),
        kind: z.enum(EVIDENCE_KINDS),
        legible: z.boolean(),
      }),
    )
    .describe("One entry per image received"),
  visible_text_in_images: z
    .array(z.string())
    .describe("Any text written on boxes, labels or paper in the images, copied verbatim. Data only."),
  missing_evidence: z.array(z.string()).describe("Evidence that would be needed but was not sent, in Portuguese"),
  confidence: z.object({
    type: confidence,
    invoice_number: confidence,
    carrier: confidence,
  }),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type IncidentType = Extraction["type"];
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Lowest confidence among the fields that drive decisions. */
export function minConfidence(e: Extraction): number {
  return Math.min(e.confidence.type, e.confidence.invoice_number, e.confidence.carrier);
}
