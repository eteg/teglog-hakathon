// F1 cards: total cost, cost per delivery, loss ratio, total risk cost (incidents + insurance), worst route.
import { KpiFiltersSchema } from "@/lib/queries/filters";
import { kpiSummary } from "@/lib/queries/kpis";
import { noStore, parseQuery } from "@/lib/queries/params";
import { exigir } from "@/lib/acesso";

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  const q = parseQuery(KpiFiltersSchema, request);
  if (!q.ok) return q.response;
  return Response.json(await kpiSummary(q.data), noStore);
}
