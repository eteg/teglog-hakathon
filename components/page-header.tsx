// Port de mca-refactor/shared/components/page-header (sem permissões).
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  className?: string
  titleClassName?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, className, titleClassName, actions }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className={cn('text-brand text-3xl font-bold', titleClassName)}>{title}</h1>
        {description && <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">{actions}</div>}
    </div>
  )
}

export function PageContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('max-desktop:px-3 flex shrink-0 flex-col gap-6 p-6', className)}>{children}</div>
}
