'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const TODOS = '__todos__'

/** Select de filtro com a opção "Todos" (valor vazio). */
export function FiltroSelect({
  rotulo,
  valor,
  opcoes,
  onChange,
  className,
}: {
  rotulo: string
  valor: string
  opcoes: { value: string; label: string }[]
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <Select value={valor || TODOS} onValueChange={(v) => onChange(v === TODOS ? '' : v)}>
      <SelectTrigger
        aria-label={rotulo}
        className={cn('max-desktop:h-11 w-full min-w-0 min-[481px]:w-auto min-[481px]:min-w-40', valor && 'border-primary text-primary', className)}
      >
        <SelectValue placeholder={rotulo} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{rotulo}: todos</SelectItem>
        {opcoes.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
