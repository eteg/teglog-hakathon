// Medições da tela de qualidade para os critérios 4 (acesso mínimo) e 6 (dados pessoais).
// Tudo é medido no próprio sistema, na hora: nada de número digitado à mão.
import 'server-only'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isNotNull } from 'drizzle-orm'

import { tarefasAnalise } from '@/db/schema'
import { getDb } from '@/lib/db'
import { encontrarPII, mascararPII } from './pii'
import { gerarAmostraPII } from './pii-amostra'
import { FERRAMENTAS_ASSISTENTE, PAPEL_DO_ASSISTENTE, ROTAS, acaoDaRota } from './permissoes'
import { listar } from './store'

// ---------------------------------------------------------------------------
// Critério 6: dados pessoais

export interface MedicaoPII {
  amostra: { relatos: number; plantados: number; escondidos: number; percentual: number; iscas: number; iscasAlteradas: number }
  varredura: { registrosVerificados: number; encontrados: number; exemplos: { origem: string; tipo: string }[] }
}

export async function medirPII(): Promise<MedicaoPII> {
  const amostra = gerarAmostraPII()
  let plantados = 0
  let escondidos = 0
  let iscas = 0
  let iscasAlteradas = 0
  for (const r of amostra) {
    const saida = mascararPII(r.texto).texto
    for (const v of r.pii) {
      plantados++
      if (!saida.includes(v)) escondidos++
    }
    for (const isca of r.iscas) {
      iscas++
      if (!saida.includes(isca)) iscasAlteradas++
    }
  }

  // Varredura do que saiu para a IA (payload de cada tarefa) e do que voltou dela (textos do caso).
  const db = await getDb()
  const tarefas = await db
    .select({ id: tarefasAnalise.id, payload: tarefasAnalise.payloadEnvio })
    .from(tarefasAnalise)
    .where(isNotNull(tarefasAnalise.payloadEnvio))
  const casos = await listar()
  const registros: { origem: string; texto: string }[] = [
    ...tarefas.map((t) => ({ origem: `tarefa ${t.id} (envio ao ezworker)`, texto: t.payload ?? '' })),
    ...casos.map((c) => ({
      origem: `${c.id} (retorno da IA)`,
      texto: [c.resumo, c.transcricao, ...c.evidencias.map((e) => e.descricao)].filter(Boolean).join(' '),
    })),
  ]
  const exemplos: MedicaoPII['varredura']['exemplos'] = []
  let encontrados = 0
  for (const r of registros) {
    const achados = encontrarPII(r.texto)
    encontrados += achados.length
    for (const a of achados) if (exemplos.length < 10) exemplos.push({ origem: r.origem, tipo: a.tipo })
  }

  return {
    amostra: {
      relatos: amostra.length,
      plantados,
      escondidos,
      percentual: plantados ? Math.round((escondidos / plantados) * 1000) / 10 : 100,
      iscas,
      iscasAlteradas,
    },
    varredura: { registrosVerificados: registros.length, encontrados, exemplos },
  }
}

// ---------------------------------------------------------------------------
// Critério 4: acesso mínimo (teste em tempo real com a chave de leitura)

type Handler = (req: Request, ctx: never) => Promise<Response>

export interface ResultadoAcesso {
  descricao: string
  metodo: string
  rota: string
  chave: 'leitura' | 'nenhuma'
  esperado: number
  obtido: number
  ok: boolean
  resposta?: unknown
}

export interface VerificacaoAcesso {
  configurado: boolean
  resultados: ResultadoAcesso[]
  rotasEscrita: number
  /** Tentativas de alterar dados feitas com a chave de leitura, e quantas foram recusadas (403). */
  tentativasEscrita: number
  recusadas: number
  ferramentasAssistente: { nome: string; descricao: string; escreve: boolean }[]
  funcoesEscritaAssistente: number
  papelAssistente: string
}

export async function verificarAcesso(): Promise<VerificacaoAcesso> {
  const { env } = await getCloudflareContext({ async: true })
  const e = env as unknown as { READ_API_TOKEN?: string; READ_API_KEY?: string }
  const chaveLeitura = e.READ_API_TOKEN || e.READ_API_KEY

  const ferramentasAssistente = FERRAMENTAS_ASSISTENTE.map((f) => ({
    nome: f.nome,
    descricao: f.descricao,
    escreve: acaoDaRota(f.metodo, f.rota) !== 'ler',
  }))
  const base = {
    ferramentasAssistente,
    funcoesEscritaAssistente: ferramentasAssistente.filter((f) => f.escreve).length,
    papelAssistente: PAPEL_DO_ASSISTENTE,
    rotasEscrita: ROTAS.filter((r) => r.acao === 'escrever').length,
  }
  if (!chaveLeitura) return { ...base, configurado: false, resultados: [], tentativasEscrita: 0, recusadas: 0 }

  // Os handlers são chamados direto (sem rede): é o mesmo código que responde em produção.
  const [ocorrencia, evidencias, padrao, arquivos, simular, mock, lista, perguntas] = await Promise.all([
    import('@/app/api/ocorrencias/[id]/route'),
    import('@/app/api/ocorrencias/[id]/evidencias/route'),
    import('@/app/api/padroes/[chave]/route'),
    import('@/app/api/files/route'),
    import('@/app/api/simular/route'),
    import('@/app/api/mock/ezworker/[canal]/route'),
    import('@/app/api/ocorrencias/route'),
    import('@/app/api/perguntas/route'),
  ])
  const idReal = (await listar())[0]?.id ?? 'OC-0000'
  const ctx = (params: Record<string, string | string[]>) => ({ params: Promise.resolve(params) }) as never
  const json = (corpo: unknown) => ({ body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } })

  const casos: {
    descricao: string
    metodo: string
    rota: string
    chave: 'leitura' | 'nenhuma'
    esperado: number
    chamar: (headers: Record<string, string>) => Promise<Response>
  }[] = [
    {
      descricao: '"Cobre a transportadora B": aprovar a cobrança de um caso',
      metodo: 'POST',
      rota: '/api/ocorrencias/[id]',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) =>
        (ocorrencia.POST as Handler)(
          new Request(`http://interno/api/ocorrencias/${idReal}`, { method: 'POST', ...json({ acao: 'aprovar' }), headers: { ...h, 'content-type': 'application/json' } }),
          ctx({ id: idReal }),
        ),
    },
    {
      descricao: 'Corrigir um campo (mudar quem paga)',
      metodo: 'POST',
      rota: '/api/ocorrencias/[id]',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) =>
        (ocorrencia.POST as Handler)(
          new Request(`http://interno/api/ocorrencias/${idReal}`, {
            method: 'POST',
            body: JSON.stringify({ acao: 'corrigir_campo', campo: 'transportadora', valor: 'Outra' }),
            headers: { ...h, 'content-type': 'application/json' },
          }),
          ctx({ id: idReal }),
        ),
    },
    {
      descricao: 'Anexar evidência ao caso',
      metodo: 'POST',
      rota: '/api/ocorrencias/[id]/evidencias',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) =>
        (evidencias.POST as Handler)(new Request(`http://interno/api/ocorrencias/${idReal}/evidencias`, { method: 'POST', headers: h }), ctx({ id: idReal })),
    },
    {
      descricao: 'Dar nome a um padrão',
      metodo: 'PUT',
      rota: '/api/padroes/[chave]',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) =>
        (padrao.PUT as Handler)(
          new Request('http://interno/api/padroes/x', { method: 'PUT', body: JSON.stringify({ nome: 'x' }), headers: { ...h, 'content-type': 'application/json' } }),
          ctx({ chave: 'x' }),
        ),
    },
    {
      descricao: 'Enviar arquivo ao R2',
      metodo: 'POST',
      rota: '/api/files',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) => (arquivos.POST as Handler)(new Request('http://interno/api/files', { method: 'POST', headers: h }), ctx({})),
    },
    {
      descricao: 'Criar ocorrência (simulação)',
      metodo: 'POST',
      rota: '/api/simular',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) => (simular.POST as Handler)(new Request('http://interno/api/simular', { method: 'POST', headers: h }), ctx({})),
    },
    {
      descricao: 'Criar ocorrência (mock do ezworker)',
      metodo: 'POST',
      rota: '/api/mock/ezworker/[canal]',
      chave: 'leitura',
      esperado: 403,
      chamar: (h) => (mock.POST as Handler)(new Request('http://interno/api/mock/ezworker/text', { method: 'POST', headers: h }), ctx({ canal: 'text' })),
    },
    {
      descricao: 'Consultar a lista de ocorrências (leitura permitida)',
      metodo: 'GET',
      rota: '/api/ocorrencias',
      chave: 'leitura',
      esperado: 200,
      chamar: (h) => (lista.GET as Handler)(new Request('http://interno/api/ocorrencias?pageSize=5', { headers: h }), ctx({})),
    },
    {
      descricao: 'Pergunta do gestor (leitura permitida)',
      metodo: 'POST',
      rota: '/api/perguntas',
      chave: 'leitura',
      esperado: 200,
      chamar: (h) =>
        (perguntas.POST as Handler)(
          new Request('http://interno/api/perguntas', { method: 'POST', body: JSON.stringify({ pergunta: 'Qual rota teve o maior custo?' }), headers: { ...h, 'content-type': 'application/json' } }),
          ctx({}),
        ),
    },
    {
      descricao: 'Sem login e sem chave',
      metodo: 'GET',
      rota: '/api/ocorrencias',
      chave: 'nenhuma',
      esperado: 401,
      chamar: (h) => (lista.GET as Handler)(new Request('http://interno/api/ocorrencias', { headers: h }), ctx({})),
    },
  ]

  const resultados: ResultadoAcesso[] = []
  for (const c of casos) {
    const headers: Record<string, string> = c.chave === 'leitura' ? { 'x-api-key': chaveLeitura } : {}
    const r = await c.chamar(headers)
    const corpo = r.status >= 400 ? await r.json().catch(() => undefined) : undefined
    resultados.push({
      descricao: c.descricao,
      metodo: c.metodo,
      rota: c.rota,
      chave: c.chave,
      esperado: c.esperado,
      obtido: r.status,
      ok: r.status === c.esperado,
      resposta: corpo,
    })
  }

  return {
    ...base,
    configurado: true,
    resultados,
    tentativasEscrita: resultados.filter((r) => r.esperado === 403).length,
    recusadas: resultados.filter((r) => r.esperado === 403 && r.ok).length,
  }
}
