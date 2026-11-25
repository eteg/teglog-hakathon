import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Caso } from "@/lib/types";

const timestamps = {
  criadoEm: text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
  atualizadoEm: text("atualizado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const mensagensWhatsapp = sqliteTable("mensagens_whatsapp", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  idMensagemWhatsapp: text("id_mensagem_whatsapp").notNull().unique(),
  telefone: text("telefone").notNull(),
  tipo: text("tipo", { enum: ["text", "image", "audio", "location", "other"] }).notNull(),
  texto: text("texto"),
  idMidia: text("id_midia"),
  tipoConteudo: text("tipo_conteudo"),
  chaveArmazenamento: text("chave_armazenamento"),
  statusMidia: text("status_midia", { enum: ["nenhuma", "pendente", "salva", "falhou"] })
    .notNull()
    .default("nenhuma"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  payloadBruto: text("payload_bruto").notNull(),
  recebidoEm: text("recebido_em").notNull(),
  ...timestamps,
});

export const tarefasAnalise = sqliteTable(
  "tarefas_analise",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mensagemId: integer("mensagem_id")
      .notNull()
      .references(() => mensagensWhatsapp.id),
    endpoint: text("endpoint").notNull(),
    status: text("status", { enum: ["pendente", "enviando", "concluida", "falhou"] })
      .notNull()
      .default("pendente"),
    payloadEnvio: text("payload_envio"),
    statusResposta: integer("status_resposta"),
    tentativas: integer("tentativas").notNull().default(0),
    maxTentativas: integer("max_tentativas").notNull().default(5),
    proximaTentativaEm: text("proxima_tentativa_em").notNull().default(sql`CURRENT_TIMESTAMP`),
    travadoEm: text("travado_em"),
    concluidoEm: text("concluido_em"),
    ultimoErro: text("ultimo_erro"),
    ...timestamps,
  },
  (tabela) => [
    uniqueIndex("tarefas_analise_mensagem_endpoint_unico").on(tabela.mensagemId, tabela.endpoint),
    index("tarefas_analise_fila_idx").on(tabela.status, tabela.proximaTentativaEm),
  ],
);

export type MensagemWhatsapp = typeof mensagensWhatsapp.$inferSelect;
export type NovaMensagemWhatsapp = typeof mensagensWhatsapp.$inferInsert;
export type TarefaAnalise = typeof tarefasAnalise.$inferSelect;

// Rotas cadastradas ("Origem → Destino"), cada uma com o traçado da rodovia em pontos [latitude, longitude].
export const rotas = sqliteTable("rotas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull().unique(),
  origem: text("origem").notNull(),
  destino: text("destino").notNull(),
  tracado: text("tracado", { mode: "json" }).$type<[number, number][]>().notNull(),
});

// Ocorrências recebidas do ezworker (via webhook). O caso completo fica em `dados` (JSON);
// as colunas soltas servem para ordenar e filtrar sem abrir o JSON.
export const casos = sqliteTable("casos", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  status: text("status").notNull(),
  recebidoEm: text("recebido_em").notNull(),
  rotaId: integer("rota_id").references(() => rotas.id),
  latitude: real("latitude"),
  longitude: real("longitude"),
  dados: text("dados", { mode: "json" }).$type<Caso>().notNull(),
});

export type CasoRow = typeof casos.$inferSelect;

// Nome dado pelo analista a um grupo de relatos parecidos (padrões emergentes).
export const padroes = sqliteTable("padroes", {
  chave: text("chave").primaryKey(),
  nome: text("nome").notNull(),
  atualizadoEm: text("atualizado_em").notNull(),
});
