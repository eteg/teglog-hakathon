import { PageContainer, PageHeader } from '@/components/page-header'
import { PadroesEmergentes } from '@/components/padroes-emergentes'

export const metadata = { title: 'Padrões emergentes · Recupera' }

export default function Padroes() {
  return (
    <PageContainer>
      <PageHeader
        title="Padrões emergentes"
        description="Relatos parecidos agrupados, com o custo e as rotas de cada grupo. Dê um nome ao padrão para a equipe reconhecer. Agrupamento provisório por tipo e subtipo."
      />
      <PadroesEmergentes />
    </PageContainer>
  )
}
