import { ChartColumn, ClipboardList, type LucideIcon } from 'lucide-react'

export type AppNavigationGroup = {
  title: string
  icon: LucideIcon
  items: { label: string; href: string }[]
}

export const NAVIGATION: AppNavigationGroup[] = [
  {
    title: 'Ocorrências',
    icon: ClipboardList,
    items: [
      { label: 'Ocorrências da carga', href: '/' },
      { label: 'Fila de revisão', href: '/revisao' },
    ],
  },
  {
    title: 'Análise',
    icon: ChartColumn,
    items: [
      { label: 'Indicativo de perda', href: '/painel' },
      { label: 'Pergunte ao prejuízo', href: '/perguntar' },
      { label: 'Padrões emergentes', href: '/padroes' },
    ],
  },
]

export function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/ocorrencias')
  return pathname.startsWith(href)
}
