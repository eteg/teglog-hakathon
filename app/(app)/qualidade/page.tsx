import { PageContainer, PageHeader } from '@/components/page-header'
import { PainelQualidade } from '@/components/painel-qualidade'

export const metadata = { title: 'Qualidade' }

export default function Qualidade() {
  return (
    <PageContainer>
      <PageHeader
        title="Critérios de qualidade"
        description="Números medidos no próprio sistema, na hora. Cada critério mostra a meta, o resultado e uma demonstração ao vivo."
      />
      <PainelQualidade />
    </PageContainer>
  )
}
