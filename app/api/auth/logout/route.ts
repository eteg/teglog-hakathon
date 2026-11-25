// POST → apaga o cookie da sessão.
import { cookieSaida } from "@/lib/sessao";

export async function POST(req: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": cookieSaida(req) } });
}
