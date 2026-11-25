import { Truck } from 'lucide-react'
import { Suspense } from 'react'

import { FormLogin } from '@/components/form-login'
import { PRODUTO } from '@/lib/produto'

export const metadata = { title: 'Entrar' }

export default function Login() {
  return (
    <main className="bg-muted/40 flex min-h-full items-center justify-center p-4">
      <div className="bg-card flex w-full max-w-sm flex-col gap-6 rounded-md border p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-md">
            <Truck className="size-6" />
          </span>
          <h1 className="text-brand text-2xl font-bold">{PRODUTO.nome}</h1>
          <p className="text-muted-foreground text-sm">Entre para acompanhar as ocorrências da sua carga.</p>
        </div>
        <Suspense>
          <FormLogin />
        </Suspense>
      </div>
    </main>
  )
}
