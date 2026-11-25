'use client'

// Port de mca-refactor/shared/components/dynamic-list: Table no desktop, CardList abaixo do breakpoint `desktop`.
import * as React from 'react'

import { CardList, type CardField, type CardListProps } from '@/components/card-list/card-list'
import type { UseRowActionsOutput } from '@/components/row-actions'
import { Table, type Sorting, type TableColumn, type TableProps } from '@/components/table/table'
import { useMediaQuery } from '@/hooks/use-media-query'
import { getDesktopMediaQuery } from '@/lib/breakpoints'
import { cn } from '@/lib/utils'

export interface DynamicListProps<TData> {
  data: TData[]
  columns: TableColumn<TData>[]
  card: {
    renderTrigger: CardListProps<TData>['renderTrigger']
    fields: CardField<TData>[]
    getItemKey?: CardListProps<TData>['getItemKey']
    className?: string
  }
  table?: {
    className?: string
    containerClassName?: string
    onRowClick?: TableProps<TData>['onRowClick']
    getRowKey?: TableProps<TData>['getRowKey']
  }
  className?: string
  sorting?: Sorting
  onSortChange?: (field: string) => void
  getRowClassName?: (record: TData) => string | undefined
  rowActions?: UseRowActionsOutput<TData>
  isLoading?: boolean
  isFetching?: boolean
  emptyState?: React.ReactNode
}

export function DynamicList<TData>({
  data,
  columns,
  card,
  table,
  className,
  sorting,
  onSortChange,
  getRowClassName,
  rowActions,
  isLoading = false,
  isFetching = false,
  emptyState,
}: DynamicListProps<TData>) {
  // Sem matchMedia no servidor: renderiza desktop e corrige na hidratação.
  const isDesktop = useMediaQuery(getDesktopMediaQuery(), true)

  return (
    <div className={cn('w-full', className)}>
      {isDesktop ? (
        <Table
          data={data}
          columns={columns}
          className={table?.className}
          containerClassName={table?.containerClassName}
          getRowClassName={getRowClassName}
          getRowKey={table?.getRowKey}
          sorting={sorting}
          onSortChange={onSortChange}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyState={emptyState}
          onRowClick={table?.onRowClick}
          rowActions={rowActions}
        />
      ) : (
        <CardList
          data={data}
          renderTrigger={card.renderTrigger}
          fields={card.fields}
          rowActions={rowActions}
          getItemKey={card.getItemKey}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyState={emptyState}
          sorting={sorting}
          onSortChange={onSortChange}
          className={card.className}
          getRowClassName={getRowClassName}
        />
      )}
    </div>
  )
}
