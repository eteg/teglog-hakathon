// Protege as páginas: sem JWT válido no cookie, vai para /login (voltando depois para a página pedida).
// As rotas /api/* verificam o acesso nelas mesmas (JWT ou x-api-key, em lib/acesso.ts).
//
// Por que `middleware.ts` e não `proxy.ts` (nome novo do Next 16): o proxy só roda no runtime
// Node.js, que é experimental no Cloudflare/OpenNext e quebra ao repassar a requisição. O Next 16
// orienta manter `middleware` para quem precisa do runtime Edge, que o OpenNext suporta.
import { NextResponse, type NextRequest } from 'next/server'

import { verificarJWT } from '@/lib/jwt'
import { ambienteAuth, COOKIE_SESSAO } from '@/lib/sessao'

export async function middleware(request: NextRequest) {
  const { JWT_SECRET } = await ambienteAuth()
  const sessao = await verificarJWT(request.cookies.get(COOKIE_SESSAO)?.value, JWT_SECRET)
  if (sessao) return NextResponse.next()

  const login = new URL('/login', request.url)
  const destino = request.nextUrl.pathname + request.nextUrl.search
  if (destino !== '/') login.searchParams.set('next', destino)
  return NextResponse.redirect(login)
}

export const config = {
  // Tudo, menos: API (protegida nas rotas), login, arquivos do Next e estáticos.
  matcher: ['/((?!api/|login|_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)'],
}
