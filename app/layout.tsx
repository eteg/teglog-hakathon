import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { AppShell } from '@/components/app-layout/app-shell'
import { PRODUTO } from '@/lib/produto'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: PRODUTO.nome, template: `%s · ${PRODUTO.nome}` },
  description: PRODUTO.descricao,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
