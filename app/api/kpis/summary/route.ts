// F1 cards: total cost, cost per delivery, loss ratio, total risk cost (incidents + insurance), worst route.
import { KpiFiltersSchema } from "@/lib/queries/filters";
import { kpiSummary } from "@/lib/queries/kpis";
import { noStore, parseQuery } from "@/lib/queries/params";

export async function GET(request: Request) {
  const q = parseQuery(KpiFiltersSchema, request);
  if (!q.ok) return q.response;
  return Response.json(await kpiSummary(q.data), noStore);
}
