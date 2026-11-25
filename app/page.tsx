import { FilaAoVivo } from '@/components/fila-ao-vivo'
import { PageContainer, PageHeader } from '@/components/page-header'
import { Simular, SimularWhatsapp } from '@/components/simular'

// Página estática: a lista busca os casos no D1 via /api/ocorrencias no navegador.
// (No Cloudflare/OpenNext a casca pré-renderizada vem do cache e não é completada
// pelo servidor, então dados dinâmicos aqui ficariam presos no fallback.)
export default function Home() {
  return (
    <PageContainer>
      <PageHeader
        title="Ocorrências da carga"
        description="Tudo o que a transportadora relatou por áudio, foto ou texto, já organizado: o que aconteceu, as evidências, o que está sendo feito e o prazo."
        actions={
          <>
            <SimularWhatsapp />
            <Simular />
          </>
        }
      />
      <FilaAoVivo />
    </PageContainer>
  )
}
