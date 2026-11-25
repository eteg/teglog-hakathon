import "server-only";
import { eq } from "drizzle-orm";
import { rotas } from "@/db/schema";
import { getDb } from "@/lib/db";
import { localNaEstrada } from "@/lib/localizacao";
import { RODOVIAS } from "@/lib/rodovias";
import type { Local } from "@/lib/types";

const ROTA_PADRAO = "Campinas → São Paulo";

async function semearRotasQueFaltam() {
  const db = await getDb();
  const existentes = new Set((await db.select({ nome: rotas.nome }).from(rotas)).map((rota) => rota.nome));
  const linhas = Object.entries(RODOVIAS).flatMap(([par, tracado]) => {
    const [origem, destino] = par.split("|");
    return [
      { nome: `${origem} → ${destino}`, origem, destino, tracado },
      { nome: `${destino} → ${origem}`, origem: destino, destino: origem, tracado: [...tracado].reverse() },
    ];
  });
  for (const linha of linhas.filter((linha) => !existentes.has(linha.nome))) {
    await db.insert(rotas).values(linha).onConflictDoNothing();
  }
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

export async function carregarTracados() {
  await semearRotasQueFaltam();
  const db = await getDb();
  const linhas = await db.select({ nome: rotas.nome, tracado: rotas.tracado }).from(rotas);
  const tracados = new Map(linhas.map((linha) => [linha.nome, linha.tracado]));
  return (nome: string | undefined, semente?: string): Local =>
    localNaEstrada(tracados.get(nome ?? "") ?? tracados.get(ROTA_PADRAO)!, semente);
}

export async function localNaRota(nome: string | undefined, semente?: string): Promise<Local> {
  const rota = (await obterRota(nome)) ?? (await obterRota(ROTA_PADRAO));
  return localNaEstrada(rota.tracado, semente);
}
