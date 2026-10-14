import { z } from "zod";
import { COUNTRIES, isKnownCountry } from "./countries.ts";
import { addUsage, chatJson, emptyUsage } from "./nebius.ts";
import { CHARS_PER_SECOND, ResearchFactSchema, ScriptSchema, VideoRequestSchema, countWords } from "./pipeline.ts";
import type { ResearchFact, Usage } from "./pipeline.ts";
import { directPlanPrompt, directScenePrompt, directTitlePrompt, placesPrompt } from "./prompts/direct.ts";
import { amountsIn, isDateIn, numbersIn, yearsIn } from "./numbers.ts";
import { labelMismatch } from "./regions.ts";
import { quoteIsInSource } from "./research.ts";
import { contentWords } from "./words.ts";
import { SourceSchema, StoryboardSchema, storyboardProblems } from "./storyboard.ts";
import { geoDistance } from "d3-geo";
import { countryCenter, countryContains } from "./world.ts";
import type { Storyboard } from "./storyboard.ts";

const PAUSE_SEC = 0.6;
const MIN_SCENE_SEC = 2.5;
// Scene calls are small and usually take 1 to 3 seconds, so a slow one is better tried again early.
const SCENE_CALL_TIMEOUT_MS = 20_000;
const EARTH_RADIUS_KM = 6371;
// How far apart two independent answers for a city's position may be.
const MAX_MARKER_GAP_KM = 250;
// The prompts ask for 8 and 4 words. One word over is not worth a retry.
const MAX_LINE_WORDS = 9;
const MAX_LABEL_WORDS = 5;
// The prompt asks for 3 words on maps, where long labels crowd each other out.
const MAX_MAP_LABEL_WORDS = 4;

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
      .max(5),
    arrows: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).max(3),
    // Cities as dots. `country` is where the city lies today, and the code checks the point is in it.
    markers: z
      .array(z.object({ label: z.string(), lon: z.number(), lat: z.number(), country: z.string() }))
      .max(3),
  }),
  z.object({
    kind: z.literal("timeline"),
    // Each event names the fact that gives its year. The fact ID is checked, then left out of the storyboard.
    events: z.array(z.object({ year: z.number().int(), label: z.string(), factId: z.string() })).min(2).max(5),
    focusIndex: z.number().int(),
  }),
  z.object({
    kind: z.literal("stat"),
    value: z.number(),
    unit: z.string().optional(),
    label: z.string(),
    total: z.number().optional(),
  }),
  z.object({
    kind: z.literal("compare"),
    title: z.string(),
    unit: z.string().optional(),
    bars: z.array(z.object({ label: z.string(), value: z.number() })).min(2).max(5),
  }),
  // The quote names its fact; the code checks the words are in that fact's quote, then uses the fact's source.
  z.object({ kind: z.literal("quote"), text: z.string(), factId: z.string() }),
  z.object({ kind: z.literal("steps"), steps: z.array(z.string()).min(2).max(5) }),
]);

const SCENE_KINDS = ["map", "timeline", "stat", "compare", "quote", "steps", "text"] as const;
type SceneKind = (typeof SCENE_KINDS)[number];

// How often each kind may appear among a video's scenes. Maps are the strongest picture and follow on from each
// other, but not every time, and a second timeline only has something new to show when the facts give enough years.
function kindLimits(scenes: number, years: number): Record<SceneKind, number> {
  return {
    map: Math.max(2, Math.round(scenes * 0.65)),
    timeline: years >= 8 ? 2 : 1,
    stat: 2,
    compare: 2,
    quote: 1,
    steps: 2,
    text: 2,
  };
}

// Picks one kind per scene from the model's ranked choices, keeping the rhythm: no kind twice in a row except maps,
// no four maps in a row, each kind at most as often as `limits` allows, and no kind the scene's facts have no data
// for. First choices are placed before second choices, so a kind goes to the scenes it suits best. A scene where
// none of its choices fits gets no plan and picks its own kind.
function pickKinds(choices: SceneKind[][], missing: SceneKind[][], limits: Record<SceneKind, number>): (SceneKind | undefined)[] {
  const picked: (SceneKind | undefined)[] = choices.map(() => undefined);
  const fits = (kind: SceneKind, index: number) => {
    if (missing[index].includes(kind) || picked.filter((other) => other === kind).length >= limits[kind]) return false;
    if (kind !== "map") return picked[index - 1] !== kind && picked[index + 1] !== kind;
    const isMap = (at: number) => at === index || picked[at] === "map";
    return ![index - 3, index - 2, index - 1, index].some((start) => [0, 1, 2, 3].every((offset) => isMap(start + offset)));
  };
  for (let rank = 0; rank < 3; rank++) {
    choices.forEach((ranked, index) => {
      const kind = ranked[rank];
      if (picked[index] === undefined && kind && fits(kind, index)) picked[index] = kind;
    });
  }
  return picked;
}

// The reply also has plain lines to show if the visual cannot be used, for example when it repeats the scene before.
const SceneReplySchema = z.object({ visual: SceneVisualSchema, lines: z.array(z.string()).min(1).max(3) });

type TitleVisual = z.infer<typeof TitleVisualSchema>;
type SceneVisual = z.infer<typeof SceneVisualSchema>;
type SceneReply = z.infer<typeof SceneReplySchema>;
type NarratedScene = { id: string; narration: string; factIds: string[] };
type FactMap = Map<string, ResearchFact>; // by fact ID

// Dates are not amounts: "14th century" or "700 CE" in a stat or a chart means the model should have used a timeline.
const DATE_WORDS = /\b(\d+(st|nd|rd|th)|century|centuries|ce|bce|bc|ad)\b|\bc\.$/i;
const isYearLike = (value: number) => Number.isInteger(value) && value >= 1000 && value <= 2100;

// Markers are for cities, so a marker named after a country or a region is a mistake.
const countryNames = new Set(Object.values(COUNTRIES).map((country) => country.name.toLowerCase()));
const REGION_WORDS = /\b(asia|europe|africa|america|middle east|steppes?|desert|basin|ocean|sea|mountains|range|empire|dynasty|kingdom|route|road)\b/i;
const CITY_WORDS = /\b(port|city|town|capital|harbou?r|village)\b/i;
const isPlaceLabel = (label: string) => !countryNames.has(label.trim().toLowerCase()) && !REGION_WORDS.test(label);

// Estimated from the word count until the voice-over sets the real length.
export function sceneDuration(narration: string): number {
  const seconds = narration.length / CHARS_PER_SECOND + PAUSE_SEC;
  return Math.max(MIN_SCENE_SEC, Math.round(seconds * 10) / 10);
}

// An event's year must be one its fact states, with the same sign for BC.
const eventIsBacked = (event: { year: number; factId: string }, facts: FactMap) =>
  yearsIn(facts.get(event.factId)?.text ?? "").includes(event.year);

// Words that tell one thing leads to another. Steps are drawn with arrows between them, which say "this led to
// that", so a narration without such a word is a list and gets no steps.
const SEQUENCE_WORDS =
  /\b(led|leads?|caus(e|ed|es|ing)|so|then|after(wards)?|because|result(ed|ing)?|until|before|first|finally|eventually|began|made|making|turned|forced|pushed|allowed|enabled|weakened|brought|triggered|sparked|became|grew|therefore|thus)\b/i;

// The kinds a scene cannot use, because its facts lack the data: a timeline needs a year in the scene's own facts
// and another year somewhere in the video, a stat one amount, a chart two, a quote a source quote, and steps a
// narration where one thing leads to another.
function kindsWithoutData(scene: NarratedScene, facts: FactMap, videoYears: number): SceneKind[] {
  const factTexts = scene.factIds.map((id) => facts.get(id)?.text ?? "");
  const amounts = amountsIn([scene.narration, ...factTexts].join(" ")).length;
  const missing: SceneKind[] = [];
  if (factTexts.every((text) => yearsIn(text).length === 0) || videoYears < 2) missing.push("timeline");
  if (amounts < 1) missing.push("stat");
  if (amounts < 2) missing.push("compare");
  if (!scene.factIds.some((id) => countWords(facts.get(id)?.quote ?? "") >= 5)) missing.push("quote");
  if (!SEQUENCE_WORDS.test(scene.narration)) missing.push("steps");
  return missing;
}

// Every label on a map, with the country it names when it is a highlight.
function mapLabels(visual: Extract<SceneVisual, { kind: "map" }>): { text: string; country?: string }[] {
  return [
    ...visual.highlights.flatMap((h) => (h.label ? [{ text: h.label, country: h.country }] : [])),
    ...visual.arrows.flatMap((a) => (a.label ? [{ text: a.label }] : [])),
    ...visual.markers.map((m) => ({ text: m.label })),
  ];
}
const mapLabelIsGrounded = (label: { text: string; country?: string }, source: string) =>
  isGrounded(label.text, source) ||
  (label.country !== undefined && label.text.trim().toLowerCase() === COUNTRIES[label.country]?.name.toLowerCase());

// An arrow labeled "eastward" that goes west, or the other way round: the model mixed up from and to.
function pointsTheOtherWay(visual: Extract<SceneVisual, { kind: "map" }>, arrow: { from: string; to: string; label?: string }) {
  const label = (arrow.label ?? "").toLowerCase().replace(/\b(middle|near|far) east\b/g, "");
  const saysEast = /\beast(ward)?s?\b/.test(label);
  const saysWest = /\bwest(ward)?s?\b/.test(label);
  const from = resolvePlace(visual, arrow.from);
  const to = resolvePlace(visual, arrow.to);
  const [start, end] = [from && countryCenter(from), to && countryCenter(to)];
  if (saysEast === saysWest || !start || !end) return false;
  const eastward = ((end[0] - start[0] + 540) % 360) - 180 > 0;
  return saysEast !== eastward;
}

// The model sometimes writes a city where a country code belongs, in an arrow or the frame. When that city is one
// of the scene's markers, it means the marker's country.
function resolvePlace(visual: Extract<SceneVisual, { kind: "map" }>, value: string): string | null {
  if (isKnownCountry(value)) return value;
  const marker = visual.markers.find((m) => m.label.trim().toLowerCase() === value.trim().toLowerCase());
  return marker && isKnownCountry(marker.country) ? marker.country : null;
}

// Text on screen, so its numbers and length can be checked. Timeline years are checked against their facts,
// and a quote against its fact's quote.
function shownText(visual: SceneVisual): string[] {
  switch (visual.kind) {
    case "text":
      return visual.lines;
    case "timeline":
      return visual.events.map((event) => event.label);
    case "map":
      return [
        ...visual.highlights.map((h) => h.label ?? ""),
        ...visual.arrows.map((a) => a.label ?? ""),
        ...visual.markers.map((m) => m.label),
      ];
    case "stat":
      return [String(visual.value), visual.total === undefined ? "" : String(visual.total), visual.unit ?? "", visual.label];
    case "compare":
      return [visual.title, visual.unit ?? "", ...visual.bars.flatMap((bar) => [bar.label, String(bar.value)])];
    case "quote":
      return [];
    case "steps":
      return visual.steps;
  }
}

// How much of a label is backed by the narration and facts: the share of its longer words that also appear there.
// Words match on their first 5 letters, so "summons" matches "summoned". This keeps the director from adding
// claims on screen that the fact-checked narration does not make.
function groundedWords(text: string, source: string): { matched: number; total: number } {
  const words = contentWords(text);
  const stems = new Set(contentWords(source).map((word) => word.slice(0, 5)));
  return { matched: words.filter((word) => stems.has(word.slice(0, 5))).length, total: words.length };
}
// Labels that state something (steps, stats, charts, timeline events) need more than half their words backed.
// A short label may have one other word, like "occurred" in "94 deaths occurred".
function isGrounded(text: string, source: string): boolean {
  const { matched, total } = groundedWords(text, source);
  return total <= 3 ? total - matched <= 1 : matched / total > 0.5;
}
// Summary lines may say things in other words, so a third is enough for them.
function lineIsGrounded(text: string, source: string): boolean {
  const { matched, total } = groundedWords(text, source);
  return total === 0 || matched / total >= 1 / 3;
}

const lineIsSafe = (line: string, allowed: Set<string>, source: string) =>
  countWords(line) <= MAX_LINE_WORDS && numbersIn(line).every((number) => allowed.has(number)) && lineIsGrounded(line, source);

function linesProblems(lines: string[], allowed: Set<string>, source: string): string[] {
  return lines
    .filter((line) => !lineIsSafe(line, allowed, source))
    .map((line) => `The line "${line}" must have at most 8 words, only numbers from the narration or facts, and mostly the narration's own words.`);
}

function titleProblems(visual: TitleVisual, allowed: Set<string>): string[] {
  const problems: string[] = [];
  if (countWords(visual.heading) > 8) problems.push("The heading is too long. Use at most 6 words.");
  for (const number of [visual.heading, visual.subheading ?? ""].flatMap(numbersIn)) {
    if (!allowed.has(number)) problems.push(`The title shows "${number}", which is not in the narration.`);
  }
  return problems;
}

// What is wrong with the visual itself, apart from its fallback lines. `source` is the scene's narration and facts.
function visualProblems(visual: SceneVisual, allowed: Set<string>, facts: FactMap, source: string): string[] {
  const problems: string[] = [];
  const ungrounded = (text: string) => `"${text}" says something the narration does not. Use the narration's own words.`;
  // Numbers on screen must come from the fact-checked narration or from a fact the video cites.
  for (const number of shownText(visual).flatMap(numbersIn)) {
    if (!allowed.has(number)) problems.push(`It shows "${number}", which is not in the narration or facts. Write it as they do.`);
  }
  const tooLong = (text: string, words: number) => countWords(text) > words;
  switch (visual.kind) {
    case "text":
      for (const line of visual.lines) if (!lineIsGrounded(line, source)) problems.push(ungrounded(line));
      break;
    case "map": {
      for (const label of shownText(visual)) {
        if (tooLong(label, MAX_MAP_LABEL_WORDS)) problems.push(`The label "${label}" is too long. Use at most 3 words.`);
      }
      // Labels name what the narration and facts name. A country may always carry its own name.
      for (const label of mapLabels(visual)) {
        if (!mapLabelIsGrounded(label, source)) problems.push(ungrounded(label.text));
      }
      for (const arrow of visual.arrows) {
        if (pointsTheOtherWay(visual, arrow)) {
          problems.push(`The arrow "${arrow.label}" from ${arrow.from} to ${arrow.to} points the other way. Swap from and to.`);
        }
      }
      for (const highlight of visual.highlights) {
        const mismatch = highlight.label ? labelMismatch(highlight.label, highlight.country) : null;
        if (mismatch) {
          problems.push(`The label "${highlight.label}" is on ${highlight.country}, but ${mismatch}. Label each country with its own name or a region it lies in.`);
        }
        // Coloring all of a big country to point at one port in it misleads, so cities go in markers.
        if (highlight.label && (CITY_WORDS.test(highlight.label) || visual.markers.some((m) => m.label === highlight.label))) {
          problems.push(`"${highlight.label}" names a city. Put cities in markers, and highlight only countries or regions.`);
        }
      }
      const places = [...visual.frame, ...visual.arrows.flatMap((arrow) => [arrow.from, arrow.to])];
      const unknown = [
        ...new Set([
          ...places.filter((place) => resolvePlace(visual, place) === null),
          ...visual.highlights.map((highlight) => highlight.country).filter((code) => !isKnownCountry(code)),
        ]),
      ];
      if (unknown.length > 0) {
        problems.push(`Unknown country codes: ${unknown.join(", ")}. Use ISO 3166-1 alpha-3 codes of today's countries.`);
      }
      for (const marker of visual.markers) {
        if (!isPlaceLabel(marker.label)) {
          problems.push(`The marker "${marker.label}" names a country or region. Markers are for cities; highlight countries instead.`);
        }
        if (!countryContains(marker.country, marker.lon, marker.lat)) {
          problems.push(
            `The marker "${marker.label}" at latitude ${marker.lat}, longitude ${marker.lon} is not in ${marker.country}. Check the country and the coordinates.`,
          );
        }
      }
      break;
    }
    case "timeline": {
      for (const event of visual.events) {
        if (tooLong(event.label, MAX_LABEL_WORDS)) problems.push(`The label "${event.label}" is too long. Use at most 4 words.`);
        if (!isGrounded(event.label, `${source} ${facts.get(event.factId)?.text ?? ""}`)) problems.push(ungrounded(event.label));
        if (!facts.has(event.factId)) {
          problems.push(`"${event.label}" cites ${event.factId}, which is not a fact in this video.`);
        } else if (!eventIsBacked(event, facts)) {
          const given = yearsIn(facts.get(event.factId)?.text ?? "");
          problems.push(
            `The year ${event.year} for "${event.label}" is not in fact ${event.factId}, which gives ${given.length > 0 ? `only ${given.join(", ")}` : "no year"}. Only use years listed under "Years in the facts".`,
          );
        }
      }
      const years = visual.events.map((event) => event.year);
      if (years.some((year, index) => index > 0 && year < years[index - 1])) problems.push("List the events in time order.");
      if (new Set(visual.events.map((event) => event.label.toLowerCase())).size < visual.events.length) {
        problems.push("Two events have the same label. Give each event its own label, or leave one out.");
      }
      if (new Set(years).size < 2) problems.push("A timeline needs at least two different years. Use another kind.");
      if (visual.focusIndex < 0 || visual.focusIndex >= visual.events.length) {
        problems.push(`focusIndex is ${visual.focusIndex}, but there are only ${visual.events.length} events.`);
      }
      break;
    }
    case "stat":
      if (tooLong(visual.label, MAX_LINE_WORDS)) problems.push("The stat label is too long. Use at most 8 words.");
      if (visual.unit && tooLong(visual.unit, 2)) problems.push("The unit is too long. Use one or two words, like million or km.");
      if (visual.total !== undefined && !(visual.total > visual.value)) problems.push("total must be bigger than value, or left out.");
      if (
        isDateIn(visual.value, source) ||
        (!visual.unit && isYearLike(visual.value)) ||
        /^(year|january|february|march|april|may|june|july|august|september|october|november|december|bc|ad|bce|ce|century|centuries|th century)$/i.test(visual.unit ?? "")
      ) {
        problems.push("A year or a date is not a good stat. Use a timeline or text for dates.");
      }
      if (!isGrounded(visual.label, source)) problems.push(ungrounded(visual.label));
      break;
    case "compare":
      if (tooLong(visual.title, MAX_LINE_WORDS)) problems.push("The chart title is too long. Use at most 8 words.");
      if (!isGrounded(visual.title, source)) problems.push(ungrounded(visual.title));
      if (
        DATE_WORDS.test(visual.unit ?? "") ||
        visual.bars.some((bar) => DATE_WORDS.test(bar.label)) ||
        visual.bars.every((bar) => isYearLike(bar.value))
      ) {
        problems.push("A chart compares amounts, not dates. Use a timeline for dates.");
      }
      for (const bar of visual.bars) {
        if (tooLong(bar.label, MAX_LABEL_WORDS)) problems.push(`The bar label "${bar.label}" is too long. Use at most 4 words.`);
        if (bar.value < 0) problems.push("Bar values cannot be negative.");
      }
      break;
    case "quote": {
      const fact = facts.get(visual.factId);
      const text = visual.text.trim();
      if (!fact) problems.push(`Unknown fact ${visual.factId}.`);
      else if (!quoteIsInSource(text, fact.quote)) {
        problems.push(`The quote must be words copied exactly from the quote of fact ${visual.factId}.`);
      }
      if (tooLong(text, 30)) problems.push("The quote is too long. Use at most 30 words.");
      if (countWords(text) < 5) problems.push("The quote is too short. Use at least 5 words.");
      // A scrap like "years. From the east" means nothing on its own, so a quote is one sentence, from its start.
      if (!/^["'“‘(]?[A-Z0-9]/.test(text)) problems.push("The quote starts in the middle of a sentence. Start where the sentence starts.");
      if (/[.!?]["”’)]?\s+\S/.test(text)) problems.push("The quote runs across two sentences. Copy one sentence, or part of one.");
      if (!lineIsGrounded(text, source)) problems.push("The quote is not about what this scene says. Pick words that say what the narration says.");
      break;
    }
    case "steps":
      for (const step of visual.steps) {
        if (tooLong(step, 6)) problems.push(`The step "${step}" is too long. Use at most 5 words.`);
        if (!isGrounded(step, source)) problems.push(ungrounded(step));
      }
      // "Exchange of goods, Exchange of ideas, ..." or "Paper spreads west, Gunpowder spreads west, ..." is a list,
      // not steps that lead to each other: one word in most of the steps gives it away.
      {
        const firstWords = visual.steps.map((step) => step.split(/\s+/)[0]?.toLowerCase() ?? "");
        const sameStart = Math.max(...firstWords.map((word) => firstWords.filter((other) => other === word).length));
        const wordSets = visual.steps.map((step) => new Set(contentWords(step)));
        const sameWord = Math.max(0, ...[...new Set(wordSets.flatMap((words) => [...words]))].map((word) => wordSets.filter((words) => words.has(word)).length));
        if (visual.steps.length >= 3 && (sameStart > visual.steps.length / 2 || (sameWord >= 3 && sameWord > visual.steps.length / 2))) {
          problems.push("These steps are a list of similar things. Steps must each lead to the next; use another kind for a list.");
        }
      }
      break;
  }
  return problems;
}

// `avoid` names the kinds this scene should not switch to.
function sceneProblems(
  { visual, lines }: SceneReply,
  allowed: Set<string>,
  facts: FactMap,
  source: string,
  avoid: string[],
): string[] {
  // The lines are only shown if the visual cannot be used, so they are worth a retry only when none of them works.
  const lineProblems = lines.some((line) => lineIsSafe(line, allowed, source)) ? [] : linesProblems(lines, allowed, source);
  const problems = visualProblems(visual, allowed, facts, source);
  // A model that keeps failing at one kind is better off switching to another than giving up to text.
  const others = SCENE_KINDS.filter((kind) => kind !== visual.kind && kind !== "text" && !avoid.includes(kind));
  const hint =
    problems.length > 0 && visual.kind !== "text" && others.length > 0
      ? [`Fix the problems below. If a ${visual.kind} cannot work with these facts, use ${others.join(" or ")} instead.`]
      : [];
  return [...hint, ...problems, ...lineProblems];
}

// The scene's plain lines, or the start of its narration if none of them is safe.
function textVisual(lines: string[], scene: NarratedScene, allowed: Set<string>): SceneVisual {
  const safeLines = lines.filter((line) => lineIsSafe(line, allowed, scene.narration));
  return { kind: "text", lines: safeLines.length > 0 ? safeLines : [scene.narration.split(/\s+/).slice(0, 7).join(" ") + "…"] };
}

// Last resort after the retries: drop whatever still breaks a rule, so one bad label does not sink the video.
// Maps and timelines keep their good parts. The other kinds are shown as the scene's plain lines instead.
function repairScene(
  { visual, lines }: SceneReply,
  scene: NarratedScene,
  allowed: Set<string>,
  facts: FactMap,
  source: string,
): SceneVisual {
  const safe = (text: string) => numbersIn(text).every((number) => allowed.has(number));
  const safeLabel = (label?: string) => (label && safe(label) && countWords(label) <= MAX_LABEL_WORDS ? label : undefined);
  const fallback = textVisual(lines, scene, allowed);

  switch (visual.kind) {
    case "text":
      return textVisual(visual.lines, scene, allowed);
    case "timeline": {
      // Kept only if every label is backed; a timeline with made-up labels is worse than plain lines.
      const focus = visual.events[visual.focusIndex];
      const events = visual.events
        .filter((event) => eventIsBacked(event, facts) && safeLabel(event.label))
        .filter((event) => isGrounded(event.label, `${source} ${facts.get(event.factId)?.text ?? ""}`))
        .filter((event, index, all) => all.findIndex((other) => other.label.toLowerCase() === event.label.toLowerCase()) === index)
        .sort((a, b) => a.year - b.year);
      const focusIndex = Math.max(0, focus ? events.indexOf(focus) : events.length - 1);
      return new Set(events.map((event) => event.year)).size >= 2 ? { kind: "timeline", events, focusIndex } : fallback;
    }
    case "map": {
      const mapLabel = (text: string | undefined, country?: string) =>
        text &&
        countWords(text) <= MAX_MAP_LABEL_WORDS &&
        mapLabelIsGrounded({ text, country }, source) &&
        !(country && (labelMismatch(text, country) || CITY_WORDS.test(text)))
          ? safeLabel(text)
          : undefined;
      const highlights = visual.highlights
        .filter((highlight) => isKnownCountry(highlight.country))
        .map((highlight) => ({ ...highlight, label: mapLabel(highlight.label, highlight.country) }));
      // The label comes from the fact-checked facts, so an arrow that goes against it has from and to swapped.
      const arrows = visual.arrows.flatMap((arrow) => {
        const [from, to] = [resolvePlace(visual, arrow.from), resolvePlace(visual, arrow.to)];
        const label = mapLabel(arrow.label);
        if (!from || !to) return [];
        return [pointsTheOtherWay(visual, arrow) ? { from: to, to: from, label } : { from, to, label }];
      });
      const markers = visual.markers
        .filter((marker) => isPlaceLabel(marker.label))
        .filter((marker) => countryContains(marker.country, marker.lon, marker.lat))
        .filter((marker) => mapLabel(marker.label));
      const frame = visual.frame.flatMap((place) => resolvePlace(visual, place) ?? []);
      if (highlights.length === 0) return fallback;
      return { kind: "map", frame: frame.length > 0 ? frame : highlights.map((h) => h.country), highlights, arrows, markers };
    }
    default:
      return visualProblems(visual, allowed, facts, source).length === 0 ? visual : fallback;
  }
}

// Same kind and the same content: the viewer would see the same picture twice.
function sameAs(a: SceneVisual, b: SceneVisual): boolean {
  if (a.kind === "map" && b.kind === "map") {
    const countries = (visual: typeof a) => visual.highlights.map((h) => h.country).sort().join(",");
    return countries(a) === countries(b) && a.arrows.length === 0 && b.arrows.length === 0;
  }
  if (a.kind === "timeline" && b.kind === "timeline") {
    return a.events.map((e) => e.year).join(",") === b.events.map((e) => e.year).join(",");
  }
  return a.kind !== "text" && a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b);
}

// Asks again, in one separate call, where each city lies. A marker only stays if both answers agree: its
// coordinates fall inside the country of the second answer, and the two positions are within 250 km. This catches
// coordinates that are simply wrong, which the first check misses when the model names a country that matches its
// own wrong coordinates, and mix-ups like the city of Karakorum and the Karakoram mountains.
async function verifyMarkers(
  title: string,
  visuals: SceneVisual[],
  narrations: string[], // the narration of the scene each visual belongs to
): Promise<{ visuals: SceneVisual[]; usage: Usage }> {
  // Each place once, with the narration of the first scene that shows it, to tell apart similar names.
  const contextOf = new Map<string, string>();
  visuals.forEach((visual, index) => {
    if (visual.kind !== "map") return;
    for (const marker of visual.markers) if (!contextOf.has(marker.label)) contextOf.set(marker.label, narrations[index]);
  });
  const places = [...contextOf.keys()];
  if (places.length === 0) return { visuals, usage: emptyUsage() };
  let secondOpinion = new Map<string, { country: string; lat: number; lon: number }>();
  let usage = emptyUsage();
  try {
    const reply = await chatJson({
      step: "direct/places",
      schemaName: "places",
      schema: z.object({
        places: z.array(z.object({ country: z.string(), lat: z.number(), lon: z.number() })).length(places.length),
      }),
      messages: placesPrompt(title, places.map((name) => ({ name, context: contextOf.get(name) ?? "" }))),
      maxTokens: 800,
      timeoutMs: SCENE_CALL_TIMEOUT_MS,
    });
    secondOpinion = new Map(places.map((place, index) => [place, reply.data.places[index]]));
    usage = reply.usage;
  } catch (error) {
    // Without the second opinion the markers cannot be trusted, so they are left out.
    console.warn(`[direct/places] Leaving out the map markers: ${error}`);
  }
  return {
    usage,
    visuals: visuals.map((visual) => {
      if (visual.kind !== "map") return visual;
      const markers = visual.markers.filter((marker) => {
        const other = secondOpinion.get(marker.label);
        if (!other || !countryContains(other.country, marker.lon, marker.lat)) return false;
        const km = geoDistance([marker.lon, marker.lat], [other.lon, other.lat]) * EARTH_RADIUS_KM;
        return km <= MAX_MARKER_GAP_KM;
      });
      if (markers.length < visual.markers.length) console.warn(`[direct/places] Dropped ${visual.markers.length - markers.length} marker(s)`);
      return { ...visual, markers };
    }),
  };
}

// The storyboard contract has no fact IDs on timeline events and no countries on markers, and a quote points to
// its source instead of its fact.
function forStoryboard(visual: SceneVisual, facts: FactMap) {
  if (visual.kind === "timeline") return { ...visual, events: visual.events.map(({ year, label }) => ({ year, label })) };
  if (visual.kind === "map") {
    return {
      ...visual,
      frame: visual.frame.flatMap((place) => resolvePlace(visual, place) ?? []),
      arrows: visual.arrows.flatMap((arrow) => {
        const from = resolvePlace(visual, arrow.from);
        const to = resolvePlace(visual, arrow.to);
        return from && to ? [{ from, to, label: arrow.label }] : [];
      }),
      markers: visual.markers.map(({ lon, lat, label }) => ({ lon, lat, label })),
    };
  }
  if (visual.kind === "quote") return { kind: "quote", text: visual.text, sourceId: facts.get(visual.factId)?.sourceId ?? "" };
  return visual;
}

export async function direct({ request, script, facts, sources }: z.infer<typeof DirectInputSchema>): Promise<DirectResult> {
  // The narration is the fact-checked text, word for word. The model only chooses what is shown.
  const factMap: FactMap = new Map(facts.map((fact) => [fact.id, fact]));
  const narrated: NarratedScene[] = script.scenes.map((scene) => ({
    id: scene.id,
    narration: scene.sentences.map((sentence) => sentence.text).join(" "),
    factIds: [...new Set(scene.sentences.flatMap((sentence) => sentence.factIds))],
  }));
  const videoFactIds = [...new Set(narrated.flatMap((scene) => scene.factIds))];
  // What is on screen may only rest on facts the video cites, so their sources are in the list next to the video.
  const videoFacts: FactMap = new Map(videoFactIds.flatMap((id) => factMap.get(id) ?? []).map((fact) => [fact.id, fact]));
  const factList = (ids: string[]) => ids.map((id) => ({ id, text: factMap.get(id)?.text ?? "", quote: factMap.get(id)?.quote ?? "" }));
  // Every year the facts state, with the fact it comes from, so a timeline can only use real ones.
  const yearList = videoFactIds.flatMap((id) => {
    const years = yearsIn(factMap.get(id)?.text ?? "");
    return years.length > 0 ? [`${id}: ${years.map((year) => (year < 0 ? `${year} (${-year} BC)` : String(year))).join(", ")}`] : [];
  });
  const videoYears = new Set(videoFactIds.flatMap((id) => yearsIn(factMap.get(id)?.text ?? ""))).size;
  // The words a scene may put on screen: its narration and the facts behind it.
  const sourceFor = (scene: NarratedScene) =>
    [scene.narration, ...scene.factIds.map((id) => factMap.get(id)?.text ?? "")].join(" ");
  const allowedFor = (scene: NarratedScene) =>
    new Set([scene.narration, ...videoFactIds.map((id) => factMap.get(id)?.text ?? "")].flatMap(numbersIn));

  // Every scene is directed in its own small call, all at once.
  const [opening, ...rest] = narrated;
  // A scene whose calls fail after the retries still gets something to show, so one bad call cannot sink the video.
  const orFallback = <T>(call: Promise<{ data: T; usage: Usage }>, fallback: T) =>
    call.catch((error) => {
      console.warn(`[direct] A scene call failed, using a fallback: ${error}`);
      return { data: fallback, usage: emptyUsage() };
    });
  const titleCall = orFallback(
    chatJson({
      step: `direct/${opening.id}`,
      schemaName: "title",
      schema: TitleVisualSchema,
      messages: directTitlePrompt(script.title, opening.narration),
      maxTokens: 300,
      timeoutMs: SCENE_CALL_TIMEOUT_MS,
      check: (visual) => titleProblems(visual, allowedFor(opening)),
      repair: () => ({ heading: script.title }),
    }),
    { heading: script.title },
  );
  // One call ranks the kinds that fit each scene, and the code picks from them so the video gets a rhythm.
  // If the call fails, each scene picks on its own.
  const missing = rest.map((scene) => kindsWithoutData(scene, factMap, videoYears));
  const plan = await chatJson({
    step: "direct/plan",
    schemaName: "plan",
    schema: z.object({
      scenes: z.array(z.object({ kinds: z.array(z.enum(SCENE_KINDS)).min(2).max(3) })).length(rest.length),
    }),
    messages: directPlanPrompt(
      script.title,
      rest.map((scene, index) => ({
        id: scene.id,
        narration: scene.narration,
        facts: scene.factIds.map((id) => factMap.get(id)?.text ?? ""),
        cannot: missing[index],
      })),
    ),
    maxTokens: 600,
    timeoutMs: SCENE_CALL_TIMEOUT_MS,
  }).catch((error) => {
    console.warn(`[direct/plan] No plan, scenes pick their own kind: ${error}`);
    return null;
  });
  const limits = kindLimits(rest.length, videoYears);
  const plannedKinds = plan ? pickKinds(plan.data.scenes.map((scene) => scene.kinds), missing, limits) : rest.map(() => undefined);
  if (plan) console.log(`[direct/plan] ${plannedKinds.map((kind) => kind ?? "free").join(", ")}`);
  // The kinds a scene should not switch to: those without data, those of the scenes next to it (maps may repeat),
  // and those the other scenes already use as often as KIND_LIMITS allows.
  const avoidFor = (index: number): SceneKind[] => {
    const others = plannedKinds.filter((_, other) => other !== index);
    const used = SCENE_KINDS.filter((kind) => others.filter((other) => other === kind).length >= limits[kind]);
    const neighbors = [plannedKinds[index - 1], plannedKinds[index + 1]].filter((kind) => kind !== undefined && kind !== "map");
    return [...new Set([...missing[index], ...neighbors, ...used])].filter(
      (kind): kind is SceneKind => kind !== undefined && kind !== "text" && kind !== plannedKinds[index],
    );
  };

  const sceneCalls = rest.map((scene, index) =>
    orFallback(
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
        plannedKind: plannedKinds[index],
        avoidKinds: avoidFor(index),
        years: yearList,
        amounts: amountsIn(sourceFor(scene)),
      }),
      maxTokens: 1000,
      timeoutMs: SCENE_CALL_TIMEOUT_MS,
      check: (reply) => [
        ...(reply.visual.kind === "text" && plannedKinds[index] && plannedKinds[index] !== "text"
          ? [`Show a ${plannedKinds[index]} or another picture, not text.`]
          : []),
        ...sceneProblems(reply, allowedFor(scene), videoFacts, sourceFor(scene), avoidFor(index)),
      ],
      repair: (reply) => ({
        visual: repairScene(reply, scene, allowedFor(scene), videoFacts, sourceFor(scene)),
        lines: reply.lines,
      }),
      }),
      { visual: textVisual([], scene, allowedFor(scene)), lines: [] },
    ),
  );
  const [title, ...scenes] = await Promise.all([titleCall, ...sceneCalls]);
  const checked = await verifyMarkers(
    script.title,
    scenes.map(({ data }) => data.visual),
    rest.map((scene) => scene.narration),
  );
  const usage = [title, ...scenes, checked, ...(plan ? [plan] : [])].reduce(
    (total, call) => addUsage(total, call.usage),
    emptyUsage(),
  );

  // The calls ran apart, so a map or timeline can repeat the one before, or the same kind can come too often in a
  // row. Then the later scene shows its lines instead, to keep some rhythm.
  const visuals: SceneVisual[] = [];
  scenes.forEach(({ data }, index) => {
    const visual = checked.visuals[index];
    const lastThree = [visuals[index - 3], visuals[index - 2], visuals[index - 1]];
    const previous = visuals[index - 1];
    const repeats = previous && sameAs(previous, visual);
    // Three maps in a row play as one journey; a fourth is too many.
    const fourthMap = visual.kind === "map" && lastThree.every((other) => other?.kind === "map");
    // Two steps, stats, quotes, charts or timelines in a row look the same; two maps of different places do not.
    const sameKind = previous && !["map", "text"].includes(visual.kind) && previous.kind === visual.kind;
    if (repeats || fourthMap || sameKind) {
      console.log(`[direct] ${rest[index].id} shows its lines instead of a ${visual.kind} that ${repeats ? "repeats the scene before" : "comes too often in a row"}`);
    }
    visuals.push(repeats || fourthMap || sameKind ? textVisual(data.lines, rest[index], allowedFor(rest[index])) : visual);
  });
  console.log(`[direct] kinds: ${visuals.map((visual, index) => (visual.kind === plannedKinds[index] ? visual.kind : `${visual.kind} (planned ${plannedKinds[index] ?? "free"})`)).join(", ")}`);

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
      ...(index === 0 ? { kind: "title", ...title.data } : forStoryboard(visuals[index - 1], videoFacts)),
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
