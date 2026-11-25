// MCP server (B13): lets the manager ask questions about the base from Claude Desktop / Claude Code.
// Read-only by construction: it has no database access, only the read token, and every tool
// is a GET on /api/read/*.
//
// Usage: RECUPERA_API_URL=https://... RECUPERA_READ_TOKEN=... npm run mcp
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TOOLS } from "./tools";

const baseUrl = process.env.RECUPERA_API_URL ?? "http://localhost:3000";
const token = process.env.RECUPERA_READ_TOKEN ?? "";

const server = new McpServer({ name: "recupera", version: "0.1.0" });

for (const tool of TOOLS) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      const response = await fetch(new URL(tool.path(args), baseUrl), {
        method: tool.method,
        headers: { authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      return { content: [{ type: "text" as const, text: response.ok ? text : `Erro ${response.status}: ${text}` }], isError: !response.ok };
    },
  );
}

// The project is not an ES module, so no top-level await.
server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
