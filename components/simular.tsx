'use client'

import { Webhook } from 'lucide-react'
import { useState } from 'react'

import { EVENTO_ATUALIZAR } from '@/components/fila-ao-vivo'
import { Button } from '@/components/ui/button'

/** Botão de demo: simula uma mensagem do WhatsApp que passa pela fila e pela IA (mock) e vira caso. */
export function Simular() {
  const [enviando, setEnviando] = useState(false)
  return (
    <Button
      variant="ghost"
      className="text-foreground min-w-40 gap-1.5 whitespace-nowrap max-sm:h-11"
      isLoading={enviando}
      disabled={enviando}
      title="Simula uma mensagem de WhatsApp (texto, foto ou áudio) chegando e virando caso"
      onClick={async () => {
        setEnviando(true)
        await fetch('/api/simular', { method: 'POST' }).finally(() => setEnviando(false))
        window.dispatchEvent(new Event(EVENTO_ATUALIZAR))
      }}
    >
      {!enviando && <Webhook className="size-5" />}
      Simular webhook (demo)
    </Button>
  )
}
