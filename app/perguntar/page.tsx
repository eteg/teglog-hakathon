import { PageContainer, PageHeader } from '@/components/page-header'
import { PerguntaGestor } from '@/components/pergunta-gestor'

export const metadata = { title: 'Pergunte ao prejuízo' }

export default function Perguntar() {
  return (
    <PageContainer>
      <PageHeader
        title="Pergunte ao prejuízo"
        description="Escolha uma pergunta: o gráfico mostra a resposta e, abaixo, a consulta usada para calcular."
      />
      <PerguntaGestor />
    </PageContainer>
  )
}
