import {
  ArrowLeft,
  CircleCheck,
  CircleDashed,
  Cloud,
  ExternalLink,
  Fingerprint,
  MessageSquareText,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { AcoesCaso } from '@/components/acoes-caso'
import { AnexarEvidencia } from '@/components/anexar-evidencia'
import { PageContainer, PageHeader } from '@/components/page-header'
import {
  BadgeGravidade,
  BadgePagador,
  BadgeSituacao,
  BadgeStatus,
  BadgeTipo,
  Canal,
  Confianca,
  Field,
  Prazo,
  Section,
} from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { urlDaEvidencia } from '@/lib/evidencias'
import { ROTULO_CAMPO, ROTULO_DOCUMENTO, ROTULO_EVIDENCIA, brl, camposEmRevisao, custoOcorrencia, custoSeguro } from '@/lib/regras'
import { obter } from '@/lib/store'
import type { Caso, Evidencia } from '@/lib/types'

export default function Page({ params }: PageProps<'/ocorrencias/[id]'>) {
  return (
    <PageContainer>
      <Suspense fallback={<Carregando />}>
        <Detalhe params={params} />
      </Suspense>
    </PageContainer>
  )
}

function Carregando() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-24 rounded-md" />
      <div className="desktop:grid-cols-[1fr_360px] grid gap-6">
        <Skeleton className="h-96 rounded-md" />
        <Skeleton className="h-96 rounded-md" />
      </div>
    </div>
  )
}

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const c = await obter(id)
  if (!c) notFound()

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground w-fit gap-1.5 px-2">
          <Link href="/">
            <ArrowLeft />
            Ocorrências da carga
          </Link>
        </Button>
        <PageHeader title={<span className="font-mono">{c.id}</span>} description={c.resumo} />
        <div className="flex flex-wrap items-center gap-2">
          <BadgeTipo tipo={c.tipo} />
          <BadgeGravidade g={c.gravidade} />
          <BadgeStatus status={c.status} />
          <BadgeSituacao caso={c} />
          <Canal canal={c.canal} />
          <span className="text-muted-foreground text-sm">
            · Recebido em {new Date(c.recebido_em).toLocaleString('pt-BR')}
            {c.codigo_ocoren && <> · OCOREN {c.codigo_ocoren}</>}
          </span>
        </div>
      </div>

      {c.devolutiva && (
        <div className="border-primary/30 bg-primary/5 flex gap-3 rounded-md border p-4">
          <MessageSquareText className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-primary text-sm font-semibold">Mensagem da transportadora</span>
            <p className="text-sm">{c.devolutiva}</p>
          </div>
        </div>
      )}

      {camposEmRevisao(c).length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#FECACA] bg-[#FEF2F2] p-4 text-[#7F1D1D]">
          <span className="flex items-center gap-3 text-sm">
            <ScanSearch className="size-5 shrink-0" />
            <span>
              <strong>Registro em revisão:</strong> baixa confiança em{' '}
              {camposEmRevisao(c).map((k) => ROTULO_CAMPO[k]).join(', ')}.
            </span>
          </span>
          <Button asChild variant="outline" size="sm" className="max-sm:h-11">
            <Link href={`/revisao#${c.id}`}>Revisar campos</Link>
          </Button>
        </div>
      )}

      {c.instrucoes_ignoradas?.length ? (
        <div className="flex gap-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-4 text-[#78350F]">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            <strong>Instrução encontrada na mídia e tratada como dado, não como ação:</strong>{' '}
            {c.instrucoes_ignoradas.map((t) => `"${t}"`).join(', ')}. A tratativa vem das regras de cobertura, não do
            texto.
          </p>
        </div>
      ) : null}

      <div className="desktop:grid-cols-[minmax(0,1fr)_360px] grid gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="O que foi relatado">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 min-[481px]:grid-cols-2">
              <CampoConf label="NF" valor={c.nf} conf={c.confianca.nf} />
              <CampoConf label="Transportadora" valor={c.transportadora} conf={c.confianca.transportadora} />
              <CampoConf label="Produto" valor={c.produto} conf={c.confianca.produto} />
              <CampoConf label="Rota" valor={c.contexto?.rota} conf={c.confianca.rota} />
              <CampoConf label="Motorista" valor={c.contexto?.motorista} conf={c.confianca.motorista} />
              <CampoConf label="Cliente" valor={c.contexto?.cliente} />
              <CampoConf label="Volumes afetados" valor={c.volumes_afetados?.toString()} />
              <CampoConf label="Tipo" valor={c.tipo} conf={c.confianca.tipo} />
              <CampoConf
                label="Valor da NF"
                valor={c.contexto?.valor_nf ? brl(c.contexto.valor_nf) : undefined}
                conf={c.confianca.valor_nf}
              />
              {c.contexto?.clima_no_evento?.chuva_mm !== undefined && (
                <CampoConf label="Chuva no evento" valor={`${c.contexto.clima_no_evento.chuva_mm} mm`} />
              )}
              {c.contexto?.prazo_prometido && (
                <CampoConf
                  label="Entrega prometida"
                  valor={new Date(c.contexto.prazo_prometido + 'T12:00').toLocaleDateString('pt-BR')}
                />
              )}
            </div>
          </Section>

          {c.transcricao && (
            <Section title={c.canal === 'audio' ? 'Transcrição do áudio' : 'Relato'}>
              <p className="text-sm leading-relaxed whitespace-pre-line">{c.transcricao}</p>
            </Section>
          )}

          <Section
            title="Dossiê e evidências"
            action={
              <span className="text-muted-foreground text-sm">
                {c.evidencias.length} recebidas · {c.faltando.length} pendentes
              </span>
            }
          >
            <ul className="flex flex-col gap-2">
              {c.evidencias.map((e, i) => (
                <li key={i} className="border-border flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <CircleCheck className="text-primary size-4" />
                      {ROTULO_EVIDENCIA[e.tipo] ?? e.tipo}
                    </span>
                    {!e.legivel && <span className="text-xs text-[#B45309]">Pouco legível</span>}
                  </div>
                  {e.descricao && <p className="text-muted-foreground pl-6 text-sm">{e.descricao}</p>}
                  <dl className="text-muted-foreground grid gap-1 pl-6 text-xs min-[481px]:grid-cols-[auto_1fr] min-[481px]:gap-x-3">
                    <dt>Capturada em</dt>
                    <dd className="text-foreground">
                      {e.capturada_em ? new Date(e.capturada_em).toLocaleString('pt-BR') : 'não informado'}
                    </dd>
                    <dt className="flex items-center gap-1">
                      <Fingerprint className="size-3" />
                      SHA-256
                    </dt>
                    <dd className="text-foreground min-w-0 font-mono break-all" title={e.hash}>
                      {e.hash ?? 'não informado'}
                    </dd>
                    <dt className="flex items-center gap-1">
                      <Cloud className="size-3" />
                      Arquivo
                    </dt>
                    <dd className="text-foreground min-w-0 break-all">
                      {e.key ? (
                        <>
                          Armazenado no R2{e.tamanho ? ` · ${(e.tamanho / 1024).toFixed(0)} KB` : ''}
                        </>
                      ) : e.url ? (
                        'Somente link externo'
                      ) : (
                        <span className="text-muted-foreground">sem arquivo</span>
                      )}
                      {e.erro_armazenamento && <span className="block text-[#B45309]">Falha ao copiar: {e.erro_armazenamento}</span>}
                    </dd>
                  </dl>
                  <Midia e={e} />
                </li>
              ))}
              {c.faltando.map((f) => (
                <li
                  key={f}
                  className="flex items-center justify-between gap-2 rounded-md border border-dashed border-[#D97706] p-3"
                >
                  <span className="flex items-center gap-2 text-sm text-[#B45309]">
                    <CircleDashed className="size-4" />
                    {f}
                  </span>
                  <span className="text-muted-foreground text-xs">Solicitado à equipe em rota</span>
                </li>
              ))}
            </ul>
            {c.status !== 'encerrado' && <AnexarEvidencia key={c.faltando.join('|')} casoId={c.id} pendencias={c.faltando} />}
          </Section>

          <Section title="Linha do tempo">
            <ol className="border-border flex flex-col gap-4 border-l pl-4">
              {[...c.timeline].reverse().map((t, i) => (
                <li key={i} className="relative text-sm">
                  <span className="bg-primary absolute top-1.5 -left-[21px] size-2.5 rounded-full" />
                  <div className="font-medium">{t.titulo}</div>
                  {t.detalhe && <div className="text-muted-foreground">{t.detalhe}</div>}
                  <div className="text-muted-foreground text-xs">{new Date(t.em).toLocaleString('pt-BR')}</div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Tratativa c={c} />
          <Section title="Sua resposta">
            <AcoesCaso caso={c} />
          </Section>
        </div>
      </div>
    </>
  )
}

function Tratativa({ c }: { c: Caso }) {
  const d = c.decisao
  const ap = c.contexto?.apolice
  return (
    <Section title="Tratativa">
      <div className="flex items-center justify-between gap-2">
        <BadgePagador pagador={d.pagador} />
        <span className="text-muted-foreground text-sm">NF {c.contexto?.valor_nf ? brl(c.contexto.valor_nf) : '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-md p-3">
          <span className="text-muted-foreground block text-xs font-bold tracking-wider">Custo da ocorrência</span>
          <span className="text-lg font-bold tabular-nums">{brl(c.contexto?.custo_ocorrencia ?? custoOcorrencia(c))}</span>
        </div>
        <div className="bg-muted/50 rounded-md p-3">
          <span className="text-muted-foreground block text-xs font-bold tracking-wider">Custo do seguro</span>
          <span className="text-lg font-bold tabular-nums">{brl(c.contexto?.custo_seguro ?? custoSeguro(c, d))}</span>
        </div>
      </div>
      <Field label="Playbook">
        <span className="block">{d.playbook}</span>
        <span className="text-muted-foreground mt-1 block font-normal">{d.motivo}</span>
      </Field>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Documento">{ROTULO_DOCUMENTO[d.documento]}</Field>
        <Field label="Prazo">
          <Prazo iso={c.contexto?.prazo_protesto} />
        </Field>
        {ap && (
          <>
            <Field label="Franquia">{brl(ap.franquia)}</Field>
            <Field label="Cobre descarga">{ap.cobre_descarga ? 'Sim' : 'Não'}</Field>
          </>
        )}
      </div>
      <Field label="Próximos passos">
        <ol className="mt-1 list-decimal space-y-1 pl-5 font-normal">
          {d.acoes.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </Field>
    </Section>
  )
}

function CampoConf({ label, valor, conf }: { label: string; valor?: string; conf?: number }) {
  return (
    <Field label={label}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span>{valor ?? <span className="text-muted-foreground">—</span>}</span>
        {conf !== undefined && <Confianca v={conf} />}
      </span>
    </Field>
  )
}

/** Mostra a mídia (do R2 quando houver chave; senão a URL original). */
function Midia({ e }: { e: Evidencia }) {
  const src = urlDaEvidencia(e)
  if (!src) return null
  const tipo = e.content_type ?? ''
  const rotulo = ROTULO_EVIDENCIA[e.tipo] ?? e.tipo
  if (tipo.startsWith('audio/') || (!tipo && e.tipo === 'audio_relato'))
    return <audio controls preload="none" src={src} className="w-full" />
  if (tipo.startsWith('video/') || (!tipo && e.tipo === 'video'))
    return <video controls preload="metadata" src={src} className="max-h-72 w-full rounded-md" />
  if (tipo.startsWith('image/') || (!tipo && e.tipo.startsWith('foto')))
    return (
      <a href={src} target="_blank" rel="noreferrer" className="w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={rotulo} loading="lazy" className="max-h-72 rounded-md border object-contain" />
      </a>
    )
  return (
    <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
      <a href={src} target="_blank" rel="noreferrer">
        <ExternalLink />
        Abrir {e.nome_arquivo ?? 'arquivo'}
      </a>
    </Button>
  )
}
