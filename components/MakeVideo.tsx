"use client";

import type { PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { DirectResult } from "@/lib/direct";
import type { Example } from "@/lib/example";
import type { FactCheckResult } from "@/lib/factcheck";
import type { FactCheckReport as Report, ResearchFact, VideoRequest } from "@/lib/pipeline";
import type { ResearchResult } from "@/lib/research";
import type { ScriptResult } from "@/lib/script";
import type { Source, Storyboard } from "@/lib/storyboard";
import type { SceneVoice, VoiceResult } from "@/lib/voice";
import { FactCheckReport } from "./FactCheckReport";
import { sentenceSpans } from "./sentence-timing";
import { StoryboardPlayer } from "./StoryboardPlayer";

type StepId = "research" | "script" | "factcheck" | "direct" | "voice";
type StepState = {
  status: "waiting" | "running" | "done" | "skipped" | "failed";
  detail?: string;
  startedAt?: number;
  ms?: number;
};
type Timed<T> = T & { ms: number };

// The results so far, kept so "Try again" can go on from the step that failed.
type Progress = {
  request: VideoRequest;
  startedAt: number;
  research?: Timed<ResearchResult>;
  script?: Timed<ScriptResult>;
  checked?: Timed<FactCheckResult>;
  directed?: Timed<DirectResult>;
};

type Finished = {
  storyboard: Storyboard;
  voice: Record<string, SceneVoice>;
  report: Report;
  facts: ResearchFact[];
  sources: Source[]; // every source research read
  costUsd: number;
  ms: number;
  example?: { topic: string; madeAt: string };
};

// Timeouts are a little longer than each route's maxDuration on the server.
const STEPS: { id: StepId; label: string; timeoutMs: number }[] = [
  { id: "research", label: "Research the topic", timeoutMs: 190_000 },
  { id: "script", label: "Write the script", timeoutMs: 130_000 },
  { id: "factcheck", label: "Fact-check every sentence", timeoutMs: 130_000 },
  { id: "direct", label: "Direct the scenes", timeoutMs: 130_000 },
  { id: "voice", label: "Record the voice-over", timeoutMs: 100_000 },
];

const AUDIENCES = ["Kids (8 to 12)", "High school", "Adults"];
const LENGTHS = [60, 90, 120];
const EXAMPLE = { json: "/examples/silk-road.json", audioFolder: "/examples/silk-road" };

const waitingSteps = () =>
  Object.fromEntries(STEPS.map((step) => [step.id, { status: "waiting" }])) as Record<StepId, StepState>;

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The saved example video, ready to play.
async function loadExample(): Promise<Finished> {
  const response = await fetch(EXAMPLE.json);
  const example = (await response.json()) as Example;
  return {
    storyboard: example.storyboard,
    voice: Object.fromEntries(
      example.storyboard.scenes.map((scene) => [
        scene.id,
        { audio: `${EXAMPLE.audioFolder}/${scene.id}.mp3`, words: example.words[scene.id] ?? [] },
      ]),
    ),
    report: example.report,
    facts: example.facts,
    sources: example.sources,
    costUsd: example.costUsd,
    ms: example.ms,
    example: { topic: example.request.topic, madeAt: example.madeAt },
  };
}

// Turns network and server errors into a sentence people can act on.
async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<Timed<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("This step took too long and was stopped.");
    }
    throw new Error("Could not reach the server. Check your connection.");
  }
  const json = await response.json().catch(() => null);
  const message: string = json?.error ?? "";
  if (response.status === 429 || /\b429\b/.test(message)) {
    throw new Error("Too many requests right now. Wait a minute, then try again.");
  }
  if (!response.ok) {
    throw new Error(message ? `Something went wrong: ${message.slice(0, 220)}` : `The server answered with HTTP ${response.status}.`);
  }
  return json as Timed<T>;
}

export function MakeVideo() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[1]);
  const [lengthSec, setLengthSec] = useState(90);
  const [steps, setSteps] = useState(waitingSteps);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<{ step: StepId; message: string } | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const progress = useRef<Progress | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  // Ticks while the pipeline runs, so the time of the current step counts up.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);

  // Follows the video and marks the sentence being spoken in the fact-check report.
  const spans = useMemo(
    () => (finished ? sentenceSpans(finished.storyboard, finished.voice, finished.report.checks) : []),
    [finished],
  );
  useEffect(() => {
    const player = playerRef.current;
    if (!player || spans.length === 0) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      setActiveSentence(spans.findLast((span) => span.startFrame <= detail.frame)?.sentenceId ?? null);
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [spans]);

  function playFrom(sentenceId: string) {
    const span = spans.find((candidate) => candidate.sentenceId === sentenceId);
    if (!span || !playerRef.current) return;
    playerRef.current.seekTo(span.startFrame);
    playerRef.current.play();
  }

  const setStep = (id: StepId, state: StepState) => setSteps((current) => ({ ...current, [id]: state }));

  async function runStep<T>(id: StepId, url: string, body: unknown, describe: (result: Timed<T>) => string) {
    const timeoutMs = STEPS.find((candidate) => candidate.id === id)?.timeoutMs ?? 130_000;
    setStep(id, { status: "running", startedAt: Date.now() });
    try {
      const result = await postJson<T>(url, body, timeoutMs);
      setStep(id, { status: "done", ms: result.ms, detail: describe(result) });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStep(id, { status: "failed", detail: message });
      setFailed({ step: id, message });
      throw error;
    }
  }

  // Runs the pipeline from `first` on, reusing the results of the steps before it.
  async function runFrom(first: StepId, saved: Progress) {
    const order = STEPS.map((step) => step.id);
    const runs = (id: StepId) => order.indexOf(id) >= order.indexOf(first);
    const state = { ...saved };
    progress.current = state;
    setRunning(true);
    setFailed(null);
    try {
      const research = runs("research")
        ? await runStep<ResearchResult>(
            "research",
            "/api/research",
            state.request,
            (result) => `${result.sources.length} sources, ${result.facts.length} facts with quotes`,
          )
        : state.research;
      if (!research) throw new Error("Research is missing.");
      state.research = research;

      const script = runs("script")
        ? await runStep<ScriptResult>("script", "/api/script", { request: state.request, facts: research.facts }, (result) => {
            const words = countWords(result.script.scenes.flatMap((scene) => scene.sentences.map((s) => s.text)).join(" "));
            return `${result.script.scenes.length} scenes, ${words} words`;
          })
        : state.script;
      if (!script) throw new Error("The script is missing.");
      state.script = script;

      const checked = runs("factcheck")
        ? await runStep<FactCheckResult>(
            "factcheck",
            "/api/factcheck",
            { script: script.script, facts: research.facts },
            ({ report }) => `${report.supported} supported, ${report.revised} revised, ${report.removed} removed`,
          )
        : state.checked;
      if (!checked) throw new Error("The fact-check is missing.");
      state.checked = checked;

      const sources: Source[] = research.sources.map(({ id, title, url }) => ({ id, title, url }));
      const directed = runs("direct")
        ? await runStep<DirectResult>(
            "direct",
            "/api/direct",
            { request: state.request, script: checked.script, facts: research.facts, sources },
            ({ storyboard }) => {
              const kinds = new Set(storyboard.scenes.map((scene) => scene.kind));
              return `${storyboard.scenes.length} scenes: ${[...kinds].join(", ")}`;
            },
          )
        : state.directed;
      if (!directed) throw new Error("The storyboard is missing.");
      state.directed = directed;

      const costUsd = [research, script, checked, directed].reduce((total, step) => total + step.usage.costUsd, 0);
      const base = { report: checked.report, facts: research.facts, sources, costUsd };
      // The video works without a voice too: silent, with captions. So a failed voice still shows the video.
      try {
        const voiced = await runStep<VoiceResult>("voice", "/api/voice", { storyboard: directed.storyboard }, (result) => {
          const seconds = result.storyboard.scenes.reduce((total, scene) => total + scene.durationSec, 0);
          return `${result.characters} characters, ${Math.round(seconds)} seconds`;
        });
        if (voiced.skipped) setStep("voice", { status: "skipped", detail: voiced.skipped });
        setFinished({
          ...base,
          storyboard: voiced.skipped ? directed.storyboard : voiced.storyboard,
          voice: voiced.voice,
          ms: Date.now() - state.startedAt,
        });
      } catch {
        setFinished({ ...base, storyboard: directed.storyboard, voice: {}, ms: Date.now() - state.startedAt });
      }
    } catch {
      // The step that failed shows its own error and a "Try again" button.
    } finally {
      setRunning(false);
    }
  }

  function makeVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    setStarted(true);
    setFinished(null);
    setActiveSentence(null);
    setSteps(waitingSteps());
    void runFrom("research", {
      request: { topic: topic.trim(), audience, lengthSec, language: "en" },
      startedAt: Date.now(),
    });
  }

  function tryAgain() {
    if (!failed || !progress.current || running) return;
    setStep(failed.step, { status: "waiting" });
    void runFrom(failed.step, progress.current);
  }

  async function watchExample() {
    if (running) return;
    setStarted(false);
    setFailed(null);
    setActiveSentence(null);
    setFinished(await loadExample());
  }

  // A link to /?example opens the example straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("example")) void loadExample().then(setFinished);
  }, []);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8">
      <header>
        <h1 className="font-display text-5xl font-bold">Meko</h1>
        <p className="mt-3 text-lg text-dim">Turn a topic into a short, fact-checked explainer video.</p>
      </header>

      <div className="flex flex-col gap-3">
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
        <p className="text-sm text-dim">
          Takes under a minute.{" "}
          <button
            type="button"
            onClick={watchExample}
            disabled={running}
            className="underline decoration-line underline-offset-4 hover:decoration-signal disabled:opacity-50"
          >
            Watch an example about the Silk Road
          </button>
        </p>
      </div>

      {started ? (
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2" aria-live="polite">
            {STEPS.map(({ id, label }) => (
              <StepRow key={id} label={label} state={steps[id]} now={now} />
            ))}
          </ol>
          {failed && !running ? (
            <div className="flex flex-wrap items-center gap-3 border-l-4 border-alert py-1 pl-4" role="alert">
              <span>
                {failed.step === "voice"
                  ? "The voice-over failed, so the video plays without sound."
                  : `${STEPS.find((step) => step.id === failed.step)?.label} failed.`}
              </span>
              <button
                type="button"
                onClick={tryAgain}
                className="rounded border border-line px-3 py-1 text-sm font-semibold hover:border-signal"
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {finished ? (
        <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <div className="flex min-w-0 flex-col gap-4">
            {finished.example ? (
              <p className="text-sm text-dim">
                Example: “{finished.example.topic}”, made by Meko on{" "}
                {new Date(finished.example.madeAt).toLocaleDateString("en-GB", { dateStyle: "long" })}.
              </p>
            ) : null}
            <StoryboardPlayer storyboard={finished.storyboard} voice={finished.voice} playerRef={playerRef} />
            <p className="text-sm text-dim">
              Made in {Math.round(finished.ms / 1000)} seconds. Model cost ${finished.costUsd.toFixed(3)}.
            </p>
            <div>
              <h2 className="font-display text-2xl font-bold">Sources</h2>
              <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 break-words">
                {finished.storyboard.sources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-line underline-offset-4 hover:decoration-signal"
                    >
                      {source.title}
                    </a>{" "}
                    <span className="text-sm text-dim">{hostname(source.url)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <FactCheckReport
            report={finished.report}
            facts={finished.facts}
            sources={finished.sources}
            numbered={finished.storyboard.sources}
            activeSentenceId={activeSentence}
            onSelect={playFrom}
          />
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
      <span className={`w-4 shrink-0 text-center ${state.status === "done" ? "text-teal" : ""}`} aria-hidden>
        {status.mark}
      </span>
      <span className="shrink-0 font-medium">{label}</span>
      <span className={state.status === "failed" ? "text-alert" : "text-dim"}>{status.text}</span>
    </li>
  );
}
