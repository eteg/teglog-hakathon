import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // Só CSS do projeto: sem isso o loader também processa o CSS interno do
        // next/font e quebra a URL da fonte (@vercel/turbopack-next/internal/font).
        condition: { not: "foreign" },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Expõe os bindings do wrangler.jsonc (ex.: D1 local) no `next dev`
// via getCloudflareContext(). Bindings remotos (`"remote": true`) exigem
// CLOUDFLARE_API_TOKEN; sem ele, D1 e R2 ficam emulados localmente.
initOpenNextCloudflareForDev({ remoteBindings: Boolean(process.env.CLOUDFLARE_API_TOKEN) });
