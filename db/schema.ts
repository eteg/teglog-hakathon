import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const whatsappMessages = sqliteTable("whatsapp_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  whatsappMessageId: text("whatsapp_message_id").notNull().unique(),
  fromPhone: text("from_phone").notNull(),
  type: text("type", { enum: ["text", "image", "audio", "location", "other"] }).notNull(),
  textBody: text("text_body"),
  mediaId: text("media_id"),
  contentType: text("content_type"),
  storageKey: text("storage_key"),
  mediaStatus: text("media_status", { enum: ["none", "pending", "stored", "failed"] })
    .notNull()
    .default("none"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  rawPayload: text("raw_payload").notNull(),
  receivedAt: text("received_at").notNull(),
  ...timestamps,
});

export const analysisJobs = sqliteTable(
  "analysis_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => whatsappMessages.id),
    endpoint: text("endpoint").notNull(),
    status: text("status", { enum: ["pending", "sending", "done", "failed"] })
      .notNull()
      .default("pending"),
    requestPayload: text("request_payload"),
    responseStatus: integer("response_status"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: text("next_attempt_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lockedAt: text("locked_at"),
    completedAt: text("completed_at"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("analysis_jobs_message_endpoint_unique").on(table.messageId, table.endpoint),
    index("analysis_jobs_queue_index").on(table.status, table.nextAttemptAt),
  ],
);

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
export type AnalysisJob = typeof analysisJobs.$inferSelect;
