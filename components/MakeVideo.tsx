"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { DirectResult } from "@/lib/direct";
import type { FactCheckResult } from "@/lib/factcheck";
import type { VideoRequest } from "@/lib/pipeline";
import type { ResearchResult } from "@/lib/research";
import type { ScriptResult } from "@/lib/script";
import type { Source, Storyboard } from "@/lib/storyboard";
import type { SceneVoice, VoiceResult } from "@/lib/voice";
import { StoryboardPlayer } from "./StoryboardPlayer";

type StepId = "research" | "script" | "factcheck" | "direct" | "voice";
type StepState = {
  status: "waiting" | "running" | "done" | "skipped" | "failed";
  detail?: string;
  startedAt?: number;
  ms?: number;
};
type Timed<T> = T & { ms: number };
type Finished = { storyboard: Storyboard; voice: Record<string, SceneVoice>; costUsd: number; ms: number };

const STEPS: { id: StepId; label: string }[] = [
  { id: "research", label: "Research the topic" },
  { id: "script", label: "Write the script" },
  { id: "factcheck", label: "Fact-check every sentence" },
  { id: "direct", label: "Direct the scenes" },
  { id: "voice", label: "Record the voice-over" },
];

const AUDIENCES = ["Kids (8 to 12)", "High school", "Adults"];
const LENGTHS = [60, 90, 120];

const waitingSteps = (): Record<StepId, StepState> => ({
  research: { status: "waiting" },
  script: { status: "waiting" },
  factcheck: { status: "waiting" },
  direct: { status: "waiting" },
  voice: { status: "waiting" },
});

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<Timed<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error ?? `The server answered with HTTP ${response.status}.`);
  return json as Timed<T>;
}

export function MakeVideo() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[1]);
  const [lengthSec, setLengthSec] = useState(90);
  const [steps, setSteps] = useState(waitingSteps);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Ticks while the pipeline runs, so the time of the current step counts up.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);

  const setStep = (id: StepId, state: StepState) => setSteps((current) => ({ ...current, [id]: state }));

  async function runStep<T>(
    id: StepId,
    url: string,
    body: unknown,
    describe: (result: Timed<T>) => string,
  ): Promise<Timed<T>> {
    setStep(id, { status: "running", startedAt: Date.now() });
    try {
      const result = await postJson<T>(url, body);
      setStep(id, { status: "done", ms: result.ms, detail: describe(result) });
      return result;
    } catch (error) {
      setStep(id, { status: "failed", detail: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async function makeVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    setStarted(true);
    setRunning(true);
    setFinished(null);
    setSteps(waitingSteps());
    const startedAt = Date.now();
    const request: VideoRequest = { topic: topic.trim(), audience, lengthSec, language: "en" };

    try {
      const research = await runStep<ResearchResult>(
        "research",
        "/api/research",
        request,
        (result) => `${result.sources.length} sources, ${result.facts.length} facts with quotes`,
      );
      const script = await runStep<ScriptResult>(
        "script",
        "/api/script",
        { request, facts: research.facts },
        (result) => {
          const words = countWords(result.script.scenes.flatMap((scene) => scene.sentences.map((s) => s.text)).join(" "));
          return `${result.script.scenes.length} scenes, ${words} words`;
        },
      );
      const checked = await runStep<FactCheckResult>(
        "factcheck",
        "/api/factcheck",
        { script: script.script, facts: research.facts },
        ({ report }) => `${report.supported} supported, ${report.revised} revised, ${report.removed} removed`,
      );
      const sources: Source[] = research.sources.map(({ id, title, url }) => ({ id, title, url }));
      const directed = await runStep<DirectResult>(
        "direct",
        "/api/direct",
        { request, script: checked.script, facts: research.facts, sources },
        ({ storyboard }) => {
          const seconds = storyboard.scenes.reduce((total, scene) => total + scene.durationSec, 0);
          return `${storyboard.scenes.length} scenes, ${Math.round(seconds)} seconds`;
        },
      );
      const costUsd = [research, script, checked, directed].reduce((total, step) => total + step.usage.costUsd, 0);

      // Without a voice the video still works, silent with captions.
      let storyboard = directed.storyboard;
      let voice: Record<string, SceneVoice> = {};
      try {
        const voiced = await runStep<VoiceResult>("voice", "/api/voice", { storyboard }, (result) => {
          const seconds = result.storyboard.scenes.reduce((total, scene) => total + scene.durationSec, 0);
          return `${result.characters} characters, ${Math.round(seconds)} seconds`;
        });
        if (voiced.skipped) {
          setStep("voice", { status: "skipped", detail: voiced.skipped });
        } else {
          storyboard = voiced.storyboard;
          voice = voiced.voice;
        }
      } catch {
        // The voice step shows its own error.
      }
      setFinished({ storyboard, voice, costUsd, ms: Date.now() - startedAt });
    } catch {
      // The step that failed shows its own error.
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8">
      <header>
        <h1 className="font-display text-5xl font-bold">Meko</h1>
        <p className="mt-3 text-lg text-dim">
          Turn a topic into a short, fact-checked explainer video.
        </p>
      </header>

      <form onSubmit={makeVideo} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-dim">Topic</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="The French Revolution"
            className="rounded border border-line bg-ink px-3 py-2 text-paper"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-dim">Audience</span>
          <select
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            className="rounded border border-line bg-ink px-3 py-2 text-paper"
          >
            {AUDIENCES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-dim">Length</span>
          <select
            value={lengthSec}
            onChange={(event) => setLengthSec(Number(event.target.value))}
            className="rounded border border-line bg-ink px-3 py-2 text-paper"
          >
            {LENGTHS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} seconds
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={running}
          className="rounded bg-signal px-5 py-2 font-semibold text-ink disabled:opacity-50"
        >
          {running ? "Making video…" : "Make video"}
        </button>
      </form>

      {started ? (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {STEPS.map(({ id, label }) => (
            <StepRow key={id} label={label} state={steps[id]} now={now} />
          ))}
        </ol>
      ) : null}

      {finished ? (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <StoryboardPlayer storyboard={finished.storyboard} voice={finished.voice} />
            <p className="mt-2 text-sm text-dim">
              Made in {Math.round(finished.ms / 1000)} seconds. Model cost ${finished.costUsd.toFixed(3)}.
            </p>
          </div>
          <aside>
            <h2 className="font-display text-2xl font-bold">Sources</h2>
            <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
              {finished.storyboard.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 hover:decoration-signal">
                    {source.title}
                  </a>{" "}
                  <span className="text-sm text-dim">{hostname(source.url)}</span>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      ) : null}
    </main>
  );
}

function StepRow({ label, state, now }: { label: string; state: StepState; now: number }) {
  const elapsed = state.startedAt ? Math.max(0, (now - state.startedAt) / 1000) : 0;
  const status = {
    waiting: { mark: "○", text: "" },
    running: { mark: "…", text: `${elapsed.toFixed(0)} s` },
    done: { mark: "✓", text: `${((state.ms ?? 0) / 1000).toFixed(1)} s · ${state.detail ?? ""}` },
    skipped: { mark: "–", text: state.detail ?? "Skipped" },
    failed: { mark: "✕", text: state.detail ?? "Failed" },
  }[state.status];
  return (
    <li className={`flex gap-3 ${state.status === "waiting" ? "text-dim/60" : ""}`}>
      <span className={`w-4 text-center ${state.status === "done" ? "text-teal" : ""}`} aria-hidden>
        {status.mark}
      </span>
      <span className="font-medium">{label}</span>
      <span className={state.status === "failed" ? "text-alert" : "text-dim"}>{status.text}</span>
    </li>
  );
}
