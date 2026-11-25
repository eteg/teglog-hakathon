'use client'

// Port de mca-refactor/shared/components/card-list (sem seleção, permissões e paginação).
import { ChevronDown, ListFilter } from 'lucide-react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import * as React from 'react'

import { CardFooterActions, type UseRowActionsOutput } from '@/components/row-actions'
import { TableSortIcon, type Sorting } from '@/components/table/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { getValueByPath, type DataPath } from '@/lib/data-path'
import { renderDataValue } from '@/lib/render-data-value'
import { cn } from '@/lib/utils'

export type CardField<TData> = {
  id: string | number
  title: string
  span?: 1 | 2
  className?: string
  sortable?: boolean
  hidden?: boolean
} & ({ dataIndex: DataPath<TData> } | { render: (record: TData) => React.ReactNode | string })

export interface CardListProps<TData> {
  data: TData[]
  renderTrigger: (record: TData) => React.ReactNode
  fields: CardField<TData>[]
  rowActions?: UseRowActionsOutput<TData>
  getItemKey?: (record: TData, index: number) => string
  isLoading?: boolean
  isFetching?: boolean
  emptyState?: React.ReactNode
  className?: string
  classNames?: { list?: string; card?: string; trigger?: string; content?: string; footer?: string }
  getRowClassName?: (record: TData) => string | undefined
  sorting?: Sorting
  onSortChange?: (field: string) => void
}

export function CardList<TData>({
  data,
  renderTrigger,
  fields,
  rowActions,
  getItemKey,
  isLoading = false,
  isFetching = false,
  emptyState,
  sorting,
  onSortChange,
  className,
  classNames,
  getRowClassName,
}: CardListProps<TData>) {
  const visibleFields = fields.filter((f) => !f.hidden)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <CardListSortDropdown fields={fields} sorting={sorting} onSortChange={onSortChange} disabled={isFetching} />
      </div>

      <div className={cn('transition-opacity duration-200', isFetching && 'opacity-50')}>
        {isLoading ? (
          <div className={cn('space-y-3', classNames?.list)}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn('bg-card rounded-xl border p-4 shadow-sm', classNames?.card)}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
            {emptyState ?? 'Nenhum registro encontrado.'}
          </div>
        ) : (
          <AccordionPrimitive.Root type="multiple" className={cn('space-y-3', classNames?.list)}>
            {data.map((record, index) => {
              const key = getItemKey ? getItemKey(record, index) : String(index)
              const actions = rowActions?.getActions(record).filter((a) => !a.hidden) ?? []
              const hasContent = visibleFields.length > 0 || actions.length > 0
              const cardClass = cn(
                'bg-card overflow-hidden rounded-xl border shadow-sm',
                classNames?.card,
                getRowClassName?.(record),
              )

              if (!hasContent) {
                return (
                  <div key={key} className={cardClass}>
                    <div className={cn('flex items-start gap-3 p-4', classNames?.trigger)}>
                      <div className="min-w-0 flex-1">{renderTrigger(record)}</div>
                    </div>
                  </div>
                )
              }

              return (
                <AccordionPrimitive.Item key={key} value={key} className={cardClass} disabled={isFetching}>
                  <AccordionPrimitive.Header className="flex items-stretch">
                    <AccordionPrimitive.Trigger
                      className={cn(
                        'group flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 p-4 text-left',
                        'hover:bg-muted/40 transition-colors',
                        '[&[data-state=open]>svg]:rotate-180',
                        classNames?.trigger,
                      )}
                    >
                      <div className="min-w-0 flex-1">{renderTrigger(record)}</div>
                      <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200" />
                    </AccordionPrimitive.Trigger>
                  </AccordionPrimitive.Header>
                  <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                    <div className={cn('border-t', classNames?.content)}>
                      {visibleFields.length > 0 && (
                        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 min-[481px]:grid-cols-2">
                          {visibleFields.map((field) => (
                            <CardFieldItem key={field.id} record={record} field={field} />
                          ))}
                        </div>
                      )}
                      <CardFooterActions
                        actions={actions}
                        disabled={isFetching || rowActions?.isPending}
                        className={classNames?.footer}
                      />
                    </div>
                  </AccordionPrimitive.Content>
                </AccordionPrimitive.Item>
              )
            })}
          </AccordionPrimitive.Root>
        )}
      </div>
    </div>
  )
}

function CardFieldItem<TData>({ record, field }: { record: TData; field: CardField<TData> }) {
  const value =
    'render' in field
      ? field.render(record)
      : renderDataValue(getValueByPath(record, field.dataIndex), { emptyValue: '—', emptyStringValue: '—' })

  return (
    <div className={cn(field.span === 2 && 'min-[481px]:col-span-2', field.className)}>
      <span className="text-muted-foreground block text-sm font-bold tracking-wider">{field.title}</span>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  )
}

function CardListSortDropdown<TData>({
  fields,
  sorting,
  onSortChange,
  disabled,
}: {
  fields: CardField<TData>[]
  sorting?: Sorting
  onSortChange?: (field: string) => void
  disabled?: boolean
}) {
  const options = fields.filter((f) => f.sortable).map((f) => ({ label: f.title, value: String(f.id) }))
  if (options.length === 0 || !onSortChange) return null
  const activeLabel = options.find((o) => o.value === sorting?.field)?.label ?? 'Ordenar por'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-11 w-fit min-w-48 justify-between gap-3 px-3" disabled={disabled}>
          <span className="flex min-w-0 items-center gap-2">
            <ListFilter className="h-4 w-4 shrink-0" />
            <span className="truncate">{activeLabel}</span>
          </span>
          <TableSortIcon direction={sorting?.direction} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-56 min-w-56">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} className="h-10 cursor-pointer justify-between" onClick={() => onSortChange(o.value)}>
            <span>{o.label}</span>
            <TableSortIcon direction={sorting?.field === o.value ? sorting.direction : undefined} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
