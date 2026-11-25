import "server-only";
import { count, eq } from "drizzle-orm";
import { rotas } from "@/db/schema";
import { getDb } from "@/lib/db";
import { localNaEstrada } from "@/lib/localizacao";
import { RODOVIAS } from "@/lib/rodovias";
import type { Local } from "@/lib/types";

const ROTA_PADRAO = "Campinas → São Paulo";

async function semearRotasQueFaltam() {
  const db = await getDb();
  const [{ total }] = await db.select({ total: count() }).from(rotas);
  if (total >= Object.keys(RODOVIAS).length * 2) return;

  const linhas = Object.entries(RODOVIAS).flatMap(([par, tracado]) => {
    const [origem, destino] = par.split("|");
    return [
      { nome: `${origem} → ${destino}`, origem, destino, tracado },
      { nome: `${destino} → ${origem}`, origem: destino, destino: origem, tracado: [...tracado].reverse() },
    ];
  });
  for (const linha of linhas) await db.insert(rotas).values(linha).onConflictDoNothing();
}

export async function obterRota(nome: string | undefined) {
  await semearRotasQueFaltam();
  const db = await getDb();
  const [rota] = await db
    .select()
    .from(rotas)
    .where(eq(rotas.nome, nome ?? ""));
  return rota;
}

/** Todos os traçados de uma vez, para calcular muitos pontos sem uma consulta por caso. */
export async function carregarTracados() {
  await semearRotasQueFaltam();
  const db = await getDb();
  const linhas = await db.select({ nome: rotas.nome, tracado: rotas.tracado }).from(rotas);
  const tracados = new Map(linhas.map((linha) => [linha.nome, linha.tracado]));
  return (nome: string | undefined, semente?: string): Local =>
    localNaEstrada(tracados.get(nome ?? "") ?? tracados.get(ROTA_PADRAO)!, semente);
}

/** Ponto sobre a rodovia da rota cadastrada; rota sem cadastro cai na rota padrão. */
export async function localNaRota(nome: string | undefined, semente?: string): Promise<Local> {
  const rota = (await obterRota(nome)) ?? (await obterRota(ROTA_PADRAO));
  return localNaEstrada(rota.tracado, semente);
}
