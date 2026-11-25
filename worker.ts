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
