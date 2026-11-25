// F3: one incident with everything the analyst needs to trust it.
import "server-only";

import { asc, eq } from "drizzle-orm";

import { carriers, decisions, deliveries, drivers, incidents, modelCalls, nodeRuns, routes } from "@/db/schema";
import { getDb } from "@/lib/db";
import { pausedAt } from "@/lib/graph/run";
import { obter } from "@/lib/store";

const PAUSE_LABEL: Record<string, string> = {
  await_review: "aguarda revisão humana",
  await_evidence: "aguarda evidência do motorista",
  await_transcriptions: "aguarda transcrição do áudio",
};

export async function incidentDetail(number: string) {
  const db = await getDb();
  const [row] = await db
    .select({ i: incidents, route: routes.name, carrier: carriers.legalName, driver: drivers.name, delivery: deliveries })
    .from(incidents)
    .leftJoin(deliveries, eq(deliveries.id, incidents.deliveryId))
    .leftJoin(routes, eq(routes.id, incidents.routeId))
    .leftJoin(carriers, eq(carriers.id, incidents.carrierId))
    .leftJoin(drivers, eq(drivers.id, incidents.driverId))
    .where(eq(incidents.number, number))
    .limit(1);
  if (!row) return null;

  const i = row.i;
  const threadId = i.threadId;
  const [trail, runs, calls, paused, caso] = await Promise.all([
    db.select().from(decisions).where(eq(decisions.incidentId, i.id)).orderBy(asc(decisions.id)),
    threadId ? db.select().from(nodeRuns).where(eq(nodeRuns.reportId, threadId)).orderBy(asc(nodeRuns.id)) : [],
    threadId ? db.select().from(modelCalls).where(eq(modelCalls.reportId, threadId)).orderBy(asc(modelCalls.id)) : [],
    threadId ? pausedAt(threadId) : null,
    obter(number),
  ]);

  const processingMs = runs.filter((r) => !r.waiting).reduce((s, r) => s + (Date.parse(r.endedAt) - Date.parse(r.startedAt)), 0);

  return {
    number: i.number,
    source: i.source,
    type: i.type,
    status: i.status,
    reasonText: i.reasonText,
    occurredAt: i.occurredAt,
    confidence: i.confidence,
    cost: i.cost,
    costEstimated: i.costEstimated,
    insuranceCost: i.insuranceCost,
    payer: i.payer,
    claimDeadline: i.claimDeadline,
    route: row.route,
    carrier: row.carrier,
    driver: row.driver,
    delivery: row.delivery
      ? { invoiceNumber: row.delivery.invoiceNumber, invoiceValue: row.delivery.invoiceValue, volumes: row.delivery.volumes, deliveredAt: row.delivery.deliveredAt }
      : null,
    graph: {
      threadId,
      pausedAt: paused,
      pausedLabel: paused ? (PAUSE_LABEL[paused] ?? paused) : null,
      decisions: trail.map((d) => ({ node: d.node, rule: d.rule, reason: d.reason, input: d.input, output: d.output, at: d.at })),
      processingMs,
      modelCalls: calls.map((c) => ({ model: c.model, attempt: c.attempt, schemaValid: c.schemaValid, costUsd: c.costUsd, latencyMs: c.latencyMs, error: c.error })),
    },
    /** Case of the first version of the app (evidence with hash, transcription, per-field confidence), when there is one. */
    case: caso ?? null,
  };
}
