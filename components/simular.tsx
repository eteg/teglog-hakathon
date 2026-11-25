'use client'

import { Webhook } from 'lucide-react'
import { useState } from 'react'

import { EVENTO_ATUALIZAR } from '@/components/fila-ao-vivo'
import { Button } from '@/components/ui/button'

/** Botão de demo: dispara um webhook falso no formato do ezworker. */
export function Simular() {
  const [enviando, setEnviando] = useState(false)
  return (
    <Button
      variant="ghost"
      className="text-foreground min-w-40 gap-1.5 whitespace-nowrap max-sm:h-11"
      isLoading={enviando}
      disabled={enviando}
      title="Simula a chegada de um JSON do ezworker"
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
