// JWT HS256 mínimo com Web Crypto (funciona no Worker, no Node e no proxy do Next), sem dependências.
// Sem imports com alias: também roda no `node --test`.

export interface Sessao {
  /** usuário */
  sub: string
  papel: 'analista' | 'leitura'
  /** emitido em / expira em (segundos desde 1970) */
  iat: number
  exp: number
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const texto = (s: string) => new TextEncoder().encode(s)

async function chave(segredo: string) {
  return crypto.subtle.importKey('raw', texto(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function assinarJWT(dados: Omit<Sessao, 'iat' | 'exp'>, segredo: string, validadeSegundos = 8 * 3600): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = b64url(texto(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const corpo = b64url(texto(JSON.stringify({ ...dados, iat: agora, exp: agora + validadeSegundos })))
  const assinatura = await crypto.subtle.sign('HMAC', await chave(segredo), texto(`${cabecalho}.${corpo}`))
  return `${cabecalho}.${corpo}.${b64url(new Uint8Array(assinatura))}`
}

/** Devolve a sessão se a assinatura confere e o token não expirou; senão null. */
export async function verificarJWT(token: string | undefined | null, segredo: string): Promise<Sessao | null> {
  if (!token || !segredo) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [cabecalho, corpo, assinatura] = partes
  try {
    const { alg } = JSON.parse(new TextDecoder().decode(deB64url(cabecalho))) as { alg?: string }
    if (alg !== 'HS256') return null
    const ok = await crypto.subtle.verify('HMAC', await chave(segredo), deB64url(assinatura), texto(`${cabecalho}.${corpo}`))
    if (!ok) return null
    const sessao = JSON.parse(new TextDecoder().decode(deB64url(corpo))) as Sessao
    if (typeof sessao.exp !== 'number' || sessao.exp < Math.floor(Date.now() / 1000)) return null
    if (sessao.papel !== 'analista' && sessao.papel !== 'leitura') return null
    return sessao
  } catch {
    return null
  }
}
