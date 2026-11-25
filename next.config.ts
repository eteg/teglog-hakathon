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
