// The decision graph as Mermaid, generated from the compiled graph itself (demo: "por dentro").
import { MemorySaver } from "@langchain/langgraph";

import { buildIncidentGraph } from "@/lib/graph/incident-graph";
import type { IncidentPorts } from "@/lib/graph/ports";
import { exigir } from "@/lib/acesso";

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  // Drawing does not touch the outside world, so no real ports are needed.
  const graph = buildIncidentGraph({} as IncidentPorts, new MemorySaver());
  const mermaid = (await graph.getGraphAsync()).drawMermaid();
  return new Response(mermaid, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
