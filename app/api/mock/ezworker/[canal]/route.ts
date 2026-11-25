import { respostaMock } from "@/lib/analise";
import { CATALOGO_MOCK_IA, escolherMock, type CanalMockIa } from "@/lib/mock-ia-catalogo";

async function responder(req: Request, ctx: RouteContext<"/api/mock/ezworker/[canal]">) {
  const { canal } = await ctx.params;
  if (!(canal in CATALOGO_MOCK_IA)) {
    return Response.json({ erro: "canal inválido", canais: Object.keys(CATALOGO_MOCK_IA) }, { status: 404 });
  }
  const catalogo = CATALOGO_MOCK_IA[canal as CanalMockIa];

  const corpo = (await req.json().catch(() => ({}))) as { from_phone?: unknown };
  const pedido = new URL(req.url).searchParams.get("mock");

  let indice: number;
  if (pedido !== null) {
    indice = Number(pedido) - 1;
    if (!Number.isInteger(indice) || indice < 0 || indice >= catalogo.length) {
      return Response.json({ erro: `mock deve ser de 1 a ${catalogo.length}` }, { status: 400 });
    }
  } else {
    indice = escolherMock(canal as CanalMockIa, corpo.from_phone);
  }

  return Response.json(await respostaMock(canal as CanalMockIa, indice), { headers: { "x-mock-indice": String(indice + 1) } });
}

export { responder as GET, responder as POST };
