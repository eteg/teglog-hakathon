// Critério 4 (acesso mínimo): a chave de leitura não altera nada e o assistente só lê.
// Rode com: npm test
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

import { FERRAMENTAS_ASSISTENTE, PAPEL_DO_ASSISTENTE, ROTAS, acaoDaRota, permite } from '../lib/permissoes.ts'

// Rotas com autenticação própria (segredo/assinatura), fora da matriz de chaves.
const ISENTAS = [
  '/api/health',
  '/api/webhook/ezworker',
  '/api/webhooks/whatsapp',
  '/api/internal/queue/tick',
  // login: são elas que criam/encerram a sessão
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/sessao',
]

function arquivosDeRota(dir = 'app/api'): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosDeRota(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

test('chave de leitura só lê; analista lê e altera', () => {
  assert.equal(permite('leitura', 'ler'), true)
  assert.equal(permite('leitura', 'escrever'), false)
  assert.equal(permite('analista', 'ler'), true)
  assert.equal(permite('analista', 'escrever'), true)
})

test('nenhuma rota que altera dados aceita a chave de leitura', () => {
  const escrita = ROTAS.filter((r) => r.acao === 'escrever')
  assert.ok(escrita.length > 0)
  for (const r of escrita) assert.equal(permite('leitura', r.acao), false, `${r.metodo} ${r.rota}`)
})

test('o assistente do gestor tem só a chave de leitura e só ferramentas de leitura', () => {
  assert.equal(PAPEL_DO_ASSISTENTE, 'leitura')
  for (const f of FERRAMENTAS_ASSISTENTE) {
    assert.equal(acaoDaRota(f.metodo, f.rota), 'ler', `${f.nome} (${f.metodo} ${f.rota}) precisa ser de leitura`)
  }
})

test('toda rota da API está na matriz (ou é isenta) e chama exigir() com a ação certa', () => {
  for (const arquivo of arquivosDeRota()) {
    const rota = '/' + relative('app', arquivo).replace(/\/route\.ts$/, '')
    if (ISENTAS.includes(rota)) continue
    const codigo = readFileSync(arquivo, 'utf8')
    const metodos = [...codigo.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1])
    for (const metodo of metodos) {
      const acao = acaoDaRota(metodo, rota)
      assert.ok(acao, `${metodo} ${rota} não está em ROTAS (lib/permissoes.ts)`)
      const corpo = codigo.split(`export async function ${metodo}`)[1].split(/\nexport /)[0]
      const exigeEscrita = /exigir\([^)]*"escrever"\)/.test(corpo)
      const exigeLeitura = /exigir\([^)]*"ler"\)|exigirLeitura\(/.test(corpo)
      assert.ok(exigeEscrita || exigeLeitura, `${metodo} ${rota} não verifica o acesso`)
      if (acao === 'escrever') assert.ok(exigeEscrita, `${metodo} ${rota} altera dados mas não exige "escrever"`)
    }
  }
})
