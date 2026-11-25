// Everything the incident graph needs from the outside world. Production: d1-ports.ts.
// Tests: in-memory fakes. Keeps the graph free of Cloudflare and of the model client.
import type { Extraction } from "@/lib/ai/extraction-schema";

import type { Decision, EnrichedDelivery, IncidentStateType, NormalizedEntities, ReportMessage } from "./state";

export type ExtractionRequest = {
  reportId: string;
  attempt: number;
  /** Masked text of the report (texts + transcripts). */
  text: string;
  images: { mediaType: string; base64: string }[];
  /** Errors of the previous attempt, so the model can fix them. */
  previousErrors: string[];
};

export interface IncidentPorts {
  loadReport(reportId: string): Promise<{ phone: string; openedAt: string; messages: ReportMessage[] }>;
  loadImages(messages: ReportMessage[]): Promise<{ mediaType: string; base64: string }[]>;
  extract(request: ExtractionRequest): Promise<{ rawText: string | null; error: string | null; callId: number | null }>;
  recordSchemaResult(callId: number | null, valid: boolean): Promise<void>;
  normalize(extraction: Extraction, phone: string): Promise<NormalizedEntities>;
  findDelivery(extraction: Extraction): Promise<EnrichedDelivery | null>;
  saveIncident(state: IncidentStateType): Promise<number>;
  saveDecisions(reportId: string, incidentId: number | null, decisions: Decision[]): Promise<void>;
  setReportStatus(reportId: string, status: "processing" | "waiting" | "done"): Promise<void>;
}
