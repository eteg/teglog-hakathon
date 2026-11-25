// T01 spike endpoint. POST {"value": 18450} starts a run; POST {"threadId", "approve"} resumes it.
import { Command } from "@langchain/langgraph";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { D1Checkpointer } from "@/lib/graph/d1-checkpointer";
import { buildSpikeGraph } from "@/lib/graph/spike";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const graph = buildSpikeGraph(new D1Checkpointer(env.DB));
  const body = (await request.json()) as { value?: number; threadId?: string; approve?: boolean };

  const threadId = body.threadId ?? crypto.randomUUID();
  const config = { configurable: { thread_id: threadId } };
  const result = body.threadId
    ? await graph.invoke(new Command({ resume: { approve: body.approve ?? false } }), config)
    : await graph.invoke({ value: body.value ?? 0, approved: null }, config);

  const snapshot = await graph.getState(config);
  return Response.json({ threadId, result, paused: snapshot.next.length > 0, next: snapshot.next });
}
