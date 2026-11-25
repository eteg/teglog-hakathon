// Simula a resposta do ezworker quando EZWORKER_URL não está configurada.
// Gera uma ocorrência no mesmo contrato do webhook real.
import type { Canal, Evidencia, OcorrenciaEzworker } from "./types";

const diasAFrente = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

export function mockOcorrencia(canal: Canal, nome: string, texto: string, midiaUrl?: string): OcorrenciaEzworker {
  const t = `${nome} ${texto}`.toLowerCase();
  const injecao = /aprovar|indeniza(ç|c)ão integral|ignore/.test(t)
    ? [texto.match(/[^.!?\n]*(aprovar|indeniza|ignore)[^.!?\n]*/i)?.[0]?.trim() ?? texto]
    : undefined;

  const evid: Evidencia[] = [];
  if (midiaUrl)
    evid.push({ tipo: canal === "audio" ? "audio_relato" : canal === "video" ? "video" : "foto_avaria", legivel: true, url: midiaUrl });
  if (texto) evid.push({ tipo: "texto", legivel: true, descricao: "Relato em texto" });

  if (canal === "audio" && /ptt|acidente|colis|tomb/.test(t)) {
    return {
      canal,
      tipo: "acidente",
      subtipo: "colisao_frontal",
      nf: "000874410",
      transportadora: "Frota própria",
      produto: "material de construção",
      volumes_afetados: 36,
      gravidade: "alta",
      resumo: "Relato por áudio de colisão em rota. Carga com perda total; motorista atendido.",
      transcricao: "Transcrição simulada (modo mock). Configure EZWORKER_URL para transcrição real.",
      evidencias: evid,
      faltando: ["boletim de ocorrência PRF", "disco de tacógrafo", "nota fiscal"],
      confianca: { tipo: 0.95, nf: 0.55, rota: 0.8 },
      contexto: {
        valor_nf: 41_800,
        apolice: { franquia: 5_000, cobre_descarga: true },
        rota: "Salvador → Brumado",
        cliente: "Construmais Brumado",
        motorista: "Edson R. (frota)",
        prazo_prometido: diasAFrente(2),
      },
      instrucoes_ignoradas: injecao,
    };
  }

  if (canal === "text" && /recus|devolv|errad|divergen/.test(t)) {
    return {
      canal,
      tipo: "recusa",
      subtipo: "pedido_divergente",
      codigo_ocoren: "13",
      nf: "000552777",
      transportadora: "Transportadora Alfa",
      produto: "móveis",
      volumes_afetados: 1,
      gravidade: "media",
      resumo: texto.slice(0, 140),
      transcricao: texto,
      evidencias: evid,
      faltando: [],
      confianca: { tipo: 0.88, nf: 0.6 },
      contexto: {
        valor_nf: 2_450,
        apolice: { franquia: 2_000, cobre_descarga: true },
        rota: "Curitiba → Florianópolis",
        cliente: "Cliente",
        motorista: "Rafael S.",
      },
      instrucoes_ignoradas: injecao,
    };
  }

  // Padrão: avaria por foto/vídeo (o caso de demo da proposta)
  return {
    canal,
    tipo: "avaria",
    subtipo: "embalagem_violada",
    codigo_ocoren: "26",
    nf: "000123456",
    transportadora: "Transportadora Beta",
    produto: "eletrônico",
    volumes_afetados: 2,
    gravidade: "alta",
    resumo: texto ? texto.slice(0, 140) : "Caixa com lateral rasgada e produto avariado na entrega.",
    evidencias: evid,
    faltando: ["foto da etiqueta"],
    confianca: { tipo: 0.94, nf: 0.71, produto: 0.9 },
    contexto: {
      valor_nf: 18_450,
      apolice: { franquia: 2_000, cobre_descarga: false },
      cobertura_aplicavel: "nao_coberto_acondicionamento",
      clima_no_evento: { chuva_mm: 32 },
      rota: "São Paulo → Manaus",
      cliente: "Loja Eletro Norte",
      motorista: "Marcos L.",
      prazo_prometido: diasAFrente(3),
      prazo_protesto: diasAFrente(8),
    },
    instrucoes_ignoradas: injecao,
  };
}
