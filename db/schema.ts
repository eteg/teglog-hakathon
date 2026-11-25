import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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

// ---------------------------------------------------------------------------
// Recupera: decision graph (docs/PLANO_DESENVOLVIMENTO.md, section 3).
// New code is in English; the tables above belong to the first version of the app.

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const INCIDENT_TYPES = ["damage", "loss", "refusal", "redelivery", "discrepancy", "accident", "delay"] as const;
export const INCIDENT_SOURCES = ["ezworker", "seed"] as const;
export const INCIDENT_STATUSES = [
  "awaiting_evidence",
  "pending_review",
  /** Someone is to be charged: a person must authorize it, whatever the value. */
  "awaiting_authorization",
  "authorized",
  "not_authorized",
  "registered",
  "billed",
  "recovered",
  "lost",
] as const;
export const PAYERS = ["insurer", "carrier", "shipper", "absorbed"] as const;

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const carriers = sqliteTable("carriers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cnpj: text("cnpj").notNull().unique(),
  legalName: text("legal_name").notNull(),
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
});

export const drivers = sqliteTable("drivers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  cpfMasked: text("cpf_masked"),
  carrierId: integer("carrier_id").references(() => carriers.id),
});

export const routes = sqliteTable("routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  originIbge: text("origin_ibge").notNull(),
  destinationIbge: text("destination_ibge").notNull(),
  name: text("name").notNull(),
  corridor: text("corridor"),
}, (t) => [uniqueIndex("routes_origin_destination").on(t.originIbge, t.destinationIbge)]);

export const insurancePolicies = sqliteTable("insurance_policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  policyNumber: text("policy_number").notNull(),
  deductible: real("deductible").notNull(),
  coversLoadingUnloading: integer("covers_loading_unloading", { mode: "boolean" }).notNull().default(false),
  adValoremPct: real("ad_valorem_pct").notNull(),
  grisPct: real("gris_pct").notNull(),
});

export const deliveries = sqliteTable("deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nfeKey: text("nfe_key").unique(),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceValue: real("invoice_value").notNull(),
  volumes: integer("volumes").notNull(),
  routeId: integer("route_id").notNull().references(() => routes.id),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  driverId: integer("driver_id").references(() => drivers.id),
  departedAt: text("departed_at").notNull(),
  deliveredAt: text("delivered_at"),
  freightCost: real("freight_cost").notNull(),
  insuranceCost: real("insurance_cost").notNull(),
}, (t) => [
  index("deliveries_dimensions").on(t.routeId, t.carrierId, t.driverId, t.departedAt),
  index("deliveries_invoice").on(t.invoiceNumber),
]);

export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Human-readable number, e.g. OC-2026-000123. */
  number: text("number").notNull().unique(),
  /** LangGraph thread that produced this incident (resumed on review and evidence). */
  threadId: text("thread_id").unique(),
  source: text("source", { enum: INCIDENT_SOURCES }).notNull().default("seed"),
  deliveryId: integer("delivery_id").references(() => deliveries.id),
  // Normalized keys (B6), also set when the invoice is not in the delivery base.
  routeId: integer("route_id").references(() => routes.id),
  carrierId: integer("carrier_id").references(() => carriers.id),
  driverId: integer("driver_id").references(() => drivers.id),
  type: text("type", { enum: INCIDENT_TYPES }).notNull(),
  reasonText: text("reason_text"),
  cost: real("cost"),
  costEstimated: integer("cost_estimated", { mode: "boolean" }).notNull().default(false),
  insuranceCost: real("insurance_cost"),
  payer: text("payer", { enum: PAYERS }),
  claimDeadline: text("claim_deadline"),
  confidence: real("confidence"),
  status: text("status", { enum: INCIDENT_STATUSES }).notNull(),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [
  index("incidents_listing").on(t.occurredAt, t.type, t.status),
  index("incidents_dimensions").on(t.routeId, t.carrierId, t.driverId),
  check("incidents_type_check", inList("type", INCIDENT_TYPES)),
  check("incidents_status_check", inList("status", INCIDENT_STATUSES)),
  check("incidents_payer_check", sql`payer is null or ${inList("payer", PAYERS)}`),
]);

export const evidence = sqliteTable("evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  incidentId: integer("incident_id").notNull().references(() => incidents.id),
  mediaKey: text("media_key").notNull(),
  sha256: text("sha256").notNull(),
  kind: text("kind").notNull(),
  receivedAt: text("received_at").notNull(),
  sourcePhone: text("source_phone"),
});

/** Audit trail: one row per decision node (shown on the incident detail, F3). */
export const decisions = sqliteTable("decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: text("thread_id").notNull(),
  incidentId: integer("incident_id").references(() => incidents.id),
  node: text("node").notNull(),
  rule: text("rule").notNull(),
  input: text("input", { mode: "json" }),
  output: text("output", { mode: "json" }),
  reason: text("reason").notNull(),
  at: text("at").notNull(),
}, (t) => [index("decisions_thread").on(t.threadId), index("decisions_incident").on(t.incidentId)]);

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  incidentId: integer("incident_id").notNull().references(() => incidents.id),
  action: text("action", { enum: ["confirm", "correct", "approve"] }).notNull(),
  correctedFields: text("corrected_fields", { mode: "json" }),
  reviewer: text("reviewer").notNull(),
  at: text("at").notNull().default(now),
});

export const clusters = sqliteTable("clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  centroid: text("centroid", { mode: "json" }).$type<number[]>(),
  createdAt: text("created_at").notNull().default(now),
});

export const incidentClusters = sqliteTable("incident_clusters", {
  incidentId: integer("incident_id").notNull().references(() => incidents.id),
  clusterId: integer("cluster_id").notNull().references(() => clusters.id),
  similarity: real("similarity").notNull(),
}, (t) => [primaryKey({ columns: [t.incidentId, t.clusterId] })]);

// Observability (quality criterion 8.5): time spent in each graph node.
export const nodeRuns = sqliteTable("node_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: text("thread_id").notNull(),
  node: text("node").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  /** True when the node only waited (evidence, human review). */
  waiting: integer("waiting", { mode: "boolean" }).notNull().default(false),
}, (t) => [index("node_runs_thread").on(t.threadId)]);

// LangGraph state (lib/graph/d1-checkpointer.ts).
export const graphCheckpoints = sqliteTable("graph_checkpoints", {
  threadId: text("thread_id").notNull(),
  checkpointNs: text("checkpoint_ns").notNull().default(""),
  checkpointId: text("checkpoint_id").notNull(),
  parentCheckpointId: text("parent_checkpoint_id"),
  checkpointType: text("checkpoint_type").notNull(),
  checkpoint: text("checkpoint").notNull(),
  metadataType: text("metadata_type").notNull(),
  metadata: text("metadata").notNull(),
}, (t) => [primaryKey({ columns: [t.threadId, t.checkpointNs, t.checkpointId] })]);

export const graphCheckpointWrites = sqliteTable("graph_checkpoint_writes", {
  threadId: text("thread_id").notNull(),
  checkpointNs: text("checkpoint_ns").notNull().default(""),
  checkpointId: text("checkpoint_id").notNull(),
  taskId: text("task_id").notNull(),
  idx: integer("idx").notNull(),
  channel: text("channel").notNull(),
  valueType: text("value_type").notNull(),
  value: text("value").notNull(),
  taskPath: text("task_path").notNull().default(""),
}, (t) => [primaryKey({ columns: [t.threadId, t.checkpointNs, t.checkpointId, t.taskId, t.idx] })]);
