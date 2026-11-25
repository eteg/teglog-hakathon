import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { mensagensWhatsapp, tarefasAnalise, type MensagemWhatsapp } from "@/db/schema";
import { enviarParaAnalise, type TipoAnalise } from "@/lib/analise";
import { getDb } from "@/lib/db";
import { criarTarefa, guardarMidia } from "@/lib/ingestao";
import { pseudonimoTelefone, semPII } from "@/lib/pii";

const BASE_RETENTATIVA_SEGUNDOS = 30;

type TarefaReservada = {
  id: number;
  mensagem_id: number;
  endpoint: TipoAnalise;
  tentativas: number;
  max_tentativas: number;
};

export async function segundosDeCooldown() {
  const { env } = await getCloudflareContext({ async: true });
  return Number(env.COOLDOWN_SECONDS) || 10;
}

async function reservarTarefas(cooldownSegundos: number) {
  const db = await getDb();
  return db.all<TarefaReservada>(sql`
    UPDATE tarefas_analise
    SET status = 'enviando', travado_em = CURRENT_TIMESTAMP,
        tentativas = tentativas + 1, atualizado_em = CURRENT_TIMESTAMP
    WHERE id IN (
      SELECT tarefa.id
      FROM tarefas_analise AS tarefa
      JOIN mensagens_whatsapp AS mensagem ON mensagem.id = tarefa.mensagem_id
      WHERE tarefa.status = 'pendente'
        AND tarefa.proxima_tentativa_em <= CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM mensagens_whatsapp AS mais_nova
          WHERE mais_nova.telefone = mensagem.telefone
            AND mais_nova.criado_em > datetime('now', ${`-${cooldownSegundos} seconds`})
        )
      ORDER BY tarefa.id
      LIMIT 20
    )
    RETURNING id, mensagem_id, endpoint, tentativas, max_tentativas`);
}

async function enviarTarefa(tarefa: TarefaReservada, mensagem: MensagemWhatsapp) {
  // Critério 6: nada de dado pessoal sai para a IA nem fica no registro da chamada (payloadEnvio).
  // O texto vai com CPF/telefone/placa/e-mail trocados por marcadores; o telefone do remetente
  // vira um pseudônimo estável. O original continua só em mensagens_whatsapp, como prova.
  const payload = {
    job_id: tarefa.id,
    message_id: mensagem.id,
    from_phone: await pseudonimoTelefone(mensagem.telefone),
    type: mensagem.tipo,
    text: semPII(mensagem.texto),
    storage_key: mensagem.chaveArmazenamento,
    content_type: mensagem.tipoConteudo,
    latitude: mensagem.latitude,
    longitude: mensagem.longitude,
  };

  const inicio = Date.now();
  let status: number | null = null;
  let erro: string | null = null;
  try {
    ({ status } = await enviarParaAnalise(tarefa.endpoint, payload));
    if (status < 200 || status >= 300) erro = `HTTP ${status}`;
  } catch (causa) {
    erro = String(causa);
  }

  const comum = {
    payloadEnvio: JSON.stringify(payload),
    statusResposta: status,
    ultimoErro: erro,
    travadoEm: null,
    atualizadoEm: sql`CURRENT_TIMESTAMP`,
  };
  const db = await getDb();
  const atualizar = (valores: SQLiteUpdateSetSource<typeof tarefasAnalise>) =>
    db
      .update(tarefasAnalise)
      .set({ ...comum, ...valores })
      .where(eq(tarefasAnalise.id, tarefa.id));

  if (!erro) {
    await atualizar({ status: "concluida", concluidoEm: sql`CURRENT_TIMESTAMP` });
    console.log("[tarefa] enviada", { tarefaId: tarefa.id, tipo: mensagem.tipo, status, ms: Date.now() - inicio });
    return;
  }

  const erroDoCliente = status !== null && status >= 400 && status < 500;
  if (erroDoCliente || tarefa.tentativas >= tarefa.max_tentativas) {
    await atualizar({ status: "falhou" });
    console.log("[tarefa] falhou", { tarefaId: tarefa.id, tentativa: tarefa.tentativas, erro });
    return;
  }

  const esperaSegundos = BASE_RETENTATIVA_SEGUNDOS * 2 ** tarefa.tentativas;
  await atualizar({ status: "pendente", proximaTentativaEm: sql`datetime('now', ${`+${esperaSegundos} seconds`})` });
  console.log("[tarefa] erro, nova tentativa", { tarefaId: tarefa.id, tentativa: tarefa.tentativas, erro });
}

async function enviarTarefas(tarefas: TarefaReservada[]) {
  if (tarefas.length === 0) return;

  const db = await getDb();
  const mensagens = await db
    .select()
    .from(mensagensWhatsapp)
    .where(inArray(mensagensWhatsapp.id, tarefas.map((tarefa) => tarefa.mensagem_id)));
  const mensagemPorId = new Map(mensagens.map((mensagem) => [mensagem.id, mensagem]));

  await Promise.all(tarefas.map((tarefa) => enviarTarefa(tarefa, mensagemPorId.get(tarefa.mensagem_id)!)));
}

async function varrer() {
  const db = await getDb();

  const liberadas = await db.all<{ id: number }>(sql`
    UPDATE tarefas_analise
    SET status = 'pendente', travado_em = NULL, atualizado_em = CURRENT_TIMESTAMP
    WHERE status = 'enviando' AND travado_em < datetime('now', '-2 minutes')
    RETURNING id`);

  const mensagensPendentes = await db
    .select()
    .from(mensagensWhatsapp)
    .where(
      and(
        eq(mensagensWhatsapp.statusMidia, "pendente"),
        sql`${mensagensWhatsapp.criadoEm} < datetime('now', '-2 minutes')`,
      ),
    );

  for (const mensagem of mensagensPendentes) {
    try {
      await guardarMidia(mensagem);
      await criarTarefa(mensagem);
    } catch (erro) {
      await db
        .update(mensagensWhatsapp)
        .set({ statusMidia: "falhou", atualizadoEm: sql`CURRENT_TIMESTAMP` })
        .where(eq(mensagensWhatsapp.id, mensagem.id));
      console.log("[midia] falhou", { mensagemId: mensagem.id, erro: String(erro) });
    }
  }

  return liberadas.length;
}

export async function processarFila(origem: string) {
  const liberadas = await varrer();
  const tarefas = await reservarTarefas(await segundosDeCooldown());
  console.log("[fila] rodou", { origem, liberadas, pegas: tarefas.length });
  await enviarTarefas(tarefas);
}
