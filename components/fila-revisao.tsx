'use client'

import { Check, PartyPopper, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ROTULO_CAMPO, ROTULO_TIPO, camposEmRevisao, lerCampo } from '@/lib/regras'
import type { CampoRevisavel, Caso } from '@/lib/types'
import { BadgeTipo, Confianca, Section } from './ui'

/** Fila de revisão (F5): campos com baixa confiança, para confirmar ou corrigir. */
export function FilaRevisao() {
  const [casos, setCasos] = useState<Caso[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [tick, setTick] = useState(0)

  useEffect(() => {
    let ativo = true
    fetch('/api/revisao', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Caso[]>) : Promise.reject(new Error(String(r.status)))))
      .then((lista: Caso[]) => ativo && setCasos(lista))
      .catch(() => ativo && setErro('Não foi possível carregar a fila de revisão.'))
    return () => {
      ativo = false
    }
  }, [tick])

  async function revisar(id: string, campo: CampoRevisavel, acao: 'confirmar_campo' | 'corrigir_campo', valor?: string) {
    setErro(null)
    const r = await fetch(`/api/ocorrencias/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao, campo, valor }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { erro?: string }
      setErro(j.erro ?? `Erro ${r.status}`)
      return false
    }
    setTick((t) => t + 1)
    return true
  }

  if (casos === null)
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-md" />
        ))}
      </div>
    )

  if (casos.length === 0)
    return (
      <div className="border-border text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 rounded-md border text-sm">
        <PartyPopper className="text-primary size-6" />
        Nenhum registro com baixa confiança. Tudo revisado.
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">{erro}</p>}
      {casos.map((c) => (
        <Section
          key={c.id}
          className="scroll-mt-20"
          title={
            <span id={c.id} className="flex flex-wrap items-center gap-2">
              <Link href={`/ocorrencias/${c.id}`} className="font-mono hover:underline">
                {c.id}
              </Link>
              <BadgeTipo tipo={c.tipo} />
            </span>
          }
          action={<span className="text-muted-foreground text-sm">{camposEmRevisao(c).length} campo(s) para revisar</span>}
        >
          {c.resumo && <p className="text-muted-foreground -mt-2 text-sm">{c.resumo}</p>}
          <ul className="flex flex-col gap-2">
            {camposEmRevisao(c).map((campo) => (
              <LinhaCampo key={campo} caso={c} campo={campo} onRevisar={revisar} />
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}

function LinhaCampo({
  caso,
  campo,
  onRevisar,
}: {
  caso: Caso
  campo: CampoRevisavel
  onRevisar: (id: string, campo: CampoRevisavel, acao: 'confirmar_campo' | 'corrigir_campo', valor?: string) => Promise<boolean>
}) {
  const atual = lerCampo(caso, campo)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(atual ?? '')
  const [enviando, setEnviando] = useState<'confirmar' | 'corrigir' | null>(null)

  async function executar(acao: 'confirmar' | 'corrigir') {
    setEnviando(acao)
    const ok = await onRevisar(caso.id, campo, acao === 'confirmar' ? 'confirmar_campo' : 'corrigir_campo', acao === 'corrigir' ? valor : undefined)
    setEnviando(null)
    if (ok) setEditando(false)
  }

  return (
    <li className="border-border flex flex-col gap-3 rounded-md border p-3 min-[640px]:flex-row min-[640px]:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-muted-foreground text-sm font-bold tracking-wider">{ROTULO_CAMPO[campo]}</span>
        {editando ? (
          campo === 'tipo' ? (
            <Select value={valor} onValueChange={setValor}>
              <SelectTrigger className="max-desktop:h-11 w-full min-[481px]:w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROTULO_TIPO).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode={campo === 'valor_nf' ? 'decimal' : undefined}
              className="desktop:text-sm max-w-md text-base"
              onKeyDown={(e) => e.key === 'Enter' && valor.trim() && executar('corrigir')}
            />
          )
        ) : (
          <span className="flex flex-wrap items-center gap-3 text-sm font-medium">
            {atual ?? <span className="text-muted-foreground">não extraído</span>}
            <Confianca v={caso.confianca[campo] ?? 0} />
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {editando ? (
          <>
            <Button size="sm" className="max-sm:h-11 flex-1" disabled={!valor.trim() || enviando !== null} isLoading={enviando === 'corrigir'} onClick={() => executar('corrigir')}>
              {enviando !== 'corrigir' && <Check />}
              Salvar correção
            </Button>
            <Button size="sm" variant="ghost" className="max-sm:h-11" onClick={() => setEditando(false)} disabled={enviando !== null}>
              <X />
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="max-sm:h-11 flex-1" disabled={!atual || enviando !== null} isLoading={enviando === 'confirmar'} onClick={() => executar('confirmar')}>
              {enviando !== 'confirmar' && <Check />}
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="max-sm:h-11 flex-1"
              disabled={enviando !== null}
              onClick={() => {
                setValor(atual ?? '')
                setEditando(true)
              }}
            >
              <Pencil />
              Corrigir
            </Button>
          </>
        )}
      </div>
    </li>
  )
}
