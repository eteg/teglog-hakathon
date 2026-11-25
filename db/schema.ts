import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Caso } from "@/lib/types";

// Tabela de exemplo — ajuste ao domínio do Reporta.
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["open", "in_progress", "resolved"] })
    .notNull()
    .default("open"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

// Ocorrências recebidas do ezworker (via webhook). O caso completo fica em `dados` (JSON);
// as colunas soltas servem para ordenar e filtrar sem abrir o JSON.
export const casos = sqliteTable("casos", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  status: text("status").notNull(),
  recebidoEm: text("recebido_em").notNull(),
  dados: text("dados", { mode: "json" }).$type<Caso>().notNull(),
});

export type CasoRow = typeof casos.$inferSelect;

// Nome dado pelo analista a um grupo de relatos parecidos (padrões emergentes).
export const padroes = sqliteTable("padroes", {
  chave: text("chave").primaryKey(),
  nome: text("nome").notNull(),
  atualizadoEm: text("atualizado_em").notNull(),
});
