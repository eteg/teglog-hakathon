import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, inArray, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { analysisJobs, whatsappMessages, type WhatsappMessage } from "@/db/schema";
import { sendToAnalysis, type AnalysisType } from "@/lib/analysis/client";
import { getDb } from "@/lib/db";
import { sweep } from "@/lib/queue/sweep";

const RETRY_BASE_SECONDS = 30;

type ReservedJob = { id: number; message_id: number; endpoint: AnalysisType; attempts: number; max_attempts: number };

export async function getCooldownSeconds() {
  const { env } = await getCloudflareContext({ async: true });
  return Number(env.COOLDOWN_SECONDS) || 10;
}

async function reserveJobs(cooldownSeconds: number) {
  const db = await getDb();
  return db.all<ReservedJob>(sql`
    UPDATE analysis_jobs
    SET status = 'sending', locked_at = CURRENT_TIMESTAMP,
        attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (
      SELECT job.id
      FROM analysis_jobs AS job
      JOIN whatsapp_messages AS message ON message.id = job.message_id
      WHERE job.status = 'pending'
        AND job.next_attempt_at <= CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_messages AS newer
          WHERE newer.from_phone = message.from_phone
            AND newer.created_at > datetime('now', ${`-${cooldownSeconds} seconds`})
        )
      ORDER BY job.id
      LIMIT 20
    )
    RETURNING id, message_id, endpoint, attempts, max_attempts`);
}

async function sendJob(job: ReservedJob, message: WhatsappMessage) {
  const payload = {
    job_id: job.id,
    message_id: message.id,
    from_phone: message.fromPhone,
    type: message.type,
    text: message.textBody,
    storage_key: message.storageKey,
    content_type: message.contentType,
    latitude: message.latitude,
    longitude: message.longitude,
  };

  const startedAt = Date.now();
  let status: number | null = null;
  let error: string | null = null;
  try {
    ({ status } = await sendToAnalysis(job.endpoint, payload));
    if (status < 200 || status >= 300) error = `HTTP ${status}`;
  } catch (cause) {
    error = String(cause);
  }

  const common = {
    requestPayload: JSON.stringify(payload),
    responseStatus: status,
    lastError: error,
    lockedAt: null,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  const db = await getDb();
  const update = (values: SQLiteUpdateSetSource<typeof analysisJobs>) =>
    db
      .update(analysisJobs)
      .set({ ...common, ...values })
      .where(eq(analysisJobs.id, job.id));

  if (!error) {
    await update({ status: "done", completedAt: sql`CURRENT_TIMESTAMP` });
    console.log("[job] enviado", { jobId: job.id, type: message.type, status, ms: Date.now() - startedAt });
    return;
  }

  const clientError = status !== null && status >= 400 && status < 500;
  if (clientError || job.attempts >= job.max_attempts) {
    await update({ status: "failed" });
    console.log("[job] falhou", { jobId: job.id, tentativa: job.attempts, erro: error });
    return;
  }

  const delaySeconds = RETRY_BASE_SECONDS * 2 ** job.attempts;
  await update({ status: "pending", nextAttemptAt: sql`datetime('now', ${`+${delaySeconds} seconds`})` });
  console.log("[job] erro, nova tentativa", { jobId: job.id, tentativa: job.attempts, erro: error });
}

async function sendJobs(jobs: ReservedJob[]) {
  if (jobs.length === 0) return;

  const db = await getDb();
  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(inArray(whatsappMessages.id, jobs.map((job) => job.message_id)));
  const messageById = new Map(messages.map((message) => [message.id, message]));

  await Promise.all(jobs.map((job) => sendJob(job, messageById.get(job.message_id)!)));
}

export async function tick(origem: string) {
  const liberados = await sweep();
  const jobs = await reserveJobs(await getCooldownSeconds());
  console.log("[tick] rodou", { origem, liberados, pegos: jobs.length });
  await sendJobs(jobs);
}
