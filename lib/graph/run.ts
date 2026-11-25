// Entry points used by the API routes: start or resume the incident graph.
import "server-only";

import { Command } from "@langchain/langgraph";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";

import { incidents } from "@/db/schema";
import { getDb } from "@/lib/db";
import { traced } from "@/lib/observability/tracer";
import type { OcorrenciaEzworker } from "@/lib/types";

import { D1Checkpointer } from "./d1-checkpointer";
import { d1Ports } from "./d1-ports";
import { buildIncidentGraph } from "./incident-graph";
import type { EvidenceAnswer, ReviewAnswer } from "./state";

export async function incidentGraph() {
  const { env } = await getCloudflareContext({ async: true });
  return buildIncidentGraph(d1Ports, new D1Checkpointer(env.DB), (name, fn) => traced(name, fn));
}

async function invoke(threadId: string, input: Parameters<Awaited<ReturnType<typeof incidentGraph>>["invoke"]>[0]) {
  const graph = await incidentGraph();
  const config = { configurable: { thread_id: threadId } };
  const state = await graph.invoke(input, config);
  const snapshot = await graph.getState(config);
  return { threadId, state, paused: snapshot.next.length > 0, next: snapshot.next as string[] };
}

/** A driver report (messages) read by Claude. */
export function runIncidentGraph(reportId: string) {
  return invoke(reportId, { reportId });
}

/** An occurrence already extracted by ezworker. */
export function runIncidentFromEzworker(source: OcorrenciaEzworker) {
  const threadId = `ez-${crypto.randomUUID()}`;
  return invoke(threadId, { reportId: threadId, source });
}

/** Where a thread is paused, if anywhere. */
export async function pausedAt(threadId: string): Promise<string | null> {
  const graph = await incidentGraph();
  const snapshot = await graph.getState({ configurable: { thread_id: threadId } });
  return (snapshot.next[0] as string | undefined) ?? null;
}

export async function threadOfCase(caseId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ threadId: incidents.threadId }).from(incidents).where(eq(incidents.number, caseId));
  return row?.threadId ?? null;
}

/** Resumes a thread only if it is paused at the expected node; returns null otherwise. */
export async function resumeIncident(threadId: string, at: "await_review" | "await_evidence" | "await_transcriptions", value: ReviewAnswer | EvidenceAnswer | { timedOut: boolean }) {
  if ((await pausedAt(threadId)) !== at) return null;
  return invoke(threadId, new Command({ resume: value }));
}
