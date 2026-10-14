// Runs the whole Meko pipeline through the app's API routes, the same way the browser does.
// Used by scripts/eval.ts and scripts/make-example.ts. The app must be running (npm run dev).

import type { DirectResult } from "../lib/direct.ts";
import type { FactCheckResult } from "../lib/factcheck.ts";
import type { VideoRequest } from "../lib/pipeline.ts";
import type { ResearchResult } from "../lib/research.ts";
import type { ScriptResult } from "../lib/script.ts";
import type { Source } from "../lib/storyboard.ts";
import type { VoiceResult } from "../lib/voice.ts";

const BASE_URL = process.env.MEKO_URL ?? "http://localhost:3000";

type Timed<T> = T & { ms: number };

export type PipelineRun = {
  request: VideoRequest;
  research: Timed<ResearchResult>;
  script: Timed<ScriptResult>;
  factcheck: Timed<FactCheckResult>;
  directed: Timed<DirectResult>;
  voiced: Timed<VoiceResult>;
  totalMs: number;
  costUsd: number; // Token Factory, all steps
};

// The timeouts are a little longer than each route's maxDuration.
async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<Timed<T>> {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    // The hosted demo needs its demo code; locally there is usually none.
    headers: { "Content-Type": "application/json", ...(process.env.DEMO_CODE ? { "x-demo-code": process.env.DEMO_CODE } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}: ${json.error ?? "no details"}`);
  console.log(`  ${path}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return json as Timed<T>;
}

// `voice: false` skips the voice-over, to save ElevenLabs credits when only the script and pictures matter.
export async function runPipeline(request: VideoRequest, { voice = true }: { voice?: boolean } = {}): Promise<PipelineRun> {
  const started = Date.now();
  const research = await post<ResearchResult>("/api/research", request, 190_000);
  const script = await post<ScriptResult>("/api/script", { request, facts: research.facts }, 130_000);
  const factcheck = await post<FactCheckResult>("/api/factcheck", { script: script.script, facts: research.facts }, 130_000);
  const sources: Source[] = research.sources.map(({ id, title, url }) => ({ id, title, url }));
  const directed = await post<DirectResult>(
    "/api/direct",
    { request, script: factcheck.script, facts: research.facts, sources },
    130_000,
  );
  const voiced: Timed<VoiceResult> = voice
    ? await post<VoiceResult>("/api/voice", { storyboard: directed.storyboard }, 100_000)
    : {
        storyboard: directed.storyboard,
        voice: {},
        characters: directed.storyboard.scenes.reduce((total, scene) => total + scene.narration.length, 0),
        skipped: "The voice-over was skipped.",
        ms: 0,
      };
  const costUsd = [research, script, factcheck, directed].reduce((total, step) => total + step.usage.costUsd, 0);
  return { request, research, script, factcheck, directed, voiced, totalMs: Date.now() - started, costUsd };
}
