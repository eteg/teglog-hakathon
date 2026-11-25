// Demonstração do critério 6: devolve o texto como ele iria para a IA (dados pessoais escondidos).
// Não grava nada. POST { texto }
import { exigir } from "@/lib/acesso";
import { mascararPII } from "@/lib/pii";

export async function POST(req: Request) {
  const negado = await exigir(req, "ler");
  if (negado) return negado;
  const { texto } = (await req.json().catch(() => ({}))) as { texto?: string };
  if (!texto?.trim()) return Response.json({ erro: "Envie o texto." }, { status: 400 });
  const r = mascararPII(texto.slice(0, 2000));
  return Response.json({ original: texto.slice(0, 2000), mascarado: r.texto, achados: r.achados.map(({ tipo, marcador }) => ({ tipo, marcador })) });
}
