import { after } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ingestMessages } from "@/lib/ingest";
import { getCooldownSeconds, tick } from "@/lib/queue/dispatch";
import { parseWhatsappPayload } from "@/lib/whatsapp/parse";
import { isValidSignature } from "@/lib/whatsapp/signature";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const params = new URL(request.url).searchParams;

  if (params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== env.WHATSAPP_VERIFY_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(params.get("hub.challenge"));
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const rawBody = await request.text();

  if (env.WHATSAPP_MODE !== "mock") {
    const signature = request.headers.get("x-hub-signature-256");
    if (!(await isValidSignature(rawBody, signature, env.WHATSAPP_APP_SECRET))) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages = parseWhatsappPayload(payload);
  console.log("[webhook] recebido", {
    mensagens: messages.length,
    telefones: [...new Set(messages.map((message) => message.fromPhone))],
  });

  await ingestMessages(messages);

  const cooldownSeconds = await getCooldownSeconds();
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, cooldownSeconds * 1000));
    await tick("webhook");
  });
  return Response.json({ status: "ok" });
}
