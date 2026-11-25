'use client'

import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Eye,
  FilterX,
  ScanSearch,
  Search,
  UserCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import type { CardField } from '@/components/card-list/card-list'
import { DynamicList } from '@/components/dynamic-list'
import { FiltroSelect } from '@/components/filtro-select'
import { Pagination } from '@/components/pagination/pagination'
import type { UseRowActionsOutput } from '@/components/row-actions'
import type { Sorting, TableColumn } from '@/components/table/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LIMIAR_CONFIANCA, ORDEM_STATUS, ROTULO_STATUS_EXIBICAO, ROTULO_TIPO, brl, rotuloSubtipo } from '@/lib/regras'
import type { Caso, PaginaCasos } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BadgePagador, BadgeStatus, BadgeTipo, Canal, Kpi, Prazo } from './ui'

const INTERVALO_MS = 5000
/** Disparado por quem sabe que chegou caso novo (ex.: botão de demo). */
export const EVENTO_ATUALIZAR = 'ocorrencias:atualizar'

type Filtros = { q: string; tipo: string; status: string; transportadora: string; motorista: string }
const SEM_FILTROS: Filtros = { q: '', tipo: '', status: '', transportadora: '', motorista: '' }

/** Ocorrências da carga (F2): busca paginada no D1, com filtros, e consulta de novo a cada 5 s. */
export function FilaAoVivo() {
  const router = useRouter()
  const [pagina, setPagina] = useState<PaginaCasos | null>(null)
  const [novos, setNovos] = useState<Set<string>>(new Set())
  const [conectado, setConectado] = useState<boolean | null>(null)
  const [chaveCarregada, setChaveCarregada] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS)
  const [busca, setBusca] = useState('')
  const [sorting, setSorting] = useState<Sorting>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const conhecidos = useRef<Set<string> | null>(null)

  // Busca com espera curta para não consultar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.q === busca ? f : { ...f, q: busca }))
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  // Chave da consulta atual: enquanto difere da última carregada, a lista mostra "buscando".
  const chave = JSON.stringify({ page, pageSize, filtros, sorting })
  const buscando = chaveCarregada !== null && chaveCarregada !== chave

  useEffect(() => {
    let ativo = true
    async function atualizar() {
      if (document.visibilityState === 'hidden') return
      const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      for (const [k, v] of Object.entries(filtros)) if (v) sp.set(k, v)
      if (sorting) {
        sp.set('ordenar', sorting.field)
        sp.set('direcao', sorting.direction)
      }
      try {
        const r = await fetch(`/api/ocorrencias?${sp}`, { cache: 'no-store' })
        if (!r.ok) throw new Error(String(r.status))
        const p = (await r.json()) as PaginaCasos
        if (!ativo) return
        // Na primeira carga nada é "novo"; depois, destaca o que chegou.
        const ids = p.data.map((c) => c.id)
        if (conhecidos.current) {
          const vistos = conhecidos.current
          const chegaram = ids.filter((id) => !vistos.has(id))
          if (chegaram.length) setNovos((s) => new Set([...s, ...chegaram]))
        }
        conhecidos.current = new Set([...(conhecidos.current ?? []), ...ids])
        setPagina(p)
        setChaveCarregada(chave)
        setConectado(true)
      } catch {
        if (ativo) setConectado(false)
      }
    }

    atualizar()
    const timer = setInterval(atualizar, INTERVALO_MS)
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener(EVENTO_ATUALIZAR, atualizar)
    return () => {
      ativo = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener(EVENTO_ATUALIZAR, atualizar)
    }
  }, [chave, page, pageSize, filtros, sorting, tick])

  // Ciclo de ordenação do mca-refactor: null -> asc -> desc -> null
  function handleSort(field: string) {
    setSorting((prev) => {
      if (prev?.field === field) return prev.direction === 'asc' ? { field, direction: 'desc' } : null
      return { field, direction: 'asc' }
    })
    setPage(1)
  }

  function filtrar(k: keyof Filtros, v: string) {
    setFiltros((f) => ({ ...f, [k]: v }))
    setPage(1)
  }

  const temFiltro = Object.values(filtros).some(Boolean)
  const casos = pagina?.data ?? []
  const r = pagina?.resumo

  const columns: TableColumn<Caso>[] = [
    {
      id: 'id',
      title: 'Caso',
      width: 120,
      sortable: true,
      render: (c) => (
        <span className="flex items-center gap-2">
          <Canal canal={c.canal} iconOnly />
          <span className="font-mono text-sm font-semibold">{c.id}</span>
        </span>
      ),
    },
    { id: 'tipo', title: 'Tipo', width: 116, sortable: true, render: (c) => <BadgeTipo tipo={c.tipo} /> },
    {
      id: 'resumo',
      title: 'Resumo',
      minWidth: 140,
      render: (c) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate" title={c.resumo}>
            {c.resumo ?? rotuloSubtipo(c.subtipo)}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {[c.transportadora, c.contexto?.rota].filter(Boolean).join(' · ')}
          </span>
        </div>
      ),
    },
    { id: 'motorista', title: 'Motorista', width: 124, sortable: true, render: (c) => c.contexto?.motorista ?? '—' },
    {
      id: 'valor',
      title: 'Custo',
      width: 124,
      align: 'right',
      sortable: true,
      render: (c) => <span className="tabular-nums">{c.contexto?.valor_nf ? brl(c.contexto.valor_nf) : '—'}</span>,
    },
    { id: 'responsavel', title: 'Responsável', width: 168, render: (c) => <BadgePagador pagador={c.decisao.pagador} /> },
    { id: 'prazo', title: 'Prazo', width: 112, sortable: true, render: (c) => <Prazo iso={c.contexto?.prazo_protesto} /> },
    {
      id: 'status',
      title: 'Status',
      width: 160,
      sortable: true,
      render: (c) => <BadgeStatus caso={c} />,
    },
  ]

  const cardFields: CardField<Caso>[] = [
    { id: 'id', title: 'Caso', sortable: true, hidden: true, dataIndex: 'id' },
    { id: 'tipo', title: 'Tipo', sortable: true, render: (c) => <BadgeTipo tipo={c.tipo} /> },
    { id: 'motorista', title: 'Motorista', sortable: true, render: (c) => c.contexto?.motorista ?? '—' },
    { id: 'valor', title: 'Custo', sortable: true, render: (c) => (c.contexto?.valor_nf ? brl(c.contexto.valor_nf) : '—') },
    { id: 'responsavel', title: 'Responsável', render: (c) => <BadgePagador pagador={c.decisao.pagador} /> },
    { id: 'prazo', title: 'Prazo', sortable: true, render: (c) => <Prazo iso={c.contexto?.prazo_protesto} /> },
    { id: 'rota', title: 'Rota', dataIndex: 'contexto.rota' },
    { id: 'status', title: 'Status', sortable: true, hidden: true, dataIndex: 'status' },
  ]

  async function aprovar(c: Caso) {
    const resp = await fetch(`/api/ocorrencias/${c.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'aprovar' }),
    })
    if (resp.ok) setTick((t) => t + 1)
  }

  const rowActions: UseRowActionsOutput<Caso> = {
    getActions: (c) => [
      { id: 'abrir', label: 'Ver ocorrência', icon: Eye, onSelect: () => router.push(`/ocorrencias/${c.id}`) },
      {
        id: 'revisar',
        label: 'Revisar campos',
        icon: ScanSearch,
        hidden: !Object.values(c.confianca ?? {}).some((v) => v < LIMIAR_CONFIANCA),
        onSelect: () => router.push('/revisao'),
      },
      {
        id: 'aprovar',
        label: 'Aprovar tratativa',
        icon: CheckCircle2,
        hidden: c.status !== 'aguardando_aprovacao',
        onSelect: () => aprovar(c),
      },
    ],
  }

  const facetas = pagina?.facetas
  const opcoes = (vals: string[] | undefined, rotulo?: Record<string, string>) =>
    (vals ?? []).map((v) => ({ value: v, label: rotulo?.[v] ?? v }))

  return (
    <>
      <div className="desktop:grid-cols-4 grid grid-cols-1 gap-3 min-[481px]:grid-cols-2">
        <Kpi
          icon={ClipboardList}
          label="Ocorrências abertas"
          value={r ? r.abertos : '—'}
          hint={r?.emRevisao ? `${r.emRevisao} com dados em revisão` : undefined}
        />
        <Kpi icon={CircleDollarSign} label="Valor das cargas afetadas" value={r ? brl(r.valorAberto) : '—'} hint="Soma das NFs abertas" />
        <Kpi icon={Clock} label="Prazo de reclamação ≤ 3 dias" value={r ? r.prazoCurto : '—'} hint="Art. 754 do Código Civil" />
        <Kpi icon={UserCheck} label="Aguardando sua aprovação" value={r ? r.aguardando : '—'} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-100">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Buscar por caso, NF, cliente, rota, motorista…"
              className="desktop:text-sm pl-9 text-base"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <span className={cn('size-2 rounded-full', conectado ? 'bg-primary' : 'bg-muted-foreground/50')} />
            {conectado ? 'Recebendo do ezworker ao vivo' : conectado === null ? 'Conectando…' : 'Reconectando…'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroSelect rotulo="Tipo" valor={filtros.tipo} opcoes={opcoes(facetas?.tipos, ROTULO_TIPO)} onChange={(v) => filtrar('tipo', v)} />
          <FiltroSelect
            rotulo="Status"
            valor={filtros.status}
            opcoes={ORDEM_STATUS.map((value) => ({ value, label: ROTULO_STATUS_EXIBICAO[value] }))}
            onChange={(v) => filtrar('status', v)}
          />
          <FiltroSelect
            rotulo="Transportadora"
            valor={filtros.transportadora}
            opcoes={opcoes(facetas?.transportadoras)}
            onChange={(v) => filtrar('transportadora', v)}
          />
          <FiltroSelect rotulo="Motorista" valor={filtros.motorista} opcoes={opcoes(facetas?.motoristas)} onChange={(v) => filtrar('motorista', v)} />
          {temFiltro && (
            <Button
              variant="ghost"
              className="max-desktop:h-11 gap-1.5"
              onClick={() => {
                setFiltros(SEM_FILTROS)
                setBusca('')
                setPage(1)
              }}
            >
              <FilterX />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <DynamicList
        data={casos}
        isLoading={pagina === null}
        isFetching={buscando}
        columns={columns}
        sorting={sorting}
        onSortChange={handleSort}
        rowActions={rowActions}
        getRowClassName={(c) => (novos.has(c.id) ? 'chegou' : undefined)}
        emptyState={temFiltro ? 'Nenhuma ocorrência encontrada com esses filtros.' : 'Nenhuma ocorrência recebida ainda.'}
        table={{
          className: 'table-fixed',
          getRowKey: (c) => c.id,
          onRowClick: (c) => router.push(`/ocorrencias/${c.id}`),
        }}
        card={{
          fields: cardFields,
          getItemKey: (c) => c.id,
          renderTrigger: (c) => (
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-foreground truncate font-mono text-base font-semibold">{c.id}</p>
                <BadgeStatus caso={c} />
              </div>
              <p className="text-muted-foreground line-clamp-2 text-sm">{c.resumo ?? rotuloSubtipo(c.subtipo)}</p>
            </div>
          ),
        }}
      />

      {pagina && pagina.total > 0 && (
        <Pagination
          currentPage={pagina.page}
          totalPages={pagina.totalPages}
          totalItems={pagina.total}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => {
            setPageSize(n)
            setPage(1)
          }}
          disabled={buscando}
        />
      )}
    </>
  )
}
