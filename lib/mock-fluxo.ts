// Fluxo do mock: gera a resposta do ezworker e entrega no mesmo caminho do webhook real
// (validação de schema → regras → D1/R2). Quando o ezworker real existir, ele chama
// POST /api/webhook/ezworker e este arquivo deixa de ser usado.
import 'server-only'

import { FOTO_DEMO_AVARIA_JPEG_BASE64 } from './demo-midia'
import { CENARIOS, escolherCenario, type EntradaMock } from './mock-ezworker'
import { receber } from './store'
import type { Canal, OcorrenciaEzworker } from './types'
import { validarOcorrencia } from './validar'

export const CANAIS: Canal[] = ['audio', 'image', 'video', 'text']

export interface ResultadoMock {
  cenario: { id: string; titulo: string }
  /** JSON que o ezworker devolveria (base64 resumido para não poluir a resposta). */
  ocorrencia: OcorrenciaEzworker
  entregue?: { id: string; status: string; pagador: string }
}

export async function simularEzworker(
  entrada: EntradaMock & { cenario?: string; entregar?: boolean; aleatorio?: boolean },
): Promise<ResultadoMock> {
  const cenario = entrada.aleatorio
    ? CENARIOS[Math.floor(Math.random() * CENARIOS.length)]
    : escolherCenario(entrada.canal, entrada.texto, entrada.cenario)
  const canal = entrada.aleatorio ? cenario.canal : entrada.canal

  // Sem arquivo numa foto, usa a imagem ilustrativa para a demo mostrar o R2.
  const arquivo =
    entrada.arquivo ??
    (canal === 'image'
      ? { base64: FOTO_DEMO_AVARIA_JPEG_BASE64, contentType: 'image/jpeg', nome: 'foto-demo.jpg' }
      : undefined)

  const texto = entrada.texto ?? (entrada.aleatorio ? cenario.textoExemplo : undefined)
  const ocorrencia = cenario.gerar({ canal, texto, arquivo })

  let entregue: ResultadoMock['entregue']
  if (entrada.entregar !== false) {
    const v = validarOcorrencia(ocorrencia)
    if (!v.ok) throw new Error(`mock gerou JSON fora do contrato: ${v.erros.join(', ')}`)
    const caso = await receber(v.dado)
    entregue = { id: caso.id, status: caso.status, pagador: caso.decisao.pagador }
  }

  return { cenario: { id: cenario.id, titulo: cenario.titulo }, ocorrencia: resumirBase64(ocorrencia), entregue }
}

function resumirBase64(o: OcorrenciaEzworker): OcorrenciaEzworker {
  return {
    ...o,
    evidencias: o.evidencias.map((e) =>
      e.conteudo_base64 ? { ...e, conteudo_base64: `<${Math.round((e.conteudo_base64.length * 3) / 4)} bytes em base64>` } : e,
    ),
  }
}
