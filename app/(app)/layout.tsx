import { AppShell } from '@/components/app-layout/app-shell'

// Páginas do produto (logadas): header + sidebar. A tela de login fica fora deste grupo.
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>
}
