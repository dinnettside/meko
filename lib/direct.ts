import { z } from "zod";
import { isKnownCountry } from "./countries.ts";
import { addUsage, chatJson, emptyUsage } from "./nebius.ts";
import { ResearchFactSchema, ScriptSchema, VideoRequestSchema, countWords } from "./pipeline.ts";
import type { Usage } from "./pipeline.ts";
import { directScenePrompt, directTitlePrompt } from "./prompts/direct.ts";
import { SourceSchema, StoryboardSchema, storyboardProblems } from "./storyboard.ts";
import type { Storyboard } from "./storyboard.ts";

const WORDS_PER_SECOND = 2.5;
const PAUSE_SEC = 0.6;
const MIN_SCENE_SEC = 2.5;
// The prompts ask for 8 and 4 words. One word over is not worth a retry.
const MAX_LINE_WORDS = 9;
const MAX_LABEL_WORDS = 5;

export const DirectInputSchema = z.object({
  request: VideoRequestSchema,
  script: ScriptSchema,
  facts: z.array(ResearchFactSchema),
  sources: z.array(SourceSchema),
});

export type DirectResult = { storyboard: Storyboard; usage: Usage };

const TitleVisualSchema = z.object({ heading: z.string(), subheading: z.string().optional() });

const SceneVisualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), lines: z.array(z.string()).min(1).max(3) }),
  z.object({
    kind: z.literal("map"),
    frame: z.array(z.string()).min(1).max(6),
    highlights: z
      .array(
        z.object({
          country: z.string(),
          label: z.string().optional(),
          tone: z.enum(["primary", "secondary", "muted"]),
        }),
      )
      .min(1)
      .max(6),
    arrows: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).max(3),
  }),
  z.object({
    kind: z.literal("timeline"),
    // Each event names the fact that gives its year. The fact ID is checked, then left out of the storyboard.
    events: z.array(z.object({ year: z.number().int(), label: z.string(), factId: z.string() })).min(2).max(5),
    focusIndex: z.number().int(),
  }),
]);

// The reply also has plain lines to show if the visual cannot be used, for example when it repeats the scene before.
const SceneReplySchema = z.object({ visual: SceneVisualSchema, lines: z.array(z.string()).min(1).max(3) });

type TitleVisual = z.infer<typeof TitleVisualSchema>;
type SceneVisual = z.infer<typeof SceneVisualSchema>;
type SceneReply = z.infer<typeof SceneReplySchema>;
type NarratedScene = { id: string; narration: string; factIds: string[] };
type FactTexts = Map<string, string>; // fact ID to fact text

// Estimated from the word count until the voice-over sets the real length.
export function sceneDuration(narration: string): number {
  const seconds = countWords(narration) / WORDS_PER_SECOND + PAUSE_SEC;
  return Math.max(MIN_SCENE_SEC, Math.round(seconds * 10) / 10);
}

// Numbers without thousands separators, so "16,000" and "16000" match.
const numbersIn = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((number) => number.replace(/,/g, ""));

// An event's year must appear in the fact it cites.
const eventIsBacked = (event: { year: number; factId: string }, factTexts: FactTexts) =>
  numbersIn(factTexts.get(event.factId) ?? "").includes(String(Math.abs(event.year)));

// Labels and lines on screen, so their numbers and length can be checked. Timeline years are checked against their facts.
function shownText(visual: SceneVisual): string[] {
  if (visual.kind === "text") return visual.lines;
  if (visual.kind === "timeline") return visual.events.map((event) => event.label);
  return [...visual.highlights.map((h) => h.label ?? ""), ...visual.arrows.map((a) => a.label ?? "")];
}

const lineIsSafe = (line: string, allowed: Set<string>) =>
  countWords(line) <= MAX_LINE_WORDS && numbersIn(line).every((number) => allowed.has(number));

function linesProblems(lines: string[], allowed: Set<string>): string[] {
  return lines
    .filter((line) => !lineIsSafe(line, allowed))
    .map((line) => `The line "${line}" must have at most 8 words and only numbers from the narration or facts.`);
}

function titleProblems(visual: TitleVisual, allowed: Set<string>): string[] {
  const problems: string[] = [];
  if (countWords(visual.heading) > 8) problems.push("The heading is too long. Use at most 6 words.");
  for (const number of [visual.heading, visual.subheading ?? ""].flatMap(numbersIn)) {
    if (!allowed.has(number)) problems.push(`The title shows "${number}", which is not in the narration.`);
  }
  return problems;
}

function sceneProblems({ visual, lines }: SceneReply, allowed: Set<string>, factTexts: FactTexts): string[] {
  const problems: string[] = linesProblems(lines, allowed);
  // Numbers on screen must come from the fact-checked narration or from a fact the video cites.
  for (const number of shownText(visual).flatMap(numbersIn)) {
    if (!allowed.has(number)) problems.push(`It shows "${number}", which is not in the narration or facts.`);
  }
  if (visual.kind === "text") return problems;
  for (const label of shownText(visual)) {
    if (countWords(label) > MAX_LABEL_WORDS) problems.push(`The label "${label}" is too long. Use at most 4 words.`);
  }
  if (visual.kind === "map") {
    const codes = [
      ...visual.frame,
      ...visual.highlights.map((highlight) => highlight.country),
      ...visual.arrows.flatMap((arrow) => [arrow.from, arrow.to]),
    ];
    const unknown = [...new Set(codes.filter((code) => !isKnownCountry(code)))];
    if (unknown.length > 0) {
      problems.push(`Unknown country codes: ${unknown.join(", ")}. Use ISO 3166-1 alpha-3 codes of today's countries.`);
    }
    return problems;
  }
  const years = visual.events.map((event) => event.year);
  if (years.some((year, index) => index > 0 && year < years[index - 1])) problems.push("List the events in time order.");
  if (new Set(years).size < 2) problems.push("A timeline needs at least two different years. Use another kind.");
  if (visual.focusIndex < 0 || visual.focusIndex >= visual.events.length) {
    problems.push(`focusIndex is ${visual.focusIndex}, but there are only ${visual.events.length} events.`);
  }
  for (const event of visual.events) {
    if (!eventIsBacked(event, factTexts)) {
      problems.push(`The year ${event.year} for "${event.label}" is not in fact ${event.factId}. Only use events from the facts.`);
    }
  }
  return problems;
}

// The scene's plain lines, or the start of its narration if none of them is safe.
function textVisual(lines: string[], scene: NarratedScene, allowed: Set<string>): SceneVisual {
  const safeLines = lines.filter((line) => lineIsSafe(line, allowed));
  return { kind: "text", lines: safeLines.length > 0 ? safeLines : [scene.narration.split(/\s+/).slice(0, 7).join(" ") + "…"] };
}

// Last resort after the retries: drop whatever still breaks a rule, so one bad label does not sink the video.
function repairScene({ visual, lines }: SceneReply, scene: NarratedScene, allowed: Set<string>, factTexts: FactTexts): SceneVisual {
  const safe = (text: string) => numbersIn(text).every((number) => allowed.has(number));
  const safeLabel = (label?: string) => (label && safe(label) && countWords(label) <= MAX_LABEL_WORDS ? label : undefined);
  const fallback = textVisual(lines, scene, allowed);

  if (visual.kind === "text") return textVisual(visual.lines, scene, allowed);
  if (visual.kind === "timeline") {
    const focus = visual.events[visual.focusIndex];
    const events = visual.events
      .filter((event) => eventIsBacked(event, factTexts) && safeLabel(event.label))
      .sort((a, b) => a.year - b.year);
    const focusIndex = Math.max(0, focus ? events.indexOf(focus) : events.length - 1);
    return new Set(events.map((event) => event.year)).size >= 2 ? { kind: "timeline", events, focusIndex } : fallback;
  }
  const highlights = visual.highlights
    .filter((highlight) => isKnownCountry(highlight.country))
    .map((highlight) => ({ ...highlight, label: safeLabel(highlight.label) }));
  const arrows = visual.arrows
    .filter((arrow) => isKnownCountry(arrow.from) && isKnownCountry(arrow.to))
    .map((arrow) => ({ ...arrow, label: safeLabel(arrow.label) }));
  const frame = visual.frame.filter(isKnownCountry);
  if (highlights.length === 0) return fallback;
  return { kind: "map", frame: frame.length > 0 ? frame : highlights.map((h) => h.country), highlights, arrows };
}

// Same kind, same countries or same events: the viewer would see the same picture twice.
function sameAs(a: SceneVisual, b: SceneVisual): boolean {
  if (a.kind === "map" && b.kind === "map") {
    const countries = (visual: typeof a) => visual.highlights.map((h) => h.country).sort().join(",");
    return countries(a) === countries(b) && a.arrows.length === 0 && b.arrows.length === 0;
  }
  if (a.kind === "timeline" && b.kind === "timeline") {
    return a.events.map((e) => e.year).join(",") === b.events.map((e) => e.year).join(",");
  }
  return false;
}

// The storyboard contract has no fact IDs on timeline events.
function withoutFactIds(visual: SceneVisual) {
  if (visual.kind !== "timeline") return visual;
  return { ...visual, events: visual.events.map(({ year, label }) => ({ year, label })) };
}

export async function direct({ request, script, facts, sources }: z.infer<typeof DirectInputSchema>): Promise<DirectResult> {
  // The narration is the fact-checked text, word for word. The model only chooses what is shown.
  const factTexts: FactTexts = new Map(facts.map((fact) => [fact.id, fact.text]));
  const narrated: NarratedScene[] = script.scenes.map((scene) => ({
    id: scene.id,
    narration: scene.sentences.map((sentence) => sentence.text).join(" "),
    factIds: [...new Set(scene.sentences.flatMap((sentence) => sentence.factIds))],
  }));
  const videoFactIds = [...new Set(narrated.flatMap((scene) => scene.factIds))];
  const factList = (ids: string[]) => ids.map((id) => ({ id, text: factTexts.get(id) ?? "" }));
  const allowedFor = (scene: NarratedScene) =>
    new Set([scene.narration, ...videoFactIds.map((id) => factTexts.get(id) ?? "")].flatMap(numbersIn));

  // Every scene is directed in its own small call, all at once.
  const [opening, ...rest] = narrated;
  const titleCall = chatJson({
    step: `direct/${opening.id}`,
    schemaName: "title",
    schema: TitleVisualSchema,
    messages: directTitlePrompt(script.title, opening.narration),
    maxTokens: 300,
    check: (visual) => titleProblems(visual, allowedFor(opening)),
    repair: () => ({ heading: script.title }),
  });
  const sceneCalls = rest.map((scene, index) =>
    chatJson({
      step: `direct/${scene.id}`,
      schemaName: "scene",
      schema: SceneReplySchema,
      messages: directScenePrompt({
        title: script.title,
        position: `scene ${index + 2} of ${narrated.length}`,
        narration: scene.narration,
        sceneFacts: factList(scene.factIds),
        otherFacts: factList(videoFactIds.filter((id) => !scene.factIds.includes(id))),
      }),
      maxTokens: 1000,
      check: (reply) => sceneProblems(reply, allowedFor(scene), factTexts),
      repair: (reply) => ({ visual: repairScene(reply, scene, allowedFor(scene), factTexts), lines: reply.lines }),
    }),
  );
  const [title, ...scenes] = await Promise.all([titleCall, ...sceneCalls]);
  const usage = [title, ...scenes].reduce((total, call) => addUsage(total, call.usage), emptyUsage());

  // The calls ran apart, so a map or timeline can repeat the one before. Then the later scene shows its lines.
  const visuals: SceneVisual[] = [];
  scenes.forEach(({ data }, index) => {
    const previous = visuals[index - 1];
    const repeats = previous && sameAs(previous, data.visual);
    visuals.push(repeats ? textVisual(data.lines, rest[index], allowedFor(rest[index])) : data.visual);
  });

  const usedSourceIds = new Set(
    facts.filter((fact) => videoFactIds.includes(fact.id)).map((fact) => fact.sourceId),
  );
  const storyboard = StoryboardSchema.parse({
    title: script.title,
    language: request.language,
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: narrated.map((scene, index) => ({
      ...(index === 0 ? { kind: "title", ...title.data } : withoutFactIds(visuals[index - 1])),
      id: scene.id,
      narration: scene.narration,
      factIds: scene.factIds,
      durationSec: sceneDuration(scene.narration),
    })),
    sources: sources
      .filter((source) => usedSourceIds.has(source.id))
      .map(({ id, title: sourceTitle, url }) => ({ id, title: sourceTitle, url })),
  });

  const problems = storyboardProblems(storyboard, facts.map((fact) => fact.id));
  if (problems.length > 0) throw new Error(`The storyboard is not valid: ${problems.join("; ")}`);
  return { storyboard, usage };
}
