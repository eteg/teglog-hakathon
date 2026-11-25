// POST { usuario, senha } → cookie com o JWT (8 h).
import { assinarJWT } from "@/lib/jwt";
import { ambienteAuth, cookieSessao, iguais, VALIDADE_SEGUNDOS } from "@/lib/sessao";

export async function POST(req: Request) {
  const { JWT_SECRET, AUTH_USUARIO, AUTH_SENHA } = await ambienteAuth();

  const { usuario, senha } = (await req.json().catch(() => ({}))) as { usuario?: string; senha?: string };
  // Compara os dois sempre (sem curto-circuito) para não revelar qual campo errou.
  const usuarioOk = iguais(usuario?.trim() ?? "", AUTH_USUARIO);
  const senhaOk = iguais(senha ?? "", AUTH_SENHA);
  if (!usuarioOk || !senhaOk) return Response.json({ erro: "Usuário ou senha inválidos." }, { status: 401 });

  const token = await assinarJWT({ sub: AUTH_USUARIO, papel: "analista" }, JWT_SECRET, VALIDADE_SEGUNDOS);
  return Response.json({ usuario: AUTH_USUARIO }, { headers: { "set-cookie": cookieSessao(token, req) } });
}
