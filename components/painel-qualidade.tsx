'use client'

import { CircleCheck, CircleX, EyeOff, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import type { CardField } from '@/components/card-list/card-list'
import { DynamicList } from '@/components/dynamic-list'
import type { TableColumn } from '@/components/table/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { MedicaoPII, ResultadoAcesso, VerificacaoAcesso } from '@/lib/qualidade'
import { cn } from '@/lib/utils'
import { Badge, Section, StatBox, StatGrid } from './ui'

type Medicao = { pii: MedicaoPII; acesso: VerificacaoAcesso; medidoEm: string }

const EXEMPLOS = [
  'Motorista Edson, CPF 529.982.247-25, placa RBX-4E21, liga no (71) 98877-6655. NF 000873221.',
  'Cliente recusou: escrever para joana.t@lojaeletro.com.br ou 11 99123-4567. CNPJ 12.345.678/0001-95, CEP 40000-000.',
  'Volume 2 não estava no baú. Condutor 52998224725, caminhão ABC1D23, valor da nota R$ 18.450,00.',
]

/** Tela de qualidade: critérios 6 (dados pessoais) e 4 (acesso mínimo), medidos na hora. */
export function PainelQualidade() {
  const [medicao, setMedicao] = useState<Medicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [medindo, setMedindo] = useState(true)

  useEffect(() => {
    let ativo = true
    fetch('/api/qualidade', { cache: 'no-store' })
      .then(async (r) => {
        const j = (await r.json()) as Medicao & { erro?: string }
        if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`)
        return j
      })
      .then((j) => ativo && (setMedicao(j), setErro(null)))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => ativo && setMedindo(false))
    return () => {
      ativo = false
    }
  }, [tick])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">
          {medicao ? `Medido em ${new Date(medicao.medidoEm).toLocaleString('pt-BR')}` : 'Medindo…'}
        </span>
        <Button
          variant="outline"
          className="max-desktop:h-11 gap-1.5"
          disabled={medindo}
          isLoading={medindo}
          onClick={() => {
            setMedindo(true)
            setTick((t) => t + 1)
          }}
        >
          {!medindo && <RefreshCw />}
          Medir de novo
        </Button>
      </div>

      {erro && <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">{erro}</p>}

      {!medicao ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-72 rounded-md" />
          <Skeleton className="h-96 rounded-md" />
        </div>
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity', medindo && 'opacity-50')}>
          <CriterioPII pii={medicao.pii} />
          <CriterioAcesso acesso={medicao.acesso} />
        </div>
      )}
    </div>
  )
}

function Meta({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <Badge tom={ok ? 'green' : 'red'}>{children}</Badge>
}

// ---------------------------------------------------------------------------

function CriterioPII({ pii }: { pii: MedicaoPII }) {
  const { amostra, varredura } = pii
  const ok = amostra.escondidos === amostra.plantados && amostra.iscasAlteradas === 0 && varredura.encontrados === 0
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <EyeOff className="text-primary size-5" />
          Dados pessoais estão protegidos?
        </span>
      }
      action={<Meta ok={ok}>{ok ? 'Meta atingida' : 'Abaixo da meta'}</Meta>}
    >
      <p className="text-muted-foreground -mt-2 text-sm">
        CPF (com dígito verificador), telefone, placa e e-mail viram marcadores antes de qualquer texto ir para a IA ou para os
        registros. CNPJ, NF e CEP não são escondidos. O original fica só no nosso banco, como prova do caso.
      </p>
      <StatGrid>
        <StatBox
          label="Escondidos na amostra"
          value={`${amostra.percentual.toLocaleString('pt-BR')}%`}
          hint={`${amostra.escondidos} de ${amostra.plantados} em ${amostra.relatos} relatos`}
        />
        <StatBox label="Iscas alteradas (NF, CNPJ, CEP)" value={amostra.iscasAlteradas} hint={`de ${amostra.iscas} · meta: 0`} />
        <StatBox
          label="Dados pessoais nos registros da IA"
          value={varredura.encontrados}
          hint={`${varredura.registrosVerificados} registros verificados · meta: 0`}
        />
      </StatGrid>
      {varredura.exemplos.length > 0 && (
        <p className="rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#7F1D1D]">
          Encontrados em: {varredura.exemplos.map((e) => `${e.origem} (${e.tipo})`).join(', ')}. Registros anteriores à máscara.
        </p>
      )}
      <AntesDepois />
    </Section>
  )
}

function AntesDepois() {
  const [texto, setTexto] = useState(EXEMPLOS[0])
  const [resultado, setResultado] = useState<{ original: string; mascarado: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function mascarar(t: string) {
    setEnviando(true)
    const r = await fetch('/api/qualidade/pii', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto: t }),
    })
    if (r.ok) setResultado((await r.json()) as { original: string; mascarado: string })
    setEnviando(false)
  }

  return (
    <div className="border-border flex flex-col gap-3 rounded-md border p-4">
      <span className="text-sm font-semibold">Antes e depois</span>
      <div className="flex flex-wrap gap-2">
        {EXEMPLOS.map((ex, i) => (
          <Button
            key={i}
            size="sm"
            variant={texto === ex ? 'default' : 'outline'}
            className="max-desktop:h-11"
            onClick={() => {
              setTexto(ex)
              setResultado(null)
            }}
          >
            Exemplo {i + 1}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pii-texto">Relato do motorista</Label>
        <Textarea id="pii-texto" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} className="desktop:text-sm min-w-0 text-base" />
      </div>
      <Button className="max-desktop:h-11 w-fit min-w-40" disabled={!texto.trim() || enviando} isLoading={enviando} onClick={() => mascarar(texto)}>
        {!enviando && <EyeOff />}
        Ver como vai para a IA
      </Button>
      {resultado && (
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs font-bold tracking-wider">Antes (fica só no nosso banco)</span>
            <p className="bg-muted/50 rounded-md p-3 text-sm break-words">{resultado.original}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs font-bold tracking-wider">Depois (vai para a IA e para os registros)</span>
            <p className="bg-muted/50 rounded-md p-3 text-sm break-words">
              {resultado.mascarado.split(/(\[[A-Z]+_\d+\])/g).map((parte, i) =>
                /^\[[A-Z]+_\d+\]$/.test(parte) ? (
                  <mark key={i} className="bg-primary/15 text-primary rounded px-1 font-mono text-xs font-semibold">
                    {parte}
                  </mark>
                ) : (
                  <span key={i}>{parte}</span>
                ),
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function CriterioAcesso({ acesso }: { acesso: VerificacaoAcesso }) {
  const ok =
    acesso.configurado &&
    acesso.recusadas === acesso.tentativasEscrita &&
    acesso.funcoesEscritaAssistente === 0 &&
    acesso.resultados.every((r) => r.ok)
  const cobranca = acesso.resultados[0]

  const columns: TableColumn<ResultadoAcesso>[] = [
    { id: 'descricao', title: 'Tentativa', minWidth: 220, dataIndex: 'descricao' },
    {
      id: 'rota',
      title: 'Rota',
      width: 320,
      render: (r) => (
        <span className="font-mono text-xs" title={`${r.metodo} ${r.rota}`}>
          {r.metodo} {r.rota}
        </span>
      ),
    },
    { id: 'chave', title: 'Chave', width: 128, render: (r) => <Badge>{r.chave}</Badge> },
    { id: 'esperado', title: 'Esperado', width: 100, align: 'right', render: (r) => <span className="tabular-nums">{r.esperado}</span> },
    { id: 'obtido', title: 'Obtido', width: 100, align: 'right', render: (r) => <span className="tabular-nums">{r.obtido}</span> },
    {
      id: 'ok',
      title: 'Resultado',
      width: 120,
      render: (r) =>
        r.ok ? (
          <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
            <CircleCheck className="size-4" /> Ok
          </span>
        ) : (
          <span className="text-destructive inline-flex items-center gap-1 text-sm font-medium">
            <CircleX className="size-4" /> Falhou
          </span>
        ),
    },
  ]
  const cardFields: CardField<ResultadoAcesso>[] = [
    { id: 'rota', title: 'Rota', render: (r) => `${r.metodo} ${r.rota}` },
    { id: 'chave', title: 'Chave', dataIndex: 'chave' },
    { id: 'esperado', title: 'Esperado', render: (r) => String(r.esperado) },
    { id: 'obtido', title: 'Obtido', render: (r) => String(r.obtido) },
  ]

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="text-primary size-5" />O assistente tem só o acesso de que precisa?
        </span>
      }
      action={<Meta ok={ok}>{ok ? 'Meta atingida' : acesso.configurado ? 'Abaixo da meta' : 'Chave não configurada'}</Meta>}
    >
      <p className="text-muted-foreground -mt-2 text-sm">
        O D1 não tem usuário só de leitura, então a separação é na API, com duas chaves: a de leitura (a única do assistente do
        gestor) e a de analista. A recusa vem da permissão, não de uma instrução dada à IA.
      </p>

      {!acesso.configurado && (
        <p className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#78350F]">
          Defina <code>READ_API_TOKEN</code> e <code>ANALYST_API_KEY</code> (em <code>.dev.vars</code> localmente ou com{' '}
          <code>wrangler secret put</code> no Worker) para rodar o teste ao vivo.
        </p>
      )}

      <StatGrid>
        <StatBox
          label="Alterações com a chave de leitura recusadas"
          value={acesso.configurado ? `${acesso.recusadas} de ${acesso.tentativasEscrita}` : '—'}
          hint="meta: todas"
        />
        <StatBox
          label="Funções de escrita do assistente"
          value={acesso.funcoesEscritaAssistente}
          hint={`de ${acesso.ferramentasAssistente.length} ferramentas · meta: 0`}
        />
        <StatBox label="Chave do assistente" value={acesso.papelAssistente} hint="só consulta" />
      </StatGrid>

      {cobranca && (
        <div className="border-border flex flex-col gap-2 rounded-md border p-4">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="text-primary size-4" />
            Demonstração: &quot;cobre a transportadora B&quot; com a chave do assistente
          </span>
          <p className="text-muted-foreground text-sm">
            {cobranca.metodo} {cobranca.rota.replace('[id]', '…')} com a chave de leitura respondeu{' '}
            <strong className="text-foreground">{cobranca.obtido}</strong>:
          </p>
          <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(cobranca.resposta, null, 2)}</pre>
        </div>
      )}

      {acesso.resultados.length > 0 && (
        <DynamicList
          data={acesso.resultados}
          columns={columns}
          table={{ className: 'table-fixed', getRowKey: (r, i) => `${r.rota}-${i}` }}
          card={{
            fields: cardFields,
            getItemKey: (r, i) => `${r.rota}-${i}`,
            renderTrigger: (r) => (
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="text-foreground truncate text-sm font-semibold">{r.descricao}</p>
                {r.ok ? <CircleCheck className="text-primary size-4 shrink-0" /> : <CircleX className="text-destructive size-4 shrink-0" />}
              </div>
            ),
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm font-bold tracking-wider">Ferramentas do assistente do gestor</span>
        <ul className="flex flex-wrap gap-2">
          {acesso.ferramentasAssistente.map((f) => (
            <li key={f.nome} title={f.descricao}>
              <Badge tom={f.escreve ? 'red' : 'blue'}>
                {f.nome} · {f.escreve ? 'escreve' : 'só lê'}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
