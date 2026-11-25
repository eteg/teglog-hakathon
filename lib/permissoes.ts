// Acesso mínimo (critério 4): quem pode o quê. Código puro, testado em tests/acesso.test.ts.
//
// O D1 não tem usuário só de leitura, então a separação é na API, com duas chaves:
//   - leitura: só consulta. É a única que o assistente do gestor recebe.
//   - analista: consulta e altera (aprovar, corrigir, responder, anexar, cobrar).
// A recusa vem da permissão (403), não de uma instrução dada à IA.

export type Papel = 'leitura' | 'analista'
export type Acao = 'ler' | 'escrever'

const PERMISSOES: Record<Papel, readonly Acao[]> = {
  leitura: ['ler'],
  analista: ['ler', 'escrever'],
}

export function permite(papel: Papel, acao: Acao): boolean {
  return PERMISSOES[papel].includes(acao)
}

/** Rotas da API e o que cada uma faz. Rotas que alteram dados exigem a chave de analista. */
export const ROTAS: { metodo: string; rota: string; acao: Acao }[] = [
  { metodo: 'GET', rota: '/api/ocorrencias', acao: 'ler' },
  { metodo: 'GET', rota: '/api/ocorrencias/[id]', acao: 'ler' },
  { metodo: 'GET', rota: '/api/revisao', acao: 'ler' },
  { metodo: 'GET', rota: '/api/padroes', acao: 'ler' },
  { metodo: 'POST', rota: '/api/perguntas', acao: 'ler' },
  { metodo: 'GET', rota: '/api/files/[...key]', acao: 'ler' },
  { metodo: 'GET', rota: '/api/mock/ezworker', acao: 'ler' },
  { metodo: 'GET', rota: '/api/qualidade', acao: 'ler' },
  { metodo: 'POST', rota: '/api/qualidade/pii', acao: 'ler' },
  { metodo: 'POST', rota: '/api/ocorrencias/[id]', acao: 'escrever' },
  { metodo: 'POST', rota: '/api/ocorrencias/[id]/evidencias', acao: 'escrever' },
  { metodo: 'PUT', rota: '/api/padroes/[chave]', acao: 'escrever' },
  { metodo: 'POST', rota: '/api/files', acao: 'escrever' },
  { metodo: 'POST', rota: '/api/simular', acao: 'escrever' },
  { metodo: 'POST', rota: '/api/mock/ezworker/[canal]', acao: 'escrever' },
]

/**
 * Ferramentas do assistente do gestor (F4): lista fechada de consultas prontas, todas de leitura.
 * Ele não monta SQL livre nem fala direto com o banco; usa estas rotas com a chave de leitura.
 */
export const FERRAMENTAS_ASSISTENTE: { nome: string; descricao: string; metodo: string; rota: string }[] = [
  { nome: 'perguntar_custos', descricao: 'Pergunta pronta sobre custos (resposta em R$ + consulta)', metodo: 'POST', rota: '/api/perguntas' },
  { nome: 'listar_ocorrencias', descricao: 'Lista de ocorrências com filtros', metodo: 'GET', rota: '/api/ocorrencias' },
  { nome: 'detalhe_ocorrencia', descricao: 'Detalhe de um caso', metodo: 'GET', rota: '/api/ocorrencias/[id]' },
  { nome: 'listar_padroes', descricao: 'Padrões emergentes', metodo: 'GET', rota: '/api/padroes' },
]

export const PAPEL_DO_ASSISTENTE: Papel = 'leitura'

export function acaoDaRota(metodo: string, rota: string): Acao | undefined {
  return ROTAS.find((r) => r.metodo === metodo && r.rota === rota)?.acao
}
