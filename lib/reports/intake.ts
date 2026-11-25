// Message intake shared by the simulator and the WhatsApp webhook (B1, B2).
// Messages from the same phone within REPORT_WINDOW_SECONDS join the same report.
import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { driverReports, messages } from "@/db/schema";
import { getDb } from "@/lib/db";
import { guardarArquivo } from "@/lib/evidencias";
import { REPORT_WINDOW_SECONDS } from "@/lib/rules/config";

export type IncomingMedia = { bytes: ArrayBuffer; contentType: string; fileName?: string };

export type IncomingMessage = {
  phone: string;
  text?: string | null;
  media?: IncomingMedia | null;
  externalId?: string | null;
  receivedAt?: string;
};

export type IntakeResult = {
  reportId: string;
  messageId: number;
  /** The report was paused waiting for this driver (evidence or transcription): resume the graph. */
  resumesWaitingReport: boolean;
};

function kindOf(m: IncomingMessage): "text" | "audio" | "image" {
  if (!m.media) return "text";
  if (m.media.contentType.startsWith("audio/")) return "audio";
  if (m.media.contentType.startsWith("image/")) return "image";
  throw new Error(`formato não aceito: ${m.media.contentType}`);
}

/** Open report of this phone still inside the window, or the one waiting for evidence. */
async function findReport(phone: string, now: Date) {
  const db = await getDb();
  const [report] = await db
    .select()
    .from(driverReports)
    .where(and(eq(driverReports.phone, phone), inArray(driverReports.status, ["open", "waiting"])))
    .orderBy(desc(driverReports.openedAt))
    .limit(1);
  if (!report) return null;
  if (report.status === "waiting") return report;

  const [last] = await db
    .select({ receivedAt: messages.receivedAt })
    .from(messages)
    .where(eq(messages.reportId, report.id))
    .orderBy(desc(messages.receivedAt))
    .limit(1);
  const lastAt = new Date(last?.receivedAt ?? report.openedAt).getTime();
  return now.getTime() - lastAt <= REPORT_WINDOW_SECONDS * 1000 ? report : null;
}

export async function receiveMessage(m: IncomingMessage): Promise<IntakeResult> {
  const db = await getDb();
  const now = m.receivedAt ? new Date(m.receivedAt) : new Date();
  const kind = kindOf(m);

  if (m.externalId) {
    const [dup] = await db.select().from(messages).where(eq(messages.externalId, m.externalId)).limit(1);
    if (dup) return { reportId: dup.reportId, messageId: dup.id, resumesWaitingReport: false };
  }

  let report = await findReport(m.phone, now);
  if (!report) {
    const id = `rep-${crypto.randomUUID()}`;
    [report] = await db
      .insert(driverReports)
      .values({ id, phone: m.phone, threadId: id, openedAt: now.toISOString() })
      .returning();
  }

  let mediaKey: string | null = null;
  let mediaSha256: string | null = null;
  if (m.media) {
    const saved = await guardarArquivo(report.id, m.media.bytes, m.media.contentType, m.media.fileName);
    mediaKey = saved.key ?? null;
    mediaSha256 = saved.hash ?? null;
  }

  const [row] = await db
    .insert(messages)
    .values({
      reportId: report.id,
      kind,
      text: m.text?.trim() || null,
      mediaKey,
      mediaSha256,
      receivedAt: now.toISOString(),
      externalId: m.externalId ?? null,
      transcriptStatus: kind === "audio" ? "pending" : null,
    })
    .returning({ id: messages.id });

  return { reportId: report.id, messageId: row.id, resumesWaitingReport: report.status === "waiting" };
}

export async function closeReport(reportId: string) {
  const db = await getDb();
  await db
    .update(driverReports)
    .set({ status: "closed", closedAt: new Date().toISOString() })
    .where(and(eq(driverReports.id, reportId), eq(driverReports.status, "open")));
}
