// Atalho da demo: sorteia um cenário do mock do ezworker e entrega no fluxo do webhook.
// Devolve o mesmo formato de POST /api/mock/ezworker/<canal> (+ `id` por compatibilidade).
import { simularEzworker } from "@/lib/mock-fluxo";

export async function POST() {
  const r = await simularEzworker({ canal: "image", aleatorio: true });
  return Response.json({ ...r, id: r.entregue?.id }, { status: 201 });
}
