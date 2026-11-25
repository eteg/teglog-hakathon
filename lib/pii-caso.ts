// Versão de um caso sem dados pessoais, para quem consulta com a chave de leitura
// (assistente do gestor, integrações). O analista, pela interface, vê o caso completo.
import { semPII } from './pii'
import type { Caso } from './types'

export function casoSemPII(c: Caso): Caso {
  const { relato_original: _, ...resto } = c
  void _
  return {
    ...resto,
    resumo: semPII(c.resumo) ?? undefined,
    transcricao: semPII(c.transcricao) ?? undefined,
    devolutiva: semPII(c.devolutiva) ?? undefined,
    evidencias: c.evidencias.map((e) => ({ ...e, descricao: semPII(e.descricao) ?? undefined })),
    timeline: c.timeline.map((t) => ({ ...t, detalhe: semPII(t.detalhe) ?? undefined })),
    contexto: c.contexto ? { ...c.contexto, placa: c.contexto.placa ? '[PLACA]' : undefined } : c.contexto,
  }
}
