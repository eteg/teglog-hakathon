import { CircleDollarSign, PiggyBank, Truck, TriangleAlert } from 'lucide-react'

import { PageContainer, PageHeader } from '@/components/page-header'
import { Ranking } from '@/components/ranking'
import { Kpi, Section } from '@/components/ui'
import { BASE, agregar, recomendar, totais } from '@/lib/padroes'
import { brl } from '@/lib/regras'

const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d })

export default function Painel() {
  const t = totais()
  const acoes = recomendar()
  const economia = acoes.reduce((s, a) => s + a.economia, 0)
  const rotas = [...new Set(BASE.map((l) => l.rota))]
  const transps = [...new Set(BASE.map((l) => l.transportadora))]
  const maxPorMil = Math.max(...BASE.map((l) => (l.ocorrencias / l.entregas) * 1000))

  return (
    <PageContainer>
      <PageHeader
        title="Indicativo de perda"
        description="Todas as ocorrências do mês comparadas pela taxa a cada mil entregas, para que quem transporta mais não pareça pior. Base sintética para a demo."
      />

      <div className="desktop:grid-cols-4 grid grid-cols-1 gap-3 min-[481px]:grid-cols-2">
        <Kpi icon={CircleDollarSign} label="Prejuízo no mês" value={brl(t.custo)} />
        <Kpi icon={Truck} label="Entregas" value={fmt(t.entregas, 0)} />
        <Kpi icon={TriangleAlert} label="Ocorrências a cada mil" value={fmt(t.porMil)} hint={`${fmt(t.ocorrencias, 0)} ocorrências`} />
        <Kpi icon={PiggyBank} label="Economia possível" value={brl(economia)} hint="Com as ações abaixo, por mês" />
      </div>

      <Section title="Ações que mais economizam">
        <ol className="flex flex-col gap-3">
          {acoes.map((a, i) => (
            <li key={a.titulo} className="border-border flex flex-wrap items-start justify-between gap-3 rounded-md border p-4">
              <div className="flex min-w-0 gap-3">
                <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-[6px] text-sm font-semibold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.titulo}</p>
                  <p className="text-muted-foreground text-sm">{a.detalhe}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary text-base font-bold tabular-nums">{brl(a.economia)}</p>
                <p className="text-muted-foreground text-xs">por mês</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-xs">Ações precisam de aprovação. Nada é executado automaticamente.</p>
      </Section>

      <Section title="Rota × transportadora" action={<span className="text-muted-foreground text-sm">Ocorrências a cada mil entregas</span>}>
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="px-2 py-2 font-medium">Rota</th>
                {transps.map((tr) => (
                  <th key={tr} className="px-2 py-2 text-center font-medium">
                    {tr.replace('Transportadora ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rotas.map((r) => (
                <tr key={r}>
                  <td className="px-2 py-2 whitespace-nowrap">{r}</td>
                  {transps.map((tr) => {
                    const l = BASE.filter((x) => x.rota === r && x.transportadora === tr)
                    if (!l.length)
                      return (
                        <td key={tr} className="bg-muted/40 text-muted-foreground rounded-md text-center">
                          —
                        </td>
                      )
                    const ent = l.reduce((s, x) => s + x.entregas, 0)
                    const oc = l.reduce((s, x) => s + x.ocorrencias, 0)
                    const pm = (oc / ent) * 1000
                    const pct = Math.round(8 + (pm / maxPorMil) * 45)
                    return (
                      <td
                        key={tr}
                        className="rounded-md px-2 py-2 text-center tabular-nums"
                        style={{ background: `color-mix(in oklab, var(--destructive) ${pct}%, transparent)` }}
                        title={`${fmt(ent, 0)} entregas · ${oc} ocorrências`}
                      >
                        <div className="font-semibold">{fmt(pm)}</div>
                        <div className="text-[11px] opacity-80">{fmt(ent, 0)} entregas</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Ranking">
        <Ranking
          dados={{
            rota: agregar((l) => l.rota),
            transportadora: agregar((l) => l.transportadora),
            produto: agregar((l) => l.produto),
          }}
        />
      </Section>
    </PageContainer>
  )
}
