// F3: GET /api/incidents/OC-1047 → fields, cost, payer, deadline, evidence, decision trail and graph state.
import { incidentDetail } from "@/lib/queries/incident-detail";
import { noStore } from "@/lib/queries/params";

export async function GET(_request: Request, ctx: RouteContext<"/api/incidents/[number]">) {
  const { number } = await ctx.params;
  const detail = await incidentDetail(decodeURIComponent(number));
  return detail ? Response.json(detail, noStore) : Response.json({ error: "não encontrada" }, { status: 404 });
}
