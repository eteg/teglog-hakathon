import { listarPontos } from "@/lib/store";

export async function GET() {
  const pontos = (await listarPontos()).map(({ local, ...propriedades }) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [local.longitude, local.latitude] },
    properties: propriedades,
  }));
  return Response.json({ type: "FeatureCollection", features: pontos }, { headers: { "cache-control": "no-store" } });
}
