import { after } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ingerirMensagens } from "@/lib/ingestao";
import { processarFila, segundosDeCooldown } from "@/lib/fila";
import { assinaturaValida, interpretarPayload } from "@/lib/whatsapp";

export async function GET(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const params = new URL(req.url).searchParams;

  if (params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== env.WHATSAPP_VERIFY_TOKEN) {
    return Response.json({ erro: "não autorizado" }, { status: 403 });
  }
  return new Response(params.get("hub.challenge"));
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const corpoBruto = await req.text();

  if (env.WHATSAPP_MODE !== "mock") {
    const assinatura = req.headers.get("x-hub-signature-256");
    if (!(await assinaturaValida(corpoBruto, assinatura, env.WHATSAPP_APP_SECRET))) {
      return Response.json({ erro: "assinatura inválida" }, { status: 401 });
    }
  }

  let corpo;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return Response.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const mensagens = interpretarPayload(corpo);
  console.log("[webhook] recebido", {
    mensagens: mensagens.length,
    telefones: [...new Set(mensagens.map((mensagem) => mensagem.telefone))],
  });

  await ingerirMensagens(mensagens);

  const cooldownSegundos = await segundosDeCooldown();
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, cooldownSegundos * 1000));
    await processarFila("webhook");
  });
  return Response.json({ status: "ok" });
}
