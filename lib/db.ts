import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * Retorna um client Drizzle ligado ao D1 (binding DB).
 * Use apenas em Server Components, Route Handlers e Server Actions.
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

/** Acesso direto ao D1 (SQL cru), usado onde a consulta precisa ser exibida ao usuário. */
export async function getD1() {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}
