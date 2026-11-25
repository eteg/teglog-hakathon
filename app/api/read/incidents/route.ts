// Read-only incident list for agents. Token: READ_API_TOKEN. Free text is already masked.
import { z } from "zod";

import { INCIDENT_STATUSES, INCIDENT_TYPES } from "@/db/schema";
import { requireScope } from "@/lib/auth";
import { listIncidents } from "@/lib/queries/incidents";
import { noStore, parseQuery } from "@/lib/queries/params";

const Schema = z.object({
  status: z.enum(INCIDENT_STATUSES).optional(),
  type: z.enum(INCIDENT_TYPES).optional(),
  route: z.coerce.number().int().positive().optional(),
  carrier: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(request: Request) {
  const denied = await requireScope(request, "read");
  if (denied) return denied;
  const q = parseQuery(Schema, request);
  if (!q.ok) return q.response;
  const { route, carrier, ...rest } = q.data;
  return Response.json(await listIncidents({ ...rest, routeId: route, carrierId: carrier }), noStore);
}
