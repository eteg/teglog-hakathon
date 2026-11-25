// Catalog of the MCP tools (quality criterion 8.4). Every tool is a GET on /api/read/*:
// there is no tool that writes, approves, bills or changes an incident.
import { z } from "zod";

const TYPES = ["damage", "loss", "refusal", "redelivery", "discrepancy", "accident", "delay"] as const;
const DIMENSIONS = ["route", "carrier", "driver", "hour"] as const;

const filters = {
  route: z.number().int().positive().optional().describe("Id da rota"),
  carrier: z.number().int().positive().optional().describe("Id da transportadora"),
  driver: z.number().int().positive().optional().describe("Id do motorista"),
  hour: z.number().int().min(0).max(23).optional().describe("Hora do dia (0 a 23)"),
  from: z.string().optional().describe("Data inicial AAAA-MM-DD"),
  to: z.string().optional().describe("Data final AAAA-MM-DD (inclusiva)"),
  type: z.enum(TYPES).optional().describe("Tipo de ocorrência"),
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  /** Only GET is allowed; the read API refuses anything else. */
  method: "GET";
  path: (args: Record<string, unknown>) => string;
};

const query = (args: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...args, ...extra })) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
};

export const TOOLS: ToolDefinition[] = [
  {
    name: "get_kpi_summary",
    title: "Resumo de perdas",
    description: "Custo total das ocorrências, custo por entrega, índice de perda e custo total de risco, sempre sobre o volume de entregas. Aceita filtros.",
    inputSchema: filters,
    method: "GET",
    path: (a) => `/api/read/kpis${query(a, { view: "summary" })}`,
  },
  {
    name: "get_kpi_ranking",
    title: "Ranking por dimensão",
    description: "Ranking por rota, transportadora, motorista ou horário, com ocorrências por mil entregas e custo. Use para saber onde a perda se concentra.",
    inputSchema: { dimension: z.enum(DIMENSIONS).describe("Dimensão do ranking"), ...filters },
    method: "GET",
    path: (a) => `/api/read/kpis${query(a, { view: "ranking" })}`,
  },
  {
    name: "get_kpi_timeseries",
    title: "Evolução no tempo",
    description: "Evolução mensal ou semanal das 5 chaves de maior custo de uma dimensão.",
    inputSchema: {
      dimension: z.enum(DIMENSIONS),
      metric: z.enum(["cost", "incidentsPer1000", "costPerDelivery"]).optional(),
      granularity: z.enum(["week", "month"]).optional(),
      ...filters,
    },
    method: "GET",
    path: (a) => `/api/read/kpis${query(a, { view: "timeseries" })}`,
  },
  {
    name: "list_incidents",
    title: "Listar ocorrências",
    description: "Ocorrências mais recentes, com tipo, rota, transportadora, custo, quem paga e status. Texto livre já mascarado.",
    inputSchema: {
      status: z.enum(["awaiting_evidence", "pending_review", "registered", "billed", "recovered", "lost"]).optional(),
      type: z.enum(TYPES).optional(),
      route: z.number().int().positive().optional(),
      carrier: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(100).optional(),
    },
    method: "GET",
    path: (a) => `/api/read/incidents${query(a)}`,
  },
  {
    name: "get_incident",
    title: "Detalhe de uma ocorrência",
    description: "Uma ocorrência pelo número (ex.: OC-1047), com a trilha de decisões do grafo.",
    inputSchema: { number: z.string().min(1) },
    method: "GET",
    path: (a) => `/api/read/incidents/${encodeURIComponent(String(a.number))}`,
  },
  {
    name: "list_patterns",
    title: "Padrões emergentes",
    description: "Grupos de relatos parecidos, com custo e rotas de cada grupo.",
    inputSchema: {},
    method: "GET",
    path: () => "/api/read/patterns",
  },
];
