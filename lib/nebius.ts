import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import type { Usage } from "./pipeline.ts";

// Model calls to NVIDIA Nemotron on Nebius Token Factory.

const BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
const CALL_TIMEOUT_MS = 45_000;
// After invalid JSON we send the problems back and ask again, at most this many times.
const MAX_FIX_ATTEMPTS = 2;

// USD per 1M tokens, from docs/model-check.md (Oct 13, 2026).
const PRICES: Record<string, { input: number; output: number }> = {
  "nvidia/Nemotron-3-Ultra-550b-a55b": { input: 1, output: 3 },
  "nvidia/nemotron-3-super-120b-a12b": { input: 0.3, output: 0.9 },
  "nvidia/Nemotron-3_5-Lightning": { input: 0.06, output: 0.24 },
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": { input: 0.06, output: 0.24 },
};

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.NEBIUS_API_KEY;
    if (!apiKey) throw new Error("NEBIUS_API_KEY is not set.");
    client = new OpenAI({ baseURL: BASE_URL, apiKey, timeout: CALL_TIMEOUT_MS, maxRetries: 0 });
  }
  return client;
}

function getModel(): string {
  const model = process.env.NEBIUS_MODEL;
  if (!model) throw new Error("NEBIUS_MODEL is not set.");
  return model;
}

export function emptyUsage(): Usage {
  return { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    calls: a.calls + b.calls,
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs one request. On a 429 it waits for Retry-After and tries once more.
async function withRateLimitRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof OpenAI.RateLimitError)) throw error;
    const waitSec = Math.min(Number(error.headers.get("retry-after")) || 5, 20);
    console.warn(`[nebius] Rate limited. Waiting ${waitSec} s, then one retry.`);
    await wait(waitSec * 1000);
    return await request();
  }
}

// One model call. Logs tokens, latency and cost.
async function callModel(
  step: string,
  params: Omit<ChatCompletionCreateParamsNonStreaming, "model">,
): Promise<{ content: string; usage: Usage }> {
  const model = getModel();
  // NVIDIA recommends temperature 1 and top_p 0.95 for Nemotron 3 in every mode.
  const body: ChatCompletionCreateParamsNonStreaming = { temperature: 1, top_p: 0.95, ...params, model };
  // Thinking off: 2 to 10 times faster, and it did not improve results in docs/model-check.md.
  Object.assign(body, { chat_template_kwargs: { enable_thinking: false } });

  const started = performance.now();
  const completion = await withRateLimitRetry(() =>
    getClient().chat.completions.create(body, { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) }),
  );
  const ms = Math.round(performance.now() - started);

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const price = PRICES[model];
  const costUsd = price ? (promptTokens * price.input + completionTokens * price.output) / 1e6 : 0;
  console.log(`[${step}] ${ms} ms, ${promptTokens} in / ${completionTokens} out, $${costUsd.toFixed(4)}`);

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") throw new Error(`${step}: the answer was cut off at max_tokens.`);
  return { content: choice?.message.content ?? "", usage: { calls: 1, promptTokens, completionTokens, costUsd } };
}

// `data` is null when the reply is not valid JSON or breaks the schema. `problems` lists what is wrong.
type ParseResult<T> = { data: T | null; problems: string[] };

function parseJson<T>(content: string, schema: z.ZodType<T>, check?: (data: T) => string[]): ParseResult<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return { data: null, problems: ["The reply is not valid JSON."] };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`);
    return { data: null, problems };
  }
  return { data: parsed.data, problems: check ? check(parsed.data).slice(0, 10) : [] };
}

// The prompt gets the JSON Schema too. Token Factory's docs say that works better than the schema alone.
function withSchema(messages: ChatCompletionMessageParam[], jsonSchema: object): ChatCompletionMessageParam[] {
  const schemaText = `Reply with JSON only. It must match this JSON Schema: ${JSON.stringify(jsonSchema)}`;
  const [first, ...rest] = messages;
  if (first?.role === "system" && typeof first.content === "string") {
    return [{ role: "system", content: `${first.content}\n\n${schemaText}` }, ...rest];
  }
  return [{ role: "system", content: schemaText }, ...messages];
}

type JsonRequest<T> = {
  step: string; // shown in the logs, like "research/plan"
  schemaName: string;
  schema: z.ZodType<T>;
  messages: ChatCompletionMessageParam[];
  maxTokens: number;
  check?: (data: T) => string[]; // rules zod cannot check, one line per problem
  // Called with the last answer if it still breaks a rule after every retry. Returns a fixed version to use.
  // Without it, the call fails.
  repair?: (data: T) => T;
};

// Asks the model for JSON that matches the schema, using strict json_schema output.
// If the JSON breaks the schema or a rule, the problems go back to the model and it tries again.
export async function chatJson<T>(request: JsonRequest<T>): Promise<{ data: T; usage: Usage }> {
  const jsonSchema = z.toJSONSchema(request.schema);
  const baseMessages = withSchema(request.messages, jsonSchema);
  let messages = baseMessages;
  let usage = emptyUsage();
  let problems: string[] = [];

  for (let attempt = 0; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    const reply = await callModel(request.step, {
      messages,
      max_tokens: request.maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: request.schemaName, schema: jsonSchema, strict: true },
      },
    });
    usage = addUsage(usage, reply.usage);
    const result = parseJson(reply.content, request.schema, request.check);
    if (result.data && result.problems.length === 0) return { data: result.data, usage };

    problems = result.problems;
    console.warn(`[${request.step}] Invalid JSON on try ${attempt + 1}: ${problems.join("; ")}`);
    if (attempt === MAX_FIX_ATTEMPTS && result.data && request.repair) {
      console.warn(`[${request.step}] Repairing the last answer instead of failing.`);
      return { data: request.repair(result.data), usage };
    }
    messages = [
      ...baseMessages,
      { role: "assistant", content: reply.content },
      {
        role: "user",
        content: `That JSON has problems:\n${problems.map((problem) => `- ${problem}`).join("\n")}\nReply with the full, corrected JSON.`,
      },
    ];
  }
  throw new Error(`${request.step}: no valid JSON after ${MAX_FIX_ATTEMPTS + 1} tries (${problems.join("; ")})`);
}
