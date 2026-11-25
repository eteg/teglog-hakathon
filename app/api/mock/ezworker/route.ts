// Mock do ezworker: lista os cenários e um exemplo do JSON que cada um devolve.
// Útil para o back conferir o contrato. GET /api/mock/ezworker
import { exigir } from "@/lib/acesso";
import { catalogo, CENARIOS } from "@/lib/mock-ezworker";

export async function GET(req: Request) {
  const negado = await exigir(req, "ler");
  if (negado) return negado;
  const cenarios = catalogo().map((c) => ({
    ...c,
    endpoint: `/api/mock/ezworker/${c.canal}`,
    exemplo: CENARIOS.find((x) => x.id === c.id)!.gerar({ canal: c.canal, texto: c.textoExemplo }),
  }));
  return Response.json({ cenarios }, { headers: { "cache-control": "no-store" } });
}
