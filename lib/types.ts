// Contrato da ocorrência tipada que o ezworker devolve (via webhook).
// Baseado no schema da proposta "Recupera". Os três endpoints
// (/ezworker/audio, /image, /text) devolvem este mesmo formato.

export type TipoOcorrencia =
  | "avaria"
  | "recusa"
  | "reentrega"
  | "extravio"
  | "atraso"
  | "acidente";

export type Gravidade = "baixa" | "media" | "alta";

export type Canal = "audio" | "image" | "video" | "text";

export type TipoEvidencia =
  | "foto_avaria"
  | "foto_canhoto"
  | "danfe"
  | "etiqueta"
  | "audio_relato"
  | "video"
  | "boletim_ocorrencia"
  | "diario_bordo"
  | "tacografo"
  | "prontuario"
  | "texto";

export interface Evidencia {
  tipo: TipoEvidencia;
  legivel: boolean;
  url?: string;
  descricao?: string;
  /** SHA-256 do arquivo original, enviado pelo ezworker (cadeia de custódia). */
  hash?: string;
  /** Quando a evidência foi capturada (ISO). */
  capturada_em?: string;
  /** Chave do arquivo no R2 (servido em /api/files/<key>). */
  key?: string;
  content_type?: string;
  tamanho?: number;
  nome_arquivo?: string;
  /** Arquivo inline vindo do ezworker; é movido para o R2 e descartado do registro. */
  conteudo_base64?: string;
  /** Falha ao copiar a mídia para o R2 (a URL original é mantida). */
  erro_armazenamento?: string;
}

export interface Local {
  latitude: number;
  longitude: number;
}

export interface Apolice {
  franquia: number;
  cobre_descarga: boolean;
}

export interface Contexto {
  valor_nf?: number;
  apolice?: Apolice;
  cobertura_aplicavel?: string;
  clima_no_evento?: { chuva_mm?: number };
  prazo_prometido?: string; // ISO date
  prazo_protesto?: string; // ISO date
  rota?: string;
  cliente?: string;
  motorista?: string;
  placa?: string;
  /** Prejuízo estimado da ocorrência (R$). Sem valor, usa valor_nf. */
  custo_ocorrencia?: number;
  /** Parte coberta pelo seguro (R$). Sem valor, é derivada da tratativa. */
  custo_seguro?: number;
}

/** Payload que chega do ezworker. */
export interface OcorrenciaEzworker {
  id?: string;
  canal: Canal;
  tipo: TipoOcorrencia;
  subtipo: string;
  codigo_ocoren?: string;
  nf?: string;
  transportadora?: string;
  produto?: string;
  volumes_afetados?: number;
  gravidade: Gravidade;
  local: Local;
  resumo?: string;
  transcricao?: string;
  evidencias: Evidencia[];
  faltando: string[];
  confianca: Record<string, number>;
  contexto?: Contexto;
  /** Texto encontrado na mídia que parece instrução. Vira dado, nunca ação. */
  instrucoes_ignoradas?: string[];
  recebido_em?: string;
}

export type Pagador =
  | "seguradora"
  | "transportadora"
  | "embarcador"
  | "absorver"
  | "revisao_humana";

export interface Decisao {
  pagador: Pagador;
  motivo: string;
  playbook: string;
  acoes: string[];
  documento: "carta_protesto" | "dossie_sinistro" | "cobranca" | "nenhum";
  requer_aprovacao: boolean;
  motivo_aprovacao?: string;
}

export type StatusCaso =
  | "novo"
  | "aguardando_evidencia"
  | "aguardando_aprovacao"
  | "aprovado"
  | "devolutiva_enviada"
  | "encerrado";

export interface EventoTimeline {
  em: string;
  titulo: string;
  detalhe?: string;
}

/** Situação do registro (dados), independente da tratativa. */
export type SituacaoRegistro = "completo" | "incompleto" | "em_revisao";

export interface CorrecaoCampo {
  campo: CampoRevisavel;
  de?: string;
  para: string;
  em: string;
}

/** Campos que o analista pode confirmar ou corrigir na fila de revisão. */
export type CampoRevisavel =
  | "tipo"
  | "nf"
  | "transportadora"
  | "produto"
  | "rota"
  | "motorista"
  | "valor_nf";

/** Caso já enriquecido no app (ocorrência + decisão + status). */
export interface Caso extends OcorrenciaEzworker {
  id: string;
  recebido_em: string;
  status: StatusCaso;
  decisao: Decisao;
  timeline: EventoTimeline[];
  devolutiva?: string;
  revisao?: { confirmados: CampoRevisavel[]; correcoes: CorrecaoCampo[] };
  /** Quais custos vieram prontos do ezworker (os demais são calculados pelas regras). */
  custos_informados?: { ocorrencia: boolean; seguro: boolean };
}

/** Resposta paginada de GET /api/ocorrencias. */
export interface PaginaCasos {
  data: Caso[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Valores possíveis para os filtros (sobre todos os casos). */
  facetas: { tipos: string[]; status: string[]; transportadoras: string[]; motoristas: string[]; rotas: string[] };
  /** Indicadores sobre o conjunto filtrado. */
  resumo: { abertos: number; valorAberto: number; prazoCurto: number; aguardando: number; emRevisao: number };
}
