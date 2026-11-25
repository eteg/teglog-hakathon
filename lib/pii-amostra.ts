// Base fictícia do critério 6: 50 relatos com CPF, telefone, placa e e-mail plantados, mais
// "iscas" que NÃO podem ser escondidas (NF, CNPJ, CEP, valores). Determinística (mesma semente,
// mesmos relatos), para o número da tela de qualidade ser reproduzível.
// Sem imports com alias: também roda no `node --test`.

export interface RelatoAmostra {
  texto: string
  /** Dados pessoais plantados: todos devem sumir do texto mascarado. */
  pii: string[]
  /** Iscas: todas devem continuar no texto mascarado. */
  iscas: string[]
}

function gerador(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function cpfValido(r: () => number): string {
  const n = Array.from({ length: 9 }, () => Math.floor(r() * 10))
  const dv = (base: number[]) => {
    const soma = base.reduce((t, d, i) => t + d * (base.length + 1 - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = dv(n)
  const d2 = dv([...n, d1])
  const s = [...n, d1, d2].join('')
  return r() < 0.5 ? `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}` : s
}

const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ'
const letra = (r: () => number) => LETRAS[Math.floor(r() * LETRAS.length)]
const dig = (r: () => number) => String(Math.floor(r() * 10))

function placa(r: () => number): string {
  const l = letra(r) + letra(r) + letra(r)
  return r() < 0.5 ? `${l}-${dig(r)}${dig(r)}${dig(r)}${dig(r)}` : `${l}${dig(r)}${letra(r)}${dig(r)}${dig(r)}`
}

function telefone(r: () => number): string {
  const ddd = String(11 + Math.floor(r() * 88))
  const num = `9${dig(r)}${dig(r)}${dig(r)}${dig(r)}-${dig(r)}${dig(r)}${dig(r)}${dig(r)}`
  const formatos = [`(${ddd}) ${num}`, `${ddd} ${num}`, `+55 ${ddd} ${num}`]
  return formatos[Math.floor(r() * formatos.length)]
}

const NOMES = ['joana', 'marcos', 'rafael', 'diego', 'paulo', 'edson', 'ana', 'lucas']

export function gerarAmostraPII(quantidade = 50, semente = 2026): RelatoAmostra[] {
  const r = gerador(semente)
  return Array.from({ length: quantidade }, (_, i) => {
    const cpf = cpfValido(r)
    const tel = telefone(r)
    const pl = placa(r)
    const email = `${NOMES[i % NOMES.length]}.${i}@transportadora${i % 3}.com.br`
    const nf = String(100_000_000 + Math.floor(r() * 899_999_999)).slice(0, 9)
    const cnpj = `${dig(r)}${dig(r)}.${dig(r)}${dig(r)}${dig(r)}.${dig(r)}${dig(r)}${dig(r)}/0001-${dig(r)}${dig(r)}`
    const cep = `${dig(r)}${dig(r)}${dig(r)}${dig(r)}${dig(r)}-${dig(r)}${dig(r)}${dig(r)}`
    const modelos = [
      `Motorista CPF ${cpf}, placa ${pl}, avaria na NF ${nf}. Contato ${tel}.`,
      `Cliente recusou a entrega da NF ${nf} (CNPJ ${cnpj}). Falar com ${email} ou ${tel}. Veículo ${pl}, condutor ${cpf}.`,
      `Ninguém no endereço, CEP ${cep}. Motorista ${cpf} no ${tel}, caminhão ${pl}. Avisar ${email}.`,
    ]
    const texto = modelos[i % modelos.length]
    const pii = [cpf, tel, pl, ...(texto.includes(email) ? [email] : [])]
    const iscas = [nf, cnpj, cep].filter((isca) => texto.includes(isca))
    return { texto, pii, iscas }
  })
}
