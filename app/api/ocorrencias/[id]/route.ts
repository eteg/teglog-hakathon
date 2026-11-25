import { CAMPOS_REVISAVEIS } from "@/lib/regras";
import { approveFromCase } from "@/lib/graph/case-review";
import { atualizarStatus, obter, revisarCampo } from "@/lib/store";
import type { CampoRevisavel } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/ocorrencias/[id]">) {
  const { id } = await ctx.params;
  const c = await obter(id);
  return c ? Response.json(c) : Response.json({ erro: "não encontrado" }, { status: 404 });
}

/** Ações humanas: aprovar, responder, encerrar e revisar campo (confirmar/corrigir). */
export async function POST(req: Request, ctx: RouteContext<"/api/ocorrencias/[id]">) {
  const { id } = await ctx.params;
  const { acao, mensagem, campo, valor } = (await req.json()) as {
    acao: string;
    mensagem?: string;
    campo?: string;
    valor?: string;
  };
  const c = await obter(id);
  if (!c) return Response.json({ erro: "não encontrado" }, { status: 404 });

  let novo;
  if (acao === "aprovar") {
    // Resumes the decision graph: confirms the reviewed fields and/or authorizes the charge.
    // Nothing is charged without this click.
    await approveFromCase(id, "Analista");
    const atual = (await obter(id)) ?? c;
    novo = await atualizarStatus(id, "aprovado", "Cliente aprovou a tratativa", atual.decisao.motivo);
  } else if (acao === "responder") {
    if (!mensagem?.trim()) return Response.json({ erro: "mensagem vazia" }, { status: 400 });
    // TODO: devolver a resposta à transportadora (webhook de saída / ezworker)
    novo = await atualizarStatus(id, "devolutiva_enviada", "Cliente respondeu à transportadora", mensagem);
  } else if (acao === "confirmar_campo" || acao === "corrigir_campo") {
    // Fila de revisão (F5)
    if (!CAMPOS_REVISAVEIS.includes(campo as CampoRevisavel))
      return Response.json({ erro: `campo inválido: ${campo}` }, { status: 400 });
    try {
      novo = await revisarCampo(id, campo as CampoRevisavel, acao === "corrigir_campo" ? "corrigir" : "confirmar", valor);
    } catch (e) {
      return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 422 });
    }
  } else if (acao === "encerrar") {
    novo = await atualizarStatus(id, "encerrado", "Cliente marcou como resolvido");
  } else {
    return Response.json({ erro: "ação inválida" }, { status: 400 });
  }
  return Response.json(novo);
}
