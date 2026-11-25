'use client'

import { Dices, ExternalLink, Send, Upload, Webhook, X } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'

import { EVENTO_ATUALIZAR } from '@/components/fila-ao-vivo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { catalogo } from '@/lib/mock-ezworker'
import type { ResultadoMock } from '@/lib/mock-fluxo'
import type { Canal } from '@/lib/types'

const CENARIOS = catalogo()
const ROTULO_CANAL: Record<Canal, string> = { image: 'Foto', audio: 'Áudio', video: 'Vídeo', text: 'Texto' }
const ACEITA: Record<Canal, string> = {
  image: 'image/jpeg,image/png,image/webp',
  audio: 'audio/*',
  video: 'video/*',
  text: 'text/plain,application/pdf',
}

/**
 * Simula o ezworker enquanto a integração real não existe: escolhe um cenário,
 * envia (com arquivo opcional) para o mock e mostra o JSON que ele devolveria.
 */
export function Simular() {
  const [aberto, setAberto] = useState(false)
  const [cenarioId, setCenarioId] = useState(CENARIOS[0].id)
  const cenario = CENARIOS.find((c) => c.id === cenarioId)!
  const [canal, setCanal] = useState<Canal>(cenario.canal)
  const [texto, setTexto] = useState(cenario.textoExemplo)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState<'enviar' | 'sortear' | null>(null)
  const [resultado, setResultado] = useState<ResultadoMock | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  function limparArquivo() {
    setArquivo(null)
    if (input.current) input.current.value = ''
  }

  function trocarCenario(id: string) {
    const c = CENARIOS.find((x) => x.id === id)!
    setCenarioId(id)
    setCanal(c.canal)
    setTexto(c.textoExemplo)
    limparArquivo()
  }

  async function enviar(modo: 'enviar' | 'sortear') {
    setEnviando(modo)
    setErro(null)
    setResultado(null)
    try {
      let r: Response
      if (modo === 'sortear') {
        r = await fetch('/api/simular', { method: 'POST' })
      } else {
        const fd = new FormData()
        fd.append('cenario', cenarioId)
        if (texto.trim()) fd.append('texto', texto.trim())
        if (arquivo) fd.append('arquivo', arquivo)
        r = await fetch(`/api/mock/ezworker/${canal}`, { method: 'POST', body: fd })
      }
      const j = (await r.json()) as ResultadoMock & { erro?: string }
      if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`)
      setResultado(j)
      window.dispatchEvent(new Event(EVENTO_ATUALIZAR))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(null)
    }
  }

  return (
    <>
      <Button variant="ghost" className="text-foreground min-w-40 gap-1.5 whitespace-nowrap max-sm:h-11" onClick={() => setAberto(true)}>
        <Webhook className="size-5" />
        Simular ezworker
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-6 pb-4 text-left">
            <DialogTitle>Simular ezworker</DialogTitle>
            <DialogDescription>
              Enquanto a integração real não existe, o mock devolve o JSON que o ezworker mandaria, e ele entra no mesmo fluxo do
              webhook.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div className="grid gap-3 min-[560px]:grid-cols-[1fr_200px]">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Cenário</Label>
                <Select value={cenarioId} onValueChange={trocarCenario}>
                  <SelectTrigger className="max-desktop:h-11 w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CENARIOS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Canal</Label>
                <Select
                  value={canal}
                  onValueChange={(v) => {
                    setCanal(v as Canal)
                    limparArquivo()
                  }}
                >
                  <SelectTrigger className="max-desktop:h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROTULO_CANAL) as Canal[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {ROTULO_CANAL[c]} · /ezworker/{c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-muted-foreground -mt-2 text-sm">{cenario.descricao}</p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mock-texto">{canal === 'text' ? 'Relato em texto' : 'Transcrição / texto da mídia (opcional)'}</Label>
              <Textarea
                id="mock-texto"
                rows={3}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="desktop:text-sm min-w-0 text-base"
              />
            </div>

            {canal !== 'text' && (
              <div className="flex flex-col gap-1.5">
                <Label>Arquivo do motorista (opcional)</Label>
                <label className="bg-muted/40 hover:border-primary flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm">
                  <Upload className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {arquivo
                      ? `${arquivo.name} · ${(arquivo.size / 1024).toFixed(0)} KB`
                      : canal === 'image'
                        ? 'Sem arquivo: usa a foto ilustrativa'
                        : `Escolher ${ROTULO_CANAL[canal].toLowerCase()} (até 10 MB)`}
                  </span>
                  {arquivo && (
                    <button
                      type="button"
                      aria-label="Remover arquivo"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault()
                        limparArquivo()
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                  <input
                    ref={input}
                    type="file"
                    accept={ACEITA[canal]}
                    className="sr-only"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}

            {erro && <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">{erro}</p>}

            {resultado && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm text-[#14532D]">
                  <span>
                    {resultado.cenario.titulo}: entregue como <strong>{resultado.entregue?.id}</strong>.
                  </span>
                  {resultado.entregue && (
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link href={`/ocorrencias/${resultado.entregue.id}`} onClick={() => setAberto(false)}>
                        <ExternalLink />
                        Abrir caso
                      </Link>
                    </Button>
                  )}
                </div>
                <details className="rounded-md border">
                  <summary className="hover:bg-muted/50 cursor-pointer p-3 text-sm font-medium">JSON devolvido pelo ezworker (mock)</summary>
                  <pre className="bg-muted max-h-72 overflow-auto border-t p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(resultado.ocorrencia, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row flex-wrap justify-between gap-2 border-t p-6 pt-4 sm:justify-between">
            <Button
              variant="outline"
              className="max-desktop:h-11 gap-1.5"
              disabled={enviando !== null}
              isLoading={enviando === 'sortear'}
              onClick={() => enviar('sortear')}
            >
              {enviando !== 'sortear' && <Dices />}
              Sortear cenário
            </Button>
            <Button
              className="max-desktop:h-11 min-w-40"
              disabled={enviando !== null || (canal === 'text' && !texto.trim())}
              isLoading={enviando === 'enviar'}
              onClick={() => enviar('enviar')}
            >
              {enviando !== 'enviar' && <Send />}
              Enviar ao ezworker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
