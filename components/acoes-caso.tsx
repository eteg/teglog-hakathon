'use client'

import { CheckCircle2, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Caso } from '@/lib/types'

/** Ações do cliente sobre a ocorrência: aprovar a tratativa e responder à transportadora. */
export function AcoesCaso({ caso }: { caso: Caso }) {
  const router = useRouter()
  const [pendente, start] = useTransition()
  const [enviando, setEnviando] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')

  async function acao(acao: 'aprovar' | 'responder' | 'encerrar') {
    setEnviando(acao)
    const r = await fetch(`/api/ocorrencias/${caso.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao, mensagem: resposta }),
    })
    setEnviando(null)
    if (r.ok) {
      setResposta('')
      start(() => router.refresh())
    }
  }

  const ocupado = pendente || enviando !== null
  const aprovado = ['aprovado', 'devolutiva_enviada', 'encerrado'].includes(caso.status)

  return (
    <div className="flex flex-col gap-4">
      {caso.decisao.requer_aprovacao && !aprovado && (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#78350F]">
            Precisa da sua aprovação: {caso.decisao.motivo_aprovacao}
          </p>
          <Button className="w-full max-sm:h-11" onClick={() => acao('aprovar')} disabled={ocupado} isLoading={enviando === 'aprovar'}>
            {enviando !== 'aprovar' && <CheckCircle2 />}
            Aprovar tratativa
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="resposta">Responder à transportadora</Label>
        <Textarea
          id="resposta"
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          rows={4}
          placeholder="Ex.: de acordo, podem seguir com a reposição."
          className="desktop:text-sm min-w-0 text-base"
        />
        <Button
          variant="outline"
          className="w-full max-sm:h-11"
          onClick={() => acao('responder')}
          disabled={ocupado || !resposta.trim()}
          isLoading={enviando === 'responder'}
        >
          {enviando !== 'responder' && <Send />}
          Enviar resposta
        </Button>
      </div>

      {caso.status !== 'encerrado' && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => acao('encerrar')} disabled={ocupado}>
          Marcar como resolvido
        </Button>
      )}
    </div>
  )
}
