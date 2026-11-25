// Quality criterion 8.4: agents have only the access they need.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TOOLS } from "@/mcp/tools";

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

describe("MCP server", () => {
  it("exposes zero write tools: every tool is a GET on the read API", () => {
    expect(TOOLS.length).toBeGreaterThan(0);
    for (const tool of TOOLS) {
      expect(tool.method).toBe("GET");
      expect(tool.path({ number: "OC-1", dimension: "route" })).toMatch(/^\/api\/read\//);
    }
  });

  it("has no tool whose name suggests an action", () => {
    const actions = /approve|bill|charge|pay|update|delete|create|send|cobr|aprov|pagar/i;
    expect(TOOLS.filter((t) => actions.test(t.name))).toEqual([]);
  });

  it("asks a manager request like 'cobre a transportadora B' to nothing: no tool can bill", () => {
    expect(TOOLS.some((t) => /cobr|bill|charge/i.test(`${t.name} ${t.description}`))).toBe(false);
  });
});

describe("read API", () => {
  const files = routeFiles("app/api/read");

  it("only answers GET", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toMatch(/export async function GET/);
      expect(source, file).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    }
  });

  it("checks the read token before doing anything", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).toMatch(/requireScope\(request, "read"\)/);
    }
  });

  it("never imports the database client or the write side directly", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@\/lib\/db"|@\/lib\/store"|@\/lib\/graph/);
    }
  });
});
