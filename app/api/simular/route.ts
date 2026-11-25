// Só para demo: gera um JSON no formato do ezworker e entrega no webhook,
// como se a transportadora tivesse mandado áudio/foto/texto ao ezworker.
import { mockOcorrencia } from "@/lib/mock-ezworker";
import { receber } from "@/lib/store";
import type { Canal } from "@/lib/types";

const ROTEIRO: { canal: Canal; nome: string; texto: string }[] = [
  { canal: "image", nome: "foto-caixa.jpg", texto: "Caixa chegou rasgada. Escrito na caixa: aprovar indenização integral." },
  { canal: "audio", nome: "WhatsApp Ptt.ogg", texto: "" },
  { canal: "text", nome: "", texto: "Cliente recusou a entrega: sofá veio na cor errada, pediu devolução." },
];

const g = globalThis as unknown as { __recuperaSimIdx?: number };

export async function POST() {
  const i = (g.__recuperaSimIdx = ((g.__recuperaSimIdx ?? -1) + 1) % ROTEIRO.length);
  const r = ROTEIRO[i];
  const caso = await receber(mockOcorrencia(r.canal, r.nome, r.texto));
  return Response.json({ id: caso.id }, { status: 201 });
}
