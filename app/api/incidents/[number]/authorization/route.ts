// A person authorizes or declines charging someone for an incident paused at await_authorization.
// POST { "decision": "authorize" | "decline", "reviewer": "Ana", "reason"?: "..." }
import { z } from "zod";

import { decideChargeFromCase } from "@/lib/graph/case-review";

const Body = z.object({
  decision: z.enum(["authorize", "decline"]),
  reviewer: z.string().trim().min(1).max(80),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/incidents/[number]/authorization">) {
  const { number } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "corpo inválido", details: parsed.error.issues }, { status: 400 });
  if (parsed.data.decision === "decline" && !parsed.data.reason) {
    return Response.json({ error: "informe o motivo para não autorizar" }, { status: 400 });
  }
  const run = await decideChargeFromCase(decodeURIComponent(number), parsed.data.decision, parsed.data.reviewer, parsed.data.reason);
  if (!run) return Response.json({ error: "esta ocorrência não está aguardando autorização de cobrança" }, { status: 409 });
  return Response.json({ number, status: run.state.status, authorization: run.state.billingAuthorization });
}
