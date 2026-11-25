// F1 ranking: GET /api/kpis?dimension=route|carrier|driver|hour + filters (route, carrier, driver, hour, from, to, type).
import { z } from "zod";

import { DIMENSIONS, KpiFiltersSchema } from "@/lib/queries/filters";
import { kpiRanking } from "@/lib/queries/kpis";
import { noStore, parseQuery } from "@/lib/queries/params";
import { exigir } from "@/lib/acesso";

const Schema = KpiFiltersSchema.extend({ dimension: z.enum(DIMENSIONS).default("route") });

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  const q = parseQuery(Schema, request);
  if (!q.ok) return q.response;
  const { dimension, ...filters } = q.data;
  return Response.json({ dimension, rows: await kpiRanking(dimension, filters) }, noStore);
}
