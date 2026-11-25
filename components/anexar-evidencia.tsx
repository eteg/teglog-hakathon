'use client'

import { Paperclip, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROTULO_EVIDENCIA, tipoParaPendencia } from '@/lib/regras'

const AVULSA = '__avulsa__'
const MAX_BYTES = 10 * 1024 * 1024

/** Anexa uma evidência ao caso (vai para o R2). Pode resolver uma pendência do dossiê. */
export function AnexarEvidencia({ casoId, pendencias }: { casoId: string; pendencias: string[] }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [resolve, setResolve] = useState(pendencias[0] ?? AVULSA)
  const [tipo, setTipo] = useState(pendencias[0] ? tipoParaPendencia(pendencias[0]) : 'foto_avaria')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [, start] = useTransition()

  function escolher(f: File | null) {
    setErro(null)
    if (f && f.size > MAX_BYTES) {
      setErro('Arquivo maior que 10 MB.')
      return
    }
    setArquivo(f)
  }

  async function enviar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    const fd = new FormData()
    fd.append('file', arquivo)
    fd.append('tipo', tipo)
    if (resolve !== AVULSA) fd.append('resolve', resolve)
    try {
      const r = await fetch(`/api/ocorrencias/${casoId}/evidencias`, { method: 'POST', body: fd })
      const j = (await r.json().catch(() => ({}))) as { erro?: string }
      if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`)
      setArquivo(null)
      if (input.current) input.current.value = ''
      start(() => router.refresh())
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="border-border flex flex-col gap-3 rounded-md border border-dashed p-4">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="size-4" />
        Anexar evidência
      </span>

      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Resolve a pendência</Label>
          <Select
            value={resolve}
            onValueChange={(v) => {
              setResolve(v)
              if (v !== AVULSA) setTipo(tipoParaPendencia(v))
            }}
          >
            <SelectTrigger className="max-desktop:h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pendencias.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
              <SelectItem value={AVULSA}>Nenhuma (evidência adicional)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="max-desktop:h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROTULO_EVIDENCIA).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label
        className="bg-muted/40 hover:border-primary flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          escolher(e.dataTransfer.files[0] ?? null)
        }}
      >
        <Upload className="text-muted-foreground size-5" />
        <span className="font-medium">{arquivo ? arquivo.name : 'Arraste ou clique para escolher'}</span>
        <span className="text-muted-foreground text-xs">
          {arquivo ? `${(arquivo.size / 1024).toFixed(0)} KB · ${arquivo.type || 'tipo desconhecido'}` : 'Foto, áudio, vídeo ou PDF · até 10 MB'}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/*,audio/*,video/*,application/pdf"
          className="sr-only"
          onChange={(e) => escolher(e.target.files?.[0] ?? null)}
        />
      </label>

      {erro && <p className="text-destructive text-sm">{erro}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {arquivo && (
          <Button
            variant="ghost"
            className="max-desktop:h-11"
            disabled={enviando}
            onClick={() => {
              setArquivo(null)
              if (input.current) input.current.value = ''
            }}
          >
            <X />
            Remover
          </Button>
        )}
        <Button className="max-desktop:h-11 min-w-40" disabled={!arquivo || enviando} isLoading={enviando} onClick={enviar}>
          {!enviando && <Upload />}
          Enviar ao dossiê
        </Button>
      </div>
    </div>
  )
}
