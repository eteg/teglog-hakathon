// Fila de revisão (F5): casos com campos de baixa confiança ainda não revisados.
import { exigir } from "@/lib/acesso";
import { filaRevisao } from "@/lib/store";

export async function GET(req: Request) {
  const negado = await exigir(req, "ler");
  if (negado) return negado;
  return Response.json(await filaRevisao(), { headers: { "cache-control": "no-store" } });
}
