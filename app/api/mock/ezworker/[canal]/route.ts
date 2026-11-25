// Mock dos endpoints do ezworker (/ezworker/audio | /image | /video | /text).
// Recebe o mesmo que o real (multipart: arquivo e/ou texto) e devolve o JSON da ocorrência.
// Por padrão também entrega no fluxo do webhook (como o real fará via callback).
//
// Campos: arquivo (opcional, até 10 MB), texto (opcional), cenario (opcional, id do catálogo),
//         entregar ("false" para só ver o JSON, sem criar o caso).
import { MAX_BYTES } from "@/lib/evidencias";
import { CANAIS, simularEzworker } from "@/lib/mock-fluxo";
import type { Canal } from "@/lib/types";

const MIME_POR_CANAL: Record<Canal, RegExp> = {
  audio: /^audio\//,
  image: /^image\/(jpeg|png|webp|heic|gif)$/,
  video: /^video\//,
  text: /^(text\/plain|application\/pdf)$/,
};

export async function POST(req: Request, ctx: RouteContext<"/api/mock/ezworker/[canal]">) {
  const { canal } = await ctx.params;
  if (!CANAIS.includes(canal as Canal))
    return Response.json({ erro: `canal inválido: ${canal}. Use ${CANAIS.join(", ")}.` }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("arquivo");
  const texto = String(form?.get("texto") ?? "").slice(0, 2000) || undefined;
  const cenario = String(form?.get("cenario") ?? "") || undefined;
  const entregar = form?.get("entregar") !== "false";

  let arquivo;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 413 });
    if (!MIME_POR_CANAL[canal as Canal].test(file.type))
      return Response.json({ erro: `Formato ${file.type || "desconhecido"} não combina com o canal ${canal}.` }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    arquivo = { base64: btoa(bin), contentType: file.type, nome: file.name };
  }
  if (!arquivo && !texto && canal === "text")
    return Response.json({ erro: "Envie o texto do relato." }, { status: 400 });

  try {
    const r = await simularEzworker({ canal: canal as Canal, texto, arquivo, cenario, entregar });
    return Response.json(r, { status: entregar ? 201 : 200 });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
