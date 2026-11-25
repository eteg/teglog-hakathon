// Entry point used by the API routes: runs (or resumes) the incident graph of a report.
import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { traced } from "@/lib/observability/tracer";

import { D1Checkpointer } from "./d1-checkpointer";
import { d1Ports } from "./d1-ports";
import { buildIncidentGraph } from "./incident-graph";

export async function incidentGraph() {
  const { env } = await getCloudflareContext({ async: true });
  return buildIncidentGraph(d1Ports, new D1Checkpointer(env.DB), (name, fn) => traced(name, fn));
}

export async function runIncidentGraph(reportId: string) {
  const graph = await incidentGraph();
  const config = { configurable: { thread_id: reportId } };
  const result = await graph.invoke({ reportId }, config);
  const snapshot = await graph.getState(config);
  return { result, paused: snapshot.next.length > 0, next: snapshot.next };
}
