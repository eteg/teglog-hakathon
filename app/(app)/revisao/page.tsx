import { FilaRevisao } from '@/components/fila-revisao'
import { PageContainer, PageHeader } from '@/components/page-header'

export const metadata = { title: 'Fila de revisão' }

export default function Revisao() {
  return (
    <PageContainer>
      <PageHeader
        title="Fila de revisão"
        description="Campos que a IA extraiu com baixa confiança (abaixo de 70%). Confirme o valor ou corrija; a tratativa é recalculada na hora."
      />
      <FilaRevisao />
    </PageContainer>
  )
}
