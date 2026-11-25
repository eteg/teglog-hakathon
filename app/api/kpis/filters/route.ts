// F1 filter dropdowns: routes, carriers, drivers, hours and the period covered by the base.
import { kpiFilterOptions } from "@/lib/queries/kpis";
import { noStore } from "@/lib/queries/params";

export async function GET() {
  return Response.json(await kpiFilterOptions(), noStore);
}
