// Padrões emergentes (F6): grupos de relatos parecidos.
import { listarPadroes } from "@/lib/padroes-emergentes";

export async function GET() {
  return Response.json(await listarPadroes(), { headers: { "cache-control": "no-store" } });
}
