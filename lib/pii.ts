// Dados pessoais (critério 6 / B17, 8.6): troca CPF, telefone, placa e e-mail por marcadores antes de
// qualquer texto ir para a IA (ezworker) ou para registros/logs. O Presidio só roda em Python
// e não funciona no Worker, então o reconhecimento é próprio, com os formatos brasileiros.
//
// Não esconde de propósito: CNPJ (identifica a transportadora, não uma pessoa), número de NF,
// CEP e valores. O CPF só é escondido se o dígito verificador bater, para não confundir com NF.
//
// Um motor só, com duas interfaces sobre os mesmos reconhecedores:
//   - maskPii / unmaskPii / containsPii: mapa reversível (grafo de decisão, /api/quality);
//   - mascararPII / semPII / pseudonimoTelefone: payload do ezworker, logs e tela de qualidade.

export type TipoPII = 'CPF' | 'TELEFONE' | 'PLACA' | 'EMAIL'

export interface AchadoPII {
  tipo: TipoPII
  marcador: string
  valor: string
}

export interface ResultadoMascara {
  texto: string
  achados: AchadoPII[]
}

/** Confere os dois dígitos verificadores do CPF. */
export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

// Ordem importa: e-mail antes (tem dígitos/letras que confundiriam), CPF antes de telefone
// (11 dígitos podem ser os dois; o dígito verificador decide).
const PADROES: { tipo: TipoPII; re: RegExp; aceitar?: (valor: string) => boolean }[] = [
  { tipo: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // CPF com ou sem pontuação; não pode estar colado em outros dígitos (CNPJ tem 14).
  // Ponto/barra/hífen só bloqueiam se vierem seguidos de dígito (o ponto final da frase não bloqueia).
  { tipo: 'CPF', re: /(?<!\d)(?<!\d[./-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)(?![./-]\d)/g, aceitar: cpfValido },
  // Placa antiga (ABC-1234 / ABC1234) e Mercosul (ABC1D23).
  { tipo: 'PLACA', re: /\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/g },
  // Telefone: +55 opcional, DDD opcional (com ou sem parênteses), 4-5 dígitos + 4 dígitos
  // com separador; ou 10-11 dígitos corridos começando por DDD válido (celular com 9).
  {
    tipo: 'TELEFONE',
    re: /(?<!\d)(?<!\d[./-])(?:\+?55\s?)?(?:\(?[1-9]\d\)?\s?)?9?\d{4}[-\s]\d{4}(?!\d)(?![./-]\d)|(?<!\d)(?<!\d[./-])(?:55)?[1-9]\d9\d{8}(?!\d)(?![./-]\d)/g,
  },
]

export type PiiKind = TipoPII
/** Marcador → valor original (ex.: { "[CPF_1]": "529.982.247-25" }). */
export type PiiMap = Record<string, string>

const normalizar = (tipo: TipoPII, valor: string) => `${tipo}:${valor.replace(/[\s().+-]/g, '').toUpperCase()}`

/** Núcleo: substitui usando (e estendendo) um mapa existente, para a numeração continuar. */
function substituir(texto: string, mapa: PiiMap): { texto: string; mapa: PiiMap; achados: AchadoPII[] } {
  const porValor = new Map<string, string>()
  const contador: Record<TipoPII, number> = { CPF: 0, TELEFONE: 0, PLACA: 0, EMAIL: 0 }
  for (const [marcador, valor] of Object.entries(mapa)) {
    const m = marcador.match(/^\[(\w+)_(\d+)\]$/)
    if (!m || !(m[1] in contador)) continue
    const tipo = m[1] as TipoPII
    contador[tipo] = Math.max(contador[tipo], Number(m[2]))
    porValor.set(normalizar(tipo, valor), marcador)
  }
  const novoMapa: PiiMap = { ...mapa }
  const achados: AchadoPII[] = []
  let saida = texto
  for (const { tipo, re, aceitar } of PADROES) {
    saida = saida.replace(re, (valor) => {
      if (/^\[[A-Z]+_\d+\]$/.test(valor)) return valor
      if (aceitar && !aceitar(valor)) return valor
      const chave = normalizar(tipo, valor)
      let marcador = porValor.get(chave)
      if (!marcador) {
        marcador = `[${tipo}_${++contador[tipo]}]`
        porValor.set(chave, marcador)
        novoMapa[marcador] = valor
        achados.push({ tipo, marcador, valor })
      }
      return marcador
    })
  }
  return { texto: saida, mapa: novoMapa, achados }
}

/**
 * Troca cada dado pessoal por um marcador estável ([CPF_1], [TELEFONE_2]...): o mesmo valor
 * recebe sempre o mesmo marcador dentro do texto, para a IA entender que é a mesma pessoa.
 */
export function mascararPII(texto: string): ResultadoMascara {
  if (!texto) return { texto, achados: [] }
  const r = substituir(texto, {})
  return { texto: r.texto, achados: r.achados }
}

/** Mascara reaproveitando um mapa existente (a numeração continua). Devolve o mapa para reverter. */
export function maskPii(text: string, map: PiiMap = {}): { masked: string; map: PiiMap } {
  if (!text) return { masked: text, map }
  const r = substituir(text, map)
  return { masked: r.texto, map: r.mapa }
}

/** Desfaz a máscara com o mapa (só no nosso lado; a IA nunca vê o mapa). */
export function unmaskPii(text: string, map: PiiMap): string {
  return Object.entries(map).reduce((t, [marcador, valor]) => t.split(marcador).join(valor), text)
}

/** True quando o texto ainda tem algo que parece dado pessoal (varredura de vazamentos). */
export function containsPii(text: string): boolean {
  return substituir(text, {}).achados.length > 0
}

/** Só o texto mascarado (atalho para logs e payloads). */
export function semPII(texto: string | null | undefined): string | null | undefined {
  return texto ? mascararPII(texto).texto : texto
}

/** Procura dados pessoais remanescentes num texto qualquer (usado na varredura dos registros). */
export function encontrarPII(texto: string): AchadoPII[] {
  return mascararPII(texto).achados
}

/**
 * Pseudônimo estável para um telefone: o ezworker consegue agrupar mensagens da mesma pessoa
 * sem receber o número. Mesmo telefone → mesmo pseudônimo. Termina com o último dígito do
 * telefone (sozinho não identifica ninguém) porque o mock da IA escolhe o cenário por ele.
 */
export async function pseudonimoTelefone(telefone: string): Promise<string> {
  const digitos = telefone.replace(/\D/g, '')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digitos))
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `tel_${hex.slice(0, 16)}_${digitos.slice(-1)}`
}

/** Telefone para logs: só os 4 últimos dígitos. */
export function telefoneParaLog(telefone: string | null | undefined): string {
  const d = (telefone ?? '').replace(/\D/g, '')
  return d ? `***${d.slice(-4)}` : ''
}
