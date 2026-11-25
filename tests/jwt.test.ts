// Login simples: o JWT só vale com a assinatura certa e dentro da validade.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { assinarJWT, verificarJWT } from '../lib/jwt.ts'

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente'

test('token assinado é aceito e traz usuário e papel', async () => {
  const t = await assinarJWT({ sub: 'analista', papel: 'analista' }, SEGREDO)
  const s = await verificarJWT(t, SEGREDO)
  assert.equal(s?.sub, 'analista')
  assert.equal(s?.papel, 'analista')
})

test('segredo errado, token adulterado ou vazio são recusados', async () => {
  const t = await assinarJWT({ sub: 'analista', papel: 'leitura' }, SEGREDO)
  assert.equal(await verificarJWT(t, 'outro-segredo'), null)
  const [c, , a] = t.split('.')
  const corpoFalso = btoa(JSON.stringify({ sub: 'x', papel: 'analista', iat: 0, exp: 9_999_999_999 })).replace(/=+$/, '')
  assert.equal(await verificarJWT(`${c}.${corpoFalso}.${a}`, SEGREDO), null)
  assert.equal(await verificarJWT('', SEGREDO), null)
  assert.equal(await verificarJWT('a.b', SEGREDO), null)
})

test('token expirado é recusado', async () => {
  const t = await assinarJWT({ sub: 'analista', papel: 'analista' }, SEGREDO, -1)
  assert.equal(await verificarJWT(t, SEGREDO), null)
})

test('alg diferente de HS256 (ex.: "none") é recusado', async () => {
  const semAssinatura = `${btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=+$/, '')}.${btoa(JSON.stringify({ sub: 'x', papel: 'analista', iat: 0, exp: 9_999_999_999 })).replace(/=+$/, '')}.`
  assert.equal(await verificarJWT(semAssinatura, SEGREDO), null)
})
