// Read-only mirror of the KPIs for agents (MCP, manager questions). Token: READ_API_TOKEN.
// GET /api/read/kpis?view=summary|ranking|timeseries&dimension=route + the F1 filters.
import { z } from "zod";

import { requireScope } from "@/lib/auth";
import { DIMENSIONS, KpiFiltersSchema } from "@/lib/queries/filters";
import { kpiRanking, kpiSummary, kpiTimeseries } from "@/lib/queries/kpis";
import { noStore, parseQuery } from "@/lib/queries/params";

const Schema = KpiFiltersSchema.extend({
  view: z.enum(["summary", "ranking", "timeseries"]).default("summary"),
  dimension: z.enum(DIMENSIONS).default("route"),
  metric: z.enum(["cost", "incidentsPer1000", "costPerDelivery"]).default("cost"),
  granularity: z.enum(["week", "month"]).default("month"),
});

export async function GET(request: Request) {
  const denied = await requireScope(request, "read");
  if (denied) return denied;
  const q = parseQuery(Schema, request);
  if (!q.ok) return q.response;
  const { view, dimension, metric, granularity, ...filters } = q.data;
  if (view === "summary") return Response.json(await kpiSummary(filters), noStore);
  if (view === "ranking") return Response.json({ dimension, rows: await kpiRanking(dimension, filters) }, noStore);
  return Response.json(await kpiTimeseries(dimension, filters, { granularity, metric, top: 5 }), noStore);
}
