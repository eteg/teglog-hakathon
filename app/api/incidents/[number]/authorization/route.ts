// A person authorizes or declines charging someone for an incident paused at await_authorization.
// POST { "decision": "authorize" | "decline", "reason"?: "..." } (+ "reviewer" só para chamadas com chave de API)
// Ação crítica: exige analista. Com login, quem autorizou é o usuário da sessão (não dá para forjar pelo corpo).
import { z } from "zod";

import { exigir } from "@/lib/acesso";
import { decideChargeFromCase } from "@/lib/graph/case-review";
import { sessaoDaRequisicao } from "@/lib/sessao";

const Body = z.object({
  decision: z.enum(["authorize", "decline"]),
  reviewer: z.string().trim().min(1).max(80).optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/incidents/[number]/authorization">) {
  const negado = await exigir(request, "escrever");
  if (negado) return negado;
  const { number } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "corpo inválido", details: parsed.error.issues }, { status: 400 });
  if (parsed.data.decision === "decline" && !parsed.data.reason) {
    return Response.json({ error: "informe o motivo para não autorizar" }, { status: 400 });
  }
  const reviewer = (await sessaoDaRequisicao(request))?.sub ?? parsed.data.reviewer;
  if (!reviewer) return Response.json({ error: "informe quem está decidindo (reviewer)" }, { status: 400 });
  const run = await decideChargeFromCase(decodeURIComponent(number), parsed.data.decision, reviewer, parsed.data.reason);
  if (!run) return Response.json({ error: "esta ocorrência não está aguardando autorização de cobrança" }, { status: 409 });
  return Response.json({ number, status: run.state.status, authorization: run.state.billingAuthorization });
}
