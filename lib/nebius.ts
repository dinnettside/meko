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
// No retry of any kind starts after this, counted from the start of a call: no fix attempt, no second try after an
// error and no wait after a 429. The last request may still run its full timeout, so a call ends within about
// 60 + 45 s. A step that makes several calls in a row passes a deadline as well.
const RETRY_WINDOW_MS = 60_000;
// A request with less time than this left before the deadline would only be cut off, so it does not start.
const MIN_REQUEST_MS = 2_000;
// No call sends a longer prompt, counted in characters. The longest real prompt is about 20,000 (a fact-check of a
// 90-second video, measured on 109 saved runs), so only a request built to repeat huge facts gets near it. One prompt
// just under it is about 100,000 tokens.
const MAX_PROMPT_CHARS = 400_000;

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

// The fast model for simple, everyday calls, like pulling facts out of each page or naming the video: Nemotron 3.5
// Lightning, about 6 % of Ultra's price and the fastest in docs/model-check.md. Everything that needs careful reasoning
// (the script, the fact-check, the plan of the video) stays on the main model, Nemotron 3 Ultra, and each scene is
// directed by the scene model below. NEBIUS_FAST_MODEL overrides it, for example with Ultra itself to compare.
const DEFAULT_FAST_MODEL = "nvidia/Nemotron-3_5-Lightning";

// When the fast model does not answer, its calls go to the scene model instead (see chatJson): Super costs more, but a
// video that waits for a model that never answers fails. On Oct 21, 2026 Lightning stopped answering while Ultra and
// Super answered at once. It normally returns facts in about a second (docs/model-check.md), so a call still waiting
// after FAST_TIMEOUT_MS has stalled. After one that fails, the fast calls on this server instance skip it for
// FAST_DOWN_MS, so they do not wait for it too.
const FAST_TIMEOUT_MS = 20_000;
const FAST_DOWN_MS = 5 * 60_000;
let fastDownUntil = 0;

// The model for everything that needs careful reasoning, picked in docs/model-check.md. NEBIUS_MODEL overrides it, so
// a fresh copy runs with only NEBIUS_API_KEY set.
const DEFAULT_MAIN_MODEL = "nvidia/Nemotron-3-Ultra-550b-a55b";

// The model that directs each scene: Nemotron 3 Super. Re-directing four saved videos with it cost a third of Ultra
// (about $0.04 against $0.12 a video), was a little faster, and broke the rules a little less often, with pictures as
// good (Oct 20, 2026). The plan, the critique and the check of places stay on Ultra. NEBIUS_SCENE_MODEL overrides it.
const DEFAULT_SCENE_MODEL = "nvidia/nemotron-3-super-120b-a12b";

// Which model a call uses: "main" is NEBIUS_MODEL, "fast" the fast model, and "scene" the scene model.
export type ModelRole = "main" | "fast" | "scene";

function getModel(role: ModelRole = "main"): string {
  if (role === "fast") return process.env.NEBIUS_FAST_MODEL || DEFAULT_FAST_MODEL;
  if (role === "scene") return process.env.NEBIUS_SCENE_MODEL || DEFAULT_SCENE_MODEL;
  return process.env.NEBIUS_MODEL || DEFAULT_MAIN_MODEL;
}

// One token from a model, for the daily health check (app/api/health): it fails when Token Factory turns the key away,
// the account is out of credit or the model is no longer served. Logged like every call; one token from each of the
// three models costs about $0.00003. A model answers in about a second, so 10 s is plenty, and two tries fit in the
// 30 s the route has. It never falls back to another model, since it checks this one.
export async function pingModel(role: ModelRole): Promise<Usage> {
  const { usage } = await callModel(
    "health",
    { messages: [{ role: "user", content: "Answer with the word OK." }], max_tokens: 1 },
    { timeoutMs: 10_000, retryUntil: Date.now() },
    true,
    false,
    role,
  );
  return usage;
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

// An error from chatJson. It carries the tokens and cost of the tries before it, so a step that goes on without
// the answer can still count them in the cost of the video.
export class ErrorWithUsage extends Error {
  usage: Usage;
  constructor(message: string, usage: Usage, options?: ErrorOptions) {
    super(message, options);
    this.usage = usage;
  }
}

// The tokens and cost a failed call spent, or none when the error does not say.
export function usageOf(error: unknown): Usage {
  return error instanceof ErrorWithUsage ? error.usage : emptyUsage();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// When the requests of one chatJson call may start. See RETRY_WINDOW_MS and JsonRequest.deadline.
type Timing = { timeoutMs: number; retryUntil: number; deadline?: number };

// How long a new request may run, or 0 when it may not start. A retry does not start after the retry window, and
// no request starts so close to the deadline that it would only be cut off. `at` is when the request would start.
function requestTimeout(timing: Timing, retry: boolean, at = Date.now()): number {
  if (retry && at >= timing.retryUntil) return 0;
  const left = timing.deadline === undefined ? Infinity : timing.deadline - at;
  return left < MIN_REQUEST_MS ? 0 : Math.min(timing.timeoutMs, left);
}

// A request that ran out of time, on our timeout or the client's.
const isTimeout = (error: unknown) =>
  error instanceof OpenAI.APIUserAbortError || error instanceof OpenAI.APIConnectionTimeoutError;

// Dropped connections and server errors are worth one more try. Bad requests are not, and chatJson handles timeouts.
const isTransient = (error: unknown) =>
  (error instanceof OpenAI.APIConnectionError && !isTimeout(error)) || error instanceof OpenAI.InternalServerError;

// The fast model failed in a way another model may not: it ran out of time, the connection or the server failed, it is
// rate limited, or Token Factory no longer serves it. A bad request or an empty account fails on every model.
const fastModelFailed = (error: unknown) =>
  isTimeout(error) || isTransient(error) || error instanceof OpenAI.RateLimitError || error instanceof OpenAI.NotFoundError;

// One model call. A transient error gets one more try, and a 429 gets one more try after waiting for Retry-After,
// while the timing allows. Each happens at most once, so a call makes at most three requests. Logs tokens, latency
// and cost.
async function callModel(
  step: string,
  params: Omit<ChatCompletionCreateParamsNonStreaming, "model">,
  timing: Timing,
  firstTry: boolean, // the first request of a chatJson call, which the retry window does not hold back
  thinking = false,
  role: ModelRole = "main",
): Promise<{ content: string; cutOff: boolean; usage: Usage }> {
  const model = getModel(role);
  // NVIDIA recommends temperature 1 and top_p 0.95 for Nemotron 3 in every mode.
  const body: ChatCompletionCreateParamsNonStreaming = { temperature: 1, top_p: 0.95, ...params, model };
  // Thinking is off unless a step asks for it: off is 2 to 10 times faster, and it did not improve the results
  // in docs/model-check.md.
  Object.assign(body, { chat_template_kwargs: { enable_thinking: thinking } });

  let started = 0;
  let completion;
  let retriedTransient = false;
  let retriedRateLimit = false;
  for (;;) {
    const timeoutMs = requestTimeout(timing, !firstTry || retriedTransient || retriedRateLimit);
    if (timeoutMs === 0) throw new Error(`${step}: ran out of time before a request could start.`);
    started = performance.now();
    try {
      completion = await getClient().chat.completions.create(body, { signal: AbortSignal.timeout(timeoutMs) });
      break;
    } catch (error) {
      if (error instanceof OpenAI.RateLimitError && !retriedRateLimit) {
        const waitMs = Math.min(Number(error.headers.get("retry-after")) || 5, 20) * 1000;
        // A wait that ends after the retry window or too close to the deadline would be for nothing.
        if (requestTimeout(timing, true, Date.now() + waitMs) === 0) throw error;
        console.warn(`[nebius] Rate limited. Waiting ${waitMs / 1000} s, then one retry.`);
        await wait(waitMs);
        retriedRateLimit = true;
        continue;
      }
      if (isTransient(error) && !retriedTransient && requestTimeout(timing, true) > 0) {
        console.warn(`[${step}] ${error instanceof Error ? error.message : error}. Trying once more.`);
        retriedTransient = true;
        continue;
      }
      throw error;
    }
  }
  const ms = Math.round(performance.now() - started);

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const price = PRICES[model];
  const costUsd = price ? (promptTokens * price.input + completionTokens * price.output) / 1e6 : 0;
  console.log(`[${step}]${model !== getModel("main") ? ` (${model.split("/").pop()})` : ""} ${ms} ms, ${promptTokens} in / ${completionTokens} out, $${costUsd.toFixed(4)}`);

  const choice = completion.choices[0];
  return {
    content: choice?.message.content ?? "",
    cutOff: choice?.finish_reason === "length",
    usage: { calls: 1, promptTokens, completionTokens, costUsd },
  };
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

// The characters of a conversation. The pipeline only sends text, but other content is counted too.
function promptChars(messages: ChatCompletionMessageParam[]): number {
  return messages.reduce(
    (total, message) =>
      total + (typeof message.content === "string" ? message.content.length : JSON.stringify(message.content ?? "").length),
    0,
  );
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
  timeoutMs?: number; // per model call, 45 s unless set
  thinking?: boolean; // lets the model reason before it answers: slower, but better at careful checks
  fast?: boolean; // a simple call, for the fast model (see DEFAULT_FAST_MODEL)
  scene?: boolean; // the direction of one scene, for the scene model (see ModelRole)
  // A Date.now() time for steps that must end in time. No request starts after it, and none runs past it; the retry
  // window still holds. A call stopped by it ends as if its tries had run out.
  deadline?: number;
  // Called with the best answer when no answer passes every rule: after the last retry, when time runs out, or when
  // a later try fails. Returns a fixed version to use. Without it, or without any answer to fix, the call fails.
  repair?: (data: T) => T;
  // How far an answer that breaks a rule is from right, lower is better. It picks the answer for `repair`. Without
  // it, the answer with the fewest problems is picked.
  distance?: (data: T) => number;
};

// Asks the model for JSON that matches the schema, using strict json_schema output.
// If the JSON breaks the schema or a rule, the problems go back to the model and it tries again.
export async function chatJson<T>(request: JsonRequest<T>): Promise<{ data: T; usage: Usage }> {
  const jsonSchema = z.toJSONSchema(request.schema);
  const baseMessages = withSchema(request.messages, jsonSchema);
  // One request can make a step repeat the same facts in prompt after prompt, so a prompt far longer than any real one
  // stops here, before it costs anything. A fix attempt only adds the model's own answer and a few lines to it.
  const chars = promptChars(baseMessages);
  if (chars > MAX_PROMPT_CHARS) {
    return giveUp(request, null, emptyUsage(), `${request.step}: the prompt has ${chars} characters, more than the ${MAX_PROMPT_CHARS} a call may send.`);
  }
  const timing: Timing = {
    timeoutMs: request.timeoutMs ?? CALL_TIMEOUT_MS,
    retryUntil: Date.now() + RETRY_WINDOW_MS,
    deadline: request.deadline,
  };
  let messages = baseMessages;
  let usage = emptyUsage();
  let problems: string[] = [];
  // The best answer that parsed but broke a rule, kept for `repair`. On a tie the later answer wins, since it had
  // the most feedback.
  let best: { data: T; distance: number } | null = null;
  // A fast call goes to the scene model while the fast model is down (see FAST_TIMEOUT_MS).
  let role: ModelRole = request.fast ? (Date.now() < fastDownUntil ? "scene" : "fast") : request.scene ? "scene" : "main";

  for (let attempt = 0; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    if (requestTimeout(timing, attempt > 0) === 0) {
      const when = attempt === 0 ? "before the first try" : `after ${attempt} tries (${problems.join("; ")})`;
      return giveUp(request, best, usage, `${request.step}: ran out of time ${when}`);
    }
    let reply;
    try {
      reply = await callModel(
        request.step,
        {
          messages,
          max_tokens: request.maxTokens,
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, schema: jsonSchema, strict: true },
          },
        },
        role === "fast" ? { ...timing, timeoutMs: Math.min(timing.timeoutMs, FAST_TIMEOUT_MS) } : timing,
        attempt === 0,
        request.thinking,
        role,
      );
    } catch (error) {
      // When the fast model fails, the scene model takes the call from the start, and the next fast calls too.
      if (role === "fast" && fastModelFailed(error)) {
        fastDownUntil = Date.now() + FAST_DOWN_MS;
        problems = ["The fast model did not answer."];
        console.warn(
          `[${request.step}] The fast model did not answer (${error instanceof Error ? error.message : error}). The scene model takes this call and the fast calls of the next ${FAST_DOWN_MS / 60_000} minutes.`,
        );
        role = "scene";
        messages = baseMessages;
        continue;
      }
      // A request that times out may be the model repeating itself, like an answer cut off at max_tokens, so the next
      // try starts over instead of sending the same conversation again.
      if (isTimeout(error)) {
        problems = ["The answer took too long."];
        console.warn(`[${request.step}] Timed out on try ${attempt + 1}. Starting over.`);
        messages = baseMessages;
        continue;
      }
      return giveUp(request, best, usage, error instanceof Error ? error.message : String(error), error);
    }
    usage = addUsage(usage, reply.usage);
    // An answer cut off at max_tokens is usually the model repeating itself. It cannot be fixed, so it starts over.
    if (reply.cutOff) {
      problems = ["The answer was cut off at max_tokens."];
      console.warn(`[${request.step}] Cut off at max_tokens on try ${attempt + 1}. Starting over.`);
      messages = baseMessages;
      continue;
    }
    const result = parseJson(reply.content, request.schema, request.check);
    if (result.data && result.problems.length === 0) return { data: result.data, usage };

    problems = result.problems;
    console.warn(`[${request.step}] Invalid JSON on try ${attempt + 1}: ${problems.join("; ")}`);
    if (result.data) {
      const distance = request.distance ? request.distance(result.data) : problems.length;
      if (!best || distance <= best.distance) best = { data: result.data, distance };
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
  return giveUp(request, best, usage, `${request.step}: no valid JSON after ${MAX_FIX_ATTEMPTS + 1} tries (${problems.join("; ")})`);
}

// Every way out of chatJson without a valid answer ends here. The best answer is repaired when the step allows it.
// Otherwise the call fails, and the error carries the tokens the tries used.
function giveUp<T>(
  request: JsonRequest<T>,
  best: { data: T } | null,
  usage: Usage,
  reason: string,
  cause?: unknown,
): { data: T; usage: Usage } {
  if (best && request.repair) {
    console.warn(`[${request.step}] Repairing the best answer instead of failing (${reason}).`);
    try {
      return { data: request.repair(best.data), usage };
    } catch (error) {
      throw new ErrorWithUsage(error instanceof Error ? error.message : String(error), usage, { cause: error });
    }
  }
  throw new ErrorWithUsage(reason, usage, cause === undefined ? undefined : { cause });
}
