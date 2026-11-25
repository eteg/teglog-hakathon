// Nome do produto: mude aqui para refletir em toda a interface (header, títulos de página, abas).
export const PRODUTO = {
  nome: 'teglog',
  descricao: 'Ocorrências logísticas: do relato da transportadora à devolutiva ao cliente.',
} as const

/** Título de aba no formato "Página · teglog". */
export const tituloPagina = (pagina: string) => `${pagina} · ${PRODUTO.nome}`
