'use client'

import { useMemo, useState } from 'react'

import type { CardField } from '@/components/card-list/card-list'
import { DynamicList } from '@/components/dynamic-list'
import type { Sorting, TableColumn } from '@/components/table/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Agregado } from '@/lib/padroes'
import { brl } from '@/lib/regras'

const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d })

type Dimensao = 'rota' | 'transportadora' | 'produto'
const ROTULO: Record<Dimensao, string> = { rota: 'Rota', transportadora: 'Transportadora', produto: 'Produto' }

/** Ranking por taxa a cada mil entregas, com a mesma listagem responsiva do mca-refactor. */
export function Ranking({ dados }: { dados: Record<Dimensao, Agregado[]> }) {
  const [dim, setDim] = useState<Dimensao>('rota')
  const [sorting, setSorting] = useState<Sorting>({ field: 'porMil', direction: 'desc' })

  function handleSort(field: string) {
    setSorting((prev) => {
      if (prev?.field === field) return prev.direction === 'asc' ? { field, direction: 'desc' } : null
      return { field, direction: 'asc' }
    })
  }

  const lista = useMemo(() => {
    const base = dados[dim]
    if (!sorting) return base
    const k = sorting.field as keyof Agregado
    const dir = sorting.direction === 'asc' ? 1 : -1
    return [...base].sort((a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0))
  }, [dados, dim, sorting])

  const max = Math.max(...dados[dim].map((a) => a.porMil))

  const columns: TableColumn<Agregado>[] = [
    { id: 'chave', title: ROTULO[dim], width: 240, sortable: true, dataIndex: 'chave' },
    {
      id: 'porMil',
      title: 'Ocorrências / mil',
      width: 220,
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-3">
          <span className="w-10 text-right font-semibold tabular-nums">{fmt(a.porMil)}</span>
          <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <span className="bg-primary block h-full rounded-full" style={{ width: `${(a.porMil / max) * 100}%` }} />
          </span>
        </div>
      ),
    },
    { id: 'entregas', title: 'Entregas', width: 120, align: 'right', sortable: true, render: (a) => fmt(a.entregas, 0) },
    { id: 'ocorrencias', title: 'Ocorrências', width: 120, align: 'right', sortable: true, render: (a) => fmt(a.ocorrencias, 0) },
    { id: 'custo', title: 'Prejuízo no mês', width: 150, align: 'right', sortable: true, render: (a) => brl(a.custo) },
  ]

  const cardFields: CardField<Agregado>[] = [
    { id: 'chave', title: ROTULO[dim], sortable: true, hidden: true, dataIndex: 'chave' },
    { id: 'porMil', title: 'Ocorrências / mil', sortable: true, render: (a) => fmt(a.porMil) },
    { id: 'entregas', title: 'Entregas', sortable: true, render: (a) => fmt(a.entregas, 0) },
    { id: 'ocorrencias', title: 'Ocorrências', sortable: true, render: (a) => fmt(a.ocorrencias, 0) },
    { id: 'custo', title: 'Prejuízo no mês', sortable: true, render: (a) => brl(a.custo) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={dim} onValueChange={(v) => setDim(v as Dimensao)}>
        <TabsList>
          {(Object.keys(ROTULO) as Dimensao[]).map((d) => (
            <TabsTrigger key={d} value={d}>
              Por {ROTULO[d].toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DynamicList
        data={lista}
        columns={columns}
        sorting={sorting}
        onSortChange={handleSort}
        table={{ className: 'table-fixed', getRowKey: (a) => a.chave }}
        card={{
          fields: cardFields,
          getItemKey: (a) => a.chave,
          renderTrigger: (a) => (
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="text-foreground truncate text-base font-semibold">{a.chave}</p>
              <span className="text-muted-foreground shrink-0 text-sm tabular-nums">{fmt(a.porMil)}/mil</span>
            </div>
          ),
        }}
      />
    </div>
  )
}
