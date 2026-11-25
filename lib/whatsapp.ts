import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NovaMensagemWhatsapp } from "@/db/schema";
import { getBucket } from "@/lib/storage";

export type MensagemInterpretada = Omit<NovaMensagemWhatsapp, "id" | "statusMidia" | "chaveArmazenamento">;
export type Midia = { bytes: ArrayBuffer; tipoConteudo: string };

type MidiaMeta = { id?: string; mime_type?: string; caption?: string };
type MensagemMeta = {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  image?: MidiaMeta;
  audio?: MidiaMeta;
  location?: { latitude?: number; longitude?: number };
};
type PayloadMeta = { entry?: { changes?: { value?: { messages?: MensagemMeta[] } }[] }[] };

const GRAPH_API = "https://graph.facebook.com/v21.0";

function interpretarMensagem(mensagem: MensagemMeta): MensagemInterpretada | null {
  if (typeof mensagem?.id !== "string" || typeof mensagem.from !== "string") return null;

  const tipo = (["text", "image", "audio", "location"] as const).find((conhecido) => conhecido === mensagem.type) ?? "other";
  const midia = tipo === "image" || tipo === "audio" ? mensagem[tipo] : undefined;

  return {
    idMensagemWhatsapp: mensagem.id,
    telefone: mensagem.from,
    tipo,
    texto: mensagem.text?.body ?? midia?.caption ?? null,
    idMidia: midia?.id ?? null,
    tipoConteudo: midia?.mime_type ?? null,
    latitude: mensagem.location?.latitude ?? null,
    longitude: mensagem.location?.longitude ?? null,
    payloadBruto: JSON.stringify(mensagem),
    recebidoEm: new Date(Number(mensagem.timestamp) * 1000 || Date.now()).toISOString(),
  };
}

export function interpretarPayload(payload: PayloadMeta): MensagemInterpretada[] {
  return (payload?.entry ?? [])
    .flatMap((entrada) => entrada?.changes ?? [])
    .flatMap((mudanca) => mudanca?.value?.messages ?? [])
    .map(interpretarMensagem)
    .filter((mensagem): mensagem is MensagemInterpretada => mensagem !== null);
}

export async function assinaturaValida(corpoBruto: string, cabecalho: string | null, segredoApp: string) {
  const hex = cabecalho?.match(/^sha256=([0-9a-f]{64})$/i)?.[1];
  if (!hex) return false;

  const assinatura = Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16));
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredoApp),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", chave, assinatura, new TextEncoder().encode(corpoBruto));
}

async function obterMidiaMeta(idMidia: string, tokenAcesso: string): Promise<Midia> {
  const headers = { authorization: `Bearer ${tokenAcesso}` };

  const info = await fetch(`${GRAPH_API}/${encodeURIComponent(idMidia)}`, { headers });
  if (!info.ok) throw new Error(`Graph API ${info.status} ao buscar a mídia`);
  const { url, mime_type } = (await info.json()) as { url: string; mime_type: string };

  const arquivo = await fetch(url, { headers });
  if (!arquivo.ok) throw new Error(`Graph API ${arquivo.status} ao baixar a mídia`);
  return { bytes: await arquivo.arrayBuffer(), tipoConteudo: mime_type };
}

async function obterMidiaMock(idMidia: string): Promise<Midia> {
  if (!idMidia.startsWith("uploads/")) throw new Error("id de mídia mock fora de uploads/");

  const objeto = await (await getBucket()).get(idMidia);
  if (!objeto) throw new Error(`Mídia ${idMidia} não encontrada no R2`);
  return {
    bytes: await objeto.arrayBuffer(),
    tipoConteudo: objeto.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

export async function obterMidia(idMidia: string): Promise<Midia> {
  const { env } = await getCloudflareContext({ async: true });
  return env.WHATSAPP_MODE === "mock" ? obterMidiaMock(idMidia) : obterMidiaMeta(idMidia, env.WHATSAPP_ACCESS_TOKEN);
}
