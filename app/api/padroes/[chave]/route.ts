// Dá nome a um grupo de relatos (F6). PUT { nome }
import { exigir } from "@/lib/acesso";
import { nomearPadrao } from "@/lib/padroes-emergentes";

export async function PUT(req: Request, ctx: RouteContext<"/api/padroes/[chave]">) {
  const negado = await exigir(req, "escrever");
  if (negado) return negado;
  const { chave } = await ctx.params;
  const { nome } = (await req.json().catch(() => ({}))) as { nome?: string };
  if (!nome?.trim()) return Response.json({ erro: "nome vazio" }, { status: 400 });
  await nomearPadrao(decodeURIComponent(chave), nome.slice(0, 80));
  return Response.json({ chave, nome: nome.trim() });
}
