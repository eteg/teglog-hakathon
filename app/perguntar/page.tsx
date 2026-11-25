import { PageContainer, PageHeader } from '@/components/page-header'
import { PerguntaGestor } from '@/components/pergunta-gestor'

export const metadata = { title: 'Pergunte ao prejuízo · Recupera' }

export default function Perguntar() {
  return (
    <PageContainer>
      <PageHeader
        title="Pergunte ao prejuízo"
        description="Pergunte em português sobre custos, rotas, transportadoras e motoristas. A resposta vem em R$, com a consulta usada para calcular."
      />
      <PerguntaGestor />
    </PageContainer>
  )
}
