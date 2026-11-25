import { getBucket, newObjectKey } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Upload via multipart/form-data, campo "file". Retorna a chave no R2. */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Envie o arquivo no campo 'file'." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Arquivo maior que 10 MB." }, { status: 413 });
  }

  const key = newObjectKey(file.name);
  const bucket = await getBucket();
  // R2 exige tamanho conhecido; com o limite de 10 MB, bufferizar é ok.
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { originalName: file.name },
  });

  return Response.json({ key, url: `/api/files/${key}` }, { status: 201 });
}
