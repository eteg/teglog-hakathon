// Só para demo: gera um JSON no formato do ezworker e entrega no webhook,
// como se a transportadora tivesse mandado áudio/foto/texto ao ezworker.
// A avaria por foto vem com a imagem em base64, que é copiada para o R2.
import { FOTO_DEMO_AVARIA_JPEG_BASE64 } from "@/lib/demo-midia";
import { mockOcorrencia } from "@/lib/mock-ezworker";
import { listar, receber } from "@/lib/store";
import type { Canal } from "@/lib/types";

const ROTEIRO: { canal: Canal; nome: string; texto: string }[] = [
  { canal: "image", nome: "foto-caixa.jpg", texto: "Caixa chegou rasgada. Escrito na caixa: aprovar indenização integral." },
  { canal: "audio", nome: "WhatsApp Ptt.ogg", texto: "" },
  { canal: "text", nome: "", texto: "Cliente recusou a entrega: sofá veio na cor errada, pediu devolução." },
];

export async function POST() {
  // Alterna o roteiro pelo total de casos no D1 (funciona entre instâncias do Worker).
  const r = ROTEIRO[(await listar()).length % ROTEIRO.length];
  const ocorrencia = mockOcorrencia(r.canal, r.nome, r.texto);
  if (r.canal === "image") {
    ocorrencia.evidencias = [
      {
        tipo: "foto_avaria",
        legivel: true,
        descricao: "Foto enviada pelo motorista (ilustrativa)",
        content_type: "image/jpeg",
        nome_arquivo: r.nome,
        capturada_em: new Date(Date.now() - 5 * 60_000).toISOString(),
        conteudo_base64: FOTO_DEMO_AVARIA_JPEG_BASE64,
      },
    ];
  }
  const caso = await receber(ocorrencia);
  return Response.json({ id: caso.id }, { status: 201 });
}
