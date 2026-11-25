import { z } from "zod";

import { INCIDENT_TYPES } from "@/db/schema";
import { DIMENSIONS, kpis } from "@/lib/queries/kpis";

const Query = z.object({
  dimension: z.enum(Object.keys(DIMENSIONS) as [keyof typeof DIMENSIONS]).default("route"),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: z.enum(INCIDENT_TYPES).optional(),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const q = Query.safeParse(params);
  if (!q.success) return Response.json({ error: "parâmetros inválidos", details: q.error.issues }, { status: 400 });
  return Response.json(await kpis(q.data));
}
