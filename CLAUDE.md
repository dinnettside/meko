# CLAUDE.md

@AGENTS.md

Project: **Meko**
Owner: Trym (solo). Built for the Nebius x NVIDIA Global AI Hackathon, track: Best Apps and Agents.

## What we're building

A web app that turns a topic into a short, fact-checked, animated explainer video.

The user types a topic, an audience and a length ("The French Revolution, high school, 90 seconds").
An agent researches the topic on the web, writes a narration script where every claim is backed by a source,
fact-checks its own script and directs each scene as structured JSON. The video then plays instantly in the
browser with maps, timelines, text and voice-over. The source list is shown next to the video.

The point: explainer videos people can trust, made in about a minute.

## Hard requirements (hackathon rules, never break these)

- Every video generation makes runtime calls to **Nebius Token Factory** using at least one **NVIDIA open model** (Nemotron). Calling NVIDIA models through OpenRouter, Hugging Face or similar does not count.
- The repo is public with an **MIT LICENSE** and a **README** with setup instructions.
- There must be a **working demo URL** (Vercel).
- **Never commit secrets.** Keys live in `.env.local` (gitignored). Keep `.env.example` updated with variable names only.
- Generated videos contain **no copyrighted music, images or third-party trademarks**. All visuals are drawn in code. Map data comes from open sources.
- Third-party APIs (Tavily, ElevenLabs) are used within their terms.
- Deadline: **Oct 30, 2026, 10:00 PDT (18:00 Oslo)**. Target: submit Oct 29.

## Stack

- Next.js (App Router), TypeScript (strict), Tailwind
- Remotion with `@remotion/player` for in-browser playback (no server-side rendering for now)
- LLM: Nebius Token Factory through the `openai` npm SDK (OpenAI-compatible)
  - base URL: `https://api.tokenfactory.nebius.com/v1/`
  - env: `NEBIUS_API_KEY`, `NEBIUS_MODEL` (picked in Phase 0: `nvidia/Nemotron-3-Ultra-550b-a55b`, see `docs/model-check.md`)
  - thinking off by default: `chat_template_kwargs: { enable_thinking: false }`
- Web search: Tavily JS SDK (search + extract), env `TAVILY_API_KEY`
- Voice (Phase 2): ElevenLabs, env `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- Validation: zod
- Maps (Phase 2): d3-geo, topojson-client, world-atlas
- Hosting: Vercel

Check the current official docs before using any SDK, endpoint or model ID. Do not rely on memory for these.
Do not add dependencies beyond this list without asking.

## Architecture

The pipeline is split into separate API routes. The browser calls them in order and shows live progress
for each step. Each route must finish well within Vercel's function time limit.

1. `POST /api/research`: input `{ topic, audience, lengthSec, language }`.
   The model plans 3-6 search queries (JSON). The server runs them on Tavily in parallel.
   The model extracts short, atomic facts, each tied to one source. If the model reports gaps, run one more round (max 2 rounds).
   Output: `{ sources, facts }`.
2. `POST /api/script`: writes the narration split into scenes. Every sentence references fact IDs.
   Length is checked in characters: about 15 spoken characters per second, measured on the chosen voice (words per second varied too much with word length).
3. `POST /api/factcheck`: checks every sentence against the source text behind its facts.
   Status per sentence: `supported`, `revised` or `removed`. Output: revised scenes plus a report.
4. `POST /api/direct`: turns the scenes into a `Storyboard` (contract below), validated with zod.
   On validation failure, retry with the error message (max 2 retries).
5. `POST /api/voice` (Phase 2): text-to-speech per scene. Returns audio and its duration.
   Scene duration = audio duration + a short pause.

Rules:
- Prompts for each step live in their own file in `lib/prompts/`. They will change a lot.
- Every loop and retry has a hard cap. Never call a model in an unbounded loop.
- Log tokens and latency for every model call. Later we show "cost of this video" in the UI.
- Keep model calls and Tavily calls in small, testable functions in `lib/`.

## Storyboard contract (draft, change only with Trym's OK)

```ts
type Source = { id: string; title: string; url: string };
type Fact = { id: string; text: string; sourceId: string };

type SceneBase = {
  id: string;
  narration: string;   // what the voice says
  factIds: string[];   // facts that back this scene
  durationSec: number; // estimated from word count until voice exists
};

type Scene =
  | (SceneBase & { kind: "title"; heading: string; subheading?: string })
  | (SceneBase & { kind: "text"; lines: string[] })
  | (SceneBase & {
      kind: "map";
      frame: string[]; // ISO 3166-1 alpha-3 codes the camera should fit
      highlights: { country: string; label?: string; tone: "primary" | "secondary" | "muted" }[];
      arrows?: { from: string; to: string; label?: string }[];
      markers?: { lon: number; lat: number; label: string }[];
    })
  | (SceneBase & { kind: "timeline"; events: { year: number; label: string; date?: string }[]; focusIndex: number }) // `date` (added Oct 14, 2026 with Trym's OK) is a day and month like "20 July", for events in the same year
  // Added Oct 14, 2026 with Trym's OK:
  | (SceneBase & { kind: "stat"; value: number; valueMax?: number; unit?: string; label: string; total?: number }) // one big number; `total` draws value out of total as dots; `valueMax` (added Oct 14, 2026 with Trym's OK) is the high end when the number is a range, like 25 to 50 million
  | (SceneBase & { kind: "compare"; title: string; unit?: string; bars: { label: string; value: number }[] }) // a bar chart
  | (SceneBase & { kind: "quote"; text: string; sourceId: string }) // a source's exact words
  | (SceneBase & { kind: "steps"; steps: string[] }) // a process or a chain of causes
  | (SceneBase & { kind: "list"; items: { title: string; detail?: string }[] }); // added Oct 14, 2026 with Trym's OK: 2-4 things of one kind side by side, as cards without arrows

type Storyboard = {
  title: string;
  language: "en" | "no";
  fps: 30;
  width: 1920;
  height: 1080;
  scenes: Scene[];
  sources: Source[];
};
```

Phase 1 renders only `title` and `text`. `map` and `timeline` come in Phase 2. `stat`, `compare`, `quote`, `steps` and `list` were added after Phase 2 so the videos feel less like slides.
Known limitation: the map data has modern borders. Historical borders are out of scope (say so in the README).

## Phases

Current phase: **4**

### Phase 0: setup and model check (Oct 13-14)
- [x] Scaffold Next.js + Tailwind + Remotion Player, MIT LICENSE, README stub, `.env.example`
- [x] `scripts/check-models.ts`: list the models on Token Factory. For each NVIDIA/Nemotron candidate, test strict JSON output, tool calling and latency on a small task. Print a short report. Trym picks the model.

### Phase 1: end-to-end MVP (done by Sun Oct 18, checkpoint)
- [x] Topic form, then research, script, factcheck and direct, then the video plays in the Remotion Player
- [x] Title and text scenes only, live progress for each step, source list next to the video

### Phase 2: visuals and voice (Oct 19-23)
- [x] Map scenes, timeline scenes, transitions
- [x] ElevenLabs voice, scene timing from audio length

### Phase 3: trust and robustness (Oct 24-26)
- [x] Fact-check report visible in the UI
- [x] Error handling and retries everywhere
- [x] `scripts/eval.ts`: run 10 topics, report % supported sentences, cost and time per video (see `docs/eval.md`)

### Phase 4: ship (Oct 27-29)
- [ ] Deploy to Vercel with environment variables
- [ ] README: setup, architecture, how Nemotron and Token Factory are used
- [ ] Design polish, demo video (under 3 min, public on YouTube), Devpost text
- [ ] Make the repo public

## How to work with Trym

- Trym owns all product and design decisions. You build and explain briefly in plain words.
- Before each phase or bigger task: propose a short plan and wait for OK.
- Work in small steps. Never build ahead of the current phase.
- After each step: run typecheck, lint and build. Then tell Trym exactly what to check in the browser.
- Commit after every working step with a clear message.
- Ask before adding dependencies, changing the storyboard contract or doing anything that costs money.
- Keep code simple and readable. No clever abstractions.
- Whenever something about Token Factory, Nemotron or other NVIDIA tooling is confusing, slow or broken, add a line to `FEEDBACK.md`. The submission requires written feedback on these tools.
- When a phase is done, tick its boxes here and update "Current phase".

## Design

- Trym decides the visual direction. Before styling the app or the videos, propose 2-3 directions (4-6 named hex colors, typefaces, a rough layout) and wait.
- Chosen direction (Oct 13, 2026, Trym let Claude pick): "Night atlas". Ink #0F1B2D (background, sea), land #22334B, border #3A4F6E, paper #F4F1EA (text), dim #93A1B5, signal amber #FFB627 (the one thing to look at), teal #4FC3B4 (second highlight). Fraunces for headings, Archivo for everything else. All colors, fonts, sizes, spacing and motion live in one file, `lib/theme.ts`.
- Video style: flat, bold history-explainer look with clear maps, few elements per scene and big readable text.
- Avoid generic AI-looking defaults: cream background with terracotta accent, black with acid green, identical rounded cards with soft shadows, gradient washes, all-caps labels above every heading.
- One memorable element per screen, everything else calm. Motion only when it explains something.
- UI text: plain English, sentence case. Buttons say exactly what happens ("Make video", not "Submit").

## Language

The app, the demo and the README are in English because the judges are international.
Norwegian output is a stretch goal. Test Nemotron's Norwegian quality before promising it.
