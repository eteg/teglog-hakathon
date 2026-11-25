// Transcription arrives from the external tool by webhook (B4).
// Idempotent: a transcript already received is never overwritten.
import "server-only";

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

import { messages } from "@/db/schema";
import { getDb } from "@/lib/db";

// Contract still to be confirmed with the tool's owner (T05); either key correlates.
export const TranscriptionPayload = z
  .object({
    external_id: z.string().min(1).optional(),
    message_id: z.number().int().positive().optional(),
    status: z.enum(["completed", "failed"]),
    text: z.string().optional(),
    language: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    duration_s: z.number().optional(),
  })
  .refine((p) => p.external_id || p.message_id, { message: "external_id ou message_id é obrigatório" })
  .refine((p) => p.status === "failed" || (p.text && p.text.trim()), { message: "text é obrigatório quando status = completed" });

export type TranscriptionInput = z.infer<typeof TranscriptionPayload>;

export type TranscriptionResult =
  | { found: false }
  | { found: true; reportId: string; messageId: number; alreadyReceived: boolean; allAudioDone: boolean };

export async function receiveTranscription(p: TranscriptionInput): Promise<TranscriptionResult> {
  const db = await getDb();
  const [msg] = await db
    .select()
    .from(messages)
    .where(p.message_id ? eq(messages.id, p.message_id) : eq(messages.externalId, p.external_id!))
    .limit(1);
  if (!msg || msg.kind !== "audio") return { found: false };

  const alreadyReceived = msg.transcriptStatus === "received";
  if (!alreadyReceived) {
    await db
      .update(messages)
      .set({
        transcript: p.status === "completed" ? p.text!.trim() : null,
        transcriptStatus: p.status === "completed" ? "received" : "failed",
        transcriptConfidence: p.confidence ?? null,
        transcribedAt: new Date().toISOString(),
      })
      .where(eq(messages.id, msg.id));
  }

  const pending = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.reportId, msg.reportId),
        eq(messages.kind, "audio"),
        or(isNull(messages.transcriptStatus), and(ne(messages.transcriptStatus, "received"), ne(messages.transcriptStatus, "failed"))),
      ),
    );

  return { found: true, reportId: msg.reportId, messageId: msg.id, alreadyReceived, allAudioDone: pending.length === 0 };
}
