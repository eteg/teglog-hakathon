'use client'

import { Calculator, MessageCircleQuestion, Send } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RespostaPergunta } from '@/lib/perguntas'
import { brl } from '@/lib/regras'
import { Section } from './ui'

const EXEMPLOS = [
  'Qual o custo total das ocorrências?',
  'Qual rota teve o maior custo?',
  'Quanto o seguro cobriu por transportadora?',
  'Quantas avarias tivemos na semana?',
  'Qual motorista tem mais custo com avaria?',
]

/** Pergunta do gestor (F4): resposta em R$ e o "como calculei" com a consulta usada. */
export function PerguntaGestor() {
  const [pergunta, setPergunta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [historico, setHistorico] = useState<RespostaPergunta[]>([])

  async function perguntar(texto: string) {
    const p = texto.trim()
    if (!p) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await fetch('/api/perguntas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pergunta: p }),
      })
      const j = (await r.json()) as RespostaPergunta & { erro?: string }
      if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`)
      setHistorico((h) => [j, ...h])
      setPergunta('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Section>
        <form
          className="flex flex-col gap-3 min-[640px]:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            perguntar(pergunta)
          }}
        >
          <div className="relative min-w-0 flex-1">
            <MessageCircleQuestion className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Ex.: qual rota teve o maior custo com avaria?"
              maxLength={500}
              className="desktop:text-sm max-desktop:h-11 pl-9 text-base"
            />
          </div>
          <Button type="submit" className="max-desktop:h-11 min-w-40" disabled={!pergunta.trim() || enviando} isLoading={enviando}>
            {!enviando && <Send />}
            Perguntar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <Button key={ex} variant="outline" size="sm" className="max-desktop:h-11 h-auto py-1.5 whitespace-normal" disabled={enviando} onClick={() => perguntar(ex)}>
              {ex}
            </Button>
          ))}
        </div>
        {erro && <p className="text-destructive text-sm">{erro}</p>}
      </Section>

      {historico.map((r, i) => (
        <Section key={historico.length - i} title={r.pergunta}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-primary text-3xl font-bold tabular-nums">
              {r.unidade === 'BRL' ? brl(r.valor) : r.valor.toLocaleString('pt-BR')}
            </span>
            <span className="text-sm">{r.resposta}</span>
          </div>

          {r.linhas.length > 1 && (
            <ol className="flex flex-col gap-1 text-sm">
              {r.linhas.map((l, j) => (
                <li key={j} className="border-border flex justify-between gap-3 border-b py-1 last:border-0">
                  <span className="min-w-0 truncate">
                    {j + 1}. {l.grupo ?? 'não informado'}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {r.unidade === 'BRL' ? brl(l.valor) : l.valor} · {l.casos} caso{l.casos === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <details className="border-border rounded-md border">
            <summary className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
              <Calculator className="size-4" />
              Como calculei
            </summary>
            <div className="flex flex-col gap-3 border-t p-3 text-sm">
              <p className="text-muted-foreground">
                Entendi como: <strong className="text-foreground">{ROTULO_METRICA[r.interpretacao.metrica]}</strong>
                {r.interpretacao.dimensao && (
                  <>
                    {' '}agrupado por <strong className="text-foreground">{r.interpretacao.dimensao}</strong>
                  </>
                )}
                {r.interpretacao.filtros.length > 0 && <>, filtrando {r.interpretacao.filtros.join(', ')}</>}
                {r.interpretacao.periodo && <>, período: {r.interpretacao.periodo}</>}.
              </p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">{r.consulta}</pre>
              <p className="text-muted-foreground text-xs">
                Consulta executada no D1 sobre a tabela de ocorrências. Interpretação por regras, provisória até o endpoint do back.
              </p>
            </div>
          </details>
        </Section>
      ))}
    </div>
  )
}

const ROTULO_METRICA = { custo: 'custo das ocorrências', seguro: 'valor coberto pelo seguro', quantidade: 'número de ocorrências' }
