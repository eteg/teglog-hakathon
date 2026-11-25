// Atalho da demo: sorteia um cenário do mock do ezworker e entrega no fluxo do webhook.
// Devolve o mesmo formato de POST /api/mock/ezworker/<canal> (+ `id` por compatibilidade).
import { exigir } from "@/lib/acesso";
import { simularEzworker } from "@/lib/mock-fluxo";

export async function POST(req: Request) {
  const negado = await exigir(req, "escrever");
  if (negado) return negado;
  const r = await simularEzworker({ canal: "image", aleatorio: true });
  return Response.json({ ...r, id: r.entregue?.id }, { status: 201 });
}
