// F1 chart: GET /api/kpis/timeseries?dimension=route&granularity=week|month&metric=cost|incidentsPer1000|costPerDelivery&top=5
import { z } from "zod";

import { DIMENSIONS, KpiFiltersSchema } from "@/lib/queries/filters";
import { kpiTimeseries } from "@/lib/queries/kpis";
import { noStore, parseQuery } from "@/lib/queries/params";
import { exigir } from "@/lib/acesso";

const Schema = KpiFiltersSchema.extend({
  dimension: z.enum(DIMENSIONS).default("route"),
  granularity: z.enum(["week", "month"]).default("month"),
  metric: z.enum(["cost", "incidentsPer1000", "costPerDelivery"]).default("cost"),
  top: z.coerce.number().int().min(1).max(10).default(5),
});

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  const q = parseQuery(Schema, request);
  if (!q.ok) return q.response;
  const { dimension, granularity, metric, top, ...filters } = q.data;
  return Response.json(await kpiTimeseries(dimension, filters, { granularity, metric, top }), noStore);
}
