// Makes one of the examples behind "Watch an example": runs the pipeline once and saves the finished video,
// with one MP3 per scene, in public/examples. Source texts are left out; titles, links and the short
// quotes behind each fact are kept.
// Run with `npm run make-example -- black-death` while the app is running (npm run dev); without a slug it makes
// the first example. The slugs are in lib/example.ts. It makes paid API calls.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { EXAMPLES } from "../lib/example.ts";
import type { Example } from "../lib/example.ts";
import type { VideoRequest } from "../lib/pipeline.ts";
import { runPipeline } from "./pipeline-client.ts";

const chosen = EXAMPLES.find((example) => example.slug === (process.argv[2] ?? EXAMPLES[0].slug));
if (!chosen) throw new Error(`Unknown example. Use one of: ${EXAMPLES.map((example) => example.slug).join(", ")}`);
const SLUG = chosen.slug;
const REQUEST: VideoRequest = { topic: chosen.topic, audience: "High school", lengthSec: 90, language: "en" };

console.log(`Making the example "${REQUEST.topic}"`);
const run = await runPipeline(REQUEST);
if (run.voiced.skipped) throw new Error(`The example needs a voice, but: ${run.voiced.skipped}`);

const folder = new URL(`../public/examples/${SLUG}/`, import.meta.url);
rmSync(folder, { recursive: true, force: true });
mkdirSync(folder, { recursive: true });
for (const [sceneId, voice] of Object.entries(run.voiced.voice)) {
  const base64 = voice.audio.slice(voice.audio.indexOf(",") + 1);
  writeFileSync(new URL(`${sceneId}.mp3`, folder), Buffer.from(base64, "base64"));
}

const example: Example = {
  request: REQUEST,
  madeAt: new Date().toISOString(),
  ms: run.totalMs,
  costUsd: run.costUsd,
  storyboard: run.voiced.storyboard,
  words: Object.fromEntries(Object.entries(run.voiced.voice).map(([sceneId, voice]) => [sceneId, voice.words])),
  report: run.factcheck.report,
  facts: run.research.facts,
  sources: run.research.sources.map(({ id, title, url }) => ({ id, title, url })),
};
writeFileSync(new URL(`../public/examples/${SLUG}.json`, import.meta.url), `${JSON.stringify(example, null, 1)}\n`);
console.log(
  `Saved public/examples/${SLUG}.json and ${Object.keys(run.voiced.voice).length} MP3s. ` +
    `${(run.totalMs / 1000).toFixed(1)} s, $${run.costUsd.toFixed(4)}, ${run.voiced.characters} characters of voice.`,
);
