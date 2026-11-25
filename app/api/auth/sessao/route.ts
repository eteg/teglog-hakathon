// GET → usuário logado (para o header), ou 401.
import { sessaoDaRequisicao } from "@/lib/sessao";

export async function GET(req: Request) {
  const s = await sessaoDaRequisicao(req);
  if (!s) return Response.json({ erro: "sem sessão" }, { status: 401 });
  return Response.json({ usuario: s.sub, papel: s.papel, expiraEm: new Date(s.exp * 1000).toISOString() }, { headers: { "cache-control": "no-store" } });
}
