// Checks which NVIDIA Nemotron models on Nebius Token Factory fit Meko.
// Tests strict JSON output, tool calling, thinking on and off, latency and a Norwegian sample.
// Prints a report and saves a copy in docs/model-check.md.
// Run with `npm run check-models`. Needs NEBIUS_API_KEY in .env.local.

import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { VERSION } from "openai/version";
import { z } from "zod";
import { FactSchema, StoryboardSchema, storyboardProblems } from "../lib/storyboard.ts";
import type { Fact, Source, Storyboard } from "../lib/storyboard.ts";

const BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
const TIMEOUT_MS = 90_000;
const BUDGET_USD = 1;
const MAX_MODELS = 8;
const TRIES = 3;
// NVIDIA recommends these sampling settings for Nemotron 3 in every mode.
const SAMPLING = { temperature: 1, top_p: 0.95 };
// The models the Token Factory docs point to. They are tested first.
const PREFERRED_MODELS = ["nvidia/Nemotron-3_5-Lightning", "nvidia/nemotron-3-super-120b-a12b"];
// Used for the budget check when the API reports no price. USD per token.
const FALLBACK_PRICE = { input: 2 / 1e6, output: 6 / 1e6 };
const THINK_TAG = /<\/?think>/i;

// ---------- Types ----------

type Price = { input: number; output: number; known: boolean }; // USD per token

type Candidate = {
  id: string;
  contextLength: number | null;
  price: Price;
  features: string[];
};

// The fields we read from GET /v1/models?verbose=true.
type RawModel = {
  id: string;
  status?: string | null;
  context_length?: number;
  architecture?: { modality?: string };
  pricing?: { prompt?: string; completion?: string };
  supported_features?: string[] | null;
};

// `extra` holds request fields the openai SDK does not know about, like chat_template_kwargs.
type Mode = { name: string; extra: Record<string, unknown> };

// Token Factory returns reasoning in one of these fields on messages and stream deltas.
type ReasoningFields = { reasoning_content?: string | null; reasoning?: string | null };

type Usage = { prompt_tokens: number; completion_tokens: number };

type TestResult = {
  name: string;
  passed: number;
  tries: number;
  format: string;
  ms: number[];
  problems: string[];
};

type JsonTest<T> = {
  name: string; // also used as the json_schema name
  schema: z.ZodType<T>;
  messages: ChatCompletionMessageParam[];
  maxTokens: number;
  check: (data: T) => string[]; // rules beyond the schema, one line per problem
};

type LatencyResult = {
  firstTokenMs: number | null;
  totalMs: number;
  tokensPerSec: number | null;
  costUsd: number;
};

type ModeReport = {
  mode: Mode;
  facts?: TestResult;
  storyboard?: TestResult;
  latency?: LatencyResult;
  error?: string;
};

type ModelReport = {
  model: Candidate;
  thinking: string;
  modes: ModeReport[];
  tools?: TestResult;
  norwegian?: string;
  error?: string;
};

class BudgetExceeded extends Error {}

// ---------- Test data ----------

const SOURCE_TEXT =
  "The French Revolution began in 1789. On 14 July 1789, crowds in Paris stormed the Bastille, " +
  "a royal fortress and prison, and in August the National Assembly adopted the Declaration of the " +
  "Rights of Man and of the Citizen. In April 1792 France declared war on Austria. The monarchy was " +
  "abolished in September 1792, and King Louis XVI was executed in January 1793.";

const SOURCES: Source[] = [
  { id: "s1", title: "The French Revolution (test text)", url: "https://example.org/french-revolution" },
];

const FACTS: Fact[] = [
  { id: "f1", text: "The French Revolution began in 1789.", sourceId: "s1" },
  { id: "f2", text: "On 14 July 1789, crowds in Paris stormed the Bastille.", sourceId: "s1" },
  {
    id: "f3",
    text: "In August 1789 the National Assembly adopted the Declaration of the Rights of Man and of the Citizen.",
    sourceId: "s1",
  },
  { id: "f4", text: "In April 1792 France declared war on Austria.", sourceId: "s1" },
  { id: "f5", text: "The monarchy was abolished in September 1792.", sourceId: "s1" },
  { id: "f6", text: "King Louis XVI was executed in January 1793.", sourceId: "s1" },
];

const FactsOutputSchema = z.object({ facts: z.array(FactSchema) });

const FACTS_TEST: JsonTest<z.infer<typeof FactsOutputSchema>> = {
  name: "facts",
  schema: FactsOutputSchema,
  maxTokens: 4000,
  messages: [
    {
      role: "system",
      content: [
        "You extract facts from a source text for an explainer video.",
        "Each fact is one short, atomic statement that the source text supports.",
        "Use the IDs f1, f2, f3 and so on, and set sourceId to the ID of the source.",
        `Reply with JSON only, matching this JSON Schema: ${JSON.stringify(z.toJSONSchema(FactsOutputSchema))}`,
      ].join("\n"),
    },
    { role: "user", content: `Source ID: s1\nSource text: ${SOURCE_TEXT}` },
  ],
  check: (data) => {
    const problems: string[] = [];
    if (data.facts.length < 3) problems.push(`only ${data.facts.length} facts`);
    if (data.facts.some((fact) => fact.sourceId !== "s1")) problems.push("a fact points to an unknown source");
    return problems;
  },
};

const STORYBOARD_TEST: JsonTest<Storyboard> = {
  name: "storyboard",
  schema: StoryboardSchema,
  maxTokens: 6000,
  messages: [
    {
      role: "system",
      content: [
        "You direct short explainer videos. Turn the facts into a storyboard.",
        "Make exactly 3 scenes, in this order: a title scene, a text scene and a map scene.",
        "Only use fact IDs from the list in factIds. Country codes are ISO 3166-1 alpha-3, like FRA.",
        'Set language to "en", fps to 30, width to 1920 and height to 1080. Copy the sources into sources.',
        "durationSec is how long the narration takes to say, at about 2.5 words per second.",
        `Reply with JSON only, matching this JSON Schema: ${JSON.stringify(z.toJSONSchema(StoryboardSchema))}`,
      ].join("\n"),
    },
    { role: "user", content: `Facts: ${JSON.stringify(FACTS)}\nSources: ${JSON.stringify(SOURCES)}` },
  ],
  check: (storyboard) => {
    const problems: string[] = [];
    const kinds = storyboard.scenes.map((scene) => scene.kind).join(", ");
    if (kinds !== "title, text, map") problems.push(`scene kinds are "${kinds}", expected "title, text, map"`);
    return [...problems, ...storyboardProblems(storyboard, FACTS.map((fact) => fact.id))];
  },
};

const SEARCH_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_web",
    description: "Search the web. Returns short text snippets from the top results.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What to search for" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};
const SearchArgsSchema = z.object({ query: z.string().min(1) });
// A made-up place, so the model can only answer by using the search result.
const TOOL_QUESTION =
  "When did the Fjordvik Coastal Museum open, and how many visitors did it have in its first year? " +
  "Search the web before you answer.";
const FAKE_SEARCH_RESULT =
  "Fjordvik Coastal Museum (fjordvik-museum.example): The museum opened on 12 May 2019. " +
  "In its first year it had 48,213 visitors.";
const FAKE_RESULT_NUMBER = /48[\s,.]?213/;

const LATENCY_PROMPT =
  "Write a 120-word narration for an explainer video about the French Revolution, for high school students. Plain text only.";
const NORWEGIAN_PROMPT =
  "Explain what the French Revolution was in 2 or 3 sentences, for high school students. Write in Norwegian bokmål.";

// ---------- Client, budget and logging ----------

const apiKey = process.env.NEBIUS_API_KEY;
if (!apiKey) {
  console.error("NEBIUS_API_KEY is missing. Add it to .env.local and run again.");
  process.exit(1);
}

const client = new OpenAI({ baseURL: BASE_URL, apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });

let spentUsd = 0;
let callCount = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const seconds = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const usd = (value: number) => `$${value.toFixed(4)}`;
const perMillion = (pricePerToken: number) => `$${(pricePerToken * 1e6).toFixed(2)}`;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// API error messages from the SDK already start with the HTTP status.
function describeError(error: unknown): string {
  if (error instanceof OpenAI.APIUserAbortError) return `no answer within ${TIMEOUT_MS / 1000} s`;
  return error instanceof Error ? error.message : String(error);
}

function checkBudget() {
  if (spentUsd >= BUDGET_USD) {
    throw new BudgetExceeded(`Stopped because the running cost reached ${usd(spentUsd)} (budget ${usd(BUDGET_USD)}).`);
  }
}

// Runs one request. On a 429 it waits for Retry-After and tries once more.
async function withRateLimitRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof OpenAI.RateLimitError)) throw error;
    const waitSec = Math.min(Number(error.headers.get("retry-after")) || 10, 60);
    console.log(`    Rate limited. Waiting ${waitSec} s, then one retry.`);
    await wait(waitSec * 1000);
    return await request();
  }
}

// Logs tokens, latency and cost for one model call and adds the cost to the running total.
function logCall(model: Candidate, label: string, ms: number, usage: Usage | null | undefined): number {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const price = model.price.known ? model.price : FALLBACK_PRICE;
  const costUsd = promptTokens * price.input + completionTokens * price.output;
  spentUsd += costUsd;
  callCount++;
  console.log(
    `    ${label}: ${seconds(ms)}, ${promptTokens} in / ${completionTokens} out, ${usd(costUsd)} (total ${usd(spentUsd)})`,
  );
  return costUsd;
}

async function chat(
  model: Candidate,
  mode: Mode,
  label: string,
  params: Omit<ChatCompletionCreateParamsNonStreaming, "model">,
): Promise<{ completion: ChatCompletion; ms: number }> {
  checkBudget();
  const body: ChatCompletionCreateParamsNonStreaming = { ...SAMPLING, ...params, model: model.id };
  Object.assign(body, mode.extra);
  let ms = 0;
  try {
    const completion = await withRateLimitRetry(async () => {
      const started = performance.now();
      const result = await client.chat.completions.create(body, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      ms = performance.now() - started;
      return result;
    });
    logCall(model, `${label} (${mode.name})`, ms, completion.usage);
    return { completion, ms };
  } catch (error) {
    console.log(`    ${label} (${mode.name}): failed, ${describeError(error)}`);
    throw error;
  }
}

// ---------- Models ----------

function skipReason(model: RawModel): string | null {
  if (model.status != null && model.status !== "active") return `status ${model.status}`;
  const modality = model.architecture?.modality;
  if (modality && modality !== "text->text") return `modality ${modality}`;
  if (/embed|guard|safety|reward|rerank|parse|vision|omni|vl\b/i.test(model.id)) return "not a chat model";
  return null;
}

function toCandidate(model: RawModel): Candidate {
  const input = Number(model.pricing?.prompt);
  const output = Number(model.pricing?.completion);
  const known = input > 0 && output > 0;
  return {
    id: model.id,
    contextLength: model.context_length ?? null,
    price: { input: known ? input : 0, output: known ? output : 0, known },
    features: model.supported_features ?? [],
  };
}

async function listCandidates(): Promise<{ candidates: Candidate[]; skipped: string[] }> {
  const list = await withRateLimitRetry(() =>
    client.get<{ data: RawModel[] }>("/models", {
      query: { verbose: true },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  );
  const skipped: string[] = [];
  const usable: RawModel[] = [];
  for (const model of list.data) {
    if (!/nvidia\/|nemotron/i.test(model.id)) continue;
    const reason = skipReason(model);
    if (reason) skipped.push(`${model.id} (${reason})`);
    else usable.push(model);
  }
  const rank = (id: string) => {
    const index = PREFERRED_MODELS.findIndex((preferred) => preferred.toLowerCase() === id.toLowerCase());
    return index === -1 ? PREFERRED_MODELS.length : index;
  };
  usable.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  for (const model of usable.slice(MAX_MODELS)) skipped.push(`${model.id} (over the limit of ${MAX_MODELS})`);
  return { candidates: usable.slice(0, MAX_MODELS).map(toCandidate), skipped };
}

// ---------- Thinking on and off ----------

const OFF_SWITCHES: Mode[] = [
  { name: "thinking off", extra: { chat_template_kwargs: { enable_thinking: false } } },
  { name: "thinking off", extra: { reasoning_effort: "none" } },
];
const ON_SWITCH: Mode = { name: "thinking on", extra: { chat_template_kwargs: { enable_thinking: true } } };

const describeSwitch = (mode: Mode) => `\`${JSON.stringify(mode.extra)}\``;

function reasoningOf(fields: ReasoningFields): string {
  return fields.reasoning_content ?? fields.reasoning ?? "";
}

function showsThinking(completion: ChatCompletion): boolean {
  const message: ReasoningFields & { content: string | null } = completion.choices[0]?.message ?? { content: null };
  const reasoningTokens = completion.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  return reasoningOf(message).trim() !== "" || reasoningTokens > 0 || THINK_TAG.test(message.content ?? "");
}

async function probeThinks(model: Candidate, mode: Mode): Promise<boolean> {
  const { completion } = await chat(model, mode, "thinking probe", {
    max_tokens: 2000,
    messages: [{ role: "user", content: "What is 17 times 23? Reply with only the number." }],
  });
  return showsThinking(completion);
}

// Tries a switch. Returns true if it changed the thinking, false if not. Adds a note when it did not work.
async function switchWorks(model: Candidate, mode: Mode, thinksByDefault: boolean, notes: string[]) {
  try {
    if ((await probeThinks(model, mode)) !== thinksByDefault) return true;
    notes.push(`${describeSwitch(mode)} had no effect.`);
  } catch (error) {
    if (error instanceof BudgetExceeded) throw error;
    notes.push(`${describeSwitch(mode)} was rejected: ${describeError(error)}.`);
  }
  return false;
}

// Finds out if the model thinks by default and if a switch can change that.
// Returns the modes to test: the default first, then the switched mode if a switch works.
async function findModes(model: Candidate): Promise<{ modes: Mode[]; note: string }> {
  const notes: string[] = [];
  if (await probeThinks(model, { name: "default", extra: {} })) {
    const thinkingOn: Mode = { name: "thinking on", extra: {} };
    for (const off of OFF_SWITCHES) {
      if (await switchWorks(model, off, true, notes)) {
        const note = ["Thinks by default.", ...notes, `${describeSwitch(off)} turns it off.`].join(" ");
        return { modes: [thinkingOn, off], note };
      }
    }
    return { modes: [thinkingOn], note: ["Thinks by default and could not be turned off.", ...notes].join(" ") };
  }
  if (await switchWorks(model, ON_SWITCH, false, notes)) {
    const thinkingOff: Mode = { name: "thinking off", extra: {} };
    return { modes: [thinkingOff, ON_SWITCH], note: `Does not think by default. ${describeSwitch(ON_SWITCH)} turns it on.` };
  }
  return { modes: [{ name: "no thinking", extra: {} }], note: ["No thinking seen.", ...notes].join(" ") };
}

// ---------- JSON tests ----------

type JsonFormat = "json_schema" | "json_object";

async function sendJson<T>(
  model: Candidate,
  mode: Mode,
  label: string,
  test: JsonTest<T>,
  format: JsonFormat,
): Promise<{ completion: ChatCompletion | null; ms: number; error: unknown }> {
  try {
    const { completion, ms } = await chat(model, mode, label, {
      messages: test.messages,
      max_tokens: test.maxTokens,
      response_format:
        format === "json_schema"
          ? {
              type: "json_schema",
              json_schema: { name: test.name, schema: z.toJSONSchema(test.schema), strict: true },
            }
          : { type: "json_object" },
    });
    return { completion, ms, error: null };
  } catch (error) {
    if (error instanceof BudgetExceeded) throw error;
    return { completion: null, ms: 0, error };
  }
}

function jsonProblems<T>(completion: ChatCompletion, test: JsonTest<T>): string[] {
  const choice = completion.choices[0];
  const content = choice?.message.content ?? "";
  if (choice?.finish_reason === "length") return ["hit max_tokens before the answer was done"];
  if (content.trim() === "") return ["empty content"];
  if (THINK_TAG.test(content)) return ["thinking text in content"];
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return [`not valid JSON, starts with ${JSON.stringify(content.slice(0, 60))}`];
  }
  const parsed = test.schema.safeParse(data);
  if (!parsed.success) {
    return parsed.error.issues
      .slice(0, 3)
      .map((issue) => `schema: ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`);
  }
  return test.check(parsed.data);
}

// Runs a JSON test TRIES times with a strict json_schema.
// If the server rejects json_schema, it switches to json_object and validates with zod only.
async function runJsonTest<T>(model: Candidate, mode: Mode, test: JsonTest<T>): Promise<TestResult> {
  const result: TestResult = { name: test.name, passed: 0, tries: 0, format: "json_schema (strict)", ms: [], problems: [] };
  let format: JsonFormat = "json_schema";

  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const label = `${test.name} ${attempt}/${TRIES}`;
    let outcome = await sendJson(model, mode, label, test, format);
    if (format === "json_schema" && outcome.error instanceof OpenAI.BadRequestError) {
      result.format = `json_object, because json_schema was rejected (${describeError(outcome.error)})`;
      format = "json_object";
      outcome = await sendJson(model, mode, label, test, format);
    }
    result.tries++;
    if (!outcome.completion) {
      result.problems.push(`Try ${attempt}: ${describeError(outcome.error)}`);
      continue;
    }
    result.ms.push(outcome.ms);
    const problems = jsonProblems(outcome.completion, test);
    if (problems.length === 0) result.passed++;
    else result.problems.push(`Try ${attempt}: ${problems.join("; ")}`);
  }
  return result;
}

// ---------- Tool calling ----------

// One round trip: the model calls search_web, gets a made-up result back and must use it.
// Returns a problem, or null when the try passed.
async function toolTry(model: Candidate, mode: Mode, attempt: number): Promise<string | null> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: "You answer questions. Use the search_web tool to look things up." },
    { role: "user", content: TOOL_QUESTION },
  ];
  const first = await chat(model, mode, `tools ${attempt}/${TRIES} call`, {
    messages,
    tools: [SEARCH_TOOL],
    max_tokens: 2000,
  });
  const message = first.completion.choices[0]?.message;
  const call = message?.tool_calls?.[0];
  if (!message || !call) {
    return `answered without calling the tool: ${JSON.stringify((message?.content ?? "").slice(0, 80))}`;
  }
  if (call.type !== "function" || call.function.name !== "search_web") return "called a tool that does not exist";
  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return `tool arguments are not valid JSON: ${call.function.arguments.slice(0, 80)}`;
  }
  if (!SearchArgsSchema.safeParse(args).success) {
    return `tool arguments do not match the schema: ${call.function.arguments.slice(0, 80)}`;
  }

  const second = await chat(model, mode, `tools ${attempt}/${TRIES} answer`, {
    messages: [
      ...messages,
      { role: "assistant", content: message.content, tool_calls: [call] },
      { role: "tool", tool_call_id: call.id, content: FAKE_SEARCH_RESULT },
    ],
    tools: [SEARCH_TOOL],
    max_tokens: 2000,
  });
  const answer = second.completion.choices[0]?.message;
  if (answer?.tool_calls?.length) return "called the tool again instead of answering";
  if (!FAKE_RESULT_NUMBER.test(answer?.content ?? "")) {
    return `answer does not use the search result: ${JSON.stringify((answer?.content ?? "").slice(0, 80))}`;
  }
  return null;
}

async function runToolTest(model: Candidate, mode: Mode): Promise<TestResult> {
  const result: TestResult = { name: "tools", passed: 0, tries: 0, format: "tools, tool_choice auto", ms: [], problems: [] };
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    result.tries++;
    try {
      const problem = await toolTry(model, mode, attempt);
      if (problem) result.problems.push(`Try ${attempt}: ${problem}`);
      else result.passed++;
    } catch (error) {
      if (error instanceof BudgetExceeded) throw error;
      result.problems.push(`Try ${attempt}: ${describeError(error)}`);
    }
  }
  return result;
}

// ---------- Latency and Norwegian ----------

async function runLatency(model: Candidate, mode: Mode): Promise<LatencyResult> {
  checkBudget();
  const body: ChatCompletionCreateParamsStreaming = {
    ...SAMPLING,
    model: model.id,
    max_tokens: 2000,
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: "user", content: LATENCY_PROMPT }],
  };
  Object.assign(body, mode.extra);
  let started = 0;
  const stream = await withRateLimitRetry(() => {
    started = performance.now();
    return client.chat.completions.create(body, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  });
  let firstTokenMs: number | null = null;
  let usage: Usage | null = null;
  for await (const chunk of stream) {
    const delta: ReasoningFields & { content?: string | null } = chunk.choices[0]?.delta ?? {};
    if (firstTokenMs === null && (delta.content || reasoningOf(delta))) {
      firstTokenMs = performance.now() - started;
    }
    if (chunk.usage) usage = chunk.usage;
  }
  const totalMs = performance.now() - started;
  const costUsd = logCall(model, `latency (${mode.name})`, totalMs, usage);
  const generatingSec = (totalMs - (firstTokenMs ?? totalMs)) / 1000;
  const completionTokens = usage?.completion_tokens ?? 0;
  return {
    firstTokenMs,
    totalMs,
    tokensPerSec: generatingSec > 0 && completionTokens > 0 ? completionTokens / generatingSec : null,
    costUsd,
  };
}

async function runNorwegian(model: Candidate, mode: Mode): Promise<string> {
  const { completion } = await chat(model, mode, "Norwegian sample", {
    max_tokens: 2000,
    messages: [{ role: "user", content: NORWEGIAN_PROMPT }],
  });
  const choice = completion.choices[0];
  const text = (choice?.message.content ?? "").trim();
  if (choice?.finish_reason === "length") return `(hit max_tokens) ${text}`;
  return text || "(empty)";
}

// ---------- One model ----------

async function checkModel(model: Candidate): Promise<ModelReport> {
  console.log(`\n${model.id}`);
  const report: ModelReport = { model, thinking: "", modes: [] };
  try {
    const { modes, note } = await findModes(model);
    report.thinking = note;
    for (const mode of modes) {
      const modeReport: ModeReport = { mode };
      report.modes.push(modeReport);
      modeReport.facts = await runJsonTest(model, mode, FACTS_TEST);
      modeReport.storyboard = await runJsonTest(model, mode, STORYBOARD_TEST);
      try {
        modeReport.latency = await runLatency(model, mode);
      } catch (error) {
        if (error instanceof BudgetExceeded) throw error;
        modeReport.error = `Latency call failed: ${describeError(error)}`;
      }
    }
    report.tools = await runToolTest(model, modes[0]);
    try {
      report.norwegian = await runNorwegian(model, modes[0]);
    } catch (error) {
      if (error instanceof BudgetExceeded) throw error;
      report.norwegian = `(failed: ${describeError(error)})`;
    }
  } catch (error) {
    if (error instanceof BudgetExceeded) throw error;
    report.error = describeError(error);
    console.log(`    Error: ${report.error}`);
  }
  return report;
}

// ---------- Report ----------

function score(result?: TestResult): string {
  if (!result) return "–";
  const time = result.ms.length > 0 ? `, ${seconds(median(result.ms))}` : "";
  return `${result.passed}/${result.tries}${time}`;
}

function buildReport(candidates: Candidate[], skipped: string[], reports: ModelReport[], stopReason: string): string {
  const lines: string[] = [];
  const runAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  lines.push("# Model check", "");
  lines.push(`Run on ${runAt} UTC against Nebius Token Factory with the openai SDK ${VERSION}.`);
  lines.push(`${callCount} model calls, total cost ${usd(spentUsd)}.${stopReason ? ` ${stopReason}` : ""}`, "");
  lines.push(
    "Sampling is temperature 1 and top_p 0.95, as NVIDIA recommends for Nemotron 3.",
    "Every call has a 90 s timeout and a max_tokens cap.",
    "",
  );

  lines.push("## Models", "");
  lines.push("| Model | Context | $ per 1M in | $ per 1M out | Supported features |", "| --- | --- | --- | --- | --- |");
  for (const model of candidates) {
    const input = model.price.known ? perMillion(model.price.input) : "?";
    const output = model.price.known ? perMillion(model.price.output) : "?";
    const context = model.contextLength?.toLocaleString("en-US") ?? "?";
    lines.push(`| ${model.id} | ${context} | ${input} | ${output} | ${model.features.join(", ") || "–"} |`);
  }
  if (skipped.length > 0) lines.push("", `Skipped: ${skipped.join("; ")}.`);

  lines.push("", "## Thinking", "");
  for (const report of reports) {
    lines.push(`- **${report.model.id}**: ${report.error ? `Failed: ${report.error}` : report.thinking}`);
  }

  lines.push("", "## Results", "");
  lines.push(
    "Facts and storyboard show passed tries out of 3 and the median time per call.",
    "Latency is one streamed call that writes a 120-word narration.",
    "",
  );
  lines.push(
    "| Model | Mode | Facts JSON | Storyboard JSON | First token | Total | Tokens/s | Cost |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const report of reports) {
    for (const { mode, facts, storyboard, latency } of report.modes) {
      const latencyCells = latency
        ? `${seconds(latency.firstTokenMs)} | ${seconds(latency.totalMs)} | ${latency.tokensPerSec?.toFixed(0) ?? "–"} | ${usd(latency.costUsd)}`
        : "– | – | – | –";
      lines.push(`| ${report.model.id} | ${mode.name} | ${score(facts)} | ${score(storyboard)} | ${latencyCells} |`);
    }
  }

  lines.push("", "## Tool calling", "");
  lines.push(
    "Passed tries out of 3. The model must call search_web with valid arguments, then use the made-up result in its answer.",
    "",
  );
  for (const report of reports) {
    if (report.tools) lines.push(`- **${report.model.id}** (${report.modes[0]?.mode.name}): ${score(report.tools)}`);
  }

  lines.push("", "## Details", "");
  for (const report of reports) {
    lines.push(`### ${report.model.id}`, "");
    if (report.error) lines.push(`- Failed: ${report.error}`);
    for (const { mode, facts, storyboard, error } of report.modes) {
      for (const result of [facts, storyboard]) {
        if (!result) continue;
        const problems = result.problems.length > 0 ? result.problems.join(" ") : "No problems.";
        lines.push(`- ${result.name} (${mode.name}), ${result.format}: ${problems}`);
      }
      if (error) lines.push(`- ${mode.name}: ${error}`);
    }
    if (report.tools) {
      const problems = report.tools.problems.length > 0 ? report.tools.problems.join(" ") : "No problems.";
      lines.push(`- tools (${report.modes[0]?.mode.name}): ${problems}`);
    }
    lines.push("");
  }

  lines.push("## Norwegian samples", "");
  lines.push("Not scored. Read them and judge the quality.", "");
  for (const report of reports) {
    if (!report.norwegian) continue;
    lines.push(`### ${report.model.id}`, "");
    lines.push(...report.norwegian.split("\n").map((line) => `> ${line}`), "");
  }
  return lines.join("\n");
}

// ---------- Main ----------

try {
  const { candidates, skipped } = await listCandidates();
  console.log(`Found ${candidates.length} NVIDIA text models to test: ${candidates.map((model) => model.id).join(", ")}`);
  if (skipped.length > 0) console.log(`Skipped: ${skipped.join("; ")}`);

  const reports: ModelReport[] = [];
  let stopReason = "";
  try {
    for (const model of candidates) reports.push(await checkModel(model));
  } catch (error) {
    if (!(error instanceof BudgetExceeded)) throw error;
    stopReason = error.message;
    console.log(`\n${stopReason}`);
  }

  const markdown = buildReport(candidates, skipped, reports, stopReason);
  console.log(`\n${markdown}`);
  writeFileSync(new URL("../docs/model-check.md", import.meta.url), `${markdown}\n`);
  console.log("Saved the report to docs/model-check.md");
} catch (error) {
  console.error(`Model check failed: ${describeError(error)}`);
  process.exitCode = 1;
}
