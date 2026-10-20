// Runs topics through the pipeline and reports how much of each script held up in the fact-check, which kinds
// of scene it got, what it cost and how long it took. Prints a table and writes it to the top of docs/eval.md.
// Run with `npm run eval -- 2` for the first 2 topics, or `npm run eval` for all 10. A folder after the count,
// like `npm run eval -- 10 /tmp/runs`, also saves each run there as JSON, to look at the scenes afterwards.
// The voice-over is skipped to save ElevenLabs credits, so video lengths are estimated from the narration.
// The app must be running (npm run dev). It makes paid API calls.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPipeline } from "./pipeline-client.ts";

// Ten topics across history, science, nature, the body and technology, none of them in the feed.
const TOPICS = [
  "The French Revolution",
  "The voyages of Christopher Columbus",
  "The partition of India in 1947",
  "How the Panama Canal was built",
  "How the human eye sees",
  "How photosynthesis works",
  "Why we have seasons",
  "How batteries store energy",
  "How hurricanes form",
  "How the internet sends data",
];
const count = Math.min(Number(process.argv[2]) || TOPICS.length, TOPICS.length);
const saveDir = process.argv[3];
if (saveDir) mkdirSync(saveDir, { recursive: true });

type Row = {
  topic: string;
  error?: string;
  totalSec: number;
  videoSec: number;
  sentences: number;
  supported: number;
  revised: number;
  removed: number;
  facts: number;
  dropped: number;
  kinds: string;
  scenes: number;
  textScenes: number;
  costUsd: number;
  characters: number;
  steps: string;
};

const rows: Row[] = [];
for (const topic of TOPICS.slice(0, count)) {
  console.log(`\n${topic}`);
  const started = Date.now();
  try {
    const run = await runPipeline({ topic, audience: "High school", lengthSec: 90, language: "en" }, { voice: false });
    const { report } = run.factcheck;
    if (saveDir) {
      const file = join(saveDir, `${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
      const { storyboard } = run.directed;
      writeFileSync(file, JSON.stringify({ request: run.request, storyboard, report, facts: run.research.facts, sources: run.research.sources.map(({ id, title, url }) => ({ id, title, url })) }, null, 1));
    }
    const scenes = run.voiced.storyboard.scenes;
    const kinds = new Map<string, number>();
    for (const scene of scenes) kinds.set(scene.kind, (kinds.get(scene.kind) ?? 0) + 1);
    rows.push({
      topic,
      totalSec: run.totalMs / 1000,
      videoSec: scenes.reduce((total, scene) => total + scene.durationSec, 0),
      sentences: report.checks.length,
      supported: report.supported,
      revised: report.revised,
      removed: report.removed,
      facts: run.research.facts.length,
      dropped: run.research.droppedFacts,
      kinds: [...kinds].map(([kind, n]) => `${n} ${kind}`).join(", "),
      scenes: scenes.length,
      textScenes: kinds.get("text") ?? 0,
      costUsd: run.costUsd,
      characters: run.voiced.characters,
      steps: [run.research, run.script, run.factcheck, run.directed].map((step) => (step.ms / 1000).toFixed(1)).join(" / "),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  Failed: ${message}`);
    rows.push({
      topic,
      error: message,
      totalSec: (Date.now() - started) / 1000,
      videoSec: 0,
      sentences: 0,
      supported: 0,
      revised: 0,
      removed: 0,
      facts: 0,
      dropped: 0,
      kinds: "",
      scenes: 0,
      textScenes: 0,
      costUsd: 0,
      characters: 0,
      steps: "",
    });
  }
}

const done = rows.filter((row) => !row.error);
const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");
const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
const allSentences = done.reduce((total, row) => total + row.sentences, 0);

const lines = [
  "# Eval",
  "",
  `Run on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC: ${count} topics, high school audience, 90 seconds each.`,
  "",
  `- Finished: ${done.length} of ${rows.length}`,
  `- Sentences supported as written: ${percent(done.reduce((t, r) => t + r.supported, 0), allSentences)} (revised ${percent(done.reduce((t, r) => t + r.revised, 0), allSentences)}, removed ${percent(done.reduce((t, r) => t + r.removed, 0), allSentences)})`,
  `- Average time per video: ${average(done.map((r) => r.totalSec)).toFixed(1)} s`,
  `- Average Token Factory cost per video: $${average(done.map((r) => r.costUsd)).toFixed(4)}`,
  `- Average narration length: ${Math.round(average(done.map((r) => r.characters)))} characters`,
  `- Scenes shown as plain text: ${percent(done.reduce((t, r) => t + r.textScenes, 0), done.reduce((t, r) => t + r.scenes, 0))}`,
  "",
  "| Topic | Supported | Revised | Removed | Facts (dropped) | Scenes | Video | Time | Steps (s) | Cost |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) =>
    row.error
      ? `| ${row.topic} | Failed: ${row.error.replace(/\|/g, "/").slice(0, 120)} | | | | | | ${row.totalSec.toFixed(1)} s | | |`
      : `| ${row.topic} | ${row.supported}/${row.sentences} | ${row.revised} | ${row.removed} | ${row.facts} (${row.dropped}) | ${row.kinds} | ${Math.round(row.videoSec)} s | ${row.totalSec.toFixed(1)} s | ${row.steps} | $${row.costUsd.toFixed(4)} |`,
  ),
  "",
  "Steps are research / script / fact-check / direct, measured on the server. The voice-over was skipped, so video lengths are estimated from the narration.",
  "Supported means the fact-check found every claim of the sentence in the quotes of its cited facts.",
  "",
];
const markdown = lines.join("\n");
console.log(`\n${markdown}`);
// The sections written by hand below the table (later updates, the trust test) are kept.
const file = new URL("../docs/eval.md", import.meta.url);
const old = existsSync(file) ? readFileSync(file, "utf8") : "";
const kept = old.indexOf("\n## ") >= 0 ? old.slice(old.indexOf("\n## ") + 1) : "";
writeFileSync(file, kept ? `${markdown}\n${kept}` : markdown);
console.log("Saved docs/eval.md");
