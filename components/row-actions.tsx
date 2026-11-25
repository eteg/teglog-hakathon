'use client'

// Port simplificado de mca-refactor/shared/components/row-actions (sem permissões/confirmação).
import { MoreVertical, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type RowAction = {
  id: string
  label: ReactNode
  icon?: LucideIcon
  variant?: 'default' | 'destructive'
  disabled?: boolean
  hidden?: boolean
  onSelect?: () => void
}

export type UseRowActionsOutput<TData> = {
  getActions: (record: TData) => RowAction[]
  isPending?: boolean
  hideWhenEmpty?: boolean
}

export function RowActions({
  actions,
  disabled = false,
  hideWhenEmpty = false,
}: {
  actions: RowAction[]
  disabled?: boolean
  hideWhenEmpty?: boolean
}) {
  const visible = actions.filter((a) => !a.hidden)
  if (hideWhenEmpty && visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="shrink-0 cursor-pointer" disabled={disabled}>
          <MoreVertical className="text-muted-foreground h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px] overflow-hidden">
        {visible.map((action) => (
          <DropdownMenuItem
            key={action.id}
            variant={action.variant ?? 'default'}
            disabled={action.disabled || disabled}
            className="cursor-pointer px-3 py-2"
            onSelect={() => action.onSelect?.()}
          >
            {action.icon && <action.icon className="h-4 w-4" />}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CardFooterActions({
  actions,
  disabled = false,
  className,
}: {
  actions: RowAction[]
  disabled?: boolean
  className?: string
}) {
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null

  return (
    <div className={cn('bg-muted/30 border-t p-4', className)}>
      <div className="flex flex-wrap gap-2">
        {visible.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
            size="sm"
            disabled={action.disabled || disabled}
            className="h-11 flex-1"
            onClick={() => action.onSelect?.()}
            data-row-action
          >
            {action.icon && <action.icon className="h-4 w-4" />}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
