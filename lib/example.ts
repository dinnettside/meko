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

// A finished video saved as files, for "Watch an example". Made by scripts/make-example.ts.
// The MP3 for each scene sits next to the JSON, in public/examples/<slug>/<scene id>.mp3.
export type Example = {
  request: VideoRequest;
  madeAt: string; // ISO date
  ms: number; // how long the whole pipeline took
  costUsd: number; // Token Factory cost of the run
  storyboard: Storyboard;
  words: Record<string, TimedWord[]>; // by scene ID
  report: FactCheckReport;
  facts: ResearchFact[];
  sources: Source[]; // every source research read, also ones the final video does not use
};
