// Persistência dos casos no Cloudflare D1 (tabela `casos`).
import 'server-only'

import { count, desc, eq } from 'drizzle-orm'

import { casos } from '@/db/schema'
import { getDb } from '@/lib/db'
import {
  ROTULO_CAMPO,
  camposEmRevisao,
  custoOcorrencia,
  custoSeguro,
  decidir,
  diasAte,
  escreverCampo,
  gerarDevolutiva,
  lerCampo,
  prazoProtesto,
  situacaoRegistro,
  statusExibicao,
  statusInicial,
  ORDEM_STATUS,
} from './regras'
import { armazenarEvidencias, guardarArquivo } from './evidencias'
import { carregarTracados, localNaRota, obterRota } from './rotas'
import { CASOS_SEMENTE } from './semente'
import type { CampoRevisavel, Caso, Evidencia, OcorrenciaEzworker, PaginaCasos, StatusCaso, TipoEvidencia } from './types'

const PRIMEIRO_NUMERO = 1040

/** Transforma o JSON do ezworker em caso: aplica regras, prazo e devolutiva. */
function montarCaso(o: OcorrenciaEzworker, id: string): Caso {
  const recebido_em = o.recebido_em ?? new Date().toISOString()
  const decisao = decidir(o)
  const caso: Caso = {
    ...o,
    id,
    recebido_em,
    contexto: {
      ...o.contexto,
      prazo_protesto: prazoProtesto(o, recebido_em),
      // Gravados no caso para a pergunta do gestor poder somar via SQL.
      custo_ocorrencia: custoOcorrencia(o),
      custo_seguro: custoSeguro(o, decisao),
    },
    decisao,
    custos_informados: {
      ocorrencia: o.contexto?.custo_ocorrencia !== undefined,
      seguro: o.contexto?.custo_seguro !== undefined,
    },
    status: statusInicial(o, decisao),
    timeline: [
      { em: recebido_em, titulo: `Recebido via ezworker (${o.canal})` },
      { em: recebido_em, titulo: `Playbook: ${decisao.playbook}`, detalhe: decisao.motivo },
    ],
  }
  caso.devolutiva = gerarDevolutiva(caso)
  return caso
}

async function inserir(o: OcorrenciaEzworker, extra?: Pick<Caso, 'relato_original' | 'pii_mascarado'>): Promise<Caso> {
  const db = await getDb()
  // Arquivos em base64 não vão para o D1: só a chave no R2, depois de copiados.
  const semConteudo = o.evidencias.map(({ conteudo_base64: _, ...e }) => (void _, e))
  // O número do caso vem do autoincremento: insere com id provisório e renomeia.
  const provisorio = o.id ?? `tmp-${crypto.randomUUID()}`
  const base = { ...montarCaso({ ...o, evidencias: semConteudo }, provisorio), ...extra }
  const rota = await obterRota(o.contexto?.rota)
  const [linha] = await db
    .insert(casos)
    .values({
      id: provisorio,
      status: base.status,
      recebidoEm: base.recebido_em,
      rotaId: rota?.id,
      latitude: o.local.latitude,
      longitude: o.local.longitude,
      dados: base,
    })
    .onConflictDoNothing({ target: casos.id })
    .returning({ seq: casos.seq })

  if (!linha) return base // id do ezworker já recebido antes (reenvio)

  const id = o.id ?? `OC-${PRIMEIRO_NUMERO + linha.seq}`
  const caso: Caso = { ...base, id }
  // Copia fotos/áudios/vídeos para o R2 com SHA-256 calculado.
  if (o.evidencias.some((e) => e.url || e.conteudo_base64)) {
    caso.evidencias = await armazenarEvidencias(id, o.evidencias)
    const falhas = caso.evidencias.filter((e) => e.erro_armazenamento)
    caso.timeline.push({
      em: new Date().toISOString(),
      titulo: `Evidências copiadas para o R2 (${caso.evidencias.length - falhas.length}/${caso.evidencias.length})`,
      detalhe: falhas.length ? falhas.map((e) => e.erro_armazenamento).join('; ') : undefined,
    })
  }
  caso.devolutiva = gerarDevolutiva(caso)
  await db.update(casos).set({ id, dados: caso }).where(eq(casos.seq, linha.seq))
  return caso
}

/** Banco vazio (primeiro acesso): carrega os casos de exemplo da demo. */
async function semearSeVazio() {
  const db = await getDb()
  const [{ total }] = await db.select({ total: count() }).from(casos)
  if (total > 0) return
  for (const o of CASOS_SEMENTE) await inserir({ ...o, local: await localNaRota(o.contexto?.rota, o.id) })
}

/** Um ponto por caso para o mapa de calor; caso antigo sem coordenada cai num ponto da rota dele. */
export async function listarPontos() {
  await semearSeVazio()
  const db = await getDb()
  const linhas = await db
    .select({ id: casos.id, latitude: casos.latitude, longitude: casos.longitude, dados: casos.dados })
    .from(casos)
  const localNoTracado = await carregarTracados()
  return linhas.map(({ id, latitude, longitude, dados }) => ({
    id,
    tipo: dados.tipo,
    rota: dados.contexto?.rota ?? null,
    prejuizo: dados.contexto?.custo_ocorrencia ?? dados.contexto?.valor_nf ?? 0,
    local: latitude !== null && longitude !== null ? { latitude, longitude } : localNoTracado(dados.contexto?.rota, id),
  }))
}

export async function receber(o: OcorrenciaEzworker, extra?: Pick<Caso, 'relato_original' | 'pii_mascarado'>): Promise<Caso> {
  return inserir(o, extra)
}

export async function listar(): Promise<Caso[]> {
  await semearSeVazio()
  const db = await getDb()
  const linhas = await db.select({ dados: casos.dados }).from(casos).orderBy(desc(casos.recebidoEm))
  return linhas.map((l) => l.dados)
}

export interface FiltrosCasos {
  q?: string
  tipo?: string
  status?: string
  transportadora?: string
  motorista?: string
  rota?: string
  situacao?: string
  /** Campo de ordenação: id | tipo | valor | prazo | status | motorista */
  ordenar?: string
  direcao?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

const ORDENADORES: Record<string, (c: Caso) => string | number> = {
  id: (c) => c.id,
  tipo: (c) => c.tipo,
  valor: (c) => c.contexto?.valor_nf ?? 0,
  prazo: (c) => (c.contexto?.prazo_protesto ? diasAte(c.contexto.prazo_protesto) : Number.MAX_SAFE_INTEGER),
  status: (c) => ORDEM_STATUS.indexOf(statusExibicao(c)),
  motorista: (c) => c.contexto?.motorista ?? '',
}

const unicos = (v: (string | undefined)[]) => [...new Set(v.filter((x): x is string => Boolean(x)))].sort()

/** Lista com filtros e paginação (contrato F2). Filtra em memória: volume de demo. */
export async function listarPagina(f: FiltrosCasos): Promise<PaginaCasos> {
  const todos = await listar()
  const q = f.q?.trim().toLowerCase()
  const filtrados = todos.filter((c) => {
    if (f.tipo && c.tipo !== f.tipo) return false
    if (f.status && statusExibicao(c) !== f.status && c.status !== f.status) return false
    if (f.transportadora && c.transportadora !== f.transportadora) return false
    if (f.motorista && c.contexto?.motorista !== f.motorista) return false
    if (f.rota && c.contexto?.rota !== f.rota) return false
    if (f.situacao && situacaoRegistro(c) !== f.situacao) return false
    if (q) {
      const alvo = [c.id, c.nf, c.resumo, c.transportadora, c.contexto?.rota, c.contexto?.cliente, c.contexto?.motorista, c.produto]
      if (!alvo.some((v) => v && String(v).toLowerCase().includes(q))) return false
    }
    return true
  })

  const chave = f.ordenar ? ORDENADORES[f.ordenar] : undefined
  if (chave) {
    const dir = f.direcao === 'desc' ? -1 : 1
    filtrados.sort((a, b) => {
      const x = chave(a)
      const y = chave(b)
      return x > y ? dir : x < y ? -dir : 0
    })
  }

  const pageSize = Math.min(Math.max(f.pageSize ?? 10, 1), 100)
  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const page = Math.min(Math.max(f.page ?? 1, 1), totalPages)
  const abertos = filtrados.filter((c) => c.status !== 'encerrado')

  return {
    data: filtrados.slice((page - 1) * pageSize, page * pageSize),
    total: filtrados.length,
    page,
    pageSize,
    totalPages,
    facetas: {
      tipos: unicos(todos.map((c) => c.tipo)),
      status: unicos(todos.map((c) => statusExibicao(c))),
      transportadoras: unicos(todos.map((c) => c.transportadora)),
      motoristas: unicos(todos.map((c) => c.contexto?.motorista)),
      rotas: unicos(todos.map((c) => c.contexto?.rota)),
    },
    resumo: {
      abertos: abertos.length,
      valorAberto: abertos.reduce((s, c) => s + (c.contexto?.valor_nf ?? 0), 0),
      prazoCurto: abertos.filter((c) => c.contexto?.prazo_protesto && diasAte(c.contexto.prazo_protesto) <= 3).length,
      aguardando: abertos.filter((c) => statusExibicao(c) === 'aguarda_voce').length,
      emRevisao: abertos.filter((c) => statusExibicao(c) === 'em_revisao').length,
    },
  }
}

/** Casos com campos de baixa confiança ainda não revisados (fila F5). */
export async function filaRevisao(): Promise<Caso[]> {
  return (await listar()).filter((c) => c.status !== 'encerrado' && camposEmRevisao(c).length > 0)
}

export async function obter(id: string): Promise<Caso | undefined> {
  const db = await getDb()
  const [linha] = await db.select({ dados: casos.dados }).from(casos).where(eq(casos.id, id)).limit(1)
  return linha?.dados
}

export async function atualizarStatus(
  id: string,
  status: StatusCaso,
  titulo: string,
  detalhe?: string,
): Promise<Caso | undefined> {
  const caso = await obter(id)
  if (!caso) return undefined
  caso.status = status
  caso.timeline.push({ em: new Date().toISOString(), titulo, detalhe })
  const db = await getDb()
  await db.update(casos).set({ status, dados: caso }).where(eq(casos.id, id))
  return caso
}

async function salvar(caso: Caso) {
  const db = await getDb()
  await db.update(casos).set({ status: caso.status, dados: caso }).where(eq(casos.id, caso.id))
}

/** Revisão humana de um campo (F5): confirma o valor extraído ou grava a correção. */
export async function revisarCampo(
  id: string,
  campo: CampoRevisavel,
  acao: 'confirmar' | 'corrigir',
  valor?: string,
): Promise<Caso | undefined> {
  const caso = await obter(id)
  if (!caso) return undefined
  caso.revisao ??= { confirmados: [], correcoes: [] }
  const agora = new Date().toISOString()
  const antes = lerCampo(caso, campo)

  if (acao === 'corrigir') {
    escreverCampo(caso, campo, valor ?? '')
    caso.revisao.correcoes.push({ campo, de: antes, para: lerCampo(caso, campo)!, em: agora })
    caso.timeline.push({ em: agora, titulo: `Campo corrigido: ${ROTULO_CAMPO[campo]}`, detalhe: `${antes ?? '—'} → ${lerCampo(caso, campo)}` })
  } else {
    caso.timeline.push({ em: agora, titulo: `Campo confirmado: ${ROTULO_CAMPO[campo]}`, detalhe: antes })
  }
  if (!caso.revisao.confirmados.includes(campo)) caso.revisao.confirmados.push(campo)
  caso.confianca = { ...caso.confianca, [campo]: 1 }

  // Dados mudaram: refaz a tratativa (alçada, pagador, custos e devolutiva).
  caso.decisao = decidir(caso)
  recalcularCustos(caso)
  if (caso.status === 'aguardando_aprovacao' && !caso.decisao.requer_aprovacao) caso.status = statusInicial(caso, caso.decisao)
  caso.devolutiva = gerarDevolutiva(caso)
  await salvar(caso)
  return caso
}

/** Recalcula só os custos derivados; os informados pelo ezworker são mantidos. */
function recalcularCustos(caso: Caso) {
  const ctx = { ...caso.contexto }
  if (!caso.custos_informados?.ocorrencia) delete ctx.custo_ocorrencia
  if (!caso.custos_informados?.seguro) delete ctx.custo_seguro
  const base = { ...caso, contexto: ctx }
  caso.contexto = { ...ctx, custo_ocorrencia: custoOcorrencia(base), custo_seguro: custoSeguro(base, caso.decisao) }
}

/** Cliente/analista anexa uma evidência ao caso (vai para o R2 e entra no dossiê). */
export async function anexarEvidencia(
  id: string,
  arquivo: { dados: ArrayBuffer; contentType: string; nome: string },
  meta: { tipo: TipoEvidencia; descricao?: string; resolve?: string },
): Promise<Caso | undefined> {
  const caso = await obter(id)
  if (!caso) return undefined
  const salvo = await guardarArquivo(id, arquivo.dados, arquivo.contentType, arquivo.nome)
  const agora = new Date().toISOString()
  const evidencia: Evidencia = {
    tipo: meta.tipo,
    legivel: true,
    descricao: meta.descricao || meta.resolve || arquivo.nome,
    capturada_em: agora,
    ...salvo,
  }
  caso.evidencias = [...caso.evidencias, evidencia]
  if (meta.resolve) caso.faltando = caso.faltando.filter((f) => f !== meta.resolve)
  caso.timeline.push({
    em: agora,
    titulo: meta.resolve ? `Pendência resolvida: ${meta.resolve}` : 'Evidência anexada',
    detalhe: `${arquivo.nome} · SHA-256 ${salvo.hash?.slice(0, 12)}…`,
  })
  if (caso.status === 'aguardando_evidencia' && caso.faltando.length === 0) caso.status = statusInicial(caso, caso.decisao)
  caso.devolutiva = gerarDevolutiva(caso)
  await salvar(caso)
  return caso
}
