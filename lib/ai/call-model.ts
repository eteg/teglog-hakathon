// The only path to the model (quality criterion 8.5): every call is timed,
// its tokens and cost recorded in model_calls, whatever the outcome.
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { z } from "zod";

import { modelCalls } from "@/db/schema";
import { getDb } from "@/lib/db";

import { costUsd } from "./pricing";

export type ModelCallInput<S extends z.ZodType> = {
  reportId: string | null;
  node: string;
  attempt: number;
  model: string;
  schema: S;
  system: string;
  content: Anthropic.ContentBlockParam[];
};

export type ModelCallOutput = {
  /** Raw JSON text returned by the model; validated by the caller (validate_schema). */
  rawText: string | null;
  error: string | null;
  callId: number | null;
};

async function client() {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = (env as unknown as Record<string, string | undefined>).ANTHROPIC_API_KEY;
  return new Anthropic({ apiKey });
}

export async function callModel<S extends z.ZodType>(input: ModelCallInput<S>): Promise<ModelCallOutput> {
  const started = Date.now();
  let rawText: string | null = null;
  let error: string | null = null;
  let usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 as number | null };

  try {
    const anthropic = await client();
    const response = await anthropic.messages.create({
      model: input.model,
      max_tokens: 16000,
      // The system prompt and the schema never change, so they are cached across reports.
      system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: input.content }],
      output_config: { format: zodOutputFormat(input.schema) },
    });
    usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    };
    if (response.stop_reason === "refusal") {
      error = `refusal: ${response.stop_details?.category ?? "unknown"}`;
    } else if (response.stop_reason === "max_tokens") {
      error = "max_tokens reached";
    } else {
      const text = response.content.find((b) => b.type === "text");
      rawText = text?.type === "text" ? text.text : null;
      if (rawText === null) error = "no text block in response";
    }
  } catch (e) {
    error = e instanceof Anthropic.APIError ? `api ${e.status}: ${e.message}` : String(e);
  }

  const db = await getDb();
  const [row] = await db
    .insert(modelCalls)
    .values({
      reportId: input.reportId,
      node: input.node,
      model: input.model,
      attempt: input.attempt,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      costUsd: costUsd(input.model, usage),
      latencyMs: Date.now() - started,
      error,
    })
    .returning({ id: modelCalls.id });

  return { rawText, error, callId: row?.id ?? null };
}

/** validate_schema records whether the answer of a given call passed the schema. */
export async function markSchemaResult(callId: number | null, valid: boolean) {
  if (callId === null) return;
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  await db.update(modelCalls).set({ schemaValid: valid }).where(eq(modelCalls.id, callId));
}
