import { z } from "zod";

// Web search with Tavily, called over plain HTTP (https://docs.tavily.com).
// Without TAVILY_API_KEY it uses Tavily's free keyless mode, which is rate-limited and only meant for development.

const SEARCH_URL = "https://api.tavily.com/search";
const TIMEOUT_MS = 20_000;

const SearchResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number(),
    }),
  ),
});

export type SearchResult = z.infer<typeof SearchResponseSchema>["results"][number];

function headers(): Record<string, string> {
  const apiKey = process.env.TAVILY_API_KEY;
  return apiKey
    ? { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
    : { "Content-Type": "application/json", "X-Tavily-Access-Mode": "keyless" };
}

// Advanced search costs 2 credits and returns up to 3 relevant passages per page in `content`.
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const started = performance.now();
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, search_depth: "advanced", chunks_per_source: 3, max_results: 5 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed with HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const { results } = SearchResponseSchema.parse(await response.json());
  console.log(`[tavily] "${query}": ${results.length} results, ${Math.round(performance.now() - started)} ms`);
  return results;
}
