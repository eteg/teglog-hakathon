// Login simples: um usuário/senha definidos no ambiente e um JWT em cookie httpOnly.
// Bem simplista de propósito (hackathon): usuário mockado, sem cadastro, sem hash de senha, sem refresh token.
import { getCloudflareContext } from '@opennextjs/cloudflare'

import { verificarJWT, type Sessao } from './jwt'

export const COOKIE_SESSAO = 'teglog_token'
export const VALIDADE_SEGUNDOS = 8 * 3600

type Ambiente = { JWT_SECRET: string; AUTH_USUARIO: string; AUTH_SENHA: string }

/**
 * Login mockado: usuário e senha "teglog". Se JWT_SECRET/AUTH_USUARIO/AUTH_SENHA existirem no
 * ambiente (wrangler secret ou .dev.vars), eles têm prioridade.
 * ATENÇÃO: com os valores padrão, qualquer um que leia este código consegue entrar e forjar tokens.
 */
const MOCK: Ambiente = {
  JWT_SECRET: 'teglog-mock-jwt-secret-troque-em-producao',
  AUTH_USUARIO: 'teglog',
  AUTH_SENHA: 'teglog',
}

/** Lê do binding do Worker (wrangler/.dev.vars) ou process.env; o que faltar usa o mock. */
export async function ambienteAuth(): Promise<Ambiente> {
  let env: Partial<Ambiente> = {}
  try {
    env = (await getCloudflareContext({ async: true })).env as unknown as Partial<Ambiente>
  } catch {
    env = process.env as unknown as Partial<Ambiente>
  }
  return {
    JWT_SECRET: env.JWT_SECRET || MOCK.JWT_SECRET,
    AUTH_USUARIO: env.AUTH_USUARIO || MOCK.AUTH_USUARIO,
    AUTH_SENHA: env.AUTH_SENHA || MOCK.AUTH_SENHA,
  }
}

export function lerCookie(req: Request, nome = COOKIE_SESSAO): string | undefined {
  const cookies = req.headers.get('cookie') ?? ''
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nome) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export async function sessaoDaRequisicao(req: Request): Promise<Sessao | null> {
  const { JWT_SECRET } = await ambienteAuth()
  return verificarJWT(lerCookie(req), JWT_SECRET)
}

export function cookieSessao(token: string, req: Request): string {
  const seguro = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE_SESSAO}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VALIDADE_SEGUNDOS}${seguro}`
}

export function cookieSaida(req: Request): string {
  const seguro = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE_SESSAO}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${seguro}`
}

/** Comparação em tempo constante. */
export function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
