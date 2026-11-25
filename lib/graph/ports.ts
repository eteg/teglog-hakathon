// Everything the incident graph needs from the outside world. Production: d1-ports.ts.
// Tests: in-memory fakes. Keeps the graph free of Cloudflare.
import type { Extraction } from "@/lib/ai/extraction-schema";

import type { Decision, EnrichedDelivery, IncidentStateType, NormalizedEntities } from "./state";

export interface IncidentPorts {
  normalize(extraction: Extraction): Promise<NormalizedEntities>;
  findDelivery(extraction: Extraction): Promise<EnrichedDelivery | null>;
  /** Insert on the first call, update afterwards. Also mirrors the incident into `casos`. */
  saveIncident(state: IncidentStateType): Promise<{ incidentId: number; caseId: string | null }>;
  saveDecisions(threadId: string, incidentId: number | null, decisions: Decision[]): Promise<void>;
}
