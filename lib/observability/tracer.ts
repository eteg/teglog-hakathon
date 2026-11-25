// Records how long each graph node took (node_runs, quality criterion 8.5). Pause nodes
// (evidence, human review, charge authorization) are flagged so processing time is not mixed with waiting time.
import "server-only";

import { nodeRuns } from "@/db/schema";
import { getDb } from "@/lib/db";

type NodeFn<S, U> = (state: S) => Promise<U> | U;

const WAITING_NODES = new Set(["await_evidence", "await_review", "await_authorization"]);

export function traced<S extends { threadId: string }, U>(node: string, fn: NodeFn<S, U>): NodeFn<S, U> {
  return async (state: S) => {
    const startedAt = new Date().toISOString();
    try {
      return await fn(state);
    } finally {
      // interrupt() throws to pause the graph; the run is still recorded.
      const db = await getDb();
      await db.insert(nodeRuns).values({
        threadId: state.threadId,
        node,
        startedAt,
        endedAt: new Date().toISOString(),
        waiting: WAITING_NODES.has(node),
      });
    }
  };
}
