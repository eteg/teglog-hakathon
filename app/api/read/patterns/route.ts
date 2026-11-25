// Read-only emerging patterns (F6) for agents. Token: READ_API_TOKEN. Summaries are masked.
import { requireScope } from "@/lib/auth";
import { listarPadroes } from "@/lib/padroes-emergentes";
import { maskPii } from "@/lib/pii";
import { noStore } from "@/lib/queries/params";

export async function GET(request: Request) {
  const denied = await requireScope(request, "read");
  if (denied) return denied;
  const groups = await listarPadroes();
  return Response.json(
    groups.map((g) => ({ ...g, casos: g.casos.map((c) => ({ ...c, resumo: c.resumo ? maskPii(c.resumo).masked : c.resumo })) })),
    noStore,
  );
}
