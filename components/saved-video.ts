import type { Example } from "@/lib/example";
import type { FactCheckReport, ResearchFact } from "@/lib/pipeline";
import type { Source, Storyboard } from "@/lib/storyboard";
import type { SceneVoice } from "@/lib/voice";

// A finished video ready to play: its storyboard, its voice per scene, and its fact-check, facts and sources.
export type SavedVideo = {
  storyboard: Storyboard;
  voice: Record<string, SceneVoice>;
  report: FactCheckReport;
  facts: ResearchFact[];
  sources: Source[]; // every source research read
  costUsd: number;
  tokens?: number;
  ms: number;
  example?: { topic: string; madeAt: string };
};

// A video saved as files in public/examples: the JSON, and one MP3 per scene next to it.
export async function loadSavedVideo(slug: string): Promise<SavedVideo> {
  const response = await fetch(`/examples/${slug}.json`);
  if (!response.ok) throw new Error(`The video "${slug}" could not be loaded.`);
  const example = (await response.json()) as Example;
  return {
    storyboard: example.storyboard,
    voice: Object.fromEntries(
      example.storyboard.scenes.map((scene) => [scene.id, { audio: `/examples/${slug}/${scene.id}.mp3`, words: example.words[scene.id] ?? [] }]),
    ),
    report: example.report,
    facts: example.facts,
    sources: example.sources,
    costUsd: example.costUsd,
    tokens: example.tokens,
    ms: example.ms,
    example: { topic: example.request.topic, madeAt: example.madeAt },
  };
}
