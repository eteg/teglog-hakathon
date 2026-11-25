'use client'

// Port de mca-refactor/shared/components/table (sem seleção, permissões e paginação).
import { AlignLeft, ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'
import * as React from 'react'

import { RowActions, type UseRowActionsOutput } from '@/components/row-actions'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table as UiTable,
  TableBody as UiTableBody,
  TableCell as UiTableCell,
  TableHead as UiTableHead,
  TableHeader as UiTableHeader,
  TableRow as UiTableRow,
} from '@/components/ui/table'
import { getValueByPath, type DataPath } from '@/lib/data-path'
import { renderDataValue } from '@/lib/render-data-value'
import { cn } from '@/lib/utils'

export type Sorting = { field: string; direction: 'asc' | 'desc' } | null

export type TableColumn<TData> = {
  id: string | number
  title?: string
  width?: string | number
  /** Largura mínima (px) de coluna flexível (sem `width`); entra no cálculo da largura mínima da tabela. */
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  className?: string
  classNames?: { skeleton?: string; header?: string; cell?: string }
} & ({ dataIndex: DataPath<TData> } | { render: (record: TData) => React.ReactNode })

export interface TableProps<TData> {
  data: TData[]
  columns: TableColumn<TData>[]
  className?: string
  containerClassName?: string
  classNames?: { table?: string; header?: string; body?: string; row?: string; cell?: string }
  getRowClassName?: (record: TData) => string | undefined
  getRowKey?: (record: TData, index: number) => string
  sorting?: Sorting
  onSortChange?: (field: string) => void
  isLoading?: boolean
  isFetching?: boolean
  emptyState?: React.ReactNode
  onRowClick?: (record: TData) => void
  rowActions?: UseRowActionsOutput<TData>
}

const ROW_ACTIONS_COLUMN_ID = '__row_actions__'
const SKELETON_ROWS = 6

const alignClassNames = { left: 'text-left', center: 'text-center', right: 'text-right' } as const

export function TableSortIcon({ direction, className }: { direction?: 'asc' | 'desc'; className?: string }) {
  const iconClass = cn('h-4 w-4 shrink-0', className)
  if (direction === 'asc') return <ArrowUpNarrowWide className={iconClass} />
  if (direction === 'desc') return <ArrowDownNarrowWide className={iconClass} />
  return <AlignLeft className={cn('text-muted-foreground', iconClass)} />
}

function widthStyle<TData>(column: TableColumn<TData>): React.CSSProperties | undefined {
  if (column.width === undefined) return undefined
  const width = typeof column.width === 'number' ? `${column.width}px` : column.width
  return { width, minWidth: width }
}

function larguraMinima<TData>(columns: TableColumn<TData>[]): number | undefined {
  let total = 0
  for (const c of columns) {
    if (typeof c.width === 'number') total += c.width
    else if (c.minWidth) total += c.minWidth
    else return undefined
  }
  return total
}

function cellContent<TData>(record: TData, column: TableColumn<TData>) {
  if ('render' in column) return column.render(record)
  return renderDataValue(getValueByPath(record, column.dataIndex))
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('a, button, input, select, textarea, [role="button"], [role="menuitem"], [data-row-action]'),
  )
}

export function Table<TData>({
  data,
  columns,
  className,
  containerClassName,
  classNames,
  getRowClassName,
  getRowKey,
  sorting,
  onSortChange,
  isLoading = false,
  isFetching = false,
  emptyState,
  onRowClick,
  rowActions,
}: TableProps<TData>) {
  const displayColumns: TableColumn<TData>[] = rowActions
    ? [
        ...columns,
        {
          id: ROW_ACTIONS_COLUMN_ID,
          title: '',
          width: 56,
          align: 'center',
          className: 'w-[56px] min-w-[56px] max-w-[56px] p-0',
          classNames: { skeleton: 'size-6 mx-auto' },
          render: (record) => (
            <div className="flex items-center justify-center" data-row-action>
              <RowActions
                actions={rowActions.getActions(record)}
                disabled={isFetching || rowActions.isPending}
                hideWhenEmpty={rowActions.hideWhenEmpty}
              />
            </div>
          ),
        },
      ]
    : columns

  return (
    <div className="flex w-full flex-col gap-4">
      <UiTable
        // Como no mca-refactor: a tabela nunca fica mais estreita que a soma das colunas;
        // se não couber, o container rola na horizontal em vez de cortar badges e valores.
        style={{ minWidth: larguraMinima(displayColumns) }}
        className={cn('w-full transition-opacity duration-200', isFetching && 'opacity-50', className, classNames?.table)}
        containerClassName={containerClassName}
      >
        <colgroup>
          {displayColumns.map((column) => (
            <col key={column.id} style={widthStyle(column)} />
          ))}
        </colgroup>

        <UiTableHeader className={cn('bg-background sticky top-0 z-10', classNames?.header)}>
          <UiTableRow className="dark:bg-muted/50 dark:hover:bg-muted bg-gray-100 hover:bg-gray-200">
            {displayColumns.map((column) => {
              const field = String(column.id)
              const isSortable = Boolean(column.sortable && onSortChange)
              const direction = sorting?.field === field ? sorting.direction : undefined
              const align = alignClassNames[column.align ?? 'left']
              return (
                <UiTableHead
                  key={column.id}
                  style={widthStyle(column)}
                  className={cn('box-border overflow-hidden whitespace-nowrap', align, column.classNames?.header)}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      className={cn('inline-flex max-w-full min-w-0 cursor-pointer items-center gap-2 font-medium whitespace-nowrap', align)}
                      onClick={() => onSortChange?.(field)}
                    >
                      <span className="line-clamp-1 min-w-0 overflow-hidden">{column.title}</span>
                      <TableSortIcon direction={direction} />
                    </button>
                  ) : (
                    <div className={cn('flex max-w-full min-w-0 items-center gap-2 whitespace-nowrap', align)}>
                      <span className="line-clamp-1 min-w-0 overflow-hidden">{column.title}</span>
                    </div>
                  )}
                </UiTableHead>
              )
            })}
          </UiTableRow>
        </UiTableHeader>

        <UiTableBody className={classNames?.body}>
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <UiTableRow key={i} className={classNames?.row}>
                {displayColumns.map((column) => (
                  <UiTableCell
                    key={column.id}
                    style={widthStyle(column)}
                    className={cn(alignClassNames[column.align ?? 'left'], 'box-border whitespace-nowrap', column.className)}
                  >
                    <Skeleton className={cn('h-4 w-3/4', column.classNames?.skeleton)} />
                  </UiTableCell>
                ))}
              </UiTableRow>
            ))
          ) : data.length === 0 ? (
            <UiTableRow className={classNames?.row}>
              <UiTableCell colSpan={displayColumns.length || 1} className="text-muted-foreground h-60 text-center">
                {emptyState ?? 'Nenhum registro encontrado.'}
              </UiTableCell>
            </UiTableRow>
          ) : (
            data.map((record, index) => {
              const interactive = Boolean(onRowClick && !isFetching)
              return (
                <UiTableRow
                  key={getRowKey ? getRowKey(record, index) : index}
                  tabIndex={interactive ? 0 : undefined}
                  className={cn(interactive && 'cursor-pointer', classNames?.row, getRowClassName?.(record))}
                  onClick={(e) => {
                    if (!onRowClick || isFetching || isInteractiveTarget(e.target)) return
                    onRowClick(record)
                  }}
                  onKeyDown={(e) => {
                    if (!onRowClick || isFetching || isInteractiveTarget(e.target) || e.key !== 'Enter') return
                    onRowClick(record)
                  }}
                >
                  {displayColumns.map((column) => {
                    const content = cellContent(record, column)
                    const isPlain = typeof content === 'string' || typeof content === 'number'
                    return (
                      <UiTableCell
                        key={column.id}
                        style={widthStyle(column)}
                        className={cn(
                          alignClassNames[column.align ?? 'left'],
                          'box-border overflow-hidden whitespace-nowrap',
                          classNames?.cell,
                          column.className,
                          column.classNames?.cell,
                        )}
                      >
                        {column.id === ROW_ACTIONS_COLUMN_ID || !isPlain ? (
                          content
                        ) : (
                          <span
                            className="text-foreground block w-full truncate font-sans text-sm leading-5 font-normal tracking-normal"
                            title={String(content)}
                          >
                            {content}
                          </span>
                        )}
                      </UiTableCell>
                    )
                  })}
                </UiTableRow>
              )
            })
          )}
        </UiTableBody>
      </UiTable>
    </div>
  )
}
