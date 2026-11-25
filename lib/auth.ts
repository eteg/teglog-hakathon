// Minimum access (quality criterion 8.4). D1 has no read-only users, so the split is done
// in the API: agents (MCP server, manager questions) only get the READ_API_TOKEN, which opens
// /api/read/* and nothing else. Without the secret configured, every call is refused.
import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Scope = "read";

const SECRET: Record<Scope, string> = { read: "READ_API_TOKEN" };

/** Constant-time comparison, so the token cannot be guessed byte by byte from response times. */
function sameToken(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/** Returns a 401/403 response when the request does not carry the token of the scope; null when it does. */
export async function requireScope(request: Request, scope: Scope): Promise<Response | null> {
  const { env } = await getCloudflareContext({ async: true });
  const expected = (env as unknown as Record<string, string | undefined>)[SECRET[scope]];
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected) return Response.json({ error: "acesso de leitura não configurado" }, { status: 403 });
  if (!given || !sameToken(given, expected)) return Response.json({ error: "não autorizado" }, { status: 401 });
  return null;
}
