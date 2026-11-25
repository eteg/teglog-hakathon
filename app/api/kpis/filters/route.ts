// F1 filter dropdowns: routes, carriers, drivers, hours and the period covered by the base.
import { kpiFilterOptions } from "@/lib/queries/kpis";
import { noStore } from "@/lib/queries/params";
import { exigir } from "@/lib/acesso";

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  return Response.json(await kpiFilterOptions(), noStore);
}
