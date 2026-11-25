// Verificação de acesso nas rotas da API (critério 4). Chame no início do handler,
// antes de ler ou alterar qualquer dado:
//   const negado = await exigir(req, 'escrever'); if (negado) return negado
import 'server-only'

import { getCloudflareContext } from '@opennextjs/cloudflare'

import { permite, type Acao, type Papel } from './permissoes'
import { sessaoDaRequisicao } from './sessao'

type Ambiente = { READ_API_KEY?: string; ANALYST_API_KEY?: string }

async function chaves(): Promise<Ambiente> {
  const { env } = await getCloudflareContext({ async: true })
  return env as unknown as Ambiente
}

/** Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem). */
function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Papel de quem chama:
 *  - header `x-api-key` (ou `Authorization: Bearer`) com a chave de leitura ou de analista;
 *  - sem chave, o JWT do login (cookie httpOnly) com o papel da sessão.
 */
export async function papelDaRequisicao(req: Request): Promise<Papel | null> {
  const chave = req.headers.get('x-api-key') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (chave) {
    const { READ_API_KEY, ANALYST_API_KEY } = await chaves()
    if (ANALYST_API_KEY && iguais(chave, ANALYST_API_KEY)) return 'analista'
    if (READ_API_KEY && iguais(chave, READ_API_KEY)) return 'leitura'
    return null
  }
  const sessao = await sessaoDaRequisicao(req)
  return sessao?.papel ?? null
}

/** Devolve a resposta de erro (401/403) quando o papel não pode fazer a ação; senão null. */
export async function exigir(req: Request, acao: Acao): Promise<Response | null> {
  const papel = await papelDaRequisicao(req)
  if (!papel)
    return Response.json(
      { erro: 'Não autenticado. Faça login ou envie a chave de acesso no header x-api-key.' },
      { status: 401, headers: { 'www-authenticate': 'ApiKey' } },
    )
  if (!permite(papel, acao))
    return Response.json(
      { erro: `Acesso negado: a chave de ${papel} não pode ${acao === 'escrever' ? 'alterar dados' : 'ler dados'}.`, papel },
      { status: 403 },
    )
  return null
}

/** Para rotas de leitura que mascaram dados pessoais quando o papel é `leitura`. */
export async function exigirLeitura(req: Request): Promise<{ negado: Response | null; papel: Papel | null }> {
  const negado = await exigir(req, 'ler')
  return { negado, papel: negado ? null : await papelDaRequisicao(req) }
}
