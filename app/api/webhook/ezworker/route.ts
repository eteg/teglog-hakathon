// Webhook chamado pelo ezworker com a ocorrência já processada
// (mesmo formato para /audio, /image, /text).
import { runIncidentFromEzworker } from "@/lib/graph/run";
import { validarOcorrencia } from "@/lib/validar";

export async function POST(req: Request) {
  const segredo = process.env.EZWORKER_WEBHOOK_SECRET;
  if (segredo && req.headers.get("x-webhook-secret") !== segredo) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const v = validarOcorrencia(corpo);
  if (!v.ok) return Response.json({ erro: "schema inválido", detalhes: v.erros }, { status: 422 });

  // The decision graph validates, masks, costs, decides who pays and pauses for review when needed.
  const run = await runIncidentFromEzworker(v.dado);
  return Response.json(
    { id: run.state.caseId, status: run.state.status, pagador: run.state.payer?.payer ?? null, pausado_em: run.next[0] ?? null },
    { status: 201 },
  );
}
