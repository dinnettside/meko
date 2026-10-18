import type { TimedWord } from "./elevenlabs.ts";
import type { FactCheckReport, ResearchFact, VideoRequest } from "./pipeline.ts";
import type { Source, Storyboard } from "./storyboard.ts";

// The examples on the start page, in order. Each is made by `npm run make-example -- <slug>`.
export const EXAMPLES = [
  { slug: "silk-road", topic: "The Silk Road" },
  { slug: "black-death", topic: "The Black Death" },
  { slug: "french-revolution", topic: "The French Revolution" },
  { slug: "apollo-11", topic: "The Apollo 11 Moon landing" },
];

// What the gallery shows under an example: how long it is, how many sources it cites and how its sentences fared.
export type ExampleMeta = { slug: string; topic: string; seconds: number; sources: number; supported: number; sentences: number };

// Six seconds of credits follow the last scene.
const CREDITS_SEC = 6;

export function exampleMeta(slug: string, example: Example): ExampleMeta {
  return {
    slug,
    topic: example.request.topic,
    seconds: Math.round(example.storyboard.scenes.reduce((total, scene) => total + scene.durationSec, 0) + CREDITS_SEC),
    sources: example.storyboard.sources.length,
    supported: example.report.supported,
    sentences: example.report.checks.length,
  };
}

// A video in the feed, as the feed page gets it from the server: what it shows under the video, and the text it is
// searched by (its title, topic, narration and source titles).
export type FeedItem = ExampleMeta & {
  title: string;
  costUsd: number;
  ms: number;
  tokens?: number;
  domains: string[]; // the sites of its first sources
  searchText: string;
};

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function feedItem(slug: string, example: Example): FeedItem {
  const sources = example.storyboard.sources;
  return {
    ...exampleMeta(slug, example),
    title: example.storyboard.title,
    costUsd: example.costUsd,
    ms: example.ms,
    tokens: example.tokens,
    domains: [...new Set(sources.map((source) => hostname(source.url)))].slice(0, 3),
    searchText: [example.storyboard.title, example.request.topic, ...example.storyboard.scenes.map((scene) => scene.narration), ...sources.map((source) => source.title)]
      .join(" ")
      .toLowerCase(),
  };
}

// A finished video saved as files, for "Watch an example". Made by scripts/make-example.ts.
// The MP3 for each scene sits next to the JSON, in public/examples/<slug>/<scene id>.mp3.
export type Example = {
  request: VideoRequest;
  madeAt: string; // ISO date
  ms: number; // how long the whole pipeline took
  costUsd: number; // Token Factory cost of the run
  tokens?: number; // tokens the models read and wrote for it, which watching it again saves
  storyboard: Storyboard;
  words: Record<string, TimedWord[]>; // by scene ID
  report: FactCheckReport;
  facts: ResearchFact[];
  sources: Source[]; // every source research read, also ones the final video does not use
};
