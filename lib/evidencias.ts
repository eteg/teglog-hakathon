// Evidências no R2: guarda a mídia, calcula o SHA-256 (cadeia de custódia) e devolve a chave.
import 'server-only'

import { getBucket } from '@/lib/storage'
import type { Evidencia } from './types'

export const MAX_BYTES = 10 * 1024 * 1024 // mesmo limite de /api/files

const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
}

export async function sha256Hex(dados: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', dados)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function urlDaEvidencia(e: Evidencia): string | undefined {
  return e.key ? `/api/files/${e.key}` : e.url
}

/** Grava os bytes no R2 em evidencias/<caso>/<uuid>.<ext> e devolve chave, hash e tamanho. */
export async function guardarArquivo(
  casoId: string,
  dados: ArrayBuffer,
  contentType: string,
  nomeArquivo?: string,
): Promise<Pick<Evidencia, 'key' | 'hash' | 'tamanho' | 'content_type' | 'nome_arquivo'>> {
  if (dados.byteLength > MAX_BYTES) throw new Error('arquivo maior que 10 MB')
  // SVG/HTML servidos pelo próprio domínio poderiam executar script: não aceitar.
  if (/svg|html|xml|javascript/i.test(contentType)) throw new Error(`formato não aceito: ${contentType}`)
  const ext =
    EXTENSAO[contentType] ??
    (nomeArquivo?.includes('.') ? nomeArquivo.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin')
  const key = `evidencias/${casoId}/${crypto.randomUUID()}.${ext}`
  const hash = await sha256Hex(dados)
  const bucket = await getBucket()
  await bucket.put(key, dados, {
    httpMetadata: { contentType: contentType || 'application/octet-stream' },
    customMetadata: { caso: casoId, sha256: hash, ...(nomeArquivo ? { originalName: nomeArquivo } : {}) },
  })
  return { key, hash, tamanho: dados.byteLength, content_type: contentType, nome_arquivo: nomeArquivo }
}

/**
 * Copia para o R2 as mídias que o ezworker mandou por URL ou base64.
 * Falha em um arquivo não derruba o webhook: a evidência fica com a URL original e o erro.
 */
export async function armazenarEvidencias(casoId: string, evidencias: Evidencia[]): Promise<Evidencia[]> {
  return Promise.all(
    evidencias.map(async (e) => {
      if (e.key) return e
      try {
        if (e.conteudo_base64) {
          const bin = Uint8Array.from(atob(e.conteudo_base64), (c) => c.charCodeAt(0))
          const { conteudo_base64: _, ...resto } = e
          void _
          const salvo = await guardarArquivo(casoId, bin.buffer, e.content_type ?? 'application/octet-stream', e.nome_arquivo)
          return { ...resto, ...salvo, hash: e.hash ?? salvo.hash }
        }
        if (e.url && /^https?:\/\//.test(e.url)) {
          const r = await fetch(e.url, { signal: AbortSignal.timeout(15_000) })
          if (!r.ok) throw new Error(`download ${r.status}`)
          const tamanho = Number(r.headers.get('content-length') ?? 0)
          if (tamanho > MAX_BYTES) throw new Error('arquivo maior que 10 MB')
          const dados = await r.arrayBuffer()
          const tipo = e.content_type ?? r.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream'
          const salvo = await guardarArquivo(casoId, dados, tipo, e.nome_arquivo ?? e.url.split('/').pop()?.split('?')[0])
          // Hash enviado pelo ezworker é mantido; se divergir do calculado, registra.
          const divergente = e.hash && e.hash !== salvo.hash
          return {
            ...e,
            ...salvo,
            hash: e.hash ?? salvo.hash,
            ...(divergente ? { erro_armazenamento: `hash divergente: calculado ${salvo.hash}` } : {}),
          }
        }
      } catch (err) {
        const { conteudo_base64: _, ...resto } = e
        void _
        return { ...resto, erro_armazenamento: err instanceof Error ? err.message : String(err) }
      }
      return e
    }),
  )
}
