import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { whatsappMessages } from "@/db/schema";
import { getDb } from "@/lib/db";
import { createJob, storeMedia } from "@/lib/ingest";

export async function sweep() {
  const db = await getDb();

  const released = await db.all<{ id: number }>(sql`
    UPDATE analysis_jobs
    SET status = 'pending', locked_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'sending' AND locked_at < datetime('now', '-2 minutes')
    RETURNING id`);

  const staleMessages = await db
    .select()
    .from(whatsappMessages)
    .where(
      and(eq(whatsappMessages.mediaStatus, "pending"), sql`${whatsappMessages.createdAt} < datetime('now', '-2 minutes')`),
    );

  for (const message of staleMessages) {
    try {
      await storeMedia(message);
      await createJob(message);
    } catch (error) {
      await db
        .update(whatsappMessages)
        .set({ mediaStatus: "failed", updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(whatsappMessages.id, message.id));
      console.log("[media] falhou", { messageId: message.id, erro: String(error) });
    }
  }

  return released.length;
}
