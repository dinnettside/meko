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

// Sources a trustworthy explainer should rest on: encyclopedias, museums, public bodies and science organizations.
// Tavily prefers them, but other sites can still come up.
export const PREFERRED_DOMAINS = [
  "wikipedia.org", "en.wikipedia.org", "britannica.com", "worldhistory.org", "newworldencyclopedia.org", "encyclopedia.com",
  "history.com", "nationalgeographic.com", "smithsonianmag.com", "si.edu", "khanacademy.org", "bbc.co.uk", "bbc.com",
  "loc.gov", "archives.gov", "metmuseum.org", "britishmuseum.org", "unesco.org", "un.org", "nasa.gov", "nih.gov",
  "cdc.gov", "who.int", "nature.com", "science.org", "ourworldindata.org", "pbs.org", "npr.org", "reuters.com", "apnews.com",
];

// Homework answers, essay mills, Q&A boards, social media and video sites: not sources a video should cite.
// Subdomains are listed too, since Tavily's docs do not say whether a domain covers them.
const EXCLUDED_DOMAINS = [
  "brainly.com", "brainly.in", "chegg.com", "coursehero.com", "quizlet.com", "studocu.com", "study.com", "homework.study.com",
  "numerade.com", "gauthmath.com", "essaypro.com", "samples.essaypro.com", "ivypanda.com", "gradesfixer.com",
  "studymoose.com", "papersowl.com", "edubirdie.com", "ukessays.com", "bartleby.com", "studycorgi.com", "tutorchase.com",
  "vaia.com", "enotes.com", "kibin.com", "phdessay.com", "123helpme.com", "cram.com", "ipl.org", "answers.com",
  "quora.com", "reddit.com", "youtube.com", "tiktok.com", "pinterest.com", "facebook.com", "instagram.com", "x.com",
  "twitter.com", "scribd.com", "medium.com", "preceden.com",
];

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
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      chunks_per_source: 3,
      max_results: 5,
      include_domains: PREFERRED_DOMAINS,
      include_domains_mode: "prefer",
      exclude_domains: EXCLUDED_DOMAINS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed with HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const { results } = SearchResponseSchema.parse(await response.json());
  console.log(`[tavily] "${query}": ${results.length} results, ${Math.round(performance.now() - started)} ms`);
  return results;
}
