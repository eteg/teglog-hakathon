// Read-only incident detail for agents. Token: READ_API_TOKEN.
// The original case (raw driver text, names) is left out: agents get masked data only.
import { requireScope } from "@/lib/auth";
import { incidentDetail } from "@/lib/queries/incident-detail";
import { noStore } from "@/lib/queries/params";

export async function GET(request: Request, ctx: RouteContext<"/api/read/incidents/[number]">) {
  const denied = await requireScope(request, "read");
  if (denied) return denied;
  const { number } = await ctx.params;
  const detail = await incidentDetail(decodeURIComponent(number));
  if (!detail) return Response.json({ error: "não encontrada" }, { status: 404 });
  const { case: _case, ...masked } = detail;
  void _case;
  return Response.json({ ...masked, driver: masked.driver ? "[MOTORISTA]" : null }, noStore);
}
