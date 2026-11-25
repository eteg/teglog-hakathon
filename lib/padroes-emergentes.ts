// Padrões emergentes (F6): agrupa relatos parecidos e guarda o nome dado pelo analista.
// Até o back ter o agrupamento por similaridade, "parecido" = mesmo tipo + subtipo.
import 'server-only'

import { padroes } from '@/db/schema'
import { getDb } from '@/lib/db'
import { custoOcorrencia, ROTULO_TIPO } from './regras'
import { listar } from './store'
import type { TipoOcorrencia } from './types'

export interface GrupoPadrao {
  chave: string
  tipo: TipoOcorrencia
  subtipo: string
  /** Nome dado pelo analista; sem nome, é sugerido a partir do tipo/subtipo. */
  nome?: string
  sugestao: string
  quantidade: number
  custo: number
  emergente: boolean
  rotas: { rota: string; quantidade: number; custo: number }[]
  transportadoras: string[]
  casos: { id: string; resumo?: string }[]
}

const MIN_EMERGENTE = 2

export async function listarPadroes(): Promise<GrupoPadrao[]> {
  const [todos, nomes] = await Promise.all([listar(), getDb().then((db) => db.select().from(padroes))])
  const nomePorChave = new Map(nomes.map((n) => [n.chave, n.nome]))
  const grupos = new Map<string, GrupoPadrao>()

  for (const c of todos) {
    const chave = `${c.tipo}:${c.subtipo}`
    const g =
      grupos.get(chave) ??
      ({
        chave,
        tipo: c.tipo,
        subtipo: c.subtipo,
        nome: nomePorChave.get(chave),
        sugestao: `${ROTULO_TIPO[c.tipo]}: ${c.subtipo.replace(/_/g, ' ')}`,
        quantidade: 0,
        custo: 0,
        emergente: false,
        rotas: [],
        transportadoras: [],
        casos: [],
      } satisfies GrupoPadrao)

    const custo = custoOcorrencia(c)
    g.quantidade++
    g.custo += custo
    g.casos.push({ id: c.id, resumo: c.resumo })
    const rota = c.contexto?.rota ?? 'Rota não informada'
    const r = g.rotas.find((x) => x.rota === rota)
    if (r) {
      r.quantidade++
      r.custo += custo
    } else g.rotas.push({ rota, quantidade: 1, custo })
    if (c.transportadora && !g.transportadoras.includes(c.transportadora)) g.transportadoras.push(c.transportadora)
    grupos.set(chave, g)
  }

  return [...grupos.values()]
    .map((g) => ({ ...g, emergente: g.quantidade >= MIN_EMERGENTE, rotas: g.rotas.sort((a, b) => b.custo - a.custo) }))
    .sort((a, b) => Number(b.emergente) - Number(a.emergente) || b.custo - a.custo)
}

export async function nomearPadrao(chave: string, nome: string) {
  const db = await getDb()
  const n = nome.trim()
  if (!n) throw new Error('nome vazio')
  await db
    .insert(padroes)
    .values({ chave, nome: n, atualizadoEm: new Date().toISOString() })
    .onConflictDoUpdate({ target: padroes.chave, set: { nome: n, atualizadoEm: new Date().toISOString() } })
}
