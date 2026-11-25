import type { NewWhatsappMessage } from "@/db/schema";

export type ParsedMessage = Omit<NewWhatsappMessage, "id" | "mediaStatus" | "storageKey">;

type MetaMedia = { id?: string; mime_type?: string; caption?: string };
type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  image?: MetaMedia;
  audio?: MetaMedia;
  location?: { latitude?: number; longitude?: number };
};
type MetaPayload = { entry?: { changes?: { value?: { messages?: MetaMessage[] } }[] }[] };

function parseMessage(message: MetaMessage): ParsedMessage | null {
  if (typeof message?.id !== "string" || typeof message.from !== "string") return null;

  const type = (["text", "image", "audio", "location"] as const).find((known) => known === message.type) ?? "other";
  const media = type === "image" || type === "audio" ? message[type] : undefined;

  return {
    whatsappMessageId: message.id,
    fromPhone: message.from,
    type,
    textBody: message.text?.body ?? media?.caption ?? null,
    mediaId: media?.id ?? null,
    contentType: media?.mime_type ?? null,
    latitude: message.location?.latitude ?? null,
    longitude: message.location?.longitude ?? null,
    rawPayload: JSON.stringify(message),
    receivedAt: new Date(Number(message.timestamp) * 1000 || Date.now()).toISOString(),
  };
}

export function parseWhatsappPayload(payload: MetaPayload): ParsedMessage[] {
  return (payload?.entry ?? [])
    .flatMap((entry) => entry?.changes ?? [])
    .flatMap((change) => change?.value?.messages ?? [])
    .map(parseMessage)
    .filter((message): message is ParsedMessage => message !== null);
}
