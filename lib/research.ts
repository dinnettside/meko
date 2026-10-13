import { z } from "zod";
import { addUsage, chatJson, emptyUsage } from "./nebius.ts";
import type { ResearchFact, ResearchSource, Usage, VideoRequest } from "./pipeline.ts";
import { extractFactsPrompt } from "./prompts/extract-facts.ts";
import { findGapsPrompt } from "./prompts/find-gaps.ts";
import { planQueriesPrompt } from "./prompts/plan-queries.ts";
import { searchWeb } from "./tavily.ts";
import type { SearchResult } from "./tavily.ts";

const MAX_ROUNDS = 2;
const SOURCES_PER_ROUND = [6, 3]; // new sources to read in round 1 and round 2
const MAX_GAP_QUERIES = 3;
const MAX_FACTS_PER_SOURCE = 6;
const MIN_SOURCE_CHARS = 300;

// The max lengths end up in the JSON Schema, and Token Factory enforces them, so lists cannot run away.
const QueriesSchema = z.object({ queries: z.array(z.string()).max(6) });
const GapsSchema = z.object({
  gaps: z.array(z.string()).max(MAX_GAP_QUERIES),
  queries: z.array(z.string()).max(MAX_GAP_QUERIES),
});
const ExtractedSchema = z.object({
  facts: z.array(z.object({ text: z.string(), quote: z.string() })).max(MAX_FACTS_PER_SOURCE),
});

type ReadSource = {
  title: string;
  url: string;
  text: string;
  facts: { text: string; quote: string }[];
  dropped: number;
};

export type ResearchResult = {
  sources: ResearchSource[];
  facts: ResearchFact[];
  queries: string[];
  droppedFacts: number; // facts thrown away because their quote was not in the source
  usage: Usage;
};

// Lowercase, plain quotes and dashes, no markdown, single spaces. Used to find a quote in a source.
function normalize(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// A fact only counts if its quote really is in the source text, so the model cannot invent facts.
export function quoteIsInSource(quote: string, sourceText: string): boolean {
  const cleanQuote = normalize(quote).replace(/^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g, "");
  return cleanQuote.split(" ").length >= 4 && normalize(sourceText).includes(cleanQuote);
}

// Runs the searches in parallel. Returns the results of each query, best first.
async function searchAll(queries: string[]): Promise<SearchResult[][]> {
  const settled = await Promise.allSettled(queries.map((query) => searchWeb(query)));
  const results = settled.map((outcome) =>
    outcome.status === "fulfilled" ? [...outcome.value].sort((a, b) => b.score - a.score) : [],
  );
  const failure = settled.find((outcome) => outcome.status === "rejected");
  if (results.every((list) => list.length === 0) && failure) throw failure.reason;
  if (failure) console.warn(`[research] A search failed: ${failure.reason}`);
  return results;
}

// Takes the best new page from each query in turn, so every part of the plan gets a source.
function pickSources(resultsPerQuery: SearchResult[][], alreadyRead: Set<string>, count: number): SearchResult[] {
  const picked: SearchResult[] = [];
  const seen = new Set(alreadyRead);
  const longest = Math.max(0, ...resultsPerQuery.map((list) => list.length));
  for (let rank = 0; rank < longest && picked.length < count; rank++) {
    for (const list of resultsPerQuery) {
      const result = list[rank];
      if (!result || picked.length === count) continue;
      const url = result.url.replace(/#.*$/, "").replace(/\/$/, "");
      if (seen.has(url) || result.content.length < MIN_SOURCE_CHARS) continue;
      seen.add(url);
      picked.push({ ...result, url });
    }
  }
  return picked;
}

async function readSource(request: VideoRequest, result: SearchResult): Promise<{ source: ReadSource; usage: Usage }> {
  const { data, usage } = await chatJson({
    step: "research/extract",
    schemaName: "facts",
    schema: ExtractedSchema,
    messages: extractFactsPrompt(request, { title: result.title, text: result.content }),
    maxTokens: 2000,
  });
  const extracted = data.facts.slice(0, MAX_FACTS_PER_SOURCE);
  const facts = extracted.filter((fact) => quoteIsInSource(fact.quote, result.content));
  return {
    source: { title: result.title, url: result.url, text: result.content, facts, dropped: extracted.length - facts.length },
    usage,
  };
}

export async function research(request: VideoRequest): Promise<ResearchResult> {
  let usage = emptyUsage();
  const plan = await chatJson({
    step: "research/plan",
    schemaName: "queries",
    schema: QueriesSchema,
    messages: planQueriesPrompt(request),
    maxTokens: 500,
    check: ({ queries }) =>
      queries.length >= 3 && queries.length <= 6 ? [] : [`Write 3 to 6 queries, not ${queries.length}.`],
  });
  usage = addUsage(usage, plan.usage);

  const read: ReadSource[] = [];
  const allQueries: string[] = [];
  let queries = plan.data.queries;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    allQueries.push(...queries);
    const results = await searchAll(queries);
    const picked = pickSources(results, new Set(read.map((source) => source.url)), SOURCES_PER_ROUND[round]);
    const settled = await Promise.allSettled(picked.map((result) => readSource(request, result)));
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        read.push(outcome.value.source);
        usage = addUsage(usage, outcome.value.usage);
      } else {
        console.warn(`[research] Could not read a source: ${outcome.reason}`);
      }
    }
    if (round === MAX_ROUNDS - 1) break;

    // The gap check is a bonus. If it fails, we go on with the facts we have.
    let gapQueries: string[] = [];
    try {
      const gaps = await chatJson({
        step: "research/gaps",
        schemaName: "gaps",
        schema: GapsSchema,
        messages: findGapsPrompt(request, read.flatMap((source) => source.facts.map((fact) => fact.text))),
        maxTokens: 800,
      });
      usage = addUsage(usage, gaps.usage);
      gapQueries = gaps.data.queries;
    } catch (error) {
      console.warn(`[research] Skipping the gap round: ${error}`);
    }
    if (gapQueries.length === 0) break;
    queries = gapQueries;
  }

  const sources: ResearchSource[] = [];
  const facts: ResearchFact[] = [];
  for (const source of read) {
    if (source.facts.length === 0) continue;
    const sourceId = `s${sources.length + 1}`;
    sources.push({ id: sourceId, title: source.title, url: source.url, text: source.text });
    for (const fact of source.facts) {
      facts.push({ id: `f${facts.length + 1}`, text: fact.text, quote: fact.quote, sourceId });
    }
  }
  const droppedFacts = read.reduce((total, source) => total + source.dropped, 0);
  console.log(`[research] ${sources.length} sources, ${facts.length} facts, ${droppedFacts} dropped`);
  if (facts.length < 5) throw new Error("Found too few facts about this topic. Try wording it differently.");
  return { sources, facts, queries: allQueries, droppedFacts, usage };
}
