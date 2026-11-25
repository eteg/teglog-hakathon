import type { z } from "zod";

export function parseQuery<S extends z.ZodType>(schema: S, request: Request): { ok: true; data: z.infer<S> } | { ok: false; response: Response } {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, response: Response.json({ error: "parâmetros inválidos", details: parsed.error.issues }, { status: 400 }) };
}

export const noStore = { headers: { "cache-control": "no-store" } };
