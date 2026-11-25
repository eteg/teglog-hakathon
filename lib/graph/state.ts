// State of the incident graph (docs/PLANO_DESENVOLVIMENTO.md, section 2.2).
import { Annotation } from "@langchain/langgraph";

import type { INCIDENT_STATUSES, PAYERS } from "@/db/schema";
import type { Extraction } from "@/lib/ai/extraction-schema";
import type { PiiMap } from "@/lib/pii";
import type { OcorrenciaEzworker } from "@/lib/types";

export type { PiiMap };
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type Payer = (typeof PAYERS)[number];

export type NormalizedEntities = {
  carrierId: number | null;
  routeId: number | null;
  driverId: number | null;
};

export type EnrichedDelivery = {
  /** Null when the invoice is not in the delivery base and the values came from the report context. */
  deliveryId: number | null;
  source: "delivery_base" | "report_context";
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

/** Value sent to Command({ resume }) when the analyst acts on a paused incident. */
export type ReviewAnswer =
  | { action: "confirm"; reviewer: string }
  | { action: "correct"; reviewer: string; fields: Partial<Extraction> };

/** Value sent to Command({ resume }) when evidence arrives for an incident waiting for it. */
export type EvidenceAnswer = { action: "evidence_received"; stillMissing: string[] };

const replace = <T>(fallback: () => T) => Annotation<T>({ reducer: (_, next) => next, default: fallback });
const append = <T>() => Annotation<T[]>({ reducer: (a, b) => a.concat(b), default: () => [] });

export const IncidentState = Annotation.Root({
  threadId: Annotation<string>(),
  /** Occurrence delivered by ezworker (already extracted from audio, photo and text). */
  source: replace<OcorrenciaEzworker | null>(() => null),
  /** When the occurrence reached us (ISO); used for the claim deadline. */
  reportedAt: replace<string>(() => ""),
  /** Free text of the occurrence, after mask_pii. */
  maskedText: replace<string>(() => ""),
  piiMap: replace<PiiMap>(() => ({})),
  /** ezworker answer converted to Extraction, before validate_schema. */
  rawExtraction: replace<string | null>(() => null),
  extraction: replace<Extraction | null>(() => null),
  validationErrors: replace<string[]>(() => []),
  injectionSignals: replace<string[]>(() => []),
  entities: replace<NormalizedEntities | null>(() => null),
  delivery: replace<EnrichedDelivery | null>(() => null),
  evidenceRequested: replace<boolean>(() => false),
  missingEvidence: replace<string[]>(() => []),
  cost: replace<CostResult | null>(() => null),
  payer: replace<PayerDecision | null>(() => null),
  reviewReasons: replace<string[]>(() => []),
  /** Set once a human confirmed or corrected the incident. */
  reviewed: replace<boolean>(() => false),
  status: replace<IncidentStatus | null>(() => null),
  incidentId: replace<number | null>(() => null),
  /** Id of the row in `casos` (first version of the app) mirrored from this incident. */
  caseId: replace<string | null>(() => null),
  /** Audit trail: each decision node appends one entry. */
  decisions: append<Decision>(),
});

export type IncidentStateType = typeof IncidentState.State;
export type IncidentStateUpdate = typeof IncidentState.Update;
