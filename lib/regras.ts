// Motor de regras "Quem paga?".
// A IA (ezworker) só devolve dados. Quem decide pagador, documento e alçada é este código.

import type { CampoRevisavel, Caso, Decisao, OcorrenciaEzworker, SituacaoRegistro, StatusCaso } from "./types";

export const ALCADA_VALOR = 10_000; // acima disso, aprovação humana
export const LIMIAR_CONFIANCA = 0.7; // abaixo disso, aprovação humana
export const PRAZO_PROTESTO_DIAS = 10; // art. 754 do Código Civil

const SUBTIPOS_ACONDICIONAMENTO = [
  "mau_acondicionamento",
  "embalagem_impropria",
  "embalagem_violada",
];

export function decidir(o: OcorrenciaEzworker): Decisao {
  const valor = o.contexto?.valor_nf ?? 0;
  const franquia = o.contexto?.apolice?.franquia ?? 0;
  const cobreDescarga = o.contexto?.apolice?.cobre_descarga ?? false;

  const base = playbook(o, valor, franquia, cobreDescarga);

  const baixaConfianca = Object.entries(o.confianca ?? {}).filter(
    ([, v]) => v < LIMIAR_CONFIANCA,
  );
  const motivos: string[] = [];
  if (valor > ALCADA_VALOR) motivos.push(`valor acima da alçada (${brl(ALCADA_VALOR)})`);
  if (baixaConfianca.length)
    motivos.push(`baixa confiança em: ${baixaConfianca.map(([k]) => k).join(", ")}`);
  if (o.instrucoes_ignoradas?.length) motivos.push("mídia contém texto com instrução");

  return {
    ...base,
    requer_aprovacao: motivos.length > 0,
    motivo_aprovacao: motivos.length ? motivos.join("; ") : undefined,
  };
}

function playbook(
  o: OcorrenciaEzworker,
  valor: number,
  franquia: number,
  cobreDescarga: boolean,
): Omit<Decisao, "requer_aprovacao" | "motivo_aprovacao"> {
  if (o.tipo === "acidente" || o.subtipo === "tombamento") {
    return {
      pagador: "seguradora",
      playbook: "Acidente em rota",
      motivo: "Evento de trânsito coberto pelo RCTR-C. Montar dossiê para a seguradora.",
      documento: "dossie_sinistro",
      acoes: [
        "Registrar boletim de ocorrência na PRF",
        "Acionar seguradora: veículo, carga e seguro pessoal",
        "Assistência ao motorista e ajudante; avisar a família",
        "Anexar diário de bordo, disco de tacógrafo e notas fiscais",
        "Anexar prontuários médicos ao dossiê",
      ],
    };
  }

  if (o.tipo === "avaria" && SUBTIPOS_ACONDICIONAMENTO.includes(o.subtipo)) {
    return {
      pagador: "embarcador",
      playbook: "Avaria por acondicionamento",
      motivo:
        "Mau acondicionamento é excluído do RCTR-C. O custo é do embarcador; revisar embalagem.",
      documento: "cobranca",
      acoes: ["Notificar embarcador com evidências", "Abrir revisão de embalagem do produto"],
    };
  }

  if (o.tipo === "avaria" && o.subtipo === "carga_descarga" && !cobreDescarga) {
    return {
      pagador: "transportadora",
      playbook: "Avaria na carga/descarga sem cobertura",
      motivo: "Apólice não tem cobertura adicional de carga e descarga.",
      documento: "carta_protesto",
      acoes: ["Emitir carta-protesto à transportadora", "Anexar fotos e canhoto"],
    };
  }

  if (valor > 0 && valor < franquia) {
    return {
      pagador: valor < 300 ? "absorver" : "transportadora",
      playbook: "Abaixo da franquia",
      motivo: `Prejuízo de ${brl(valor)} abaixo da franquia de ${brl(franquia)}: não acionar seguro.`,
      documento: valor < 300 ? "nenhum" : "carta_protesto",
      acoes:
        valor < 300
          ? ["Registrar perda absorvida para o painel de padrões"]
          : ["Emitir carta-protesto à transportadora"],
    };
  }

  if (o.tipo === "avaria" || o.tipo === "extravio") {
    return {
      pagador: "seguradora",
      playbook: o.tipo === "avaria" ? "Avaria coberta" : "Extravio coberto",
      motivo: "Evento coberto e acima da franquia. Abrir sinistro no RCTR-C.",
      documento: "dossie_sinistro",
      acoes: ["Gerar dossiê de sinistro", "Enviar aviso à seguradora", "Protestar transportadora no prazo"],
    };
  }

  if (o.tipo === "recusa" || o.tipo === "reentrega" || o.tipo === "atraso") {
    return {
      pagador: "transportadora",
      playbook: "Falha de entrega",
      motivo: "Custo de reentrega, devolução ou SLA atribuído à transportadora pelo contrato.",
      documento: "cobranca",
      acoes: ["Agendar nova tentativa com o cliente", "Lançar cobrança na fatura do frete"],
    };
  }

  return {
    pagador: "revisao_humana",
    playbook: "Sem playbook",
    motivo: "Nenhuma regra se aplica. Analista decide.",
    documento: "nenhum",
    acoes: ["Analisar caso manualmente"],
  };
}

export function statusInicial(o: OcorrenciaEzworker, d: Decisao): StatusCaso {
  if (o.faltando?.length) return "aguardando_evidencia";
  if (d.requer_aprovacao) return "aguardando_aprovacao";
  return "novo";
}

export function prazoProtesto(o: OcorrenciaEzworker, recebidoEm: string): string {
  if (o.contexto?.prazo_protesto) return o.contexto.prazo_protesto;
  const d = new Date(recebidoEm);
  d.setDate(d.getDate() + PRAZO_PROTESTO_DIAS);
  return d.toISOString().slice(0, 10);
}

/** Dias de calendário entre hoje e a data (0 = vence hoje). */
export function diasAte(iso: string, agora = new Date()): number {
  const alvo = new Date(iso.slice(0, 10) + "T00:00:00");
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

/** Devolutiva da transportadora para o cliente que contratou o frete. */
export function gerarDevolutiva(c: Caso): string {
  const cliente = c.contexto?.cliente ?? "cliente";
  const nf = c.nf ? ` na entrega da NF ${c.nf}` : "";
  const tipo = ROTULO_TIPO[c.tipo].toLowerCase();
  const proximo: Record<Caso["decisao"]["pagador"], string> = {
    seguradora: "Já acionamos o seguro da carga para cobrir o prejuízo.",
    transportadora: "A ocorrência é de nossa responsabilidade e vamos arcar com a solução.",
    embarcador:
      "Pelas evidências, a causa foi o acondicionamento da mercadoria, que não é coberto pelo seguro de transporte. Precisamos alinhar a tratativa com vocês.",
    absorver: "O valor está abaixo da franquia; registramos a perda e seguimos com a reposição.",
    revisao_humana: "Nossa equipe está analisando o caso e retorna em até 1 dia útil.",
  };
  const prazo = c.contexto?.prazo_protesto
    ? ` O prazo para reclamação formal vai até ${new Date(c.contexto.prazo_protesto + "T12:00").toLocaleDateString("pt-BR")}.`
    : "";
  const falta = c.faltando?.length ? ` Ainda estamos reunindo: ${c.faltando.join(", ")}.` : "";
  return `Olá, ${cliente}. Registramos uma ocorrência de ${tipo}${nf} (caso ${c.id}). ${proximo[c.decisao.pagador]}${prazo}${falta}`;
}

export const ROTULO_TIPO: Record<OcorrenciaEzworker["tipo"], string> = {
  avaria: "Avaria",
  recusa: "Recusa",
  reentrega: "Reentrega",
  extravio: "Extravio",
  atraso: "Atraso",
  acidente: "Acidente",
};

export const ROTULO_PAGADOR: Record<Decisao["pagador"], string> = {
  seguradora: "Seguradora",
  transportadora: "Transportadora",
  embarcador: "Embarcador",
  absorver: "Absorver",
  revisao_humana: "Revisão humana",
};

export const ROTULO_STATUS: Record<StatusCaso, string> = {
  novo: "Em tratativa",
  aguardando_evidencia: "Reunindo evidências",
  aguardando_aprovacao: "Aguarda você",
  aprovado: "Tratativa aprovada",
  devolutiva_enviada: "Você respondeu",
  encerrado: "Encerrado",
};

export const ROTULO_DOCUMENTO: Record<Decisao["documento"], string> = {
  carta_protesto: "Carta-protesto",
  dossie_sinistro: "Dossiê de sinistro",
  cobranca: "Cobrança",
  nenhum: "Nenhum",
};

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------------------------
// Custos (F3): prejuízo da ocorrência e parte coberta pelo seguro.

export function custoOcorrencia(o: OcorrenciaEzworker): number {
  return o.contexto?.custo_ocorrencia ?? o.contexto?.valor_nf ?? 0;
}

export function custoSeguro(o: OcorrenciaEzworker, d: Decisao): number {
  if (o.contexto?.custo_seguro !== undefined) return o.contexto.custo_seguro;
  if (d.pagador !== "seguradora") return 0;
  return Math.max(0, custoOcorrencia(o) - (o.contexto?.apolice?.franquia ?? 0));
}

// ---------------------------------------------------------------------------
// Revisão (F5) e situação do registro (F3).

export const CAMPOS_REVISAVEIS: CampoRevisavel[] = [
  "tipo",
  "nf",
  "transportadora",
  "produto",
  "rota",
  "motorista",
  "valor_nf",
];

export const ROTULO_CAMPO: Record<CampoRevisavel, string> = {
  tipo: "Tipo",
  nf: "NF",
  transportadora: "Transportadora",
  produto: "Produto",
  rota: "Rota",
  motorista: "Motorista",
  valor_nf: "Valor da NF",
};

export function lerCampo(c: OcorrenciaEzworker, campo: CampoRevisavel): string | undefined {
  switch (campo) {
    case "rota":
      return c.contexto?.rota;
    case "motorista":
      return c.contexto?.motorista;
    case "valor_nf":
      return c.contexto?.valor_nf?.toString();
    default:
      return c[campo] as string | undefined;
  }
}

/** Aplica a correção no caso. Lança erro se o valor não for válido para o campo. */
export function escreverCampo(c: Caso, campo: CampoRevisavel, valor: string) {
  const v = valor.trim();
  if (!v) throw new Error("valor vazio");
  c.contexto ??= {};
  switch (campo) {
    case "rota":
      c.contexto.rota = v;
      break;
    case "motorista":
      c.contexto.motorista = v;
      break;
    case "valor_nf": {
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0) throw new Error("valor da NF inválido");
      c.contexto.valor_nf = n;
      break;
    }
    case "tipo":
      if (!(v in ROTULO_TIPO)) throw new Error(`tipo inválido: ${v}`);
      c.tipo = v as Caso["tipo"];
      break;
    default:
      c[campo] = v;
  }
}

/** Campos com confiança abaixo do limiar que ainda não foram confirmados/corrigidos. */
export function camposEmRevisao(c: OcorrenciaEzworker): CampoRevisavel[] {
  return CAMPOS_REVISAVEIS.filter((k) => (c.confianca?.[k] ?? 1) < LIMIAR_CONFIANCA);
}

export function situacaoRegistro(c: OcorrenciaEzworker): SituacaoRegistro {
  if (camposEmRevisao(c).length) return "em_revisao";
  if (c.faltando?.length) return "incompleto";
  return "completo";
}

export const ROTULO_SITUACAO: Record<SituacaoRegistro, string> = {
  completo: "Completo",
  incompleto: "Incompleto",
  em_revisao: "Em revisão",
};

export const ROTULO_EVIDENCIA: Record<string, string> = {
  foto_avaria: "Foto da avaria",
  foto_canhoto: "Foto do canhoto",
  danfe: "DANFE / nota fiscal",
  etiqueta: "Etiqueta",
  audio_relato: "Áudio do relato",
  video: "Vídeo",
  boletim_ocorrencia: "Boletim de ocorrência",
  diario_bordo: "Diário de bordo",
  tacografo: "Disco de tacógrafo",
  prontuario: "Prontuário médico",
  texto: "Relato em texto",
};

/** Sugere o tipo de evidência a partir do nome da pendência (ex.: "foto da etiqueta" → etiqueta). */
export function tipoParaPendencia(pendencia: string): string {
  const p = pendencia.toLowerCase();
  if (p.includes("etiqueta")) return "etiqueta";
  if (p.includes("tacógrafo") || p.includes("tacografo")) return "tacografo";
  if (p.includes("prontuário") || p.includes("prontuario")) return "prontuario";
  if (p.includes("boletim") || p.includes("prf")) return "boletim_ocorrencia";
  if (p.includes("nota") || p.includes("danfe") || p.includes("nf")) return "danfe";
  if (p.includes("canhoto")) return "foto_canhoto";
  if (p.includes("diário") || p.includes("diario")) return "diario_bordo";
  if (p.includes("vídeo") || p.includes("video")) return "video";
  if (p.includes("áudio") || p.includes("audio")) return "audio_relato";
  return "foto_avaria";
}

// ---------------------------------------------------------------------------
// Status único exibido ao cliente: junta o andamento da tratativa e a situação do
// registro em um só valor, pela prioridade do que pede ação primeiro.

export type StatusExibicao =
  | "encerrado"
  | "em_revisao"
  | "aguarda_voce"
  | "incompleto"
  | "respondido"
  | "aprovado"
  | "em_tratativa";

export const ORDEM_STATUS: StatusExibicao[] = [
  "em_revisao",
  "aguarda_voce",
  "incompleto",
  "em_tratativa",
  "aprovado",
  "respondido",
  "encerrado",
];

export const ROTULO_STATUS_EXIBICAO: Record<StatusExibicao, string> = {
  encerrado: "Encerrado",
  em_revisao: "Em revisão",
  aguarda_voce: "Aguarda você",
  incompleto: "Incompleto",
  respondido: "Você respondeu",
  aprovado: "Tratativa aprovada",
  em_tratativa: "Em tratativa",
};

export const DESCRICAO_STATUS_EXIBICAO: Record<StatusExibicao, string> = {
  encerrado: "Caso encerrado.",
  em_revisao: "Há dados extraídos com baixa confiança aguardando revisão.",
  aguarda_voce: "A tratativa precisa da sua aprovação.",
  incompleto: "Faltam evidências para fechar o dossiê.",
  respondido: "Você respondeu à transportadora.",
  aprovado: "Tratativa aprovada; em andamento.",
  em_tratativa: "Registro completo; a transportadora está tratando.",
};

export function statusExibicao(c: Caso): StatusExibicao {
  if (c.status === "encerrado") return "encerrado";
  if (camposEmRevisao(c).length) return "em_revisao";
  // Precisa da aprovação do cliente enquanto não foi aprovada nem respondida.
  if (c.status === "aguardando_aprovacao" || (c.decisao.requer_aprovacao && !["aprovado", "devolutiva_enviada"].includes(c.status)))
    return "aguarda_voce";
  if (c.faltando?.length) return "incompleto";
  if (c.status === "devolutiva_enviada") return "respondido";
  if (c.status === "aprovado") return "aprovado";
  return "em_tratativa";
}

// ---------------------------------------------------------------------------
// Subtipo legível: o ezworker manda códigos como "colisao_frontal"; a tela mostra "Colisão frontal".

export const ROTULO_SUBTIPO: Record<string, string> = {
  embalagem_violada: "Embalagem violada",
  mau_acondicionamento: "Mau acondicionamento",
  embalagem_impropria: "Embalagem imprópria",
  carga_descarga: "Carga e descarga",
  amassado_leve: "Amassado leve",
  colisao_frontal: "Colisão frontal",
  tombamento: "Tombamento",
  pedido_divergente: "Pedido divergente",
  destinatario_ausente: "Destinatário ausente",
  volume_nao_localizado: "Volume não localizado",
  bloqueio_rodovia: "Bloqueio na rodovia",
  atraso_rota: "Atraso na rota",
};

/** Rótulo do subtipo; para códigos desconhecidos, troca "_" por espaço e capitaliza. */
export function rotuloSubtipo(subtipo?: string): string {
  if (!subtipo) return "";
  if (ROTULO_SUBTIPO[subtipo]) return ROTULO_SUBTIPO[subtipo];
  const texto = subtipo.replace(/[_-]+/g, " ").trim().toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
