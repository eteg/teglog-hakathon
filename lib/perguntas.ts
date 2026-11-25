// Pergunta do gestor (F4). Interpreta a pergunta por regras simples, monta um SQL sobre a
// tabela `casos` do D1, executa e devolve a resposta em R$ com a consulta usada.
// Provisório até o endpoint do back (que pode usar IA) ficar pronto: mesmo contrato de resposta.
import 'server-only'

import { getD1 } from '@/lib/db'
import { listar } from './store'

export type Metrica = 'custo' | 'seguro' | 'quantidade'
export type Dimensao = 'rota' | 'transportadora' | 'motorista' | 'produto' | 'tipo' | 'cliente'

export interface RespostaPergunta {
  pergunta: string
  resposta: string
  valor: number
  unidade: 'BRL' | 'ocorrencias'
  interpretacao: { metrica: Metrica; dimensao?: Dimensao; filtros: string[]; periodo?: string }
  /** SQL executado no D1 (parâmetros já substituídos, só para exibição). */
  consulta: string
  linhas: { grupo?: string; valor: number; casos: number }[]
}

const METRICA_SQL: Record<Metrica, string> = {
  custo: "COALESCE(json_extract(dados, '$.contexto.custo_ocorrencia'), json_extract(dados, '$.contexto.valor_nf'), 0)",
  seguro: "COALESCE(json_extract(dados, '$.contexto.custo_seguro'), 0)",
  quantidade: '1',
}

const DIMENSAO_SQL: Record<Dimensao, string> = {
  rota: "json_extract(dados, '$.contexto.rota')",
  transportadora: "json_extract(dados, '$.transportadora')",
  motorista: "json_extract(dados, '$.contexto.motorista')",
  produto: "json_extract(dados, '$.produto')",
  tipo: "json_extract(dados, '$.tipo')",
  cliente: "json_extract(dados, '$.contexto.cliente')",
}

const ROTULO_DIM: Record<Dimensao, string> = {
  rota: 'rota',
  transportadora: 'transportadora',
  motorista: 'motorista',
  produto: 'produto',
  tipo: 'tipo de ocorrência',
  cliente: 'cliente',
}

const TIPOS = ['avaria', 'recusa', 'reentrega', 'extravio', 'atraso', 'acidente']

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export async function responderPergunta(pergunta: string): Promise<RespostaPergunta> {
  const p = norm(pergunta)

  const metrica: Metrica = /\bseguro|segurad|indeniz/.test(p)
    ? 'seguro'
    : /\bquant[oa]s\b|\bnumero de\b|\bqtd/.test(p)
      ? 'quantidade'
      : 'custo'

  const dimensao = (Object.keys(DIMENSAO_SQL) as Dimensao[]).find((d) =>
    new RegExp(`\\b(por|qual|quais|cada|pior|piores|maior|maiores)\\b.*\\b${d === 'tipo' ? 'tipos?' : d + 's?'}\\b`).test(p),
  )

  // Filtros: tipo citado e valores conhecidos (transportadora, rota, motorista, produto) citados na pergunta.
  const where: string[] = []
  const params: string[] = []
  const filtros: string[] = []
  const tipo = TIPOS.find((t) => new RegExp(`\\b${t}s?\\b`).test(p))
  if (tipo && dimensao !== 'tipo') {
    where.push(`${DIMENSAO_SQL.tipo} = ?`)
    params.push(tipo)
    filtros.push(`tipo = ${tipo}`)
  }

  const casos = await listar()
  const conhecidos: [Dimensao, (string | undefined)[]][] = [
    ['transportadora', casos.map((c) => c.transportadora)],
    ['rota', casos.map((c) => c.contexto?.rota)],
    ['motorista', casos.map((c) => c.contexto?.motorista)],
    ['produto', casos.map((c) => c.produto)],
  ]
  for (const [dim, valores] of conhecidos) {
    if (dim === dimensao) continue
    const achado = [...new Set(valores.filter(Boolean) as string[])].find((v) => {
      const chave = norm(v).replace(/^transportadora /, '').split(/[ →(]/)[0]
      return chave.length >= 3 && new RegExp(`\\b${chave}\\b`).test(p)
    })
    if (achado) {
      where.push(`${DIMENSAO_SQL[dim]} = ?`)
      params.push(achado)
      filtros.push(`${dim} = ${achado}`)
    }
  }

  let periodo: string | undefined
  const desde = new Date()
  if (/\bhoje\b/.test(p)) {
    desde.setHours(0, 0, 0, 0)
    periodo = 'hoje'
  } else if (/\bsemana\b|7 dias/.test(p)) {
    desde.setDate(desde.getDate() - 7)
    periodo = 'últimos 7 dias'
  } else if (/\bmes\b|30 dias/.test(p)) {
    desde.setDate(desde.getDate() - 30)
    periodo = 'últimos 30 dias'
  }
  if (periodo) {
    where.push('recebido_em >= ?')
    params.push(desde.toISOString())
  }

  const agregado = metrica === 'quantidade' ? 'COUNT(*)' : `SUM(${METRICA_SQL[metrica]})`
  const whereSql = where.length ? `\nWHERE ${where.join('\n  AND ')}` : ''
  const sql = dimensao
    ? `SELECT ${DIMENSAO_SQL[dimensao]} AS grupo,\n       ${agregado} AS valor,\n       COUNT(*) AS casos\nFROM casos${whereSql}\nGROUP BY grupo\nORDER BY valor DESC\nLIMIT 10`
    : `SELECT ${agregado} AS valor,\n       COUNT(*) AS casos\nFROM casos${whereSql}`

  const d1 = await getD1()
  const { results } = await d1
    .prepare(sql)
    .bind(...params)
    .all<{ grupo?: string; valor: number | null; casos: number }>()
  const linhas = results.map((r) => ({ grupo: r.grupo ?? undefined, valor: r.valor ?? 0, casos: r.casos }))

  let i = 0
  const consulta = sql.replace(/\?/g, () => `'${String(params[i++]).replace(/'/g, "''")}'`)

  const unidade = metrica === 'quantidade' ? 'ocorrencias' : 'BRL'
  const fmt = (v: number) => (unidade === 'BRL' ? brl(v) : `${v} ocorrência${v === 1 ? '' : 's'}`)
  const nomeMetrica = metrica === 'seguro' ? 'coberto pelo seguro' : metrica === 'custo' ? 'de custo' : ''
  const maiorQue = metrica === 'seguro' ? 'maior valor coberto pelo seguro' : metrica === 'custo' ? 'maior custo' : 'mais ocorrências'
  const contexto = [filtros.join(', '), periodo].filter(Boolean).join(' · ')
  const sufixo = contexto ? ` (${contexto})` : ''

  let resposta: string
  let valor: number
  if (dimensao) {
    const topo = linhas[0]
    valor = topo?.valor ?? 0
    resposta = topo
      ? `${ROTULO_DIM[dimensao][0].toUpperCase()}${ROTULO_DIM[dimensao].slice(1)} com ${maiorQue}: ${topo.grupo ?? 'não informado'}, com ${fmt(topo.valor)} em ${topo.casos} ocorrência${topo.casos === 1 ? '' : 's'}${sufixo}.`
      : `Nenhuma ocorrência encontrada${sufixo}.`
  } else {
    valor = linhas[0]?.valor ?? 0
    const n = linhas[0]?.casos ?? 0
    resposta =
      metrica === 'quantidade'
        ? `${fmt(valor)}${sufixo}.`
        : `Total ${nomeMetrica}: ${fmt(valor)} em ${n} ocorrência${n === 1 ? '' : 's'}${sufixo}.`
  }

  return {
    pergunta,
    resposta,
    valor,
    unidade,
    interpretacao: { metrica, dimensao, filtros, periodo },
    consulta,
    linhas,
  }
}
