// Critério 6: formatos que devem ser escondidos e os que não devem.
// Rode com: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cpfValido, mascararPII } from '../lib/pii.ts'

const mascara = (t: string) => mascararPII(t).texto

test('CPF válido é escondido, com e sem pontuação', () => {
  assert.equal(mascara('CPF 529.982.247-25 do motorista'), 'CPF [CPF_1] do motorista')
  assert.equal(mascara('cpf 52998224725'), 'cpf [CPF_1]')
})

test('CPF com dígito verificador errado não é escondido (pode ser outro número)', () => {
  assert.equal(cpfValido('529.982.247-24'), false)
  assert.equal(mascara('código 529.982.247-24'), 'código 529.982.247-24')
})

test('telefone com DDD, com parênteses, com +55, sem DDD e corrido', () => {
  assert.equal(mascara('liga (71) 98877-6655'), 'liga [TELEFONE_1]')
  assert.equal(mascara('liga 71 98877-6655'), 'liga [TELEFONE_1]')
  assert.equal(mascara('whats +55 71 98877-6655'), 'whats [TELEFONE_1]')
  assert.equal(mascara('fixo 3333-4444'), 'fixo [TELEFONE_1]')
  assert.equal(mascara('cel 71988776655'), 'cel [TELEFONE_1]')
})

test('placa antiga e Mercosul', () => {
  assert.equal(mascara('placa ABC-1234'), 'placa [PLACA_1]')
  assert.equal(mascara('placa ABC1234'), 'placa [PLACA_1]')
  assert.equal(mascara('placa RBX4E21'), 'placa [PLACA_1]')
})

test('e-mail', () => {
  assert.equal(mascara('escreve para joana.t@transportadora.com.br'), 'escreve para [EMAIL_1]')
})

test('NÃO esconde: NF, CNPJ, CEP, valores e datas', () => {
  const texto = 'NF 000123456, CNPJ 12.345.678/0001-95, CEP 40000-000, valor R$ 18.450,00, dia 25/11/2026'
  assert.equal(mascara(texto), texto)
  assert.equal(mascara('CNPJ 12345678000195'), 'CNPJ 12345678000195')
  assert.equal(mascara('NF 000874410'), 'NF 000874410')
})

test('mesmo valor recebe o mesmo marcador; valores diferentes, marcadores diferentes', () => {
  const r = mascararPII('liga 71 98877-6655 ou (71) 98877-6655 ou 21 99999-0000')
  assert.equal(r.texto, 'liga [TELEFONE_1] ou [TELEFONE_1] ou [TELEFONE_2]')
  assert.equal(r.achados.length, 2)
})

test('texto já mascarado não é mascarado de novo', () => {
  assert.equal(mascara('motorista [CPF_1], placa [PLACA_1]'), 'motorista [CPF_1], placa [PLACA_1]')
})

test('amostra de 50 relatos: 100% dos dados pessoais escondidos e nenhuma isca alterada', async () => {
  const { gerarAmostraPII } = await import('../lib/pii-amostra.ts')
  const amostra = gerarAmostraPII()
  assert.equal(amostra.length, 50)
  let plantados = 0
  let escondidos = 0
  for (const r of amostra) {
    const saida = mascara(r.texto)
    for (const v of r.pii) {
      plantados++
      if (!saida.includes(v)) escondidos++
      else assert.fail(`não escondeu "${v}" em: ${r.texto}`)
    }
    for (const isca of r.iscas) assert.ok(saida.includes(isca), `escondeu a isca "${isca}" em: ${r.texto}`)
  }
  assert.equal(escondidos, plantados)
})

test('CPF e telefone no fim da frase (seguidos de ponto) também são escondidos', () => {
  assert.equal(mascara('condutor 52998224725.'), 'condutor [CPF_1].')
  assert.equal(mascara('ligue 71 98877-6655.'), 'ligue [TELEFONE_1].')
})
