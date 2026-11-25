import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getBucket } from "@/lib/storage";

export type Media = { bytes: ArrayBuffer; contentType: string };

const GRAPH_API = "https://graph.facebook.com/v21.0";

async function getMetaMedia(mediaId: string, accessToken: string): Promise<Media> {
  const headers = { authorization: `Bearer ${accessToken}` };

  const info = await fetch(`${GRAPH_API}/${encodeURIComponent(mediaId)}`, { headers });
  if (!info.ok) throw new Error(`Graph API ${info.status} ao buscar a mídia`);
  const { url, mime_type } = (await info.json()) as { url: string; mime_type: string };

  const file = await fetch(url, { headers });
  if (!file.ok) throw new Error(`Graph API ${file.status} ao baixar a mídia`);
  return { bytes: await file.arrayBuffer(), contentType: mime_type };
}

async function getMockMedia(mediaId: string): Promise<Media> {
  if (!mediaId.startsWith("uploads/")) throw new Error("media_id mock fora de uploads/");

  const object = await (await getBucket()).get(mediaId);
  if (!object) throw new Error(`Mídia ${mediaId} não encontrada no R2`);
  return {
    bytes: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

export async function getMedia(mediaId: string): Promise<Media> {
  const { env } = await getCloudflareContext({ async: true });
  return env.WHATSAPP_MODE === "mock" ? getMockMedia(mediaId) : getMetaMedia(mediaId, env.WHATSAPP_ACCESS_TOKEN);
}
