import "server-only";
import { eq, sql } from "drizzle-orm";
import { analysisJobs, whatsappMessages, type WhatsappMessage } from "@/db/schema";
import { analysisTypes } from "@/lib/analysis/client";
import { getDb } from "@/lib/db";
import { getBucket, newObjectKey } from "@/lib/storage";
import { getMedia } from "@/lib/whatsapp/media-provider";
import type { ParsedMessage } from "@/lib/whatsapp/parse";

export async function storeMedia(message: WhatsappMessage) {
  const { bytes, contentType } = await getMedia(message.mediaId!);

  const now = new Date();
  const prefix = `whatsapp/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storageKey = newObjectKey(`media.${contentType.match(/\/(\w+)/)?.[1] ?? "bin"}`, prefix);

  const bucket = await getBucket();
  await bucket.put(storageKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: { whatsappMessageId: message.whatsappMessageId, fromPhone: message.fromPhone },
  });

  const db = await getDb();
  await db
    .update(whatsappMessages)
    .set({ storageKey, contentType, mediaStatus: "stored", updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(whatsappMessages.id, message.id));

  console.log("[media] salva", { messageId: message.id, storageKey, contentType, bytes: bytes.byteLength });
}

export async function createJob({ id: messageId, type }: Pick<WhatsappMessage, "id" | "type">) {
  const endpoint = analysisTypes.find((analysisType) => analysisType === type);
  if (!endpoint) return;

  const db = await getDb();
  const [job] = await db
    .insert(analysisJobs)
    .values({ messageId, endpoint })
    .onConflictDoNothing()
    .returning({ id: analysisJobs.id });
  if (job) console.log("[job] criado", { jobId: job.id, messageId, type });
}

export async function ingestMessages(messages: ParsedMessage[]) {
  const db = await getDb();

  for (const message of messages) {
    const [saved] = await db
      .insert(whatsappMessages)
      .values({ ...message, mediaStatus: message.mediaId ? "pending" : "none" })
      .onConflictDoNothing()
      .returning();

    if (!saved) {
      console.log("[ingest] duplicada, ignorada", message.whatsappMessageId);
      continue;
    }

    const { id: messageId, fromPhone, type, textBody } = saved;
    console.log("[ingest] salva", { messageId, fromPhone, type, textBody });

    if (saved.mediaId) {
      try {
        await storeMedia(saved);
      } catch (error) {
        console.log("[media] erro", { messageId, erro: String(error) });
        continue;
      }
    }

    if (type === "location") {
      const { latitude, longitude } = saved;
      console.log("[location] salva", { messageId, fromPhone, latitude, longitude });
    }
    await createJob(saved);
  }
}
