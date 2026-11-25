// Records how long each graph node took (node_runs). Waiting nodes (transcription,
// evidence, human review) are flagged so processing time is not mixed with waiting time.
import "server-only";

import { nodeRuns } from "@/db/schema";
import { getDb } from "@/lib/db";

type NodeFn<S, U> = (state: S) => Promise<U> | U;

export function traced<S extends { reportId: string }, U>(
  node: string,
  fn: NodeFn<S, U>,
  options: { waiting?: boolean } = {},
): NodeFn<S, U> {
  return async (state: S) => {
    const startedAt = new Date().toISOString();
    try {
      return await fn(state);
    } finally {
      // interrupt() throws to pause the graph; the run is still recorded.
      const db = await getDb();
      await db.insert(nodeRuns).values({
        reportId: state.reportId,
        node,
        startedAt,
        endedAt: new Date().toISOString(),
        waiting: options.waiting ?? false,
      });
    }
  };
}
