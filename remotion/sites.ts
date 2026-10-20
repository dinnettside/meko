// The sites behind each scene's facts. Used by the video's corner note, and by the pages, which load it without the
// rest of the video.
import type { ResearchFact } from "../lib/pipeline.ts";
import type { Storyboard } from "../lib/storyboard.ts";

const MAX_SITES = 2;

const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// The sites behind each scene's facts, by scene ID, at most two each, so the video can show where it comes from.
export function sceneSites(storyboard: Storyboard, facts: Pick<ResearchFact, "id" | "sourceId">[]): Record<string, string[]> {
  const sourceOf = new Map(facts.map((fact) => [fact.id, fact.sourceId]));
  const urlOf = new Map(storyboard.sources.map((source) => [source.id, source.url]));
  return Object.fromEntries(
    storyboard.scenes.map((scene) => {
      const sites = scene.factIds.map((id) => siteOf(urlOf.get(sourceOf.get(id) ?? "") ?? "")).filter(Boolean);
      return [scene.id, [...new Set(sites)].slice(0, MAX_SITES)];
    }),
  );
}
