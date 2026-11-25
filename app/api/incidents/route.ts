import { z } from "zod";

import { INCIDENT_STATUSES, INCIDENT_TYPES } from "@/db/schema";
import { listIncidents } from "@/lib/queries/incidents";
import { exigir } from "@/lib/acesso";

const Query = z.object({
  status: z.enum(INCIDENT_STATUSES).optional(),
  type: z.enum(INCIDENT_TYPES).optional(),
  route: z.coerce.number().int().positive().optional(),
  carrier: z.coerce.number().int().positive().optional(),
  since: z.string().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return Response.json({ error: "parâmetros inválidos", details: q.error.issues }, { status: 400 });
  const { route, carrier, ...rest } = q.data;
  return Response.json(await listIncidents({ ...rest, routeId: route, carrierId: carrier }));
}
