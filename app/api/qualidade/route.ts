// Tela de qualidade: medições dos critérios 4 (acesso mínimo) e 6 (dados pessoais), feitas na hora.
import { exigir } from "@/lib/acesso";
import { medirPII, verificarAcesso } from "@/lib/qualidade";

export async function GET(req: Request) {
  const negado = await exigir(req, "ler");
  if (negado) return negado;
  const [pii, acesso] = await Promise.all([medirPII(), verificarAcesso()]);
  return Response.json({ pii, acesso, medidoEm: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
