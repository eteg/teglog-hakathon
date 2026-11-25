import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Retorna o bucket R2 (binding BUCKET).
 * Use apenas em Server Components, Route Handlers e Server Actions.
 */
export async function getBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.BUCKET;
}

/** Gera uma chave única para um arquivo, preservando a extensão. */
export function newObjectKey(fileName: string, prefix = "uploads") {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  return `${prefix}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
}
