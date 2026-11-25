// State of the incident graph (docs/PLANO_DESENVOLVIMENTO.md, section 2.2).
import { Annotation } from "@langchain/langgraph";

import type { INCIDENT_STATUSES, MESSAGE_KINDS, PAYERS } from "@/db/schema";
import type { Extraction } from "@/lib/ai/extraction-schema";

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type Payer = (typeof PAYERS)[number];

export type ReportMessage = {
  id: number;
  kind: (typeof MESSAGE_KINDS)[number];
  text: string | null;
  mediaKey: string | null;
  mediaSha256: string | null;
  receivedAt: string;
  transcript: string | null;
  transcriptStatus: "pending" | "received" | "failed" | null;
};

/** Placeholder → original value, so masked data can be restored when saving (8.6). */
export type PiiMap = Record<string, string>;

export type NormalizedEntities = {
  carrierId: number | null;
  routeId: number | null;
  driverId: number | null;
};

export type EnrichedDelivery = {
  deliveryId: number;
  invoiceNumber: string;
  invoiceValue: number;
  volumes: number;
  freightCost: number;
  insuranceCost: number;
  deliveredAt: string | null;
  policy: {
    deductible: number;
    coversLoadingUnloading: boolean;
  } | null;
};

export type CostResult = {
  cost: number;
  insuranceCost: number;
  estimated: boolean;
};

export type PayerDecision = {
  payer: Payer;
  claimDeadline: string | null;
};

/** One entry per decision node; stored in `decisions` and shown on F3. */
export type Decision = {
  node: string;
  rule: string;
  input: unknown;
  output: unknown;
  /** Short reason in Portuguese, read by the analyst. */
  reason: string;
  at: string;
};

export type ReviewAnswer =
  | { action: "confirm"; reviewer: string }
  | { action: "correct"; reviewer: string; fields: Partial<Extraction> };

const replace = <T>(fallback: () => T) => Annotation<T>({ reducer: (_, next) => next, default: fallback });
const append = <T>() => Annotation<T[]>({ reducer: (a, b) => a.concat(b), default: () => [] });

export const IncidentState = Annotation.Root({
  reportId: Annotation<string>(),
  messages: replace<ReportMessage[]>(() => []),
  /** Text sent to the model, after mask_pii. */
  maskedText: replace<string>(() => ""),
  piiMap: replace<PiiMap>(() => ({})),
  extraction: replace<Extraction | null>(() => null),
  extractionAttempts: replace<number>(() => 0),
  validationErrors: replace<string[]>(() => []),
  injectionSignals: replace<string[]>(() => []),
  transcriptionTimedOut: replace<boolean>(() => false),
  entities: replace<NormalizedEntities | null>(() => null),
  delivery: replace<EnrichedDelivery | null>(() => null),
  evidenceRequested: replace<boolean>(() => false),
  cost: replace<CostResult | null>(() => null),
  payer: replace<PayerDecision | null>(() => null),
  status: replace<IncidentStatus | null>(() => null),
  incidentId: replace<number | null>(() => null),
  /** Audit trail: each decision node appends one entry. */
  decisions: append<Decision>(),
});

export type IncidentStateType = typeof IncidentState.State;
export type IncidentStateUpdate = typeof IncidentState.Update;
