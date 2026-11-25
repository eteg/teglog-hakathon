// GET /api/quality: the six quality criteria with numbers measured on the system itself.
import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { TOOLS } from "@/mcp/tools";

import { runAttackBattery } from "./attacks";
import { countLeaks, measureMasking } from "./pii";

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}

export async function qualityReport() {
  const db = await getDb();

  // 8.1 Schema: every ezworker occurrence is validated; nothing invalid becomes an incident.
  const [schema] = await db.all<{ valid: number; failed: number; savedWithoutValidation: number }>(sql`
    select
      (select count(distinct thread_id) from decisions where rule = 'SCHEMA_VALID') as valid,
      (select count(distinct thread_id) from decisions where rule = 'SCHEMA_FAILED') as failed,
      (select count(*) from incidents i where i.source = 'ezworker'
         and not exists (select 1 from decisions d where d.thread_id = i.thread_id and d.rule = 'SCHEMA_VALID')) as savedWithoutValidation`);

  // 8.3 Human in the loop.
  const [hitl] = await db.all<{ total: number; sentToReview: number; waitingReview: number; reviewedByHuman: number; passedWithoutHuman: number }>(sql`
    with t as (select thread_id, status from incidents where source = 'ezworker')
    select
      (select count(*) from t) as total,
      (select count(*) from t where exists (select 1 from decisions d where d.thread_id = t.thread_id and d.rule = 'REVIEW_REQUIRED')) as sentToReview,
      (select count(*) from t where status = 'pending_review') as waitingReview,
      (select count(*) from t where exists (select 1 from decisions d where d.thread_id = t.thread_id and d.rule in ('HUMAN_CONFIRMED', 'HUMAN_CORRECTED'))) as reviewedByHuman,
      (select count(*) from t where status = 'registered'
         and exists (select 1 from decisions d where d.thread_id = t.thread_id and d.rule = 'REVIEW_REQUIRED')
         and not exists (select 1 from decisions d where d.thread_id = t.thread_id and d.rule in ('HUMAN_CONFIRMED', 'HUMAN_CORRECTED'))) as passedWithoutHuman`);
  // Charging someone always needs a person (incident graph: decide_billing / await_authorization).
  const [billing] = await db.all<{ chargeable: number; awaiting: number; authorized: number; declined: number; withoutPerson: number }>(sql`
    with c as (
      select thread_id, status from incidents
      where source = 'ezworker' and payer is not null and payer <> 'absorbed' and coalesce(cost, 0) > 0
        and status not in ('awaiting_evidence', 'pending_review')
    )
    select
      (select count(*) from c) as chargeable,
      (select count(*) from c where status = 'awaiting_authorization') as awaiting,
      (select count(*) from c where status = 'authorized') as authorized,
      (select count(*) from c where status = 'not_authorized') as declined,
      (select count(*) from c where status not in ('awaiting_authorization', 'not_authorized')
         and not exists (select 1 from decisions d where d.thread_id = c.thread_id and d.rule = 'HUMAN_AUTHORIZED')) as withoutPerson`);
  const reasonRows = await db.all<{ output: string }>(sql`select output from decisions where rule = 'REVIEW_REQUIRED'`);
  const reasons: Record<string, number> = {};
  for (const r of reasonRows) {
    for (const reason of (JSON.parse(r.output) as { reasons: string[] }).reasons ?? []) {
      const key = reason.replace(/[\d.,]+|R\$\s*/g, "").replace(/\s+/g, " ").trim();
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
  }

  // 8.5 Observability: processing time per incident (waiting excluded) and per node.
  const runs = await db.all<{ thread_id: string; node: string; ms: number; waiting: number }>(sql`
    select thread_id, node, (julianday(ended_at) - julianday(started_at)) * 86400000 as ms, waiting from node_runs`);
  const perThread = new Map<string, number>();
  const perNode = new Map<string, number[]>();
  for (const r of runs) {
    if (r.waiting) continue;
    perThread.set(r.thread_id, (perThread.get(r.thread_id) ?? 0) + r.ms);
    perNode.set(r.node, [...(perNode.get(r.node) ?? []), r.ms]);
  }
  const threadMs = [...perThread.values()];

  // 8.6 Personal data: planted samples and stored output.
  const planted = await db.all<{ reason_text: string }>(sql`select reason_text from incidents where number like 'PII-%'`);
  const stored = await db.all<{ text: string | null }>(sql`
    select reason_text as text from incidents where source = 'ezworker'
    union all select reason || ' ' || coalesce(input, '') || ' ' || coalesce(output, '') from decisions`);

  const attacks = await runAttackBattery();

  return {
    generatedAt: new Date().toISOString(),
    schema: {
      validOccurrences: schema.valid,
      rejectedOccurrences: schema.failed,
      validShare: pct(schema.valid, schema.valid + schema.failed),
      savedWithoutValidation: schema.savedWithoutValidation,
    },
    guardrails: attacks,
    humanInTheLoop: {
      incidents: hitl.total,
      sentToReview: hitl.sentToReview,
      sentToReviewShare: pct(hitl.sentToReview, hitl.total),
      waitingReview: hitl.waitingReview,
      reviewedByHuman: hitl.reviewedByHuman,
      /** Must be 0: an incident that needed review was registered without a person. */
      passedWithoutHuman: hitl.passedWithoutHuman,
      reasons,
      charges: {
        chargeable: billing.chargeable,
        awaitingAuthorization: billing.awaiting,
        authorized: billing.authorized,
        declined: billing.declined,
        /** Must be 0: a charge that went ahead without a person authorizing it. */
        withoutPersonAuthorizing: billing.withoutPerson,
      },
    },
    minimumAccess: {
      agentTools: TOOLS.map((t) => t.name),
      writeTools: TOOLS.filter((t) => t.method !== "GET").length,
      readApiRequiresToken: true,
    },
    observability: {
      processedIncidents: threadMs.length,
      processingMsP50: percentile(threadMs, 50),
      processingMsP95: percentile(threadMs, 95),
      perNodeMsAvg: Object.fromEntries([...perNode].map(([node, ms]) => [node, Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)])),
    },
    personalData: {
      planted: measureMasking(planted.map((p) => p.reason_text)),
      /** Must be 0: stored incident text and decision trail with personal data. */
      leaksInStoredOutput: countLeaks(stored.map((s) => s.text)),
    },
  };
}
