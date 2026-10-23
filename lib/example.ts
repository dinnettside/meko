import type { TimedWord } from "./elevenlabs.ts";
import type { FactCheckReport, ResearchFact, VideoRequest } from "./pipeline.ts";
import type { Source, Storyboard } from "./storyboard.ts";
import { storyboardFrames } from "../remotion/timing.ts";

// The videos in the feed, in order. Each is made by `npm run make-example -- <slug>`, as a one-minute video. The order
// keeps neighbours apart: no two videos in a row have the same look, and history and science take turns where they can.
// `npm run vary-examples` then picks their openings and looks for this order.
export const EXAMPLES = [
  { slug: "black-death", topic: "The Black Death" },
  { slug: "earthquakes", topic: "Why earthquakes happen" },
  { slug: "vaccines", topic: "How vaccines work" },
  { slug: "silk-road", topic: "The Silk Road" },
  { slug: "neural-networks", topic: "How neural networks learn" },
  { slug: "heart", topic: "How the heart pumps blood" },
  { slug: "berlin-wall", topic: "The fall of the Berlin Wall" },
  { slug: "volcanoes", topic: "How volcanoes erupt" },
  { slug: "apollo-11", topic: "The Apollo 11 Moon landing" },
  { slug: "airplanes", topic: "How do airplanes fly?" },
];

// What the feed shows under a video: how long it is, how many sources it cites and how its sentences fared.
export type ExampleMeta = { slug: string; topic: string; seconds: number; sources: number; supported: number; revised: number; removed: number; sentences: number };

// The fact-check in a few words: "7 sentences checked, all supported" or "8 sentences checked, 4 rewritten to match the
// sources". A rewrite is the check at work, so it is named for what it did.
export function checkedLine({ sentences, revised, removed }: { sentences: number; revised: number; removed: number }): string {
  const changes = [revised > 0 ? `${revised} rewritten to match the sources` : "", removed > 0 ? `${removed} removed` : ""].filter(Boolean);
  return `${sentences} sentences checked, ${changes.length > 0 ? changes.join(" and ") : "all supported"}`;
}

export function exampleMeta(slug: string, example: Example): ExampleMeta {
  return {
    slug,
    topic: example.request.topic,
    // As long as the player makes it, with the dissolves between scenes and the credits, in whole seconds as it shows it.
    seconds: Math.floor(storyboardFrames(example.storyboard) / example.storyboard.fps),
    sources: example.storyboard.sources.length,
    supported: example.report.supported,
    revised: example.report.revised,
    removed: example.report.removed,
    sentences: example.report.checks.length,
  };
}

// A video in the feed, as the feed page gets it from the server: what it shows under the video, and the text it is
// searched by (its title, topic, narration and source titles).
export type FeedItem = ExampleMeta & {
  title: string;
  madeAt: string; // ISO date
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
    madeAt: example.madeAt,
    costUsd: example.costUsd,
    ms: example.ms,
    tokens: example.tokens,
    domains: [...new Set(sources.map((source) => hostname(source.url)))].slice(0, 3),
    searchText: [example.storyboard.title, example.request.topic, ...example.storyboard.scenes.map((scene) => scene.narration), ...sources.map((source) => source.title)]
      .join(" ")
      .toLowerCase(),
  };
}

// The day a video was made, like "Oct 18". The feed's videos are older runs, so their time and cost say when they were
// made: Meko has become cheaper since.
export const madeOn = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

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
