import { listarPontos } from "@/lib/store";
import { exigir } from "@/lib/acesso";

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  const pontos = (await listarPontos()).map(({ local, ...propriedades }) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [local.longitude, local.latitude] },
    properties: propriedades,
  }));
  return Response.json({ type: "FeatureCollection", features: pontos }, { headers: { "cache-control": "no-store" } });
}
