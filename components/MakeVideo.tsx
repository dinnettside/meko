"use client";

import type { PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { DirectResult } from "@/lib/direct";
import { EXAMPLES } from "@/lib/example";
import type { Example } from "@/lib/example";
import type { LibraryVideo } from "@/lib/library";
import type { FactCheckResult } from "@/lib/factcheck";
import type { FactCheckReport as Report, ResearchFact, VideoRequest } from "@/lib/pipeline";
import type { ResearchResult } from "@/lib/research";
import type { ScriptResult } from "@/lib/script";
import type { Source, Storyboard } from "@/lib/storyboard";
import type { SceneVoice, VoiceResult } from "@/lib/voice";
import { FactCheckReport } from "./FactCheckReport";
import { HowItWorks } from "./HowItWorks";
import { sentenceSpans } from "./sentence-timing";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { StoryboardPlayer } from "./StoryboardPlayer";
import { sceneSites } from "@/remotion/SourceChip";

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
  tokens?: number; // tokens the models read and wrote for it
  ms: number;
  example?: { topic: string; madeAt: string };
  library?: { madeAt: string }; // when the video comes from the library, made earlier for the same request
};

// Timeouts are a little longer than each route's maxDuration on the server.
const STEPS: { id: StepId; label: string; timeoutMs: number }[] = [
  { id: "research", label: "Research the topic", timeoutMs: 190_000 },
  { id: "script", label: "Write the script", timeoutMs: 130_000 },
  { id: "factcheck", label: "Fact-check every sentence", timeoutMs: 130_000 },
  { id: "direct", label: "Direct the scenes", timeoutMs: 130_000 },
  { id: "voice", label: "Record the voice-over", timeoutMs: 100_000 },
];

// The audiences as the form's sentence says them ("Explain ... to high school students") and as the pipeline gets them.
const AUDIENCES = [
  { value: "Kids (8 to 12)", label: "kids aged 8 to 12" },
  { value: "High school", label: "high school students" },
  { value: "Adults", label: "adults" },
];
const SUGGESTIONS = ["The Black Death", "How vaccines work", "How do airplanes fly?", "The fall of the Berlin Wall"];
const LENGTHS = [60, 90, 120];

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

// A video from the library, ready to play: its MP3s are files in the library's storage.
function fromLibrary(video: LibraryVideo): Finished {
  return {
    storyboard: video.storyboard,
    voice: Object.fromEntries(video.storyboard.scenes.map((scene) => [scene.id, { audio: video.audio[scene.id], words: video.words[scene.id] ?? [] }])),
    report: video.report,
    facts: video.facts,
    sources: video.sources,
    costUsd: video.costUsd,
    tokens: video.tokens,
    ms: video.ms,
    library: { madeAt: video.madeAt },
  };
}

// A finished video of the same request from the library, or null. A library that cannot be reached counts as none.
async function findInLibrary(request: VideoRequest): Promise<LibraryVideo | null> {
  try {
    const response = await fetch("/api/library/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return ((await response.json()) as { video: LibraryVideo | null }).video;
  } catch {
    return null;
  }
}

// A saved example video, ready to play.
async function loadExample(slug: string): Promise<Finished> {
  const response = await fetch(`/examples/${slug}.json`);
  if (!response.ok) throw new Error(`The example "${slug}" could not be loaded.`);
  const example = (await response.json()) as Example;
  return {
    storyboard: example.storyboard,
    voice: Object.fromEntries(
      example.storyboard.scenes.map((scene) => [
        scene.id,
        { audio: `/examples/${slug}/${scene.id}.mp3`, words: example.words[scene.id] ?? [] },
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

// A step the server refused for its demo code, so the form can ask for one.
class CodeError extends Error {}

// Turns network and server errors into a sentence people can act on.
async function postJson<T>(url: string, body: unknown, timeoutMs: number, demoCode: string): Promise<Timed<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(demoCode ? { "x-demo-code": demoCode } : {}) },
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
  if (response.status === 401) {
    throw new CodeError(demoCode ? "That demo code is not right. Check it and try again." : "Making a video needs the demo code. Enter it next to the button.");
  }
  // The site has no demo code set up, so no code can work. Its message says so, rather than blaming the code typed.
  if (response.status === 503 && message) throw new Error(message);
  if (response.status === 429 || /\b429\b/.test(message)) {
    throw new Error("Too many requests right now. Wait a minute, then try again.");
  }
  if (!response.ok) {
    throw new Error(message ? `Something went wrong: ${message.slice(0, 220)}` : `The server answered with HTTP ${response.status}.`);
  }
  return json as Timed<T>;
}

const DEMO_CODE_KEY = "meko-demo-code";

// `codeRequired` is true on the hosted demo, where making a video needs a demo code.
export function MakeVideo({ codeRequired }: { codeRequired: boolean }) {
  const [topic, setTopic] = useState("");
  // Remembered from the last code the server accepted in this browser. The page is prerendered without it, so the
  // field fills in on the client; storage can be blocked, and then it starts empty.
  const [demoCode, setDemoCode] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(DEMO_CODE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [audience, setAudience] = useState(AUDIENCES[1].value);
  const [lengthSec, setLengthSec] = useState(90);
  const [steps, setSteps] = useState(waitingSteps);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<{ step: StepId; message: string } | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const [tab, setTab] = useState<"factcheck" | "sources">("factcheck");
  // Whether the form shows the demo code field: on the hosted demo from the start, and anywhere once a step asks for it.
  const [needsCode, setNeedsCode] = useState(codeRequired);
  const [asked, setAsked] = useState<VideoRequest | null>(null); // what the video being made is about
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
  const sites = useMemo(() => (finished ? sceneSites(finished.storyboard, finished.facts) : {}), [finished]);
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

  // Remembered in this browser once a step has accepted it, so the code is only typed once and a mistyped one is
  // never kept, also when it is fixed before "Try again". Storage can be blocked, and that is fine.
  function rememberCode(code: string) {
    try {
      if (code) localStorage.setItem(DEMO_CODE_KEY, code);
    } catch {}
  }

  async function runStep<T>(id: StepId, url: string, body: unknown, describe: (result: Timed<T>) => string) {
    const timeoutMs = STEPS.find((candidate) => candidate.id === id)?.timeoutMs ?? 130_000;
    const code = demoCode.trim();
    setStep(id, { status: "running", startedAt: Date.now() });
    try {
      const result = await postJson<T>(url, body, timeoutMs, code);
      rememberCode(code);
      setStep(id, { status: "done", ms: result.ms, detail: describe(result) });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof CodeError) setNeedsCode(true);
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
      const tokens = [research, script, checked, directed].reduce((total, step) => total + step.usage.promptTokens + step.usage.completionTokens, 0);
      const base = { report: checked.report, facts: research.facts, sources, costUsd, tokens };
      // The video works without a voice too: silent, with captions. So a failed voice still shows the video.
      try {
        const voiced = await runStep<VoiceResult>("voice", "/api/voice", { storyboard: directed.storyboard }, (result) => {
          const seconds = result.storyboard.scenes.reduce((total, scene) => total + scene.durationSec, 0);
          return `${result.characters} characters, ${Math.round(seconds)} seconds`;
        });
        if (voiced.skipped) setStep("voice", { status: "skipped", detail: voiced.skipped });
        const result = {
          ...base,
          storyboard: voiced.skipped ? directed.storyboard : voiced.storyboard,
          voice: voiced.voice,
          ms: Date.now() - state.startedAt,
        };
        setFinished(result);
        // A whole video with its voice goes into the library, so the next person who asks gets it at once. It is
        // saved in the background; a video that cannot be saved still plays.
        if (!voiced.skipped) {
          void postJson("/api/library/save", { request: state.request, ...result }, 60_000, demoCode.trim()).catch((error) =>
            console.warn("The video could not be saved in the library.", error),
          );
        }
      } catch {
        setFinished({ ...base, storyboard: directed.storyboard, voice: {}, ms: Date.now() - state.startedAt });
      }
    } catch {
      // The step that failed shows its own error and a "Try again" button.
    } finally {
      setRunning(false);
    }
  }

  // Looks in the library first: a video made earlier for the same request plays at once and costs nothing.
  // `fresh` makes a new one anyway.
  async function makeVideo(event?: FormEvent<HTMLFormElement>, fresh = false) {
    event?.preventDefault();
    if (running) return;
    const request: VideoRequest = { topic: topic.trim(), audience, lengthSec, language: "en" };
    setAsked(request);
    setTab("factcheck");
    setFinished(null);
    setActiveSentence(null);
    setFailed(null);
    if (!fresh) {
      setRunning(true);
      const saved = await findInLibrary(request);
      setRunning(false);
      if (saved) {
        setStarted(false);
        setFinished(fromLibrary(saved));
        return;
      }
    }
    setStarted(true);
    setSteps(waitingSteps());
    void runFrom("research", { request, startedAt: Date.now() });
  }

  function tryAgain() {
    if (!failed || !progress.current || running) return;
    setStep(failed.step, { status: "waiting" });
    void runFrom(failed.step, progress.current);
  }

  // A link to /?example opens the first example straight away, and /?example=black-death that one.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("example");
    if (wanted === null) return;
    const slug = EXAMPLES.some((example) => example.slug === wanted) ? wanted : EXAMPLES[0].slug;
    void loadExample(slug).then(setFinished);
  }, []);

  const home = !started && !finished;
  const audienceLabel = (value: string) => AUDIENCES.find((option) => option.value === value)?.label ?? value;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col px-5 sm:px-8">
        {home ? (
          <section className="pt-14 sm:pt-20">
            <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-7xl">Explainer videos you can check.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Meko researches a topic on the web, writes a script where every sentence cites its source, checks each claim, and
              animates it with maps, diagrams and a voice-over in about a minute.
            </p>
          </section>
        ) : null}

        <form
          onSubmit={(event) => void makeVideo(event)}
          className={`rounded-2xl border border-rule bg-surface p-5 sm:p-7 ${home ? "mt-10" : "mt-8"}`}
        >
          <div className="font-serif text-2xl leading-[1.7] sm:text-3xl">
            <span>Explain </span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              required
              minLength={3}
              maxLength={200}
              placeholder="the French Revolution"
              aria-label="Topic"
              className="w-full border-b-2 border-rule bg-transparent px-1 outline-none transition-colors placeholder:text-muted/60 focus:border-fg sm:w-[22ch]"
            />
            <span> to </span>
            <InlineSelect label="Audience" value={audience} onChange={setAudience} options={AUDIENCES} />
            <span> in about </span>
            <InlineSelect
              label="Length"
              value={String(lengthSec)}
              onChange={(value) => setLengthSec(Number(value))}
              options={LENGTHS.map((seconds) => ({ value: String(seconds), label: `${seconds} seconds` }))}
            />
            <span>.</span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>Try</span>
              {SUGGESTIONS.map((suggestion, index) => (
                <span key={suggestion} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  <button type="button" onClick={() => setTopic(suggestion)} className="text-fg underline decoration-rule underline-offset-4 hover:decoration-fg">
                    {suggestion}
                  </button>
                </span>
              ))}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {needsCode ? (
                <label className="flex items-center gap-2 text-sm text-muted">
                  Demo code
                  <input
                    value={demoCode}
                    onChange={(event) => setDemoCode(event.target.value)}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="From the submission"
                    suppressHydrationWarning
                    className="w-44 rounded-full border border-rule bg-bg px-4 py-2.5 font-mono text-sm text-fg outline-none placeholder:font-sans placeholder:text-muted/70 focus:border-fg"
                  />
                </label>
              ) : null}
              <button
                type="submit"
                disabled={running}
                className="rounded-full bg-fg px-6 py-3 font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {running ? "Making video…" : "Make video"}
              </button>
            </div>
          </div>
          {needsCode ? (
            <p className="mt-4 text-sm text-muted">
              On this site, making a new video needs the demo code from the Meko submission, so strangers cannot spend the API
              credits. Videos already made play without it.
            </p>
          ) : null}
        </form>

        {started && !finished && asked ? (
          <section className="mt-12 max-w-2xl" aria-live="polite">
            <h2 className="font-serif text-3xl">Making “{asked.topic}”</h2>
            <p className="mt-2 text-muted">
              For {audienceLabel(asked.audience)}, about {asked.lengthSec} seconds. This takes about a minute.
            </p>
            <ol className="mt-8 flex flex-col">
              {STEPS.map(({ id, label }, index) => (
                <StepRow key={id} label={label} state={steps[id]} now={now} last={index === STEPS.length - 1} />
              ))}
            </ol>
            {failed && !running ? (
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-bad/40 px-4 py-3" role="alert">
                <span>
                  {failed.step === "voice"
                    ? "The voice-over failed, so the video plays without sound."
                    : `${STEPS.find((step) => step.id === failed.step)?.label} failed.`}
                </span>
                <button type="button" onClick={tryAgain} className="rounded-full border border-fg px-4 py-1.5 text-sm font-medium hover:bg-fg hover:text-bg">
                  Try again
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {finished ? (
          <section id="result" className="mt-12 scroll-mt-6">
            <div className="flex flex-col gap-2 border-b border-rule pb-5">
              <h2 className="font-serif text-3xl leading-tight sm:text-4xl">{finished.storyboard.title}</h2>
              <p className="font-mono text-sm text-muted">
                {finished.example ? "Example · " : finished.library ? "From the library · " : ""}
                Made in {Math.round(finished.ms / 1000)} s · ${finished.costUsd.toFixed(3)} · {finished.storyboard.sources.length} sources ·{" "}
                {finished.report.supported} of {finished.report.checks.length} sentences supported
              </p>
              {finished.library ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                  <span>
                    Meko made this video for the same request on{" "}
                    {new Date(finished.library.madeAt).toLocaleDateString("en-GB", { dateStyle: "long" })}, so it plays again without new
                    research or model calls. That saved about ${finished.costUsd.toFixed(2)}
                    {finished.tokens ? ` and ${Math.round(finished.tokens / 1000)},000 tokens of model work` : ""}.
                  </span>
                  <button
                    type="button"
                    onClick={() => void makeVideo(undefined, true)}
                    disabled={running}
                    className="rounded-full border border-fg px-4 py-1.5 font-medium text-fg hover:bg-fg hover:text-bg disabled:opacity-50"
                  >
                    Make a new one
                  </button>
                </p>
              ) : null}
            </div>
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="min-w-0">
                <div className="overflow-hidden rounded-xl border border-rule">
                  <StoryboardPlayer
                    storyboard={finished.storyboard}
                    voice={finished.voice}
                    sites={sites}
                    checks={finished.report}
                    playerRef={playerRef}
                  />
                </div>
              </div>
              <aside className="flex min-w-0 flex-col">
                <div role="tablist" className="flex gap-6 border-b border-rule">
                  {(
                    [
                      ["factcheck", "Fact-check"],
                      ["sources", `Sources (${finished.storyboard.sources.length})`],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                        tab === id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {tab === "factcheck" ? (
                  <FactCheckReport
                    report={finished.report}
                    facts={finished.facts}
                    sources={finished.sources}
                    numbered={finished.storyboard.sources}
                    activeSentenceId={activeSentence}
                    onSelect={playFrom}
                  />
                ) : (
                  <ol className="mt-4 flex flex-col">
                    {finished.storyboard.sources.map((source, index) => (
                      <li key={source.id} className="flex gap-3 border-b border-rule py-3 last:border-b-0">
                        <span className="w-6 shrink-0 font-mono text-sm text-muted">{index + 1}</span>
                        <span className="min-w-0 break-words">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-rule underline-offset-4 hover:decoration-fg"
                          >
                            {source.title}
                          </a>
                          <span className="mt-0.5 block font-mono text-xs text-muted">{hostname(source.url)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
            </div>
          </section>
        ) : null}

        <HowItWorks />
      </main>
      <SiteFooter />
    </>
  );
}

// A choice inside the form's sentence, drawn as an underlined word with a small arrow instead of a box.
function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <span className="relative inline-block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="cursor-pointer appearance-none border-b-2 border-rule bg-transparent py-0 pl-1 pr-7 outline-none transition-colors focus:border-fg"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-bg font-sans text-base text-fg">
            {option.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-base text-muted">
        ▾
      </span>
    </span>
  );
}

// One step of making a video, on a line down the left: a circle that fills in when the step is done, its name, and
// what it found or how long it has run.
function StepRow({ label, state, now, last }: { label: string; state: StepState; now: number; last: boolean }) {
  const elapsed = state.startedAt ? Math.max(0, (now - state.startedAt) / 1000) : 0;
  const detail = {
    waiting: "",
    running: `${elapsed.toFixed(0)} s`,
    done: `${((state.ms ?? 0) / 1000).toFixed(1)} s · ${state.detail ?? ""}`,
    skipped: state.detail ?? "Skipped",
    failed: state.detail ?? "Failed",
  }[state.status];
  const dot = {
    waiting: "border-rule bg-bg",
    running: "border-fg bg-bg animate-pulse",
    done: "border-fg bg-fg",
    skipped: "border-rule bg-rule",
    failed: "border-bad bg-bad",
  }[state.status];
  return (
    <li className="flex gap-4">
      <span className="flex w-4 flex-col items-center" aria-hidden>
        <span className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${dot}`} />
        {last ? null : <span className="w-px flex-1 bg-rule" />}
      </span>
      <span className={`flex min-w-0 flex-col pb-6 ${state.status === "waiting" ? "text-muted" : ""}`}>
        <span className="font-medium">{label}</span>
        {detail ? <span className={`mt-0.5 font-mono text-sm ${state.status === "failed" ? "text-bad" : "text-muted"}`}>{detail}</span> : null}
      </span>
    </li>
  );
}
