'use client'

import { Calculator, CircleHelp } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { RespostaPergunta } from '@/lib/perguntas'
import { brl } from '@/lib/regras'
import { cn } from '@/lib/utils'
import { Section } from './ui'

/** Perguntas disponíveis ao gestor (F4). Sem texto livre: só o que o sistema sabe calcular. */
const PERGUNTAS = [
  'Qual o custo total das ocorrências?',
  'Qual rota teve o maior custo?',
  'Qual transportadora tem o maior custo?',
  'Quanto o seguro cobriu por transportadora?',
  'Quantas avarias tivemos na semana?',
  'Qual motorista tem mais custo com avaria?',
]

/** Pergunta do gestor (F4): escolhe uma pergunta pronta; mostra o gráfico e a última consulta. */
export function PerguntaGestor() {
  const [selecionada, setSelecionada] = useState(PERGUNTAS[0])
  const [resposta, setResposta] = useState<RespostaPergunta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    fetch('/api/perguntas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pergunta: selecionada }),
    })
      .then(async (r) => {
        const j = (await r.json()) as RespostaPergunta & { erro?: string }
        if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`)
        return j
      })
      .then((j) => {
        if (!ativo) return
        setResposta(j)
        setErro(null)
      })
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [selecionada])

  function perguntar(p: string) {
    if (p === selecionada) return
    setCarregando(true)
    setSelecionada(p)
  }

  const formatar = (v: number) => (resposta?.unidade === 'BRL' ? brl(v) : v.toLocaleString('pt-BR'))

  return (
    <div className="flex flex-col gap-6">
      <Section title="Perguntas">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Perguntas disponíveis">
          {PERGUNTAS.map((p) => (
            <Button
              key={p}
              role="radio"
              aria-checked={p === selecionada}
              variant={p === selecionada ? 'default' : 'outline'}
              size="sm"
              className="max-desktop:h-11 h-auto py-1.5 whitespace-normal"
              disabled={carregando && p !== selecionada}
              onClick={() => perguntar(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </Section>

      {erro && (
        <div className="flex gap-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#78350F]" role="alert">
          <CircleHelp className="mt-0.5 size-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {!resposta ? (
        <Skeleton className="h-80 rounded-md" />
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity duration-200', carregando && 'opacity-50')} aria-busy={carregando}>
          <Section title={resposta.grafico.titulo}>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm">{resposta.pergunta}</span>
              <span className="text-foreground text-3xl font-bold tabular-nums">{formatar(resposta.valor)}</span>
            </div>
            <GraficoBarras linhas={resposta.grafico.linhas} formatar={formatar} />
          </Section>

          <Section title="Última consulta">
            <p className="text-sm">{resposta.resposta}</p>
            <details className="border-border rounded-md border">
              <summary className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
                <Calculator className="size-4" />
                Como calculei
              </summary>
              <div className="flex flex-col gap-3 border-t p-3 text-sm">
                <p className="text-muted-foreground">
                  Entendi como: <strong className="text-foreground">{ROTULO_METRICA[resposta.interpretacao.metrica]}</strong>
                  {resposta.interpretacao.dimensao && (
                    <>
                      {' '}agrupado por <strong className="text-foreground">{resposta.interpretacao.dimensao}</strong>
                    </>
                  )}
                  {resposta.interpretacao.filtros.length > 0 && <>, filtrando {resposta.interpretacao.filtros.join(', ')}</>}
                  {resposta.interpretacao.periodo && <>, período: {resposta.interpretacao.periodo}</>}.
                </p>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">{resposta.consulta}</pre>
                <TabelaDados titulo={resposta.grafico.titulo} linhas={resposta.grafico.linhas} formatar={formatar} />
                <p className="text-muted-foreground text-xs">
                  Consulta executada no D1 sobre a tabela de ocorrências. Interpretação por regras, provisória até o endpoint do back.
                </p>
              </div>
            </details>
          </Section>
        </div>
      )}
    </div>
  )
}

const ROTULO_METRICA = { custo: 'custo das ocorrências', seguro: 'valor coberto pelo seguro', quantidade: 'número de ocorrências' }

type Linha = { grupo: string; valor: number; casos: number }

/**
 * Barras horizontais de uma série (magnitude por categoria): um único tom, extremidade de dado
 * arredondada, valor escrito em tinta de texto e tooltip por barra no hover/foco.
 */
function GraficoBarras({ linhas, formatar }: { linhas: Linha[]; formatar: (v: number) => string }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const max = Math.max(...linhas.map((l) => l.valor), 0)

  if (linhas.length === 0 || max === 0)
    return <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">Sem dados para essa pergunta.</p>

  return (
    <ul className="flex flex-col gap-2" aria-label="Gráfico de barras">
      {linhas.map((l, i) => {
        const pct = (l.valor / max) * 100
        return (
          <li
            key={l.grupo}
            tabIndex={0}
            className="group relative grid grid-cols-1 items-center gap-x-3 gap-y-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] min-[481px]:grid-cols-[minmax(0,200px)_1fr]"
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
            onFocus={() => setAtivo(i)}
            onBlur={() => setAtivo(null)}
            aria-label={`${l.grupo}: ${formatar(l.valor)} em ${l.casos} ocorrência${l.casos === 1 ? '' : 's'}`}
          >
            <span className="text-foreground truncate text-sm" title={l.grupo}>
              {l.grupo}
            </span>
            <div className="flex min-w-0 items-center gap-2 py-1">
              {/* área de hover maior que a barra */}
              <div className="flex h-5 min-w-0 flex-1 items-center">
                <div
                  className={cn('bg-primary h-full rounded-r-[4px] transition-opacity', ativo !== null && ativo !== i && 'opacity-40')}
                  style={{ width: `max(${pct}%, 2px)` }}
                />
              </div>
              <span className="text-foreground w-28 shrink-0 text-right text-sm font-medium tabular-nums">{formatar(l.valor)}</span>
            </div>
            {ativo === i && (
              <div
                role="tooltip"
                className="bg-popover text-popover-foreground pointer-events-none absolute top-full left-0 z-10 mt-1 rounded-md border px-3 py-2 text-xs shadow-md min-[481px]:left-[212px]"
              >
                <div className="font-semibold">{l.grupo}</div>
                <div className="tabular-nums">{formatar(l.valor)}</div>
                <div className="text-muted-foreground">
                  {l.casos} ocorrência{l.casos === 1 ? '' : 's'}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Visão em tabela dos mesmos dados do gráfico (acessibilidade / conferência). */
function TabelaDados({ titulo, linhas, formatar }: { titulo: string; linhas: Linha[]; formatar: (v: number) => string }) {
  return (
    <table className="w-full text-sm">
      <caption className="text-muted-foreground mb-1 text-left text-xs">Dados do gráfico: {titulo}</caption>
      <thead>
        <tr className="text-muted-foreground border-b text-left text-xs">
          <th className="py-1 font-medium">Grupo</th>
          <th className="py-1 text-right font-medium">Valor</th>
          <th className="py-1 text-right font-medium">Ocorrências</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.grupo} className="border-b last:border-0">
            <td className="py-1">{l.grupo}</td>
            <td className="py-1 text-right tabular-nums">{formatar(l.valor)}</td>
            <td className="py-1 text-right tabular-nums">{l.casos}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
