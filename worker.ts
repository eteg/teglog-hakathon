// `.open-next/worker.js` é gerado pelo `opennextjs-cloudflare build` e não existe no typecheck
// do CI (que roda antes do build). @ts-ignore (e não @ts-expect-error) porque depois do build o
// arquivo existe e o import passa a ser válido. Padrão da doc do OpenNext para worker customizado.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(_event, environment, context) {
    const request = new Request(`${environment.APP_URL}/api/internal/queue/tick`, {
      method: "POST",
      headers: { "x-internal-secret": environment.INTERNAL_SECRET },
    });
    context.waitUntil(handler.fetch(request, environment, context));
  },
} satisfies ExportedHandler<CloudflareEnv>;
