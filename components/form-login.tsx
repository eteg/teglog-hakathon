'use client'

import { LogIn } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function FormLogin() {
  const params = useSearchParams()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { erro?: string }
      setErro(j.erro ?? `Erro ${r.status}`)
      setEnviando(false)
      return
    }
    // Só volta para caminhos internos (evita redirecionar para outro site).
    const destino = params.get('next')
    window.location.href = destino?.startsWith('/') && !destino.startsWith('//') ? destino : '/'
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={entrar}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="usuario">Usuário</Label>
        <Input
          id="usuario"
          autoComplete="username"
          autoFocus
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="desktop:text-sm max-desktop:h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="desktop:text-sm max-desktop:h-11 text-base"
        />
      </div>
      {erro && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm" role="alert">
          {erro}
        </p>
      )}
      <Button type="submit" className="max-desktop:h-11 w-full" disabled={!usuario.trim() || !senha || enviando} isLoading={enviando}>
        {!enviando && <LogIn />}
        Entrar
      </Button>
    </form>
  )
}
