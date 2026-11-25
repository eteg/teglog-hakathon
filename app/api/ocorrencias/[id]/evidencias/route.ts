// Anexa uma evidência ao caso: multipart { file, tipo, descricao?, resolve? }.
// O arquivo vai para o R2 (com SHA-256) e entra no dossiê; `resolve` tira a pendência da lista.
import { exigir } from "@/lib/acesso";
import { MAX_BYTES } from "@/lib/evidencias";
import { anexarEvidencia } from "@/lib/store";
import type { TipoEvidencia } from "@/lib/types";

const TIPOS: TipoEvidencia[] = [
  "foto_avaria", "foto_canhoto", "danfe", "etiqueta", "audio_relato", "video",
  "boletim_ocorrencia", "diario_bordo", "tacografo", "prontuario", "texto",
];
const MIME_ACEITOS = /^(image\/(jpeg|png|webp|heic|gif)|audio\/|video\/|application\/pdf$)/;

export async function POST(req: Request, ctx: RouteContext<"/api/ocorrencias/[id]/evidencias">) {
  const negado = await exigir(req, "escrever");
  if (negado) return negado;
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const tipo = String(form.get("tipo") ?? "") as TipoEvidencia;
  const descricao = String(form.get("descricao") ?? "").slice(0, 200) || undefined;
  const resolve = String(form.get("resolve") ?? "") || undefined;

  if (!(file instanceof File)) return Response.json({ erro: "Envie o arquivo no campo 'file'." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 413 });
  if (!MIME_ACEITOS.test(file.type)) return Response.json({ erro: "Formato não aceito (foto, áudio, vídeo ou PDF)." }, { status: 415 });
  if (!TIPOS.includes(tipo)) return Response.json({ erro: `tipo inválido: ${tipo}` }, { status: 400 });

  const caso = await anexarEvidencia(
    id,
    { dados: await file.arrayBuffer(), contentType: file.type, nome: file.name },
    { tipo, descricao, resolve },
  );
  if (!caso) return Response.json({ erro: "não encontrado" }, { status: 404 });
  return Response.json(caso, { status: 201 });
}
