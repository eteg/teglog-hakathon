// F1 grid: GET /api/kpis/matrix?rows=route&cols=carrier + filters.
import { z } from "zod";

import { DIMENSIONS, KpiFiltersSchema } from "@/lib/queries/filters";
import { kpiMatrix } from "@/lib/queries/kpis";
import { noStore, parseQuery } from "@/lib/queries/params";

const Schema = KpiFiltersSchema.extend({
  rows: z.enum(DIMENSIONS).default("route"),
  cols: z.enum(DIMENSIONS).default("carrier"),
});

export async function GET(request: Request) {
  const q = parseQuery(Schema, request);
  if (!q.ok) return q.response;
  const { rows, cols, ...filters } = q.data;
  if (rows === cols) return Response.json({ error: "rows e cols precisam ser diferentes" }, { status: 400 });
  return Response.json(await kpiMatrix(rows, cols, filters), noStore);
}
