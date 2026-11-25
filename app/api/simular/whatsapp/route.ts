// Só para demo: simula uma mensagem do WhatsApp (texto, foto ou áudio) e a leva pelo fluxo real:
// ingestão → fila → IA (mock) → caso na tela. O último dígito do telefone escolhe qual dos 10 mocks de cada canal.
import { count, desc, like } from "drizzle-orm";
import { mensagensWhatsapp } from "@/db/schema";
import { getDb } from "@/lib/db";
import { FOTO_DEMO_AVARIA_JPEG_BASE64 } from "@/lib/demo-midia";
import { processarFila } from "@/lib/fila";
import { ingerirMensagens } from "@/lib/ingestao";
import { CATALOGO_MOCK_IA } from "@/lib/mock-ia-catalogo";
import { getBucket } from "@/lib/storage";
import { listar } from "@/lib/store";
import { interpretarPayload } from "@/lib/whatsapp";

const CANAIS = ["text", "image", "audio"] as const;
const PREFIXO_TELEFONE = "5519999990";

async function guardarMidiaDemo(canal: "image" | "audio") {
  const id = canal === "image" ? "uploads/demo-foto.jpg" : "uploads/demo-audio.ogg";
  const mime_type = canal === "image" ? "image/jpeg" : "audio/ogg";
  const bytes =
    canal === "image"
      ? Uint8Array.from(atob(FOTO_DEMO_AVARIA_JPEG_BASE64), (c) => c.charCodeAt(0))
      : new TextEncoder().encode("OggS");
  await (await getBucket()).put(id, bytes, { httpMetadata: { contentType: mime_type } });
  return { id, mime_type };
}

async function sortearTelefone() {
  const db = await getDb();
  const filtro = like(mensagensWhatsapp.telefone, `${PREFIXO_TELEFONE}__`);
  const usos = await db
    .select({ telefone: mensagensWhatsapp.telefone, total: count() })
    .from(mensagensWhatsapp)
    .where(filtro)
    .groupBy(mensagensWhatsapp.telefone);
  const [ultima] = await db
    .select({ telefone: mensagensWhatsapp.telefone })
    .from(mensagensWhatsapp)
    .where(filtro)
    .orderBy(desc(mensagensWhatsapp.id))
    .limit(1);

  const totalPorTelefone = new Map(usos.map((uso) => [uso.telefone, uso.total]));
  const todos = CANAIS.flatMap((_, canal) =>
    Array.from({ length: CATALOGO_MOCK_IA.text.length }, (_, mock) => `${PREFIXO_TELEFONE}${canal}${mock}`),
  );
  const menorUso = Math.min(...todos.map((telefone) => totalPorTelefone.get(telefone) ?? 0));
  const candidatos = todos.filter(
    (telefone) => (totalPorTelefone.get(telefone) ?? 0) === menorUso && telefone !== ultima?.telefone,
  );
  return candidatos[Math.floor(Math.random() * candidatos.length)];
}

export async function POST() {
  await listar();

  const telefone = await sortearTelefone();
  const canal = CANAIS[Number(telefone[PREFIXO_TELEFONE.length])];
  const ocorrencia = CATALOGO_MOCK_IA[canal][Number(telefone.slice(-1))];

  const base = {
    from: telefone,
    id: `wamid.simulado-${crypto.randomUUID()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const mensagem =
    canal === "text"
      ? { ...base, type: "text", text: { body: ocorrencia.transcricao } }
      : canal === "image"
        ? { ...base, type: "image", image: { ...(await guardarMidiaDemo("image")), caption: ocorrencia.resumo } }
        : { ...base, type: "audio", audio: await guardarMidiaDemo("audio") };

  await ingerirMensagens(interpretarPayload({ entry: [{ changes: [{ value: { messages: [mensagem] } }] }] }));
  await processarFila("simular", 0);
  return Response.json({ status: "ok", canal, mock: Number(telefone.slice(-1)) + 1 }, { status: 201 });
}
