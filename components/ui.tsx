import { FileText, Image as ImageIcon, Mic, Video, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  DESCRICAO_STATUS_EXIBICAO,
  ROTULO_PAGADOR,
  ROTULO_SITUACAO,
  ROTULO_STATUS_EXIBICAO,
  ROTULO_TIPO,
  diasAte,
  situacaoRegistro,
  statusExibicao,
  type StatusExibicao,
} from '@/lib/regras'
import type { Canal as TCanal, Caso, Gravidade, OcorrenciaEzworker, Pagador, TipoOcorrencia } from '@/lib/types'
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

/**
 * Badge no padrão do mca-refactor (ProjectStatusBadge/StatusBadge): nunca passa da largura do pai
 * (max-w-full + overflow-hidden) e o texto corta com "…" em vez de quebrar; o texto completo fica
 * no `title`. Para caber sem corte, dê largura à coluna (ex.: `width` da TableColumn).
 */
export function Badge({ tom = 'slate', title, children }: { tom?: Tom; title?: string; children: ReactNode }) {
  const t = TONS[tom]
  const dica = title ?? (typeof children === 'string' ? children : undefined)
  return (
    <span
      title={dica}
      className={cn(
        'inline-flex max-w-full min-w-0 items-center justify-start gap-1 overflow-hidden rounded-[6px] border px-2 pt-0.5 pb-1 align-middle',
        t.container,
      )}
    >
      <span className={cn('block h-1.25 w-1.25 shrink-0 rounded-full', t.dot)} />
      <span className={cn('min-w-0 truncate font-sans text-xs leading-4 font-semibold tracking-normal', t.text)}>{children}</span>
    </span>
  )
}

/** Grade de StatBox: quantas colunas couberem com no mínimo 10rem cada; senão, uma por linha. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3', className)}>{children}</div>
}

/** Caixa de número (rótulo + valor) padronizada: rótulo em uma linha com "…" e valor sem quebrar. */
export function StatBox({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-muted/50 flex min-w-0 flex-col gap-0.5 rounded-md p-3">
      <span className="text-muted-foreground truncate text-xs font-bold tracking-wider" title={label}>
        {label}
      </span>
      <span className="truncate text-lg leading-7 font-bold tabular-nums">{value}</span>
      {hint && (
        <span className="text-muted-foreground truncate text-xs" title={hint}>
          {hint}
        </span>
      )}
    </div>
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
      {/* Altura fixa por linha (rótulo: 2 linhas, valor: 1, nota: 1) para os cards ficarem alinhados entre si. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-muted-foreground line-clamp-2 min-h-10 text-sm leading-5" title={label}>
          {label}
        </span>
        <span className="text-foreground truncate text-xl leading-7 font-bold tabular-nums">{value}</span>
        <span className="text-muted-foreground min-h-4 truncate text-xs leading-4">{hint ?? ' '}</span>
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

const TOM_STATUS: Record<StatusExibicao, Tom> = {
  em_revisao: 'red',
  aguarda_voce: 'amber',
  incompleto: 'amber',
  em_tratativa: 'blue',
  aprovado: 'green',
  respondido: 'green',
  encerrado: 'slate',
}
/** Status único da ocorrência (tratativa + situação do registro). */
export function BadgeStatus({ caso }: { caso: Caso }) {
  const s = statusExibicao(caso)
  return (
    <Badge tom={TOM_STATUS[s]} title={`${ROTULO_STATUS_EXIBICAO[s]}: ${DESCRICAO_STATUS_EXIBICAO[s]}`}>
      {ROTULO_STATUS_EXIBICAO[s]}
    </Badge>
  )
}

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

/** Situação do registro (F3) como informação, não como segundo status. */
export function TextoSituacao({ caso }: { caso: OcorrenciaEzworker }) {
  return <span className="text-muted-foreground text-sm">Registro {ROTULO_SITUACAO[situacaoRegistro(caso)].toLowerCase()}</span>
}
