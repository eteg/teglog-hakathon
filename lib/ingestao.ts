import "server-only";
import { eq, sql } from "drizzle-orm";
import { mensagensWhatsapp, tarefasAnalise, type MensagemWhatsapp } from "@/db/schema";
import { tiposAnalise } from "@/lib/analise";
import { getDb } from "@/lib/db";
import { getBucket, newObjectKey } from "@/lib/storage";
import { semPII, telefoneParaLog } from "@/lib/pii";
import { obterMidia, type MensagemInterpretada } from "@/lib/whatsapp";

export async function guardarMidia(mensagem: MensagemWhatsapp) {
  const { bytes, tipoConteudo } = await obterMidia(mensagem.idMidia!);

  const agora = new Date();
  const prefixo = `whatsapp/${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, "0")}`;
  const chaveArmazenamento = newObjectKey(`midia.${tipoConteudo.match(/\/(\w+)/)?.[1] ?? "bin"}`, prefixo);

  const bucket = await getBucket();
  await bucket.put(chaveArmazenamento, bytes, {
    httpMetadata: { contentType: tipoConteudo },
    customMetadata: { idMensagemWhatsapp: mensagem.idMensagemWhatsapp, telefone: mensagem.telefone },
  });

  const db = await getDb();
  await db
    .update(mensagensWhatsapp)
    .set({ chaveArmazenamento, tipoConteudo, statusMidia: "salva", atualizadoEm: sql`CURRENT_TIMESTAMP` })
    .where(eq(mensagensWhatsapp.id, mensagem.id));

  console.log("[midia] salva", { mensagemId: mensagem.id, chaveArmazenamento, tipoConteudo, bytes: bytes.byteLength });
}

export async function criarTarefa({ id: mensagemId, tipo }: Pick<MensagemWhatsapp, "id" | "tipo">) {
  const endpoint = tiposAnalise.find((tipoAnalise) => tipoAnalise === tipo);
  if (!endpoint) return;

  const db = await getDb();
  const [tarefa] = await db
    .insert(tarefasAnalise)
    .values({ mensagemId, endpoint })
    .onConflictDoNothing()
    .returning({ id: tarefasAnalise.id });
  if (tarefa) console.log("[tarefa] criada", { tarefaId: tarefa.id, mensagemId, tipo });
}

export async function ingerirMensagens(mensagens: MensagemInterpretada[]) {
  const db = await getDb();

  for (const mensagem of mensagens) {
    const [salva] = await db
      .insert(mensagensWhatsapp)
      .values({ ...mensagem, statusMidia: mensagem.idMidia ? "pendente" : "nenhuma" })
      .onConflictDoNothing()
      .returning();

    if (!salva) {
      console.log("[ingestao] duplicada, ignorada", mensagem.idMensagemWhatsapp);
      continue;
    }

    const { id: mensagemId, telefone, tipo, texto } = salva;
    console.log("[ingestao] salva", { mensagemId, telefone: telefoneParaLog(telefone), tipo, texto: semPII(texto) });

    if (salva.idMidia) {
      try {
        await guardarMidia(salva);
      } catch (erro) {
        console.log("[midia] erro", { mensagemId, erro: String(erro) });
        continue;
      }
    }

    if (tipo === "location") {
      const { latitude, longitude } = salva;
      console.log("[localizacao] salva", { mensagemId, telefone: telefoneParaLog(telefone), latitude, longitude });
    }
    await criarTarefa(salva);
  }
}
