// Fila de revisão (F5): casos com campos de baixa confiança ainda não revisados.
import { filaRevisao } from "@/lib/store";

export async function GET() {
  return Response.json(await filaRevisao(), { headers: { "cache-control": "no-store" } });
}
