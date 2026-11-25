'use client'

import { Check, Pencil, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { GrupoPadrao } from '@/lib/padroes-emergentes'
import { brl } from '@/lib/regras'
import { Badge, BadgeTipo, Section } from './ui'

/** Padrões emergentes (F6): grupos de relatos parecidos, com custo, rotas e nome dado pelo analista. */
export function PadroesEmergentes() {
  const [grupos, setGrupos] = useState<GrupoPadrao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    fetch('/api/padroes', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<GrupoPadrao[]>) : Promise.reject(new Error(String(r.status)))))
      .then((g: GrupoPadrao[]) => ativo && setGrupos(g))
      .catch(() => ativo && setErro('Não foi possível carregar os padrões.'))
    return () => {
      ativo = false
    }
  }, [])

  if (erro) return <p className="text-destructive text-sm">{erro}</p>
  if (grupos === null)
    return (
      <div className="desktop:grid-cols-2 grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-md" />
        ))}
      </div>
    )
  if (grupos.length === 0)
    return <p className="text-muted-foreground flex h-60 items-center justify-center text-sm">Nenhuma ocorrência para agrupar ainda.</p>

  return (
    <div className="desktop:grid-cols-2 grid gap-4">
      {grupos.map((g) => (
        <Grupo
          key={g.chave}
          grupo={g}
          onNomeado={(nome) => setGrupos((l) => l?.map((x) => (x.chave === g.chave ? { ...x, nome } : x)) ?? null)}
        />
      ))}
    </div>
  )
}

function Grupo({ grupo: g, onNomeado }: { grupo: GrupoPadrao; onNomeado: (nome: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(g.nome ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const r = await fetch(`/api/padroes/${encodeURIComponent(g.chave)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    setSalvando(false)
    if (!r.ok) {
      setErro('Não foi possível salvar o nome.')
      return
    }
    onNomeado(nome.trim())
    setEditando(false)
  }

  return (
    <Section
      title={
        <span className="flex flex-wrap items-center gap-2">
          {g.nome ?? <span className="text-muted-foreground font-normal italic">{g.sugestao}</span>}
        </span>
      }
      action={
        g.emergente ? (
          <Badge tom="red">
            <Sparkles className="size-3" /> Emergente
          </Badge>
        ) : (
          <Badge>Caso isolado</Badge>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <BadgeTipo tipo={g.tipo} />
        <span className="text-muted-foreground font-mono text-xs">{g.subtipo}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-md p-3">
          <span className="text-muted-foreground block text-xs font-bold tracking-wider">Custo do grupo</span>
          <span className="text-lg font-bold tabular-nums">{brl(g.custo)}</span>
        </div>
        <div className="bg-muted/50 rounded-md p-3">
          <span className="text-muted-foreground block text-xs font-bold tracking-wider">Relatos</span>
          <span className="text-lg font-bold tabular-nums">{g.quantidade}</span>
        </div>
      </div>

      <div>
        <span className="text-muted-foreground block text-sm font-bold tracking-wider">Rotas</span>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {g.rotas.map((r) => (
            <li key={r.rota} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{r.rota}</span>
              <span className="shrink-0 tabular-nums">
                {brl(r.custo)} · {r.quantidade}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {g.casos.map((c) => (
          <Link key={c.id} href={`/ocorrencias/${c.id}`} title={c.resumo} className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono">
            {c.id}
          </Link>
        ))}
      </div>

      {editando ? (
        <form
          className="flex flex-col gap-2 min-[481px]:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (nome.trim()) salvar()
          }}
        >
          <Input
            autoFocus
            value={nome}
            maxLength={80}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Avaria por embalagem em eletrônicos"
            className="desktop:text-sm max-desktop:h-11 text-base"
          />
          <Button type="submit" className="max-desktop:h-11" disabled={!nome.trim() || salvando} isLoading={salvando}>
            {!salvando && <Check />}
            Salvar
          </Button>
        </form>
      ) : (
        <Button variant="outline" className="max-desktop:h-11 w-full" onClick={() => setEditando(true)}>
          <Pencil />
          {g.nome ? 'Renomear grupo' : 'Dar nome ao grupo'}
        </Button>
      )}
      {erro && <p className="text-destructive text-sm">{erro}</p>}
    </Section>
  )
}
