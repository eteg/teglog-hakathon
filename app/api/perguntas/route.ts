// Pergunta do gestor (F4). POST { pergunta } → resposta em R$ + consulta usada.
import { responderPergunta } from "@/lib/perguntas";

export async function POST(req: Request) {
  const { pergunta } = (await req.json().catch(() => ({}))) as { pergunta?: string };
  if (!pergunta?.trim()) return Response.json({ erro: "pergunta vazia" }, { status: 400 });
  if (pergunta.length > 500) return Response.json({ erro: "pergunta muito longa" }, { status: 400 });
  return Response.json(await responderPergunta(pergunta.trim()));
}
