import { FileText, Image as ImageIcon, Mic, Video, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { ROTULO_PAGADOR, ROTULO_SITUACAO, ROTULO_STATUS, ROTULO_TIPO, diasAte, situacaoRegistro } from '@/lib/regras'
import type { Canal as TCanal, Gravidade, OcorrenciaEzworker, Pagador, SituacaoRegistro, StatusCaso, TipoOcorrencia } from '@/lib/types'
import { cn } from '@/lib/utils'

// Badge no mesmo formato do StatusBadge do mca-refactor (pílula com bolinha).
type Tom = 'green' | 'slate' | 'amber' | 'red' | 'blue' | 'violet'

const TONS: Record<Tom, { container: string; dot: string; text: string }> = {
  green: { container: 'bg-[#BBF7D0] border-[#BBF7D0]', dot: 'bg-[#14532D]', text: 'text-[#14532D]' },
  slate: { container: 'bg-[#E2E8F0] border-[#E2E8F0]', dot: 'bg-[#0F172A]', text: 'text-[#0F172A]' },
  amber: { container: 'bg-[#FDE68A] border-[#FDE68A]', dot: 'bg-[#78350F]', text: 'text-[#78350F]' },
  red: { container: 'bg-[#FECACA] border-[#FECACA]', dot: 'bg-[#7F1D1D]', text: 'text-[#7F1D1D]' },
  blue: { container: 'bg-[#BFDBFE] border-[#BFDBFE]', dot: 'bg-[#1E3A8A]', text: 'text-[#1E3A8A]' },
  violet: { container: 'bg-[#DDD6FE] border-[#DDD6FE]', dot: 'bg-[#4C1D95]', text: 'text-[#4C1D95]' },
}

export function Badge({ tom = 'slate', children }: { tom?: Tom; children: ReactNode }) {
  const t = TONS[tom]
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center justify-start gap-1 overflow-hidden rounded-[6px] border px-2 pt-0.5 pb-1',
        t.container,
      )}
    >
      <span className={cn('block h-1.25 w-1.25 shrink-0 rounded-full', t.dot)} />
      <span className={cn('font-sans text-xs leading-4 font-semibold tracking-normal whitespace-nowrap', t.text)}>
        {children}
      </span>
    </span>
  )
}

/** Seção com borda, no padrão dos cards do mca-refactor. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-border bg-card flex min-w-0 flex-col gap-4 rounded-md border p-6', className)}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="border-border bg-card flex min-w-0 items-start gap-4 rounded-md border p-5">
      {Icon && (
        <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-[6px]">
          <Icon className="text-primary size-5" />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-foreground text-xl font-bold break-words tabular-nums">{value}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground block text-sm font-bold tracking-wider">{label}</span>
      <div className="mt-0.5 text-sm font-medium">{children ?? '—'}</div>
    </div>
  )
}

const TOM_TIPO: Record<TipoOcorrencia, Tom> = {
  avaria: 'red',
  acidente: 'red',
  extravio: 'amber',
  recusa: 'blue',
  reentrega: 'blue',
  atraso: 'slate',
}
export const BadgeTipo = ({ tipo }: { tipo: TipoOcorrencia }) => <Badge tom={TOM_TIPO[tipo]}>{ROTULO_TIPO[tipo]}</Badge>

const TOM_STATUS: Record<StatusCaso, Tom> = {
  novo: 'blue',
  aguardando_evidencia: 'amber',
  aguardando_aprovacao: 'amber',
  aprovado: 'green',
  devolutiva_enviada: 'green',
  encerrado: 'slate',
}
export const BadgeStatus = ({ status }: { status: StatusCaso }) => (
  <Badge tom={TOM_STATUS[status]}>{ROTULO_STATUS[status]}</Badge>
)

const TOM_PAGADOR: Record<Pagador, Tom> = {
  seguradora: 'violet',
  transportadora: 'blue',
  embarcador: 'amber',
  absorver: 'slate',
  revisao_humana: 'red',
}
export const BadgePagador = ({ pagador }: { pagador: Pagador }) => (
  <Badge tom={TOM_PAGADOR[pagador]}>{ROTULO_PAGADOR[pagador]}</Badge>
)

const TOM_GRAV: Record<Gravidade, Tom> = { alta: 'red', media: 'amber', baixa: 'slate' }
export const BadgeGravidade = ({ g }: { g: Gravidade }) => (
  <Badge tom={TOM_GRAV[g]}>Gravidade {g === 'media' ? 'média' : g}</Badge>
)

const CANAL: Record<TCanal, { icon: LucideIcon; label: string }> = {
  audio: { icon: Mic, label: 'Áudio' },
  image: { icon: ImageIcon, label: 'Foto' },
  video: { icon: Video, label: 'Vídeo' },
  text: { icon: FileText, label: 'Texto' },
}
export function Canal({ canal, iconOnly = false }: { canal: TCanal; iconOnly?: boolean }) {
  const { icon: Icon, label } = CANAL[canal]
  if (iconOnly)
    return (
      <span className="text-muted-foreground inline-flex" title={label} aria-label={label}>
        <Icon className="size-4" />
      </span>
    )
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-4" />
      {label}
    </span>
  )
}

export function Prazo({ iso }: { iso?: string }) {
  if (!iso) return <span className="text-muted-foreground">—</span>
  const d = diasAte(iso)
  const tom: Tom = d < 0 ? 'red' : d <= 3 ? 'amber' : 'slate'
  return <Badge tom={tom}>{d < 0 ? `Vencido há ${-d}d` : d === 0 ? 'Vence hoje' : `${d} dias`}</Badge>
}

export function Confianca({ v }: { v: number }) {
  const pct = Math.round(v * 100)
  const cor = v >= 0.85 ? 'bg-primary' : v >= 0.7 ? 'bg-[#D97706]' : 'bg-destructive'
  return (
    <span className="inline-flex items-center gap-2" title={`Confiança ${pct}%`}>
      <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <span className={cn('block h-full', cor)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{pct}%</span>
    </span>
  )
}

const TOM_SITUACAO: Record<SituacaoRegistro, Tom> = { completo: 'green', incompleto: 'amber', em_revisao: 'red' }
/** Situação do registro (F3): completo, incompleto (falta evidência) ou em revisão (baixa confiança). */
export function BadgeSituacao({ caso }: { caso: OcorrenciaEzworker }) {
  const s = situacaoRegistro(caso)
  return <Badge tom={TOM_SITUACAO[s]}>Registro {ROTULO_SITUACAO[s].toLowerCase()}</Badge>
}
