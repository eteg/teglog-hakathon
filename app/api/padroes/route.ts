// Padrões emergentes (F6): grupos de relatos parecidos.
import { exigir } from "@/lib/acesso";
import { listarPadroes } from "@/lib/padroes-emergentes";

export async function GET(req: Request) {
  const negado = await exigir(req, "ler");
  if (negado) return negado;
  return Response.json(await listarPadroes(), { headers: { "cache-control": "no-store" } });
}
