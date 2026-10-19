import { z } from "zod";
import { COUNTRIES, isKnownCountry } from "./countries.ts";
import { addUsage, chatJson, emptyUsage, usageOf } from "./nebius.ts";
import { CHARS_PER_SECOND, ResearchFactListSchema, ScriptSchema, SourceListSchema, VideoRequestSchema, countWords, spokenLength } from "./pipeline.ts";
import type { ResearchFact, Usage } from "./pipeline.ts";
import { directCritiquePrompt, directPlanPrompt, directScenePrompt, directTitlePrompt, placesPrompt } from "./prompts/direct.ts";
import type { OwnKind } from "./prompts/direct.ts";
import {
  datesIn,
  isDateIn,
  isDayAndMonth,
  isNameNumber,
  isPartOf,
  numbersIn,
  rangesIn,
  statesDate,
  timeKey,
  yearRangesIn,
  yearsIn,
} from "./numbers.ts";
import { isCountryName, isCountryOwnName, labelMismatch, namesAPlace, namesCity, namesCountry, namesRegionOf } from "./regions.ts";
import { questionProblems } from "./script.ts";
import { claimWords, contentWords, dropsHedge, groundedWords, isSentenceOf, sameWords, sentencesOf, wholeSentencesOf } from "./words.ts";
import {
  amountsFor,
  barIsStated,
  hasPhrase,
  isFullyGrounded,
  isGrounded,
  isNotAPerson,
  isPercent,
  isYearLike,
  lineIsGrounded,
  phraseWords,
  roleOf,
  statedTogether,
  unitKey,
} from "./grounding.ts";
import { BACKDROPS, DRAWING_TONES, FIGURE_LOOKS, SPACE_BODIES, StoryboardSchema, storyboardProblems } from "./storyboard.ts";
import { ICON_NAMES, iconKey } from "./icons.ts";
import { MOON_SEAS, MOON_SITES, moonPlace } from "./moon.ts";
import { TEMPLATES, TEMPLATE_NAMES, isTemplateName, templateParams, templateSpec } from "./templates.ts";
import type { Family, Keep, SceneData, TemplateName, TemplateVisual } from "./templates.ts";
import { fitDrawing, placeLabels } from "./drawing.ts";
import { introOptions, looksFor, pickIntro, pickLooks } from "./looks.ts";
import { saveDrawing, similarDrawings } from "./library.ts";
import { THEME_NAMES } from "./themes.ts";
import { placeOf } from "./places.ts";
import { geoDistance } from "d3-geo";
import { canDraw, countryCenter, countryContains } from "./world.ts";
import type { DrawingPart, Storyboard } from "./storyboard.ts";

const PAUSE_SEC = 0.6;
const MIN_SCENE_SEC = 2.5;
// Scene calls are small and usually take 1 to 3 seconds, so a slow one is better tried again early.
const SCENE_CALL_TIMEOUT_MS = 20_000;
// The route may run for 120 s. Directing starts no model call after 90 s, so slow calls cannot sink the video.
const DIRECT_DEADLINE_MS = 90_000;
// The plan only helps, so a slow plan gives way and the scenes pick their own kinds.
const PLAN_DEADLINE_MS = 30_000;
// The critique only polishes the plan, so it gets less time, and changes at most a few scenes.
const CRITIQUE_DEADLINE_MS = 15_000;
const MAX_CRITIQUE_CHANGES = 3;
// A second try for a scene that ended as text starts only with this much time left before the scene calls stop.
const SECOND_TRY_MS = 15_000;
// Scene calls stop this long before the deadline, to leave time for the check of map markers.
const MARKER_CHECK_MS = 10_000;
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
  facts: ResearchFactListSchema,
  sources: SourceListSchema,
});

export type DirectResult = { storyboard: Storyboard; usage: Usage };

const TitleVisualSchema = z.object({ heading: z.string(), subheading: z.string().optional(), icon: z.string().optional() });

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
    // Routes drawn along their way. Stops are city names the code places from its own table, or marker labels.
    routes: z
      .array(z.object({ stops: z.array(z.string()).min(2).max(6), by: z.enum(["land", "sea"]), label: z.string().optional() }))
      .max(2),
  }),
  z.object({
    kind: z.literal("timeline"),
    // Each event names the fact that gives its year, and its date when events share a year. The fact ID is
    // checked, then left out of the storyboard.
    events: z
      .array(z.object({ year: z.number().int(), date: z.string().optional(), label: z.string(), factId: z.string() }))
      .min(2)
      .max(5),
    focusIndex: z.number().int(),
    // Periods drawn as bands under the events, each from the fact that gives its start and end year.
    eras: z.array(z.object({ start: z.number().int(), end: z.number().int(), label: z.string(), factId: z.string() })).max(3),
  }),
  z.object({
    kind: z.literal("stat"),
    value: z.number(),
    valueMax: z.number().optional(),
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
  // Icons are names from lib/icons.ts; an unknown one is dropped, never worth a retry.
  z.object({ kind: z.literal("steps"), steps: z.array(z.string()).min(2).max(5), icons: z.array(z.string()).max(5) }),
  z.object({
    kind: z.literal("list"),
    items: z.array(z.object({ title: z.string(), detail: z.string().optional(), icon: z.string().optional() })).min(2).max(4),
  }),
  z.object({
    kind: z.literal("versus"),
    left: z.string(),
    right: z.string(),
    leftIcon: z.string().optional(),
    rightIcon: z.string().optional(),
    rows: z.array(z.object({ label: z.string(), left: z.string(), right: z.string() })).min(2).max(4),
  }),
  z.object({
    kind: z.literal("people"),
    people: z
      .array(z.object({ name: z.string(), role: z.string().optional(), look: z.enum(FIGURE_LOOKS), prop: z.string().optional() }))
      .min(1)
      .max(4),
  }),
  z.object({
    kind: z.literal("space"),
    view: z.enum(["journey", "moon"]),
    bodies: z.array(z.enum(SPACE_BODIES)).max(4),
    craft: z.object({ from: z.enum(SPACE_BODIES), to: z.enum(SPACE_BODIES), label: z.string().optional() }).optional(),
    // Seas and landing sites on the Moon, by name; the code places them.
    sites: z.array(z.string()).max(4),
  }),
  z.object({
    kind: z.literal("illustration"),
    title: z.string().optional(),
    items: z
      .array(
        z.object({
          icon: z.string().optional(),
          figure: z.enum(FIGURE_LOOKS).optional(),
          label: z.string().optional(),
          x: z.number(),
          y: z.number(),
          size: z.enum(["small", "medium", "large"]).optional(),
        }),
      )
      .min(2)
      .max(6),
    links: z.array(z.object({ from: z.number().int(), to: z.number().int(), label: z.string().optional() })).max(5),
    backdrop: z.enum(BACKDROPS).optional(),
  }),
  z.object({ kind: z.literal("change"), from: z.string(), to: z.string(), year: z.number().int().optional() }),
  // A diagram drawn from simple parts on the 0 to 100 grid; the code clamps them to the grid and draws them. Each label
  // names one part by its position in the list, and the code places it beside that part (lib/drawing.ts).
  z.object({
    kind: z.literal("drawing"),
    title: z.string().optional(),
    parts: z
      .array(
        z.discriminatedUnion("shape", [
          z.object({ shape: z.literal("band"), y1: z.number(), y2: z.number(), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("box"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("blob"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("cone"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("tube"), points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(6), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("arrow"), points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(6), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("flow"), points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(6), tone: z.enum(DRAWING_TONES) }),
          z.object({ shape: z.literal("icon"), name: z.string(), x: z.number(), y: z.number(), size: z.enum(["small", "medium", "large"]) }),
        ]),
      )
      .min(3)
      .max(10),
    labels: z.array(z.object({ text: z.string(), part: z.number().int() })).min(2).max(6),
  }),
]);

const SCENE_KINDS = [
  "map",
  "timeline",
  "stat",
  "compare",
  "quote",
  "steps",
  "list",
  "versus",
  "change",
  "people",
  "space",
  "illustration",
  "drawing",
  "text",
] as const;
type SceneKind = (typeof SCENE_KINDS)[number];
// A kind of scene: one of the director's own, or one of Trym's templates.
type AnyKind = SceneKind | TemplateName;
const ALL_KINDS = [...SCENE_KINDS, ...TEMPLATE_NAMES] as [AnyKind, ...AnyKind[]];

// Icons that are signs, not things, so a free picture does not use them as items.
const SIGN_ICONS = new Set(["arrowup", "arrowdown", "plus", "minus", "check", "cross"]);

// Kinds that tell more than they show; a drawing made for the topic replaces these first.
const PLAIN_KINDS: AnyKind[] = ["text", "list", "steps", "quote", "illustration", "drawing", "big_statement", "kinetic_words", "definition_card"];

// Which of the director's own kinds look alike on screen (see Family in lib/templates.ts).
const FAMILIES: Record<SceneKind, Family> = {
  map: "map",
  timeline: "time",
  stat: "number",
  compare: "chart",
  quote: "words",
  steps: "chain",
  list: "cards",
  versus: "sides",
  change: "sides",
  people: "people",
  space: "picture",
  illustration: "picture",
  drawing: "picture",
  text: "words",
};
const familyOf = (kind: AnyKind): Family => (isTemplateName(kind) ? templateSpec(kind).family : FAMILIES[kind]);

// How often each kind may appear among a video's scenes. Maps are the strongest picture and follow on from each
// other, but not every time.
function kindLimits(scenes: number, geographic: boolean): Record<AnyKind, number> {
  const own: Record<SceneKind, number> = {
    map: geographic ? Math.max(2, Math.round(scenes * 0.65)) : 0,
    // A second timeline mostly showed the same events again.
    timeline: 1,
    stat: 2,
    compare: 2,
    quote: scenes >= 8 ? 2 : 1,
    // Without maps, a process topic like how vaccines work needs more steps to avoid plain text.
    steps: geographic ? 2 : 3,
    list: 2,
    versus: 1,
    change: 1,
    people: 2,
    space: 2,
    illustration: 2,
    drawing: 1, // the model's own drawing is the video's signature scene; two of them were often one too many
    text: 2,
  };
  // Each template at most once: a second cycle or myth card in one video looks like a repeat.
  return { ...own, ...Object.fromEntries(TEMPLATE_NAMES.map((name) => [name, 1])) } as Record<AnyKind, number>;
}

// How often scenes of one family may appear. Words on screen (text, quotes, statements, cards) are the weakest
// pictures, so a video gets only a few of them, whatever their kind.
const familyLimits = (scenes: number): Partial<Record<Family, number>> => ({ words: scenes >= 9 ? 3 : 2 });

// What a kind must respect to go to a scene: the kinds its facts have no data for (`missing`, by scene), and how
// often each kind and family may appear.
type KindRules = { missing: AnyKind[][]; limits: Record<AnyKind, number>; families: Partial<Record<Family, number>> };

// Whether a kind may go to scene `index`, given the kinds picked for the other scenes: not a kind its facts have no
// data for, each kind and family at most as often as the rules allow, no kind twice in a row except maps, and no
// four maps in a row. `strict` also keeps two scenes of one family apart, so each scene looks different from the one
// before.
function kindFits(kind: AnyKind, index: number, picked: (AnyKind | undefined)[], rules: KindRules, strict: boolean): boolean {
  if (rules.missing[index].includes(kind)) return false;
  const others = picked.filter((other, at): other is AnyKind => at !== index && other !== undefined);
  if (others.filter((other) => other === kind).length >= rules.limits[kind]) return false;
  const family = familyOf(kind);
  if (others.filter((other) => familyOf(other) === family).length >= (rules.families[family] ?? Infinity)) return false;
  if (kind === "map") {
    const isMap = (at: number) => at === index || picked[at] === "map";
    return ![index - 3, index - 2, index - 1, index].some((start) => [0, 1, 2, 3].every((offset) => isMap(start + offset)));
  }
  const neighbors = [picked[index - 1], picked[index + 1]].filter((other): other is AnyKind => other !== undefined);
  if (neighbors.includes(kind)) return false;
  return !strict || !neighbors.some((other) => familyOf(other) === family);
}

// Picks one kind per scene from the model's ranked choices, keeping the rhythm (see kindFits). First choices are
// placed before second choices, so a kind goes to the scenes it suits best, and a choice that looks like the scene
// next to it waits until the scenes' other choices are tried. Text comes last: a scene gets it only when none of its
// other choices fits. A scene where none of its choices fits gets no plan and picks its own kind.
function pickKinds(choices: AnyKind[][], rules: KindRules): (AnyKind | undefined)[] {
  const picked: (AnyKind | undefined)[] = choices.map(() => undefined);
  for (const strict of [true, false]) {
    for (let rank = 0; rank < 3; rank++) {
      choices.forEach((ranked, index) => {
        const kind = ranked[rank];
        if (picked[index] === undefined && kind && kind !== "text" && kindFits(kind, index, picked, rules, strict)) picked[index] = kind;
      });
    }
  }
  choices.forEach((ranked, index) => {
    if (picked[index] === undefined && ranked.includes("text") && kindFits("text", index, picked, rules, false)) picked[index] = "text";
  });
  return picked;
}

type TitleVisual = z.infer<typeof TitleVisualSchema>;
type SceneVisual = z.infer<typeof SceneVisualSchema>; // the director's own kinds
type AnyVisual = SceneVisual | TemplateVisual;
type MapVisual = Extract<SceneVisual, { kind: "map" }>;
// The reply also has plain lines to show if the visual cannot be used, for example when it repeats the scene before.
type SceneReply = { visual: AnyVisual; lines: string[] };
const isTemplateVisual = (visual: AnyVisual): visual is TemplateVisual => isTemplateName(visual.kind);

// The reply a scene may give: one of the director's own kinds, or one of the templates offered to it.
// The reply for one scene: the director's own kinds except those it may not use (`blocked`), and the templates offered.
function sceneReplySchema(templates: TemplateName[], blocked: AnyKind[] = []): z.ZodType<SceneReply> {
  const own = SceneVisualSchema.options.filter((option) => !blocked.includes(option.shape.kind.value));
  const options = [...own, ...templates.map((name) => TEMPLATES[name].schema)];
  // Typed as the director's own kinds only; a template's reply is typed loosely as TemplateVisual, and each is
  // checked against its own schema here.
  const visual = z.discriminatedUnion("kind", options as unknown as typeof SceneVisualSchema.options);
  return z.object({ visual, lines: z.array(z.string()).min(1).max(3) }) as unknown as z.ZodType<SceneReply>;
}
type NarratedScene = { id: string; narration: string; factIds: string[] };
type FactMap = Map<string, ResearchFact>; // by fact ID

// A bar labeled with a unit instead of a thing.
const UNIT_LABEL = /^(tonnes?|tons?|kilo(gram)?s?|kg|pounds?|lbs?|km|kilomet(er|re)s?|miles?|met(er|re)s?|feet|years?|days?|dollars?|euros?|percent|%)$/i;

// Whether a range is in the stat's unit: "25 to 50 million" fits a stat in millions or of "million people", and a
// stat without a unit whose label has the word, like "ships" in "ships sank". "4 to 5 years" does not fit a stat in
// millions. A range with no unit word after it fits any stat.
function unitFits(rangeUnit: string, stat: { unit?: string; label: string }): boolean {
  if (!rangeUnit) return true;
  const key = unitKey(rangeUnit);
  const unit = stat.unit ?? "";
  return [unit, ...unit.split(/\s+/), ...claimWords(stat.label)].some((word) => word !== "" && unitKey(word) === key);
}

// Whether a label is only a date or a time, like "July 20, 1969" or "After 4:00 PM EDT", with nothing that happens.
const DATE_PARTS = /\b(january|february|march|april|may|june|july|august|september|october|november|december|edt|est|utc|gmt|am|pm|a\.m|p\.m|after|before|around|about|on|at|in)\b/gi;
const isOnlyADate = (text: string) => /\d/.test(text) && claimWords(text.replace(DATE_PARTS, " ")).every((word) => /^\d+$/.test(word));

// Event labels sit side by side under a timeline, and long ones run into their neighbors. The more events, the less
// room each label has.
const maxEventLabelChars = (events: number) => (events <= 3 ? 40 : events === 4 ? 34 : 30);

// Dates are not amounts: "14th century" or "700 CE" in a stat or a chart means the model should have used a timeline.
const DATE_WORDS = /\b(\d+(st|nd|rd|th)|century|centuries|ce|bce|bc|ad)\b|\bc\.$/i;

// Markers are for cities, so a marker named after a country or a region is a mistake.
const countryNames = new Set(Object.values(COUNTRIES).map((country) => country.name.toLowerCase()));
const REGION_WORDS = /\b(asia|europe|africa|america|middle east|steppes?|desert|basin|ocean|sea|mountains|range|empire|dynasty|kingdom|route|road)\b/i;
const CITY_WORDS = /\b(port|city|town|capital|harbou?r|village)\b/i;
const isPlaceLabel = (label: string) => !countryNames.has(label.trim().toLowerCase()) && !REGION_WORDS.test(label);
// A country code a map can draw: a real one, and not Antarctica.
const isMapCountry = (code: string) => isKnownCountry(code) && canDraw(code);

// An amount in percent, like "45%" or "12.5 percent".
const PERCENT_AMOUNT = /\d(?:[\d,.]*\d)?\s*(?:%|percent\b|per cent\b)/gi;

// Estimated from the word count until the voice-over sets the real length.
export function sceneDuration(narration: string): number {
  const seconds = spokenLength(narration) / CHARS_PER_SECOND + PAUSE_SEC;
  return Math.max(MIN_SCENE_SEC, Math.round(seconds * 10) / 10);
}

// What is wrong with a period on a timeline: its fact must state it as one period, like "ruled from 1451 to 1481",
// not as two years of different events. It must overlap the events' years (`span`), and its label must use the
// scene's or the fact's words.
function eraProblems(
  era: { start: number; end: number; label: string; factId: string },
  facts: FactMap,
  source: string,
  span: [number, number],
): string[] {
  const problems: string[] = [];
  const fact = facts.get(era.factId);
  if (!fact) return [`The period "${era.label}" cites ${era.factId}, which is not a fact in this video.`];
  const periods = yearRangesIn(fact.text);
  if (!periods.some(([start, end]) => start === era.start && end === era.end)) {
    const given = periods.map(([start, end]) => `${start} to ${end}`).join(", ");
    problems.push(
      `Fact ${era.factId} does not give ${era.start} to ${era.end} as one period${given ? `; it gives ${given}` : ""}. Use a period its fact states, or leave eras empty.`,
    );
  }
  if (era.end < span[0] || era.start > span[1]) problems.push(`The period "${era.label}" lies outside the events' years. Leave it out.`);
  if (countWords(era.label) > MAX_LABEL_WORDS) problems.push(`The period label "${era.label}" is too long. Use at most 4 words.`);
  if (!isGrounded(era.label, `${source} ${fact.text}`)) problems.push(`"${era.label}" says something the narration does not. Use the narration's own words.`);
  return problems;
}

// An event's year must be one its fact states, with the same sign for BC.
const eventIsBacked = (event: { year: number; factId: string }, facts: FactMap) =>
  yearsIn(facts.get(event.factId)?.text ?? "").includes(event.year);

// Words for places a world map cannot show.
const SPACE_WORDS =
  /\b(moon|lunar|mars|orbit|orbital|spacecraft|spaceflight|spacewalk|astronauts?|rockets?|planet|planets|galaxy|asteroid|comet|crater|tranquility)\b/i;

// The whole sentences of 5 to 30 words in a source quote, which is what a quote scene may show.
const quotableSentences = (quote: string) =>
  wholeSentencesOf(quote).filter((sentence) => {
    const words = countWords(sentence);
    return words >= 5 && words <= 30 && !/[|•·]/.test(sentence);
  });
const hasWholeSentence = (quote: string) => quotableSentences(quote).length > 0;

// Words that tell one thing leads to another, in the past or the present tense, since a process like how vaccines
// work is told in the present ("triggers", "becomes"). Steps are drawn with arrows between them, which say "this led
// to that", so a narration without such a word is a list and gets no steps.
const SEQUENCE_WORDS =
  /\b(led|leads?|leading|caus(e|ed|es|ing)|so|then|next|after(wards)?|because|result(s|ed|ing)?|until|before|first|finally|eventually|began|begin(s|ning)?|start(s|ed|ing)?|made|mak(e|es|ing)|turn(s|ed|ing)?|forc(e|es|ed|ing)|push(es|ed|ing)?|allow(s|ed|ing)?|enabl(e|es|ed|ing)|weaken(s|ed|ing)?|brought|bring(s|ing)?|trigger(s|ed|ing)?|spark(s|ed|ing)?|became|become(s)?|becoming|grew|grow(s|ing|n)?|cut(s|ting)?|end(s|ed|ing)?|clos(e|es|ed|ing)|drove|driv(e|es|ing)|spur(s|red|ring)?|prompt(s|ed|ing)?|fuel(s|led|ed|ling|ing)?|activat(e|es|ed|ing)|produc(e|es|ed|ing)|releas(e|es|ed|ing)|therefore|thus)\b/i;

// Words that start with a capital but are not names of people.
const NOT_NAMES = new Set(
  "i the a an in on at by of to from for and but or so it its this that these those he she they his her their we our you your there then when after before during while since until as with into over under between january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday god".split(
    " ",
  ),
);

// Whether a narration names someone: a capitalized word that is not the first of a sentence, a place or a month,
// like "Neil Armstrong" or "Robespierre". A loose test; the people check then wants every name in the narration.
function namesAPerson(text: string): boolean {
  return [...text.matchAll(/\p{Lu}[\p{Ll}'’-]+/gu)].some((match) => {
    const before = text.slice(0, match.index);
    const startsSentence = before.trim() === "" || /[.!?:"“]\s*$/.test(before);
    return !startsSentence && !NOT_NAMES.has(match[0].toLowerCase()) && !namesAPlace(match[0]);
  });
}

// Words that set two things side by side. A scoreboard compares two sides, so a narration without such a word
// gets none: "The Wall came down over days and weeks" has no two sides to score.
const VERSUS_WORDS =
  /\b(while|whereas|but|unlike|compared|comparison|than|versus|vs|both|instead|contrast|differ(s|ed|ent|ence|ences)?|same|similar|other|each|either|neither|rival(s|ry)?|against)\b/i;

// Words that tell a name or a status changed into another. A change scene strikes out the old one, so a narration that
// only says something ended gets no change scene.
const CHANGE_WORDS =
  /\b(renam(e|es|ed|ing)|became|become(s)?|becoming|chang(e|es|ed|ing)|turn(s|ed|ing)? into|replac(e|es|ed|ing)|succeed(s|ed|ing)?|known as|called|now|new name|transform(s|ed|ing)?|convert(s|ed|ing)?)\b/i;

// The kinds a scene cannot use, because its facts lack the data: a timeline needs a year in the scene's own facts
// and another year somewhere in the video, a stat one amount, a chart two, a quote a source quote, steps a narration
// where one thing leads to another, a scoreboard a narration that compares two things, and a change a narration
// where a name or status changes.
function kindsWithoutData(scene: NarratedScene, facts: FactMap, videoYears: number, data: SceneData): AnyKind[] {
  const factTexts = scene.factIds.map((id) => facts.get(id)?.text ?? "");
  const amounts = amountsFor([scene.narration, ...factTexts].join(" ")).length;
  // A template fits only a scene with what it shows, like a loop for a cycle or a range for an uncertain number.
  const missing: AnyKind[] = TEMPLATE_NAMES.filter((name) => !templateSpec(name).fits(data));
  if (factTexts.every((text) => yearsIn(text).length === 0) || videoYears < 2) missing.push("timeline");
  if (amounts < 1) missing.push("stat");
  if (amounts < 2) missing.push("compare");
  if (!scene.factIds.some((id) => hasWholeSentence(facts.get(id)?.quote ?? ""))) missing.push("quote");
  if (!SEQUENCE_WORDS.test(scene.narration)) missing.push("steps");
  if (!VERSUS_WORDS.test(scene.narration)) missing.push("versus");
  // A space scene shows a journey between bodies or places on the Moon, so it needs a body besides the Earth: a scene
  // about a satellite in orbit around the Earth has nothing to show there.
  if (!SPACE_WORDS.test(scene.narration) || !/\b(moon|lunar|mars|martian|sun|solar)\b/i.test(scene.narration)) missing.push("space");
  if (!namesAPerson([scene.narration, ...factTexts].join(" "))) missing.push("people");
  if (!CHANGE_WORDS.test(scene.narration)) missing.push("change");
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
// A map label names a place the scene or another fact of the video names, like a city on the route, or is just the
// name of the country it is on.
const mapLabelIsGrounded = (label: { text: string; country?: string }, source: string, facts: FactMap) =>
  isGrounded(label.text, source) ||
  isGrounded(label.text, [...facts.values()].map((fact) => fact.text).join(" ")) ||
  (label.country !== undefined && isCountryName(label.text, label.country));

// The directions a text gives: "eastward", "to the west", "carried silk west". Names are not directions: "East Asia",
// "West Berlin", "the Middle East", "eastern Europe", and "the West" or "the East" with a capital, the sides in the
// Cold War.
const PLACE_AFTER_DIRECTION =
  /^\s+(?:asia|africa|indies|berlin|germany|europe|bank|coast|side|end|roman|timor|pakistan|bengal|virginia|india|indian|jerusalem|java|anglia|prussia|wing|point|front)\b/i;
function directionsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/\b(east|west)(?:wards?)?\b/gi)) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    if (/\b(?:middle|near|far)\s+$/i.test(before) || PLACE_AFTER_DIRECTION.test(after)) continue;
    if (/^(?:East|West)$/.test(match[0]) && /\bthe\s+$/i.test(before)) continue;
    found.add(match[1].toLowerCase());
  }
  return found;
}

// Whether every direction an arrow's label gives is one the narration or facts give too. A made-up "Eastward" must
// not decide which way an arrow points.
const directionIsBacked = (label: string | undefined, source: string) => {
  const backed = directionsIn(source);
  return [...directionsIn(label ?? "")].every((direction) => backed.has(direction));
};

// An arrow labeled "eastward" that goes west, or the other way round: the model mixed up from and to.
function pointsTheOtherWay(visual: MapVisual, arrow: { from: string; to: string; label?: string }) {
  const directions = directionsIn(arrow.label ?? "");
  const from = resolvePlace(visual, arrow.from);
  const to = resolvePlace(visual, arrow.to);
  const [start, end] = [from && countryCenter(from), to && countryCenter(to)];
  if (directions.size !== 1 || !start || !end) return false;
  const eastward = ((end[0] - start[0] + 540) % 360) - 180 > 0;
  return directions.has("east") !== eastward;
}

// The model sometimes writes a city where a country code belongs, in an arrow or the frame. When that city is one
// of the scene's markers, it means the marker's country.
function resolvePlace(visual: Extract<SceneVisual, { kind: "map" }>, value: string): string | null {
  if (isMapCountry(value)) return value;
  const marker = visual.markers.find((m) => m.label.trim().toLowerCase() === value.trim().toLowerCase());
  return marker && isMapCountry(marker.country) ? marker.country : null;
}

// Text on screen, so its numbers and length can be checked. Timeline years are checked against their facts,
// and a quote against its fact's quote.
function shownText(visual: SceneVisual): string[] {
  switch (visual.kind) {
    case "text":
      return visual.lines;
    case "timeline":
      return [...visual.events.map((event) => event.label), ...visual.eras.map((era) => era.label)];
    case "map":
      return [
        ...visual.highlights.map((h) => h.label ?? ""),
        ...visual.arrows.map((a) => a.label ?? ""),
        ...visual.markers.map((m) => m.label),
        ...visual.routes.flatMap((route) => [route.label ?? "", ...route.stops]),
      ];
    case "stat":
      return [
        String(visual.value),
        visual.valueMax === undefined ? "" : String(visual.valueMax),
        visual.total === undefined ? "" : String(visual.total),
        visual.unit ?? "",
        visual.label,
      ];
    case "compare":
      return [visual.title, visual.unit ?? "", ...visual.bars.flatMap((bar) => [bar.label, String(bar.value)])];
    case "quote":
      return [];
    case "steps":
      return visual.steps;
    case "list":
      return visual.items.flatMap((item) => [item.title, item.detail ?? ""]);
    case "versus":
      return [visual.left, visual.right, ...visual.rows.flatMap((row) => [row.label, row.left, row.right])];
    case "change":
      return [visual.from, visual.to, visual.year === undefined ? "" : String(visual.year)];
    case "people":
      return visual.people.flatMap((person) => [person.name, person.role ?? ""]);
    case "space":
      return [visual.craft?.label ?? "", ...visual.sites];
    case "illustration":
      return [visual.title ?? "", ...visual.items.map((item) => item.label ?? ""), ...visual.links.map((link) => link.label ?? "")];
    case "drawing":
      return [visual.title ?? "", ...visual.labels.map((label) => label.text)];
  }
}

// The words a narration uses for each body a space scene can show. Earth needs none: a launch starts there.
const BODY_WORDS: Record<(typeof SPACE_BODIES)[number], RegExp> = {
  earth: /./,
  moon: /\b(moon|lunar)\b/i,
  sun: /\b(sun|solar)\b/i,
  mars: /\b(mars|martian)\b/i,
};

// Words that tell of a journey along a way: a voyage, a trade route, a march. Such a map draws a route.
const TRAVEL_WORDS =
  /\b(sail(s|ed|ing)?|voyages?|routes?|roads?|caravans?|journey(s|ed)?|travell?(ed|ing)?|march(es|ed|ing)?|shipped)\b/i;

// The words that show a figure would hold a thing: a flask for an experiment, a flag for a flag. Other icons need
// their own name in the narration.
const PROP_WORDS: Partial<Record<string, RegExp>> = {
  flask: /\b(experiment|laborator|lab\b|chemi|scien)/i,
  microscope: /\b(microscop|cells?\b|bacteri|germs?\b)/i,
  book: /\b(books?|wrote|writ|author|reads?\b|read\b)/i,
  scroll: /\b(laws?\b|decree|treaty|declar|document|charter|edict)/i,
  letter: /\b(letters?|wrote)/i,
  sword: /\b(swords?|battles?|fought|knights?|wars?\b)/i,
  shield: /\b(shields?|defen)/i,
  syringe: /\b(vaccin|inject|inocul)/i,
  telescope: /\b(telescopes?|astronom|observ)/i,
  map: /\b(maps?|mapped|explor)/i,
  compass: /\b(compass|navigat)/i,
  crown: /\b(crowns?|crowned|kings?|queens?|emperors?|empress|monarch)/i,
  gavel: /\b(courts?|judges?|trials?|verdict)/i,
  ballot: /\b(votes?|voted|voting|elect|ballots?)/i,
};
const propFits = (prop: string, source: string) => {
  const key = iconKey(prop);
  return key !== undefined && (PROP_WORDS[key] ?? new RegExp(`\\b${key}`, "i")).test(source);
};

// Places in COUNTRIES small enough that the country is its city or its island, so a route may stop there by that name.
const CITY_STATES = new Set(["SGP", "HKG", "MAC", "VAT", "MCO", "SMR", "BHR", "MLT", "KWT", "LUX", "DJI", "BMU", "CUW", "GUM", "FLK", "SHN", "PRI"]);
const namesACountry = (text: string) => Object.keys(COUNTRIES).some((code) => !CITY_STATES.has(code) && isCountryOwnName(text, code));

// A stop's own name, without the note after it: "Kaffa" for "Kaffa (Crimea)" or "Calicut, India".
const stopName = (stop: string) => stop.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();

// Words of the sea, without which a route is not a sea route.
const SEA_WORDS = /\b(sail(s|ed|ing|ors?)?|ships?|fleets?|voyages?|seas?|ocean|ports?|navy|naval|boats?|maritime|harbou?rs?|coasts?|galleons?)\b/i;

// Words that show a figure's look is right for the person it stands for: a crown only for a king, queen or emperor,
// and not for Martin Luther King, a spacesuit only in a story about space. A plain figure needs nothing.
const LOOK_WORDS: Record<(typeof FIGURE_LOOKS)[number], RegExp | null> = {
  person: null,
  astronaut: /\b(astronauts?|cosmonauts?|spacewalk|moonwalk|lunar|module|apollo|space|spacecraft|orbit|moon)\b/i,
  scientist: /\b(scientists?|physicists?|chemists?|biologists?|researchers?|discover(ed|y|ies)?|experiments?|laborator(y|ies)|inventors?|invented|mathematicians?)\b/i,
  soldier: /\b(soldiers?|army|armies|troops|generals?|fought|military|marines?|officers?|commanders?|legions?|warriors?|knights?)\b/i,
  ruler: /\b(kings?|queens?|emperors?|empress|sultans?|tsars?|czars?|pharaohs?|khans?|shahs?|caliphs?|monarchs?|princes?|princess|dukes?|duchess|kaiser|regent)\b/i,
  worker: /\b(workers?|miners?|builders?|labou?rers?|strikers?|strike|factory|craftsmen|peasants?|farmers?)\b/i,
  explorer: /\b(explorers?|expeditions?|navigators?|voyages?|sailed|discovered|reached|climbers?|mountaineers?)\b/i,
  doctor: /\b(doctors?|physicians?|surgeons?|nurses?|medics?|medicine|treated)\b/i,
};
// The sentences that name a person, without the person's own name, so "King" in "Martin Luther King" is no title.
const aboutPerson = (name: string, source: string) => {
  const nameWords = new Set(phraseWords(name));
  return sentencesOf(source)
    .filter((sentence) => groundedWords(name, sentence).matched > 0)
    .map((sentence) => sentence.split(/\s+/).filter((word) => !nameWords.has(word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))).join(" "))
    .join(" ");
};
function lookFits(look: (typeof FIGURE_LOOKS)[number], name: string, role: string | undefined, source: string): boolean {
  const words = LOOK_WORDS[look];
  if (!words) return true;
  // A spacesuit fits anyone in a story about space; other looks need their words next to the person.
  return words.test(`${aboutPerson(name, source)} ${role ?? ""}`) || (look === "astronaut" && words.test(source));
}

// Where a text is first named in the narration (then the facts), so things can come in the order they are spoken.
const firstMention = (text: string, narration: string, source: string) => {
  const words = claimWords(text).filter((word) => word.length > 2);
  const at = (where: string) => Math.min(...words.map((word) => where.toLowerCase().indexOf(word)).filter((index) => index >= 0), Infinity);
  const inNarration = at(narration);
  return Number.isFinite(inNarration) ? inNarration : narration.length + at(source);
};

// Whether a route stop is a city the map can place: one of the scene's markers, or a city in the code's own table.
const stopMarker = (visual: MapVisual, stop: string) =>
  visual.markers.find((marker) => marker.label.trim().toLowerCase() === stop.trim().toLowerCase());

// What is wrong with a route stop: it must be one of the scene's markers, or a city (not a country) in the code's
// table, named in the narration or facts, in a country the map shows. Memphis on a map of the United States is not
// the Memphis in Egypt the table holds; the model then gives it as a marker.
function stopProblems(visual: MapVisual, stop: string, source: string, facts: FactMap): string[] {
  if (stopMarker(visual, stop)) return [];
  if (namesACountry(stopName(stop))) return [`"${stop}" names a country. A route stops at cities and ports: name one, or give it as a marker.`];
  const place = placeOf(stop);
  if (!place) return [`The route stop "${stop}" is not a city the map knows. Use a city the narration or facts name, or give it as a marker.`];
  const factText = [...facts.values()].map((fact) => fact.text).join(" ");
  if (!isFullyGrounded(stopName(stop), source) && !isFullyGrounded(stopName(stop), factText)) {
    return [`"${stop}" says something the narration does not. Use the narration's own words.`];
  }
  const shown = new Set([...visual.frame, ...visual.highlights.map((h) => h.country), ...visual.markers.map((m) => m.country)]);
  if (!shown.has(place.country)) {
    return [`"${stop}" is placed in ${COUNTRIES[place.country]?.name ?? place.country}, which this map does not show. Add that country to the frame if it is right, or give the city as a marker.`];
  }
  return [];
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
        if (!mapLabelIsGrounded(label, source, facts)) problems.push(ungrounded(label.text));
      }
      for (const arrow of visual.arrows) {
        if (!directionIsBacked(arrow.label, source)) {
          problems.push(`The arrow label "${arrow.label}" gives a direction the narration does not. Leave the direction out.`);
        } else if (pointsTheOtherWay(visual, arrow)) {
          problems.push(`The arrow "${arrow.label}" from ${arrow.from} to ${arrow.to} points the other way. Swap from and to.`);
        }
      }
      for (const highlight of visual.highlights) {
        const mismatch = highlight.label ? labelMismatch(highlight.label, highlight.country) : null;
        if (mismatch) {
          problems.push(`The label "${highlight.label}" is on ${highlight.country}, but ${mismatch}. Label each country with its own name or a region it lies in.`);
        }
        // Coloring all of a big country to point at one port in it misleads, so cities go in markers. A city in
        // brackets, like "Crimea (Kaffa)", is one too.
        if (
          highlight.label &&
          (CITY_WORDS.test(highlight.label) ||
            /[()]/.test(highlight.label) ||
            namesCity(highlight.label, highlight.country) ||
            visual.markers.some((m) => m.label === highlight.label))
        ) {
          problems.push(`"${highlight.label}" names a city. Put cities in markers, and highlight only countries or regions.`);
        }
      }
      const places = [...visual.frame, ...visual.arrows.flatMap((arrow) => [arrow.from, arrow.to])];
      const unknown = [
        ...new Set([
          ...places.filter((place) => resolvePlace(visual, place) === null),
          ...visual.highlights.map((highlight) => highlight.country).filter((code) => !isMapCountry(code)),
        ]),
      ];
      if (unknown.length > 0) {
        const antarctica = unknown.includes("ATA") ? " The map cannot show Antarctica." : "";
        problems.push(`Unknown country codes: ${unknown.join(", ")}. Use ISO 3166-1 alpha-3 codes of today's countries.${antarctica}`);
      }
      for (const route of visual.routes) {
        if (route.label && (!mapLabelIsGrounded({ text: route.label }, source, facts) || !directionIsBacked(route.label, source))) {
          problems.push(ungrounded(route.label));
        }
        if (route.by === "sea" && !SEA_WORDS.test(source)) problems.push('The narration says nothing of the sea. Give this route "by" land, or use arrows.');
        for (const stop of route.stops) problems.push(...stopProblems(visual, stop, source, facts));
        if (new Set(route.stops.map((stop) => stop.trim().toLowerCase())).size < route.stops.length) {
          problems.push(`The route through ${route.stops.join(", ")} visits a stop twice.`);
        }
      }
      // A voyage or a trade route through known places is drawn along its way, with a ship or a camel on it, not as
      // arrows between countries.
      if (visual.routes.length === 0 && visual.arrows.length > 0 && visual.markers.length >= 2 && TRAVEL_WORDS.test(source)) {
        problems.push(
          'This is a journey along a way. Give it as "routes": its stops in order (your markers or cities the narration names), by land or sea, instead of arrows.',
        );
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
        const factText = facts.get(event.factId)?.text ?? "";
        const maxChars = maxEventLabelChars(visual.events.length);
        if (tooLong(event.label, MAX_LABEL_WORDS) || event.label.length > maxChars) {
          problems.push(`The label "${event.label}" is too long. Use at most 4 short words, ${maxChars} letters in all.`);
        }
        if (!isGrounded(event.label, `${source} ${factText}`)) problems.push(ungrounded(event.label));
        if (!facts.has(event.factId)) {
          problems.push(`"${event.label}" cites ${event.factId}, which is not a fact in this video.`);
        } else if (!eventIsBacked(event, facts)) {
          const given = yearsIn(factText);
          problems.push(
            `The year ${event.year} for "${event.label}" is not in fact ${event.factId}, which gives ${given.length > 0 ? `only ${given.join(", ")}` : "no year"}. Only use years listed under "Years in the facts".`,
          );
        } else if (event.date && !isDayAndMonth(event.date)) {
          problems.push(`Write the date "${event.date}" as a day and a month only, like "20 July". The year is shown on its own.`);
        } else if (event.date && !statesDate(event.date, factText, event.year)) {
          problems.push(`Fact ${event.factId} does not give "${event.date}" as a date in ${event.year}. Only use dates its fact states, with their year.`);
        }
      }
      const keys = visual.events.map((event) => timeKey(event.year, event.date));
      if (keys.some((key, index) => index > 0 && key < keys[index - 1])) problems.push("List the events in time order.");
      if (new Set(visual.events.map((event) => event.label.toLowerCase())).size < visual.events.length) {
        problems.push("Two events have the same label. Give each event its own label, or leave one out.");
      }
      // Events may share a year only when each has its own date, like the days of the Moon landing.
      const years = visual.events.map((event) => event.year);
      const span: [number, number] = [Math.min(...years), Math.max(...years)];
      const sharesYear = (event: { year: number }) => years.filter((year) => year === event.year).length > 1;
      if (new Set(keys).size < 2) problems.push("A timeline needs at least two different years or dates. Use another kind.");
      else if (new Set(keys).size < keys.length || visual.events.some((event) => sharesYear(event) && !event.date)) {
        problems.push('Two events share a year. Give each of them a "date" from its fact, or keep one event per year.');
      }
      if (visual.focusIndex < 0 || visual.focusIndex >= visual.events.length) {
        problems.push(`focusIndex is ${visual.focusIndex}, but there are only ${visual.events.length} events.`);
      }
      for (const era of visual.eras) problems.push(...eraProblems(era, facts, source, span));
      break;
    }
    case "stat": {
      if (tooLong(visual.label, MAX_LINE_WORDS)) problems.push("The stat label is too long. Use at most 8 words.");
      if (visual.unit && tooLong(visual.unit, 2)) problems.push("The unit is too long. Use one or two words, like million or km.");
      // A percentage is already out of 100. Other totals draw value out of total as dots, so the narration must say
      // exactly that.
      if (visual.total !== undefined && isPercent(visual.unit) && visual.total !== 100) {
        problems.push("A percentage is already out of 100. Leave out total.");
      } else if (visual.total !== undefined && !(visual.total > (visual.valueMax ?? visual.value))) {
        problems.push("total must be bigger than value, or left out.");
      } else if (visual.total !== undefined && !isPercent(visual.unit) && !isPartOf(visual.value, visual.total, source)) {
        problems.push(`Leave out total: the narration and facts do not say ${visual.value} is part of ${visual.total}, like "25 of 75 million".`);
      }
      // A range the narration or facts give may be shown whole, whatever word follows it.
      if (visual.valueMax !== undefined && !rangesIn(source).some((range) => range.low === visual.value && range.high === visual.valueMax)) {
        problems.push(`The narration and facts do not give ${visual.value} to ${visual.valueMax} as a range. Leave out valueMax.`);
      }
      // A number that is one end of a range of the same thing must be shown as the whole range, so the viewer sees how
      // uncertain it is. "4 to 5 years" says nothing about "5 million people", and neither does a range in a sentence
      // about something else.
      const range = sentencesOf(source)
        .filter((sentence) => groundedWords(visual.label, sentence).matched > 0)
        .flatMap((sentence) => rangesIn(sentence))
        .find((other) => unitFits(other.unit, visual) && (other.low === visual.value || other.high === visual.value));
      if (visual.valueMax === undefined && range) {
        problems.push(`The narration gives the range ${range.low} to ${range.high}. Show all of it: value ${range.low}, valueMax ${range.high}.`);
      }
      if (
        isDateIn(visual.value, source) ||
        (!visual.unit && isYearLike(visual.value)) ||
        /^(year|january|february|march|april|may|june|july|august|september|october|november|december|bc|ad|bce|ce|century|centuries|th century)$/i.test(visual.unit ?? "")
      ) {
        problems.push("A year or a date is not a good stat. Use a timeline or text for dates.");
      }
      if (!isGrounded(visual.label, source)) problems.push(ungrounded(visual.label));
      if (isNameNumber(visual.value, source)) problems.push(`${visual.value} is part of a name here, like Apollo 11, not an amount.`);
      // The big number is what this scene is about, so it comes from this scene, not from elsewhere in the video.
      if (!numbersIn(source).includes(String(visual.value))) {
        problems.push(`${visual.value} is not in this scene's narration or facts. Show a number this scene gives, or another kind.`);
      }
      break;
    }
    case "compare":
      if (tooLong(visual.title, MAX_LINE_WORDS)) problems.push("The chart title is too long. Use at most 8 words.");
      if (!isGrounded(visual.title, source)) problems.push(ungrounded(visual.title));
      if (
        DATE_WORDS.test(visual.unit ?? "") ||
        /^(dates?|days?|months?)$/i.test(visual.unit ?? "") ||
        visual.bars.some((bar) => DATE_WORDS.test(bar.label)) ||
        visual.bars.every((bar) => isYearLike(bar.value)) ||
        visual.bars.filter((bar) => isDateIn(bar.value, source)).length > visual.bars.length / 2
      ) {
        problems.push("A chart compares amounts, not dates. Use a timeline for dates.");
      }
      // Latitude and longitude are a place, not two amounts.
      if (/\b(latitude|longitude|coordinates?)\b/i.test([visual.title, ...visual.bars.map((bar) => bar.label)].join(" "))) {
        problems.push("Coordinates are not amounts to compare. Use a map or another kind.");
      }
      // "Tonnes: 130, Tons: 143" is one amount in two units, not two things to compare.
      if (visual.bars.filter((bar) => UNIT_LABEL.test(bar.label.trim())).length >= 2) {
        problems.push("The bars are one amount in different units. A chart compares different things in one unit.");
      }
      // "Europe population killed: 50, European population killed: 60" is two estimates of one number, which is a range.
      if (visual.bars.some((bar, index) => visual.bars.slice(0, index).some((other) => sameWords(other.label, bar.label)))) {
        problems.push("Two bars are the same thing. A chart compares different things; two estimates of one number are a range, shown as a stat.");
      }
      if (/^\p{Ll}/u.test(visual.title.trim())) problems.push('Write the chart title as a short title, like "Plague deaths in Europe".');
      for (const bar of visual.bars) {
        if (tooLong(bar.label, MAX_LABEL_WORDS)) problems.push(`The bar label "${bar.label}" is too long. Use at most 4 words.`);
        if (bar.value < 0) problems.push("Bar values cannot be negative.");
        // Each bar is a claim: its label and its number come from one sentence of this scene, so a chart cannot pair
        // a place with a number said about something else.
        if (!isGrounded(bar.label, source)) problems.push(ungrounded(bar.label));
        else if (!barIsStated(bar, visual.unit, source)) {
          problems.push(`No sentence of this scene gives ${bar.value} for "${bar.label}". Each bar shows a number the narration or facts give for that thing.`);
        }
      }
      break;
    case "list": {
      if (visual.items.some((item, index) => visual.items.slice(0, index).some((other) => sameWords(other.title, item.title)))) {
        problems.push("Two items have the same title. Each item is a different thing.");
      }
      if (visual.items.some((item) => yearsIn(item.title).length > 0 || datesIn(item.title).length > 0)) {
        problems.push("A list item is a date. Dates belong on a timeline; a list shows things of one kind.");
      }
      for (const item of visual.items) {
        if (tooLong(item.title, 4)) problems.push(`The title "${item.title}" is too long. Use at most 3 words.`);
        if (item.detail && tooLong(item.detail, 7)) problems.push(`The detail "${item.detail}" is too long. Use at most 6 words.`);
        if (!isGrounded(item.title, source)) problems.push(ungrounded(item.title));
        if (item.detail && !isGrounded(item.detail, source)) problems.push(ungrounded(item.detail));
      }
      break;
    }
    case "versus": {
      if (visual.left.trim().toLowerCase() === visual.right.trim().toLowerCase()) problems.push("The two sides must be different.");
      for (const side of [visual.left, visual.right]) {
        if (tooLong(side, 4)) problems.push(`The side "${side}" is too long. Use at most 3 words.`);
        if (!isGrounded(side, source)) problems.push(ungrounded(side));
      }
      for (const row of visual.rows) {
        if (tooLong(row.label, 4)) problems.push(`The point "${row.label}" is too long. Use at most 3 words.`);
        for (const cell of [row.label, row.left, row.right]) {
          if (tooLong(cell, 6)) problems.push(`"${cell}" is too long. Use at most 5 words.`);
          // Each side's answer is a claim, so every word of it must come from the narration or facts: a one-word
          // cell like "Adequate", "Yes" or "No" would otherwise slip through.
          if (!isFullyGrounded(cell, source)) problems.push(ungrounded(cell));
        }
      }
      break;
    }
    case "change":
      if (visual.from.trim().toLowerCase() === visual.to.trim().toLowerCase()) problems.push("The old and the new must be different.");
      // Each side is one name or status: "wheat to livestock" struck out for "new plows adopted" showed the whole change
      // as the old state.
      if ([visual.from, visual.to].some((side) => /\s(?:to|into)\s|→|->/i.test(side))) {
        problems.push('Give the old name or status in "from" and the new one in "to", like "Wheat" and "Livestock", not the change itself.');
      }
      for (const side of [visual.from, visual.to]) {
        if (tooLong(side, 4)) problems.push(`"${side}" is too long: a change shows a name or a status, in at most 4 words.`);
        // Striking out a name says it was the name before, so the old one must be stated, word for word: no
        // "Prince Mehmed" when the narration only says Sultan Mehmed II.
        if (!isFullyGrounded(side, source)) problems.push(`"${side}" is not what the narration or facts call it. Use their exact words for both names.`);
      }
      if (visual.year !== undefined && !yearsIn(source).includes(visual.year)) {
        problems.push(`The year ${visual.year} is not in this scene's narration or facts. Leave it out.`);
      }
      break;
    case "quote": {
      const fact = facts.get(visual.factId);
      const text = visual.text.trim();
      // A quote is one whole sentence of its source, word for word: a scrap like "years. From the east" means nothing
      // on its own, and a sentence cut short can drop a "but" or a "some say".
      if (!fact) problems.push(`Unknown fact ${visual.factId}.`);
      else if (!isSentenceOf(text, fact.quote)) {
        problems.push(`The quote must be one whole sentence copied exactly from the quote of fact ${visual.factId}, from its first word to its end.`);
      }
      if (tooLong(text, 30)) problems.push("The quote is too long. Use at most 30 words.");
      if (countWords(text) < 5) problems.push("The quote is too short. Use at least 5 words.");
      if (/[|•·]/.test(text)) problems.push("The quote is a heading or a list, not a sentence. Copy a sentence someone wrote.");
      if (!lineIsGrounded(text, source)) problems.push("The quote is not about what this scene says. Pick words that say what the narration says.");
      break;
    }
    case "steps":
      if (visual.steps.some(isOnlyADate)) problems.push("A step is only a date or a time. Steps say what happens; dates belong on a timeline.");
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
        // "Glass, gold, horses move" lists things; a step in a chain says one thing that happens.
        const commas = visual.steps.filter((step) => step.includes(",")).length;
        if (commas >= 2 || (visual.steps.length >= 3 && (sameStart > visual.steps.length / 2 || (sameWord >= 3 && sameWord > visual.steps.length / 2)))) {
          problems.push("These steps are a list of similar things. Steps must each lead to the next; use a list instead.");
        }
      }
      break;
    case "people": {
      const names = visual.people.map((person) => person.name.trim().toLowerCase());
      if (new Set(names).size < names.length) problems.push("Two people have the same name. Show each person once.");
      for (const person of visual.people) {
        // Every word of a name must be the narration's or the facts': a figure never stands for someone they do not name.
        if (tooLong(person.name, 4) || !isFullyGrounded(person.name, source)) {
          problems.push(`"${person.name}" is not a name the narration or facts give. Show only the people they name, as they write the name.`);
        }
        if (isNotAPerson(person.name, source)) problems.push(`"${person.name}" is not a person here. Show only people.`);
        // A role belongs to the person it is said about, in the same clause, so roles cannot be swapped between people.
        if (person.role && (tooLong(person.role, 4) || !roleOf(person.name, person.role, source))) {
          problems.push(`The role "${person.role}" must be what the narration or facts call ${person.name}, at most 4 words, in their words.`);
        }
      }
      break;
    }
    case "space": {
      if (visual.view === "journey") {
        const bodies = new Set([...visual.bodies, ...(visual.craft ? [visual.craft.from, visual.craft.to] : [])]);
        if (bodies.size < 2) problems.push("A journey shows at least two bodies, like earth and moon, or a craft flying between them.");
        if (visual.craft && visual.craft.from === visual.craft.to) problems.push("The craft must fly from one body to another.");
        const label = visual.craft?.label;
        if (label && (tooLong(label, MAX_LABEL_WORDS) || !isFullyGrounded(label, source) || numbersIn(label).some((number) => !numbersIn(source).includes(number)))) {
          problems.push(ungrounded(label));
        }
        for (const body of bodies) {
          if (!BODY_WORDS[body].test(source)) problems.push(`The narration does not mention the ${body}. Show only the bodies it names.`);
        }
      } else {
        if (visual.sites.length === 0) problems.push("A Moon view needs at least one sea or landing site the narration names.");
        for (const site of visual.sites) {
          if (!moonPlace(site)) problems.push(`"${site}" is not a place on the Moon the map knows. Use one from the list.`);
          else if (!hasPhrase(site, source)) problems.push(`The narration and facts do not name "${site}". Show only the seas and sites they name, as they write them.`);
        }
      }
      break;
    }
    case "drawing": {
      if (visual.title && (tooLong(visual.title, MAX_LINE_WORDS) || !isGrounded(visual.title, source))) problems.push(ungrounded(visual.title));
      // A label names a part the narration or facts speak of, in their words.
      for (const label of visual.labels) {
        if (tooLong(label.text, MAX_LABEL_WORDS)) problems.push(`The label "${label.text}" is too long. Use at most 4 words.`);
        if (!isGrounded(label.text, source)) problems.push(ungrounded(label.text));
      }
      if (visual.labels.some((label, index) => visual.labels.slice(0, index).some((other) => sameWords(other.text, label.text)))) {
        problems.push("Two labels say the same. Each label names a different part.");
      }
      for (const label of visual.labels) {
        if (!visual.parts[label.part]) problems.push(`The label "${label.text}" names part ${label.part}, but parts are counted from 0 and there are ${visual.parts.length}.`);
      }
      // Two labels on one part would sit on top of each other.
      if (visual.labels.some((label, index) => visual.labels.slice(0, index).some((other) => other.part === label.part))) {
        problems.push("Two labels name the same part. Give each label its own part.");
      }
      for (const part of visual.parts) {
        if (part.shape === "icon" && !iconKey(part.name)) problems.push(`"${part.name}" is not an icon. Use one from the list.`);
      }
      // A clear picture has one thing moving: rows of tubes and flows made a drawing nobody could read.
      if (visual.parts.filter((part) => part.shape === "tube" || part.shape === "flow" || part.shape === "arrow").length > 4) {
        problems.push("Draw one clear picture: at most 4 tubes, flows and arrows together, for the one thing that moves.");
      }
      if (visual.parts.filter((part) => part.shape === "band").length > 3) problems.push("Use at most 3 layers.");
      // Labeled boxes and blobs alone picture nothing: "Immune memory" came out as a box and two ovals.
      if (visual.parts.every((part) => part.shape === "box" || part.shape === "blob")) {
        problems.push("Draw the thing itself, with layers, tubes, flows, cones or icons, not only labeled boxes and blobs.");
      }
      // The model once gave every place as a fraction from 0 to 1, which squeezed the drawing into a corner.
      if (onUnitGrid(visual)) problems.push("Give x, y, w, h, y1 and y2 as numbers from 0 to 100, not as fractions from 0 to 1.");
      break;
    }
    case "illustration": {
      if (visual.title && (tooLong(visual.title, MAX_LINE_WORDS) || !isGrounded(visual.title, source))) problems.push(ungrounded(visual.title));
      visual.items.forEach((item, index) => {
        if (!item.icon && !item.figure) problems.push(`Item ${index} needs an icon or a figure.`);
        if (item.icon && !iconKey(item.icon)) problems.push(`"${item.icon}" is not an icon. Use one from the list.`);
        // Arrows and signs are not things: as items they read as forces or movement the picture does not show.
        if (SIGN_ICONS.has(iconKey(item.icon) ?? "")) problems.push(`"${item.icon}" is a sign, not a thing. Show movement with links, and things with icons of things.`);
        if (item.label && tooLong(item.label, MAX_LABEL_WORDS)) problems.push(`The label "${item.label}" is too long. Use at most 4 words.`);
        // A figure stands for people, so its label is held to the people rule: every word in the narration or facts.
        if (item.label && !(item.figure ? isFullyGrounded(item.label, source) : isGrounded(item.label, source))) problems.push(ungrounded(item.label));
      });
      if (!visual.items.some((item) => item.label)) problems.push("Label the items in the narration's words, so the picture says what it says.");
      // Items on top of each other cannot be read.
      if (visual.items.some((item, index) => visual.items.slice(0, index).some((other) => Math.hypot(item.x - other.x, item.y - other.y) < 12))) {
        problems.push("Two items sit on top of each other. Spread them out over the grid.");
      }
      for (const link of visual.links) {
        if (!visual.items[link.from] || !visual.items[link.to] || link.from === link.to) {
          problems.push(`A link joins items ${link.from} and ${link.to}, but items are counted from 0 and a link joins two different items.`);
        }
        // A link's label is said about one of the two things it joins, in the same clause.
        const ends = [visual.items[link.from]?.label ?? "", visual.items[link.to]?.label ?? ""].filter(Boolean);
        if (link.label && (tooLong(link.label, MAX_LABEL_WORDS) || !ends.some((end) => statedTogether(end, link.label ?? "", source)))) {
          problems.push(`The arrow label "${link.label}" must be what the narration or facts say about the things it joins.`);
        }
      }
      // The same words twice on one picture are clutter: "stress builds" on an item and on two arrows.
      if (!linkLabelsAreNew(visual)) problems.push("Two arrows, or an arrow and an item, say the same. Give each arrow its own words, or none.");
      break;
    }
  }
  return problems;
}

// What is wrong with a template's reply: each text it shows must be short, backed and use only numbers from the
// narration or facts, and the template's own rules must hold.
function templateProblems(visual: TemplateVisual, allowed: Set<string>, source: string, narration: string, quotable: string[] = []): string[] {
  const spec = templateSpec(visual.kind);
  const problems = spec.shown(visual).flatMap(({ text, words, chars, exact, optional }) => {
    // An optional text that breaks a rule is left out later, by tidyTemplate.
    if (!text || optional) return [];
    const found: string[] = [];
    if (countWords(text) > words || (chars !== undefined && text.length > chars)) {
      found.push(`"${text}" is too long. Use at most ${words} words${chars !== undefined ? ` and ${chars} letters` : ""}.`);
    }
    for (const number of numbersIn(text)) {
      if (!allowed.has(number)) found.push(`It shows "${number}", which is not in the narration or facts. Write it as they do.`);
    }
    if (!(exact ? isFullyGrounded(text, source) : isGrounded(text, source))) {
      found.push(`"${text}" says something the narration does not. Use ${exact ? "its exact words" : "the narration's own words"}.`);
    }
    return found;
  });
  return [...problems, ...(spec.check?.(visual, { narration, source, quotable }) ?? [])];
}

const focusIsTold = (label: string, narration: string) => groundedWords(label, narration).matched > 0;

// A quote is read while the scene's narration is spoken: 22 words under a 4-second sentence could not be read.
const quoteWords = (narration: string) => Math.max(12, Math.ceil(countWords(narration) * 1.5));
const quoteFits = (text: string, narration: string) => countWords(text) <= quoteWords(narration);

// `avoid` names the kinds this scene should not switch to, `blocked` the kinds it may not use at all, and `offered`
// the templates it may use.
function sceneProblems(
  { visual, lines }: SceneReply,
  allowed: Set<string>,
  facts: FactMap,
  source: string,
  narration: string,
  avoid: AnyKind[],
  blocked: AnyKind[],
  offered: TemplateName[],
  quotable: string[] = [],
): string[] {
  // The lines are only shown if the visual cannot be used, so they are worth a retry only when none of them works.
  const lineProblems = lines.some((line) => lineIsSafe(line, allowed, source)) ? [] : linesProblems(lines, allowed, source);
  // A model that keeps failing at one kind is better off switching to another than giving up to text.
  const others = [...SCENE_KINDS, ...offered].filter((kind) => kind !== visual.kind && kind !== "text" && !avoid.includes(kind));
  if (blocked.includes(visual.kind)) {
    const why = visual.kind === "map" ? ": its narration names no place a map can show" : "";
    return [`A ${visual.kind} does not fit this scene${why}. Use ${others.join(" or ") || "text"} instead.`, ...lineProblems];
  }
  const problems = isTemplateVisual(visual) ? templateProblems(visual, allowed, source, narration, quotable) : visualProblems(visual, allowed, facts, source);
  // Countries the scene does not name are muted later, so a map of places it never names would show nothing.
  if (visual.kind === "map" && showsNothing(tidyMap(visual, source), narration)) {
    problems.push("Nothing on this map is a place this scene's narration names, so it would show nothing. Color or mark a place it names, or use another kind.");
  }
  // Words on screen keep the narration's hedges: "End of feudalism" may not stand for "may have helped end feudalism".
  const texts = isTemplateVisual(visual) ? templateSpec(visual.kind).shown(visual).map((item) => item.text ?? "") : shownText(visual);
  for (const text of texts) {
    if (text && dropsHedge(text, narration)) problems.push(`"${text}" states as certain what the narration says only may be true. Keep its "may" or leave it out.`);
  }
  // The marked event of a timeline is the one this scene tells: a scene about ships reaching Sicily once marked the
  // siege before it.
  const focus = visual.kind === "timeline" ? visual.events[visual.focusIndex] : undefined;
  if (focus && !focusIsTold(focus.label, narration)) {
    problems.push(`The marked event "${focus.label}" is not what this scene tells. Mark the event its narration is about, with a label in its words.`);
  }
  if (visual.kind === "quote" && !quoteFits(visual.text, narration)) {
    problems.push(`The quote is too long to read while this scene is spoken. Pick a sentence of at most ${quoteWords(narration)} words, or another kind.`);
  }
  const hint =
    problems.length > 0 && visual.kind !== "text" && others.length > 0
      ? [`Fix the problems below. If a ${visual.kind} cannot work with these facts, use ${others.join(" or ")} instead.`]
      : [];
  return [...hint, ...problems, ...lineProblems];
}

// The scene's plain lines, or the start of its narration if none of them is safe.
function textVisual(lines: string[], scene: NarratedScene, allowed: Set<string>): SceneVisual {
  // A line cut off at a comma, like "The water cycle, also known as the hydrologic cycle,", ends without it.
  const safeLines = lines
    .filter((line) => lineIsSafe(line, allowed, scene.narration) && !dropsHedge(line, scene.narration))
    .map((line) => line.trim().replace(/[,;:]+$/, ""));
  return { kind: "text", lines: safeLines.length > 0 ? safeLines : [narrationLine(scene.narration)] };
}

// A short line from the narration itself, for a scene left with no other picture: its first sentence when that is
// short, else that sentence's first clause ("The cycle repeats"), else its first words.
function narrationLine(narration: string): string {
  const sentence = (narration.trim().split(/(?<=[.!?])\s+/)[0] ?? "").replace(/[.!?]+$/, "");
  if (countWords(sentence) <= MAX_LINE_WORDS) return sentence;
  const clause = sentence.split(/\s*[,;:—–]\s*/)[0];
  if (countWords(clause) >= 2 && countWords(clause) <= MAX_LINE_WORDS) return clause;
  return `${sentence.split(/\s+/).slice(0, 7).join(" ")}…`;
}

// Last resort after the retries: drop whatever still breaks a rule, so one bad label does not sink the video.
// Maps, timelines, lists and scoreboards keep their good parts. The other kinds are shown as the scene's plain lines
// instead, and so is a kind the scene may not use at all (`blocked`).
function repairScene(
  { visual, lines }: SceneReply,
  scene: NarratedScene,
  allowed: Set<string>,
  facts: FactMap,
  source: string,
  blocked: AnyKind[],
  quotable: string[] = [],
): AnyVisual {
  const safe = (text: string) => numbersIn(text).every((number) => allowed.has(number));
  const safeLabel = (label?: string) => (label && safe(label) && countWords(label) <= MAX_LABEL_WORDS ? label : undefined);
  const fallback = textVisual(lines, scene, allowed);
  if (blocked.includes(visual.kind)) return fallback;
  if (isTemplateVisual(visual)) {
    // A template keeps what passes the checks, if its own repair leaves enough of it.
    if (templateProblems(visual, allowed, source, scene.narration, quotable).length === 0) return visual;
    const repaired = templateSpec(visual.kind).repair?.(visual, keepFor(allowed, source), { narration: scene.narration, source, quotable });
    return repaired && templateProblems(repaired, allowed, source, scene.narration, quotable).length === 0 ? repaired : fallback;
  }

  switch (visual.kind) {
    case "text":
      return textVisual(visual.lines, scene, allowed);
    case "timeline": {
      // Kept only if every label is backed; a timeline with made-up labels is worse than plain lines.
      // A date its fact does not state for that year goes; the year stays.
      const dateIsBacked = (event: (typeof visual.events)[number]) =>
        event.date !== undefined && isDayAndMonth(event.date) && statesDate(event.date, facts.get(event.factId)?.text ?? "", event.year);
      const backed = visual.events.map((event) => (event.date && !dateIsBacked(event) ? { ...event, date: undefined } : event));
      const focus = backed[visual.focusIndex];
      if (focus && !focusIsTold(focus.label, scene.narration)) return fallback;
      const key = (event: (typeof backed)[number]) => timeKey(event.year, event.date);
      const events = backed
        .filter((event) => eventIsBacked(event, facts) && safeLabel(event.label) && event.label.length <= maxEventLabelChars(visual.events.length))
        .filter((event) => isGrounded(event.label, `${source} ${facts.get(event.factId)?.text ?? ""}`))
        .filter((event, index, all) => all.findIndex((other) => other.label.toLowerCase() === event.label.toLowerCase()) === index)
        .filter((event, index, all) => event === focus || !all.some((other, at) => key(other) === key(event) && (other === focus || at < index)))
        .sort((a, b) => key(a) - key(b));
      // Events that share a year all need dates. Without them, one event per year stays: the focus if it is one
      // of them, else the first.
      const dated = events.filter((event) => {
        const sameYear = events.filter((other) => other.year === event.year);
        if (sameYear.length === 1 || sameYear.every((other) => other.date)) return true;
        return event === (focus && sameYear.includes(focus) ? focus : sameYear[0]);
      });
      const focusIndex = Math.max(0, focus ? dated.indexOf(focus) : dated.length - 1);
      const years = dated.map((event) => event.year);
      const span: [number, number] = [Math.min(...years), Math.max(...years)];
      const eras = visual.eras.filter((era) => eraProblems(era, facts, source, span).length === 0);
      return new Set(dated.map(key)).size >= 2 ? { kind: "timeline", events: dated, focusIndex, eras } : fallback;
    }
    case "map": {
      const mapLabel = (text: string | undefined, country?: string) =>
        text &&
        countWords(text) <= MAX_MAP_LABEL_WORDS &&
        mapLabelIsGrounded({ text, country }, source, facts) &&
        !(country && (labelMismatch(text, country) || CITY_WORDS.test(text) || /[()]/.test(text) || namesCity(text, country)))
          ? safeLabel(text)
          : undefined;
      const highlights = visual.highlights
        .filter((highlight) => isMapCountry(highlight.country))
        .map((highlight) => ({ ...highlight, label: mapLabel(highlight.label, highlight.country) }));
      // A kept label's direction comes from the narration, so an arrow that goes against it has from and to swapped.
      // A label with a direction the narration does not give goes, and the arrow stays as it was.
      const arrows = visual.arrows.flatMap((arrow) => {
        const [from, to] = [resolvePlace(visual, arrow.from), resolvePlace(visual, arrow.to)];
        const label = directionIsBacked(arrow.label, source) ? mapLabel(arrow.label) : undefined;
        if (!from || !to) return [];
        return [label && pointsTheOtherWay(visual, { ...arrow, label }) ? { from: to, to: from, label } : { from, to, label }];
      });
      const markers = visual.markers
        .filter((marker) => isPlaceLabel(marker.label))
        .filter((marker) => countryContains(marker.country, marker.lon, marker.lat))
        .filter((marker) => mapLabel(marker.label));
      const frame = visual.frame.flatMap((place) => resolvePlace(visual, place) ?? []);
      const keptMarkers = { ...visual, markers };
      // A sea route that loses a stop in the middle would take another way, so it goes whole; a land route keeps the
      // stops that pass.
      const routes = visual.routes
        .map((route) => ({
          ...route,
          label: directionIsBacked(route.label, source) ? mapLabel(route.label) : undefined,
          kept: route.stops.filter((stop) => stopProblems(keptMarkers, stop, source, facts).length === 0),
        }))
        .filter((route) => route.kept.length >= 2 && (route.by === "land" || route.kept.length === route.stops.length) && (route.by === "land" || SEA_WORDS.test(source)))
        .map(({ kept, ...route }) => ({ ...route, stops: kept }));
      if (highlights.length === 0) return fallback;
      return { kind: "map", frame: frame.length > 0 ? frame : highlights.map((h) => h.country), highlights, arrows, markers, routes };
    }
    case "versus": {
      // Points the narration does not back go; two or more good ones still make a scoreboard of two different sides.
      const cellOk = (cell: string) => countWords(cell) <= 6 && isFullyGrounded(cell, source) && safe(cell);
      const rows = visual.rows.filter((row) => countWords(row.label) <= 4 && [row.label, row.left, row.right].every(cellOk));
      const sidesDiffer = visual.left.trim().toLowerCase() !== visual.right.trim().toLowerCase();
      const sidesOk = sidesDiffer && [visual.left, visual.right].every((side) => countWords(side) <= 4 && isGrounded(side, source) && safe(side));
      return sidesOk && rows.length >= 2 ? { ...visual, rows } : fallback;
    }
    case "list": {
      // Items the narration does not back go, and so do dates and repeats; two or more good ones still make a list.
      const sameTitle = (a: { title: string }, b: { title: string }) => sameWords(a.title, b.title);
      const items = visual.items
        .filter((item) => countWords(item.title) <= 4 && isGrounded(item.title, source) && safe(item.title) && !dropsHedge(item.title, scene.narration))
        .filter((item) => yearsIn(item.title).length === 0 && datesIn(item.title).length === 0)
        .filter((item, index, all) => all.findIndex((other) => other === item || sameTitle(other, item)) === index)
        .map((item) =>
          item.detail && countWords(item.detail) <= 7 && isGrounded(item.detail, source) && safe(item.detail) && !dropsHedge(item.detail, scene.narration)
            ? item
            : { title: item.title, icon: item.icon },
        );
      return items.length >= 2 ? { kind: "list", items } : fallback;
    }
    case "compare": {
      // A title that starts in lower case is the one problem a chart can lose without losing a claim.
      const titled = { ...visual, title: visual.title.charAt(0).toUpperCase() + visual.title.slice(1) };
      return visualProblems(titled, allowed, facts, source).length === 0 ? titled : fallback;
    }
    case "stat": {
      // Most often only the total or the end of the range is wrong. Without them the number may still stand. A range
      // is never made up here: a number the narration gives as a range shows as lines instead.
      const tries = [visual, { ...visual, total: undefined }, { ...visual, valueMax: undefined }, { ...visual, total: undefined, valueMax: undefined }];
      return tries.find((attempt) => visualProblems(attempt, allowed, facts, source).length === 0) ?? fallback;
    }
    case "people": {
      // People the narration does not name go; the others stay, with their role only if it is backed.
      const people = visual.people
        .filter((person) => countWords(person.name) <= 4 && isFullyGrounded(person.name, source) && safe(person.name) && !isNotAPerson(person.name, source))
        .filter((person, index, all) => all.findIndex((other) => other.name.trim().toLowerCase() === person.name.trim().toLowerCase()) === index)
        .map((person) =>
          person.role && countWords(person.role) <= 4 && roleOf(person.name, person.role, source) && safe(person.role)
            ? person
            : { ...person, role: undefined },
        );
      return people.length > 0 ? { ...visual, people } : fallback;
    }
    case "space": {
      const sites = visual.sites.filter((site) => moonPlace(site) !== null && hasPhrase(site, source));
      const craftLabel = visual.craft?.label;
      const label =
        craftLabel && isFullyGrounded(craftLabel, source) && numbersIn(craftLabel).every((number) => numbersIn(source).includes(number)) ? craftLabel : undefined;
      const repaired = { ...visual, sites, craft: visual.craft ? { ...visual.craft, label } : undefined };
      return visualProblems(repaired, allowed, facts, source).length === 0 ? repaired : fallback;
    }
    case "drawing": {
      // A drawing made on a 0 to 1 grid is stretched to the 0 to 100 grid. Labels the narration does not back and
      // unknown icons go; the drawing stays if two labels are left.
      const full = onUnitGrid(visual) ? toFullGrid(visual) : visual;
      const labels = full.labels
        .filter((label) => countWords(label.text) <= MAX_LABEL_WORDS && isGrounded(label.text, source) && safe(label.text) && full.parts[label.part])
        .filter((label, index, all) => all.findIndex((other) => sameWords(other.text, label.text) || other.part === label.part) === index);
      const parts = full.parts.filter((part) => part.shape !== "icon" || iconKey(part.name));
      const title = full.title && countWords(full.title) <= MAX_LINE_WORDS && isGrounded(full.title, source) ? full.title : undefined;
      const repaired = { ...full, title, labels, parts };
      return labels.length >= 2 && parts.length >= 3 && visualProblems(repaired, allowed, facts, source).length === 0 ? repaired : fallback;
    }
    case "illustration": {
      // Labels and links the narration does not back go; the picture stays if it still says something.
      const labelOk = (label: string | undefined, strict: boolean) =>
        label && countWords(label) <= MAX_LABEL_WORDS && (strict ? isFullyGrounded(label, source) : isGrounded(label, source)) && safe(label);
      // An item drawn as a sign (an arrow, a plus) goes, with its links.
      const things = visual.items.filter((item) => !SIGN_ICONS.has(iconKey(item.icon) ?? ""));
      const items = things.map((item) => (labelOk(item.label, item.figure !== undefined) ? item : { ...item, label: undefined }));
      const links = visual.links
        .map((link) => ({ ...link, from: things.indexOf(visual.items[link.from]), to: things.indexOf(visual.items[link.to]) }))
        .filter((link) => items[link.from] && items[link.to] && link.from !== link.to)
        .map((link) => {
          const ends = [items[link.from].label ?? "", items[link.to].label ?? ""].filter(Boolean);
          const stated = link.label && countWords(link.label) <= MAX_LABEL_WORDS && ends.some((end) => statedTogether(end, link.label ?? "", source));
          return stated ? link : { ...link, label: undefined };
        })
        // An arrow label that repeats an item or an earlier arrow goes.
        .map((link, index, all) =>
          link.label && (items.some((item) => item.label && sameWords(item.label, link.label ?? "")) || all.slice(0, index).some((other) => other.label && sameWords(other.label, link.label ?? "")))
            ? { ...link, label: undefined }
            : link,
        );
      const title = visual.title && countWords(visual.title) <= MAX_LINE_WORDS && isGrounded(visual.title, source) ? visual.title : undefined;
      const repaired = { ...visual, title, items, links };
      return visualProblems(repaired, allowed, facts, source).length === 0 ? repaired : fallback;
    }
    case "quote":
      return visualProblems(visual, allowed, facts, source).length === 0 && quoteFits(visual.text, scene.narration) ? visual : fallback;
    default:
      return visualProblems(visual, allowed, facts, source).length === 0 ? visual : fallback;
  }
}

// The title card shows the video's title, or its main part before a colon, when that is short. The model's own heading
// is used only for a long title: the fast model once made "How Volcanoes Erupt: From Deep Earth to Explosive Power"
// into "Volcanoes Deep Earth".
function headingOf(title: string, fallback: string): string {
  const main = title.split(/:\s/)[0].trim();
  return countWords(main) <= 6 ? main : fallback;
}

// Same kind and the same content: the viewer would see the same picture twice.
function sameAs(a: AnyVisual, b: AnyVisual): boolean {
  if (a.kind === "map" && b.kind === "map") {
    const countries = (visual: typeof a) => visual.highlights.map((h) => h.country).sort().join(",");
    return countries(a) === countries(b) && a.arrows.length + a.routes.length === 0 && b.arrows.length + b.routes.length === 0;
  }
  if (a.kind === "timeline" && b.kind === "timeline") {
    return a.events.map((e) => e.year).join(",") === b.events.map((e) => e.year).join(",");
  }
  return a.kind !== "text" && a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b);
}

// Whether a scene names a highlighted country: by its name, another name for it or for its people ("Chinese"), a
// label in the scene's own words, or a named city in it. An arrow to a country does not name it.
function countryIsNamed(visual: MapVisual, highlight: MapVisual["highlights"][number], source: string): boolean {
  return (
    (highlight.label !== undefined && isGrounded(highlight.label, source)) ||
    namesCountry(source, highlight.country) ||
    visual.markers.some((marker) => countryContains(highlight.country, marker.lon, marker.lat) && isGrounded(marker.label, source))
  );
}

// Countries the scene does not name stay on the map, but muted, so each map points at its own part of the story
// and does not color a country the narration says nothing about. An arrow joins two places the scene names: an
// arrow to a country it does not name, or to a city whose marker was dropped, goes. So does an arrow that repeats
// another, from the same place to the same place, which would be drawn right on top of it.
function tidyMap(visual: AnyVisual, source: string): AnyVisual {
  if (visual.kind !== "map") return visual;
  const named = (code: string | null) =>
    code !== null &&
    countryIsNamed(visual, { country: code, tone: "secondary", label: visual.highlights.find((h) => h.country === code)?.label }, source);
  const route = (arrow: { from: string; to: string }) => `${resolvePlace(visual, arrow.from)}>${resolvePlace(visual, arrow.to)}`;
  const arrows = visual.arrows
    .filter((arrow) => named(resolvePlace(visual, arrow.from)) && named(resolvePlace(visual, arrow.to)))
    .filter((arrow, index, all) => all.findIndex((other) => route(other) === route(arrow)) === index);
  const highlights = visual.highlights.map((highlight) =>
    highlight.tone === "muted" || countryIsNamed(visual, highlight, source) ? highlight : { ...highlight, tone: "muted" as const },
  );
  // Two markers on one spot, like "Caffa" and "Kaffa", would be drawn on top of each other, so the later one goes
  // unless an arrow or a route names it.
  const linked = new Set([...visual.arrows.flatMap((arrow) => [arrow.from, arrow.to]), ...visual.routes.flatMap((r) => r.stops)].map((name) => name.trim().toLowerCase()));
  const markers = visual.markers.filter(
    (marker, index) =>
      linked.has(marker.label.trim().toLowerCase()) ||
      !visual.markers.slice(0, index).some((other) => Math.abs(other.lon - marker.lon) < 0.5 && Math.abs(other.lat - marker.lat) < 0.5),
  );
  // A map needs one main country: the first named one takes over when the model's choice was muted.
  if (!highlights.some((highlight) => highlight.tone === "primary")) {
    const first = highlights.findIndex((highlight) => highlight.tone === "secondary");
    if (first >= 0) highlights[first] = { ...highlights[first], tone: "primary" };
  }
  return { ...visual, highlights, arrows, markers };
}

// A map shows nothing when it colors no country the scene names and marks, joins or follows no place its narration
// names. A map of Sicily under a sentence about Caffa showed only a place from another scene.
const showsNothing = (visual: AnyVisual, narration: string) =>
  visual.kind === "map" &&
  visual.arrows.length + visual.routes.length === 0 &&
  visual.highlights.every((h) => h.tone === "muted") &&
  !visual.markers.some((marker) => isGrounded(marker.label, narration));

// Whether every arrow label in a free picture says something no item and no other arrow says.
type IllustrationVisual = Extract<SceneVisual, { kind: "illustration" }>;
const linkLabelsAreNew = (visual: IllustrationVisual) =>
  visual.links.every(
    (link, index) =>
      !link.label ||
      (!visual.items.some((item) => item.label && sameWords(item.label, link.label ?? "")) &&
        !visual.links.slice(0, index).some((other) => other.label && sameWords(other.label, link.label ?? ""))),
  );

// Every number that places something in a drawing, to tell a drawing made on a 0 to 1 grid from one on the 0 to 100
// grid the prompt asks for.
type DrawingVisual = Extract<SceneVisual, { kind: "drawing" }>;
const drawingNumbers = (visual: DrawingVisual) => [
  ...visual.parts.flatMap((part) => {
    if (part.shape === "band") return [part.y1, part.y2];
    if (part.shape === "tube" || part.shape === "arrow" || part.shape === "flow") return part.points.flatMap((point) => [point.x, point.y]);
    if (part.shape === "icon") return [part.x, part.y];
    return [part.x, part.y, part.w, part.h];
  }),
];
const onUnitGrid = (visual: DrawingVisual) => drawingNumbers(visual).every((value) => Math.abs(value) <= 1.5);
// The same drawing on the 0 to 100 grid.
const toFullGrid = (visual: DrawingVisual): DrawingVisual => {
  const point = ({ x, y }: { x: number; y: number }) => ({ x: x * 100, y: y * 100 });
  return {
    ...visual,
    parts: visual.parts.map((part) => {
      if (part.shape === "band") return { ...part, y1: part.y1 * 100, y2: part.y2 * 100 };
      if (part.shape === "tube" || part.shape === "arrow" || part.shape === "flow") return { ...part, points: part.points.map(point) };
      if (part.shape === "icon") return { ...part, ...point(part) };
      return { ...part, ...point(part), w: part.w * 100, h: part.h * 100 };
    }),
  };
};

// The words that say where a free picture takes place, without which its backdrop is left out.
const BACKDROP_WORDS: Record<(typeof BACKDROPS)[number], RegExp> = {
  underground: /\b(underground|beneath|below|ground|crust|rocks?|magma|soil|roots?|caves?|mines?|wells?|layers?|buried|tunnels?|fossils?)\b/i,
  sea: /\b(seas?|oceans?|underwater|fish|ships?|waves?|coral|seabed|seafloor|tides?)\b/i,
  sky: /\b(sky|air|clouds?|birds?|planes?|flight|fly|flies|atmosphere|wind|rain|storms?)\b/i,
  space: /\b(space|orbit\w*|planets?|stars?|moon|galax\w*|satellites?|rockets?)\b/i,
  body: /\b(body|organs?|blood|heart|lungs?|stomach|brain|liver|kidneys?|muscles?|bones?|skin|immune|digest\w*)\b/i,
};

// Whether a text a template shows passes the checks: short enough, with only numbers from the narration or facts, and
// in their words.
const keepFor =
  (allowed: Set<string>, source: string): Keep =>
  (text, words, exact) =>
    !text ||
    (countWords(text) <= words && numbersIn(text).every((number) => allowed.has(number)) && (exact ? isFullyGrounded(text, source) : isGrounded(text, source)));

// A template without the optional texts that break a rule, like a label on a drawing in words the narration does not
// use. Its own repair leaves them out; a template it cannot repair shows the scene as text instead.
function tidyTemplate(visual: AnyVisual, scene: NarratedScene, allowed: Set<string>, source: string, quotable: string[]): AnyVisual {
  if (!isTemplateVisual(visual)) return visual;
  const spec = templateSpec(visual.kind);
  const keep = keepFor(allowed, source);
  if (spec.shown(visual).every(({ text, words, exact, optional }) => !optional || keep(text, words, exact))) return visual;
  return spec.repair?.(visual, keep, { narration: scene.narration, source, quotable }) ?? textVisual([], scene, allowed);
}

// People and figures as the narration speaks of them. They come in the order they are named, since the scene shows
// each as it is spoken. A figure wears a look only when its words are said about that person (no crown for a
// president), and holds a thing only when it is spoken of with them: three astronauts each holding a rocket say
// nothing.
function tidyPeople(visual: AnyVisual, narration: string, source: string): AnyVisual {
  if (visual.kind === "people") {
    const people = visual.people
      .map((person) => ({
        ...person,
        look: lookFits(person.look, person.name, person.role, source) ? person.look : ("person" as const),
        // A role that only repeats the name says nothing.
        role: person.role && !sameWords(person.role, person.name) && groundedWords(person.role, person.name).matched < claimWords(person.role).length ? person.role : undefined,
        prop: person.prop && propFits(person.prop, aboutPerson(person.name, source)) ? person.prop : undefined,
      }))
      .sort((a, b) => firstMention(a.name, narration, source) - firstMention(b.name, narration, source));
    return { ...visual, people };
  }
  if (visual.kind === "illustration") {
    const order = visual.items
      .map((item, index) => ({ index, at: item.label ? firstMention(item.label, narration, source) : -1 }))
      .sort((a, b) => a.at - b.at || a.index - b.index)
      .map(({ index }) => index);
    const items = order.map((index) => {
      const item = visual.items[index];
      if (!item.figure) return item;
      const look = lookFits(item.figure, item.label ?? "", undefined, source) ? item.figure : ("person" as const);
      return { ...item, figure: look, icon: item.icon && propFits(item.icon, source) ? item.icon : undefined };
    });
    const links = visual.links.map((link) => ({ ...link, from: order.indexOf(link.from), to: order.indexOf(link.to) }));
    // A backdrop only where the narration or facts say the scene takes place there.
    const backdrop = visual.backdrop && BACKDROP_WORDS[visual.backdrop].test(source) ? visual.backdrop : undefined;
    return { ...visual, items, links, backdrop };
  }
  return visual;
}

// The last scene of a video with maps, when it would only show lines: every place the maps showed, and the camera
// pulls back over them. The country the first map was about stays amber. It shows the whole picture and claims
// nothing new, so it has no labels on countries or arrows.
function recapMap(maps: MapVisual[]): MapVisual {
  const origin = maps[0].highlights.find((highlight) => highlight.tone === "primary")?.country;
  const countries = [
    ...new Set(maps.flatMap((map) => map.highlights.filter((highlight) => highlight.tone !== "muted").map((highlight) => highlight.country))),
  ];
  const arrows = maps
    .flatMap((map) => map.arrows.map((arrow) => ({ from: resolvePlace(map, arrow.from), to: resolvePlace(map, arrow.to) })))
    .filter((arrow): arrow is { from: string; to: string } => arrow.from !== null && arrow.to !== null && arrow.from !== arrow.to)
    .filter((arrow, index, all) => all.findIndex((other) => other.from === arrow.from && other.to === arrow.to) === index)
    .slice(0, 6);
  const markers = maps
    .flatMap((map) => map.markers)
    .filter((marker, index, all) => all.findIndex((other) => other.label === marker.label) === index)
    .slice(0, 6);
  // Land routes by city name only, since a stop at a marker of another map has no marker here; without labels. Sea
  // routes stay out, because their way depends on the year of their own scene.
  const routes = maps
    .flatMap((map) => map.routes)
    .filter((route) => route.by === "land")
    .map((route) => ({ stops: route.stops.filter((stop) => placeOf(stop) !== null), by: route.by }))
    .filter((route) => route.stops.length >= 2)
    .slice(0, 2);
  return {
    kind: "map",
    frame: countries,
    highlights: countries.map((country) => ({ country, tone: country === origin ? "primary" : "secondary" })),
    arrows,
    markers,
    routes,
  };
}

// Asks again, in one separate call, where each city lies. A marker only stays if both answers agree: its
// coordinates fall inside the country of the second answer, and the two positions are within 250 km. This catches
// coordinates that are simply wrong, which the first check misses when the model names a country that matches its
// own wrong coordinates, and mix-ups like the city of Karakorum and the Karakoram mountains.
async function verifyMarkers(
  title: string,
  visuals: AnyVisual[],
  narrations: string[], // the narration of the scene each visual belongs to
  deadline: number,
): Promise<{ visuals: AnyVisual[]; usage: Usage }> {
  // Each place once, with the narration of the first scene that shows it, to tell apart similar names.
  const contextOf = new Map<string, string>();
  visuals.forEach((visual, index) => {
    if (visual.kind !== "map") return;
    for (const marker of visual.markers) if (!contextOf.has(marker.label)) contextOf.set(marker.label, narrations[index]);
    // A label on a country is asked about too: "Caffa" once stood on Georgia, and it is a port in Crimea.
    for (const highlight of visual.highlights) {
      if (highlight.label && !isCountryName(highlight.label, highlight.country) && !contextOf.has(highlight.label)) contextOf.set(highlight.label, narrations[index]);
    }
  });
  const places = [...contextOf.keys()];
  if (places.length === 0) return { visuals, usage: emptyUsage() };
  let secondOpinion = new Map<string, { isPlace: boolean; isCity: boolean; country: string; lat: number; lon: number }>();
  let usage = emptyUsage();
  try {
    const reply = await chatJson({
      step: "direct/places",
      schemaName: "places",
      schema: z.object({
        places: z
          .array(z.object({ isPlace: z.boolean(), isCity: z.boolean(), country: z.string(), lat: z.number(), lon: z.number() }))
          .length(places.length),
      }),
      messages: placesPrompt(title, places.map((name) => ({ name, context: contextOf.get(name) ?? "" }))),
      maxTokens: 800,
      timeoutMs: SCENE_CALL_TIMEOUT_MS,
      deadline,
    });
    secondOpinion = new Map(places.map((place, index) => [place, reply.data.places[index]]));
    usage = reply.usage;
  } catch (error) {
    // Without the second opinion the markers cannot be trusted, so they are left out.
    console.warn(`[direct/places] Leaving out the map markers: ${error}`);
    usage = usageOf(error);
  }
  return {
    usage,
    visuals: visuals.map((visual) => {
      if (visual.kind !== "map") return visual;
      const markers = visual.markers.filter((marker) => {
        const other = secondOpinion.get(marker.label);
        // A marker for "Senate" or "Magistrates" is not a place, wherever the model puts it.
        if (!other || !other.isPlace || !countryContains(other.country, marker.lon, marker.lat)) return false;
        const km = geoDistance([marker.lon, marker.lat], [other.lon, other.lat]) * EARTH_RADIUS_KM;
        return km <= MAX_MARKER_GAP_KM;
      });
      if (markers.length < visual.markers.length) console.warn(`[direct/places] Dropped ${visual.markers.length - markers.length} marker(s)`);
      // A country labeled with a city, or with a place that lies in another country, loses the label: cities are
      // markers. Then the country stays bright only if the scene names it. A region the country lies in, like Central
      // Asia, keeps its label whatever country the second opinion gives for it.
      const misplaced = (label: string, country: string) => {
        const other = secondOpinion.get(label);
        return other !== undefined && (other.isCity || (other.isPlace && other.country.toUpperCase() !== country && !namesRegionOf(label, country)));
      };
      const highlights = visual.highlights.map((highlight) =>
        highlight.label && misplaced(highlight.label, highlight.country) ? { ...highlight, label: undefined } : highlight,
      );
      const unlabeled = highlights.filter((highlight, index) => highlight.label !== visual.highlights[index].label).length;
      if (unlabeled > 0) console.warn(`[direct/places] Took a city's name off ${unlabeled} countr${unlabeled === 1 ? "y" : "ies"}`);
      // A route stop at a dropped marker goes too, rather than being looked up by name in the table, where the same
      // name may be another city.
      const dropped = new Set(visual.markers.filter((marker) => !markers.includes(marker)).map((marker) => marker.label.trim().toLowerCase()));
      const routes = visual.routes.map((route) => ({ ...route, stops: route.stops.filter((stop) => !dropped.has(stop.trim().toLowerCase())) }));
      return { ...visual, highlights, markers, routes };
    }),
  };
}

// The storyboard contract has no fact IDs on timeline events and no countries on markers, and a quote points to
// its source instead of its fact.
// The year a route's journey took place: the earliest year in the sentences that name its stops. A route about today,
// or one that names a canal without a year, is modern; with no year at all, it stays undated and takes no canal.
function routeYear(stops: string[], source: string): number | undefined {
  const years = sentencesOf(source)
    .filter((sentence) => stops.some((stop) => groundedWords(stopName(stop), sentence).matched > 0))
    .flatMap((sentence) => yearsIn(sentence));
  if (years.length > 0) return Math.min(...years);
  return /\b(today|nowadays|modern|currently|suez canal|panama canal)\b/i.test(source) ? new Date().getFullYear() : undefined;
}

// What travels along a route: a ship by sea, and by land only what the narration names, else a plain arrowhead.
function routeIcon(by: "land" | "sea", source: string): string | undefined {
  if (by === "sea") return "ship";
  if (/\b(camels?|caravans?)\b/i.test(source)) return "camel";
  if (/\b(horses?|cavalry|horseback|mounted)\b/i.test(source)) return "horse";
  if (/\b(trains?|railways?|railroads?)\b/i.test(source)) return "train";
  if (/\b(cars?|trucks?|drove|motorcade)\b/i.test(source)) return "car";
  return undefined;
}

function forStoryboard(visual: AnyVisual, facts: FactMap, source: string, sourceTitle?: string, narration?: string) {
  if (isTemplateVisual(visual)) return { kind: "template" as const, template: visual.kind, params: templateParams(visual, { sourceTitle, narration, source }) };
  // An empty detail would draw an empty line under a card's title, and an unknown icon would draw a dot.
  if (visual.kind === "list") {
    return {
      kind: "list" as const,
      items: visual.items.map(({ title, detail, icon }) => ({ title, ...(detail?.trim() ? { detail } : {}), ...(iconKey(icon) ? { icon: iconKey(icon) } : {}) })),
    };
  }
  if (visual.kind === "steps") {
    const icons = visual.steps.map((_, index) => iconKey(visual.icons[index]) ?? "");
    return { kind: "steps" as const, steps: visual.steps, ...(icons.some(Boolean) ? { icons } : {}) };
  }
  if (visual.kind === "versus") {
    const { leftIcon, rightIcon, ...rest } = visual;
    return { ...rest, ...(iconKey(leftIcon) ? { leftIcon: iconKey(leftIcon) } : {}), ...(iconKey(rightIcon) ? { rightIcon: iconKey(rightIcon) } : {}) };
  }
  if (visual.kind === "people") {
    return { kind: "people" as const, people: visual.people.map(({ prop, ...person }) => ({ ...person, ...(iconKey(prop) ? { prop: iconKey(prop) } : {}) })) };
  }
  if (visual.kind === "space") {
    return { ...visual, sites: visual.sites.filter((site) => moonPlace(site) !== null) };
  }
  if (visual.kind === "drawing") {
    // A drawing still made on a 0 to 1 grid after the retries is stretched to the 0 to 100 grid.
    const scale = onUnitGrid(visual) ? 100 : 1;
    const clamp = (value: number) => Math.max(0, Math.min(100, value * scale));
    const point = ({ x, y }: { x: number; y: number }) => ({ x: clamp(x), y: clamp(y) });
    const parts = visual.parts.map((part): DrawingPart | null => {
      if (part.shape === "band") return { ...part, y1: clamp(Math.min(part.y1, part.y2)), y2: clamp(Math.max(part.y1, part.y2)) };
      if (part.shape === "icon") return iconKey(part.name) ? { ...part, name: iconKey(part.name) ?? part.name, ...point(part) } : null;
      if (part.shape === "tube" || part.shape === "arrow" || part.shape === "flow") return { ...part, points: part.points.map(point) };
      return { ...part, ...point(part), w: clamp(Math.abs(part.w)), h: clamp(Math.abs(part.h)) };
    });
    // An unknown icon is left out, so the labels count the parts that are left. The drawing is then fitted to the
    // canvas, and each label placed beside its part.
    const kept = parts.flatMap((part) => (part ? [part] : []));
    const labels = visual.labels.flatMap(({ text, part }) => (parts[part] ? [{ text, part: kept.indexOf(parts[part]) }] : []));
    const fitted = fitDrawing(kept, Boolean(visual.title));
    return { kind: "drawing" as const, title: visual.title, parts: fitted, labels: placeLabels(fitted, labels, Boolean(visual.title)) };
  }
  if (visual.kind === "illustration") {
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    return { ...visual, items: visual.items.map((item) => ({ ...item, icon: iconKey(item.icon), x: clamp(item.x), y: clamp(item.y) })) };
  }
  if (visual.kind === "timeline") {
    const eras = visual.eras.map(({ start, end, label }) => ({ start, end, label }));
    return {
      kind: "timeline" as const,
      focusIndex: visual.focusIndex,
      events: visual.events.map(({ year, label, date }) => (date ? { year, label, date } : { year, label })),
      ...(eras.length > 0 ? { eras } : {}),
    };
  }
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
      // Each stop at a marker's point or at the city's place in the code's table, never at the model's coordinates.
      routes: visual.routes
        .map((route) => ({
          by: route.by,
          ...(route.label ? { label: route.label } : {}),
          ...(routeYear(route.stops, source) !== undefined ? { year: routeYear(route.stops, source) } : {}),
          ...(routeIcon(route.by, source) ? { icon: routeIcon(route.by, source) } : {}),
          stops: route.stops.flatMap((stop) => {
            const marker = stopMarker(visual, stop);
            const place = marker ? { lon: marker.lon, lat: marker.lat } : placeOf(stop);
            return place ? [{ lon: place.lon, lat: place.lat, label: marker ? marker.label : stop }] : [];
          }),
        }))
        .filter((route) => route.stops.length >= 2),
    };
  }
  if (visual.kind === "quote") return { kind: "quote", text: visual.text, sourceId: facts.get(visual.factId)?.sourceId ?? "" };
  return visual;
}

export async function direct({ request, script, facts, sources }: z.infer<typeof DirectInputSchema>): Promise<DirectResult> {
  const deadline = Date.now() + DIRECT_DEADLINE_MS;
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
    const text = factMap.get(id)?.text ?? "";
    const years = yearsIn(text);
    const dates = datesIn(text);
    if (years.length === 0) return [];
    const yearText = years.map((year) => (year < 0 ? `${year} (${-year} BC)` : String(year))).join(", ");
    return [`${id}: ${yearText}${dates.length > 0 ? ` (dates: ${dates.join(", ")})` : ""}`];
  });
  // Points in time a timeline can use: the years the facts state, and their dates for events within one year.
  const videoYears = new Set(
    videoFactIds.flatMap((id) => {
      const text = factMap.get(id)?.text ?? "";
      return [...yearsIn(text).map(String), ...datesIn(text)];
    }),
  ).size;
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
      return { data: fallback, usage: usageOf(error) };
    });
  const titleCall = orFallback<TitleVisual>(
    chatJson({
      step: `direct/${opening.id}`,
      fast: true,
      schemaName: "title",
      schema: TitleVisualSchema,
      messages: directTitlePrompt(script.title, opening.narration, ICON_NAMES),
      maxTokens: 300,
      timeoutMs: SCENE_CALL_TIMEOUT_MS,
      deadline: deadline - MARKER_CHECK_MS,
      check: (visual) => titleProblems(visual, allowedFor(opening)),
      repair: () => ({ heading: script.title }),
    }),
    { heading: script.title },
  );
  // A map needs places: a scene has them when it names a country, region, continent or sea. A video with fewer than
  // two such scenes is not about places, and maps would be guesses: the model once planned maps for how the immune
  // system works, and for the Moon landing. Asking the model which scenes name places let the Moon through.
  const hasPlaces = rest.map((scene) => namesAPlace(sourceFor(scene)));
  const geographic = hasPlaces.filter(Boolean).length >= 2;
  // A scene's narration or facts must name the place, and the scene must not be about space: facts about "the
  // American spaceflight" once gave a scene about the Moon landing a map of the United States labeled "Tranquility
  // Base". A place only the facts name counts only when the facts are not about space either.
  const mapFits = rest.map((scene) => {
    const factText = scene.factIds.map((id) => factMap.get(id)?.text ?? "").join(" ");
    const placeInFacts = namesAPlace(factText) && !SPACE_WORDS.test(factText);
    return !SPACE_WORDS.test(scene.narration) && (namesAPlace(scene.narration) || placeInFacts);
  });
  const limits = kindLimits(rest.length, geographic);
  // The whole sentences of a scene's source quotes, which a quote or a letter may show word for word.
  const quotableOf = (scene: NarratedScene) => scene.factIds.flatMap((id) => quotableSentences(factMap.get(id)?.quote ?? ""));
  // What each scene offers the templates to decide whether they fit.
  const sceneData = (scene: NarratedScene): SceneData => {
    const source = sourceFor(scene);
    return {
      narration: scene.narration,
      source,
      amounts: amountsFor(source),
      years: yearsIn(source),
      dates: datesIn(source),
      percents: (source.match(PERCENT_AMOUNT) ?? []).length,
      namesPerson: namesAPerson(source),
      quotable: quotableOf(scene),
    };
  };
  // The kinds each scene cannot use: those its facts have no data for, and a map where it names no place.
  const missing = rest.map((scene, index): AnyKind[] => [
    ...kindsWithoutData(scene, factMap, videoYears, sceneData(scene)),
    ...(geographic && mapFits[index] ? [] : ["map" as const]),
  ]);
  const rules: KindRules = { missing, limits, families: familyLimits(rest.length) };
  // The kinds a scene can use at all, for the plan and the critique.
  const fitsFor = (index: number) => ALL_KINDS.filter((kind) => !missing[index].includes(kind) && limits[kind] > 0);
  // Only the templates some scene can use, so the menu stays short.
  const templateMenu = TEMPLATE_NAMES.filter((name) => rest.some((_, index) => fitsFor(index).includes(name))).map((name) => ({ name, plan: templateSpec(name).plan }));
  // One call ranks the kinds that fit each scene, and the code picks from them so the video gets a rhythm.
  // If the call fails, each scene picks on its own.
  const plan = await chatJson({
    step: "direct/plan",
    schemaName: "plan",
    schema: z.object({
      theme: z.enum(THEME_NAMES),
      // Each scene's picture in words first, then the kinds that can show it.
      scenes: z.array(z.object({ idea: z.string(), kinds: z.array(z.enum(ALL_KINDS)).min(2).max(3) })).length(rest.length),
    }),
    messages: directPlanPrompt(
      script.title,
      rest.map((scene, index) => ({
        id: scene.id,
        narration: scene.narration,
        facts: scene.factIds.map((id) => factMap.get(id)?.text ?? ""),
        fits: fitsFor(index),
      })),
      templateMenu,
    ),
    maxTokens: 1400,
    timeoutMs: SCENE_CALL_TIMEOUT_MS,
    deadline: Math.min(deadline - MARKER_CHECK_MS, Date.now() + PLAN_DEADLINE_MS),
  }).catch((error) => {
    console.warn(`[direct/plan] No plan, scenes pick their own kind: ${error}`);
    return { data: null, usage: usageOf(error) };
  });
  const plannedKinds = plan.data ? pickKinds(plan.data.scenes.map((scene) => scene.kinds), rules) : rest.map(() => undefined);
  if (plan.data) console.log(`[direct/plan] ${plan.data.theme}: ${plannedKinds.map((kind) => kind ?? "free").join(", ")}`);
  // A second look at the plan by the model, as a demanding editor who wants each scene to show what its narration is
  // about, and not look like the scenes around it. It may swap a few scenes; a swap follows the same rules.
  const critique = plan.data
    ? await chatJson({
        step: "direct/critique",
        schemaName: "critique",
        schema: z.object({
          changes: z.array(z.object({ scene: z.string(), kind: z.enum(ALL_KINDS), why: z.string() })).max(MAX_CRITIQUE_CHANGES),
        }),
        messages: directCritiquePrompt(
          script.title,
          rest.map((scene, index) => ({ id: scene.id, narration: scene.narration, idea: plan.data?.scenes[index]?.idea ?? "", picked: plannedKinds[index] ?? "free", fits: fitsFor(index) })),
          templateMenu,
        ),
        maxTokens: 500,
        timeoutMs: SCENE_CALL_TIMEOUT_MS,
        deadline: Math.min(deadline - MARKER_CHECK_MS, Date.now() + CRITIQUE_DEADLINE_MS),
      }).catch((error) => {
        console.warn(`[direct/critique] No critique, keeping the plan: ${error}`);
        return { data: null, usage: usageOf(error) };
      })
    : { data: null, usage: emptyUsage() };
  for (const change of critique.data?.changes ?? []) {
    const index = rest.findIndex((scene) => scene.id === change.scene);
    if (index < 0 || plannedKinds[index] === change.kind) continue;
    const fits = kindFits(change.kind, index, plannedKinds, rules, false);
    console.log(`[direct/critique] ${change.scene}: ${plannedKinds[index] ?? "free"} to ${change.kind}${fits ? "" : " does not fit, kept"} (${change.why})`);
    if (fits) plannedKinds[index] = change.kind;
  }
  // A drawing made for exactly this topic, like the volcano, is the best picture a video can have, and its narrow
  // checks only let it in where the narration explains its process. When one fits a scene and the plan picked none, it
  // takes the plainest scene it fits.
  if (plan.data && !plannedKinds.some((kind) => kind !== undefined && isTemplateName(kind) && templateSpec(kind).signature)) {
    const plainness = (kind: AnyKind | undefined) => (kind === undefined || PLAIN_KINDS.includes(kind) ? 0 : kind === "map" ? 2 : 1);
    const candidates = rest.flatMap((_, index) =>
      TEMPLATE_NAMES.filter((name) => templateSpec(name).signature && !missing[index].includes(name) && kindFits(name, index, plannedKinds, rules, false)).map((name) => ({ index, name })),
    );
    const best = candidates.sort((a, b) => plainness(plannedKinds[a.index]) - plainness(plannedKinds[b.index]))[0];
    if (best) {
      console.log(`[direct] ${rest[best.index].id}: ${plannedKinds[best.index] ?? "free"} to ${best.name}, a drawing made for this topic`);
      plannedKinds[best.index] = best.name;
    }
  }
  // The templates a scene may use: those the plan ranked for it and `kind`, the kind it is asked for, unless another
  // scene is to use them.
  const offeredFor = (index: number, kind: AnyKind | undefined): TemplateName[] =>
    [...new Set([kind, ...(plan.data?.scenes[index]?.kinds ?? [])])].filter(
      (other): other is TemplateName =>
        other !== undefined && isTemplateName(other) && !missing[index].includes(other) && !plannedKinds.some((planned, at) => at !== index && planned === other),
    );
  // The kinds a scene may not use at all: those it has no data for, and those the other scenes already use as often
  // as the rules allow, by kind or by family, so a scene without a plan does not add a third quote or statement.
  const blockedFor = (index: number, kind: AnyKind | undefined): AnyKind[] => {
    const others = plannedKinds.filter((other, at): other is AnyKind => at !== index && other !== undefined);
    const usedUp = ALL_KINDS.filter(
      (other) =>
        others.filter((planned) => planned === other).length >= limits[other] ||
        others.filter((planned) => familyOf(planned) === familyOf(other)).length >= (rules.families[familyOf(other)] ?? Infinity),
    );
    return [...new Set([...missing[index], ...usedUp])].filter((other) => other !== "text" && other !== kind);
  };
  // The kinds a scene should not switch to: the blocked ones, and those of the scenes next to it (maps may repeat).
  const avoidFor = (index: number, kind: AnyKind | undefined): AnyKind[] => {
    const neighbors = [plannedKinds[index - 1], plannedKinds[index + 1]].filter(
      (other): other is AnyKind => other !== undefined && other !== "map" && other !== "text" && other !== kind,
    );
    return [...new Set([...blockedFor(index, kind), ...neighbors])];
  };
  // Of those, the ones worth naming in a scene's prompt: its schema has no other templates anyway.
  const avoidInPrompt = (index: number, kind: AnyKind | undefined) =>
    avoidFor(index, kind).filter((other) => !isTemplateName(other) || offeredFor(index, kind).includes(other));

  // One scene's call, asking for `kind`, or leaving the kind to the model when the plan has none for it. A scene asked
  // for a drawing sees drawings made before for similar scenes, from the library, to learn from.
  const sceneCall = async (index: number, kind: AnyKind | undefined) => {
    const scene = rest[index];
    const offered = offeredFor(index, kind);
    // A kind the scene may not use is neither described nor in the reply's schema, which keeps the prompt short.
    const blocked = blockedFor(index, kind);
    const drawingExamples = kind === "drawing" ? await similarDrawings(scene.narration) : [];
    return orFallback<SceneReply>(
      chatJson({
        step: `direct/${scene.id}`,
        schemaName: "scene",
        schema: sceneReplySchema(offered, blocked),
        messages: directScenePrompt({
          title: script.title,
          position: `scene ${index + 2} of ${narrated.length}`,
          narration: scene.narration,
          sceneFacts: factList(scene.factIds),
          quotable: scene.factIds.flatMap((id) => quotableSentences(factMap.get(id)?.quote ?? "").map((sentence) => ({ factId: id, sentence }))),
          icons: ICON_NAMES,
          // The Moon's places only matter to a scene about space.
          moonPlaces: SPACE_WORDS.test(scene.narration) ? [...MOON_SEAS, ...MOON_SITES].map((place) => place.name) : [],
          // Only the other facts a timeline can use, those that state a year, and only when the scene may be a timeline:
          // sending every fact of the video cost about a thousand tokens a call and drew labels from words the scene
          // does not say.
          otherFacts: blocked.includes("timeline")
            ? []
            : factList(videoFactIds.filter((id) => !scene.factIds.includes(id) && yearsIn(factMap.get(id)?.text ?? "").length > 0)),
          kinds: SCENE_KINDS.filter((other): other is OwnKind => other !== "text" && !blocked.includes(other)),
          templates: offered.map((name) => templateSpec(name).prompt),
          drawingExamples: drawingExamples.map(({ narration, drawing }) => ({ narration, drawing })),
          plannedKind: kind,
          idea: plan.data?.scenes[index]?.idea,
          avoidKinds: avoidInPrompt(index, kind),
          years: yearList,
          amounts: amountsFor(sourceFor(scene)),
        }),
        maxTokens: 1000,
        timeoutMs: SCENE_CALL_TIMEOUT_MS,
        deadline: deadline - MARKER_CHECK_MS,
        check: (reply) => [
          ...(reply.visual.kind === "text" && kind && kind !== "text" ? [`Show a ${kind} or another picture, not text.`] : []),
          ...sceneProblems(reply, allowedFor(scene), videoFacts, sourceFor(scene), scene.narration, avoidFor(index, kind), blockedFor(index, kind), offered, quotableOf(scene)),
        ],
        repair: (reply) => ({
          visual: repairScene(reply, scene, allowedFor(scene), videoFacts, sourceFor(scene), blockedFor(index, kind), quotableOf(scene)),
          lines: reply.lines,
        }),
      }),
      { visual: textVisual([], scene, allowedFor(scene)), lines: [] },
    );
  };
  const [title, ...firstTries] = await Promise.all([titleCall, ...rest.map((_, index) => sceneCall(index, plannedKinds[index]))]);
  // A scene whose picture still broke a rule after the retries shows its lines. If the plan ranked another kind for it
  // that fits among the scenes around it, and there is time, it gets one more call with that kind, all such scenes at
  // once, so fewer scenes end as plain text.
  // A map that is left with nothing the scene names would show its lines too, so it gets the second call as well.
  const failed = (visual: AnyVisual, index: number) => visual.kind === "text" || showsNothing(tidyMap(visual, sourceFor(rest[index])), rest[index].narration);
  const shownKinds = firstTries.map(({ data }) => data.visual.kind);
  const scenes = await Promise.all(
    firstTries.map(async (first, index) => {
      const planned = plannedKinds[index];
      if (!failed(first.data.visual, index) || planned === undefined || planned === "text") return first;
      if (Date.now() > deadline - MARKER_CHECK_MS - SECOND_TRY_MS) return first;
      const next = (plan.data?.scenes[index]?.kinds ?? []).find((kind) => kind !== planned && kind !== "text" && kindFits(kind, index, shownKinds, rules, false));
      if (!next) return first;
      console.log(`[direct] ${rest[index].id} tries a ${next}, since its ${planned} did not work`);
      const second = await sceneCall(index, next);
      const usage = addUsage(first.usage, second.usage);
      return failed(second.data.visual, index) ? { ...first, usage } : { ...second, usage };
    }),
  );
  // Markers are checked before the maps are tidied, so a country kept bright only by a wrong marker is muted too.
  const checked = await verifyMarkers(
    script.title,
    scenes.map(({ data }) => data.visual),
    rest.map((scene) => scene.narration),
    deadline,
  );
  const tidied = checked.visuals.map((visual, index) => {
    const scene = rest[index];
    const source = sourceFor(scene);
    return tidyTemplate(tidyPeople(tidyMap(visual, source), scene.narration, source), scene, allowedFor(scene), source, quotableOf(scene));
  });
  const usage = [title, ...scenes, checked, plan, critique].reduce((total, call) => addUsage(total, call.usage), emptyUsage());

  // The calls ran apart, so a map or timeline can repeat the one before, the same kind can come too often in a row,
  // or a kind can come more often than `limits` allows. Then the later scene shows its lines instead, to keep some
  // rhythm.
  const visuals: AnyVisual[] = [];
  const noRecap: boolean[] = []; // scenes whose own map was just turned down, so no map may take their place
  scenes.forEach(({ data }, index) => {
    const visual = tidied[index];
    const previous = visuals[index - 1];
    const repeats = previous !== undefined && sameAs(previous, visual);
    // Three maps in a row play as one journey; a fourth is too many.
    const fourthMap = visual.kind === "map" && [visuals[index - 3], visuals[index - 2], previous].every((other) => other?.kind === "map");
    // Two steps, stats, quotes, charts or timelines in a row look the same; two maps of different places do not.
    const sameKind = previous !== undefined && !["map", "text"].includes(visual.kind) && previous.kind === visual.kind;
    const overLimit = visual.kind !== "text" && visuals.filter((other) => other.kind === visual.kind).length >= limits[visual.kind];
    const emptyMap = showsNothing(visual, rest[index].narration);
    const why = repeats
      ? "repeats the scene before"
      : fourthMap
        ? "would be a fourth map in a row"
        : sameKind
          ? "comes twice in a row"
          : overLimit
            ? "comes too often in this video"
            : emptyMap
              ? "shows nothing"
              : null;
    if (why) console.log(`[direct] ${rest[index].id} shows its lines instead of a ${visual.kind} that ${why}`);
    noRecap.push(visual.kind === "map" && why !== null);
    visuals.push(why ? textVisual(data.lines, rest[index], allowedFor(rest[index])) : visual);
  });
  // A video about places ends on a map of every place it showed, instead of lines, unless the last scene may not
  // have a map, it would be one map too many or a fourth in a row, or it would bring back a map just turned down.
  const maps = visuals.filter((visual): visual is MapVisual => visual.kind === "map");
  const last = visuals.length - 1;
  const mapsBefore = visuals.slice(Math.max(0, last - 3), last).filter((visual) => visual.kind === "map").length;
  const recapFits = maps.length >= 2 && maps.length < limits.map && mapsBefore < 3 && !missing[last]?.includes("map");
  if (geographic && recapFits && visuals[last]?.kind === "text" && !noRecap[last]) {
    console.log(`[direct] ${rest[last]?.id} ends on a map of every place in the video instead of lines`);
    visuals[last] = recapMap(maps);
  }
  console.log(`[direct] kinds: ${visuals.map((visual, index) => (visual.kind === plannedKinds[index] ? visual.kind : `${visual.kind} (planned ${plannedKinds[index] ?? "free"})`)).join(", ")}`);

  // The title card asks the question the video answers, when the fact-checked narration still backs it.
  const narration = narrated.map((scene) => scene.narration).join(" ");
  const question = script.question && questionProblems(script.question, narration).length === 0 ? script.question : undefined;
  if (script.question && !question) console.warn(`[direct] Leaving out the question "${script.question}": the narration does not back it`);

  // The source a template names, like a fact card's: the source of the scene's fact that shares most words with
  // what the template shows.
  const sourceTitleFor = (scene: NarratedScene, visual: AnyVisual) => {
    if (!isTemplateVisual(visual)) return undefined;
    const shown = templateSpec(visual.kind).shown(visual).map((item) => item.text ?? "").join(" ");
    const [best] = scene.factIds
      .flatMap((id) => factMap.get(id) ?? [])
      .sort((a, b) => groundedWords(shown, b.text).matched - groundedWords(shown, a.text).matched);
    return sources.find((source) => source.id === best?.sourceId)?.title;
  };
  const usedSourceIds = new Set(
    facts.filter((fact) => videoFactIds.includes(fact.id)).map((fact) => fact.sourceId),
  );
  const storyboard = StoryboardSchema.parse({
    title: script.title,
    language: request.language,
    theme: plan.data?.theme ?? "night",
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: narrated.map((scene, index) => ({
      ...(index === 0
        ? { kind: "title", heading: headingOf(script.title, title.data.heading), subheading: question || title.data.subheading, icon: iconKey(title.data.icon) }
        : forStoryboard(visuals[index - 1], videoFacts, sourceFor(rest[index - 1]), sourceTitleFor(rest[index - 1], visuals[index - 1]), rest[index - 1].narration)),
      id: scene.id,
      narration: scene.narration,
      factIds: scene.factIds,
      durationSec: sceneDuration(scene.narration),
    })),
    sources: sources
      .filter((source) => usedSourceIds.has(source.id))
      .map(({ id, title: sourceTitle, url }) => ({ id, title: sourceTitle, url })),
  });

  // Some scenes are drawn with one of Trym's templates instead of their own drawing, so videos look less alike. A
  // quote's look may show the source words around it.
  const lookOptions = storyboard.scenes.map((scene, index) => {
    const visual = visuals[index - 1];
    const quoteFact = visual?.kind === "quote" ? factMap.get(visual.factId) : undefined;
    return looksFor(scene, {
      isLast: index === storyboard.scenes.length - 1,
      sourceTitle: scene.kind === "quote" ? storyboard.sources.find((source) => source.id === scene.sourceId)?.title : undefined,
      excerpt: quoteFact?.quote.trim(),
    });
  });
  const templatesShown = storyboard.scenes.flatMap((scene) => (scene.kind === "template" ? [scene.template] : []));
  const looks = pickLooks(lookOptions, script.title, templatesShown);
  storyboard.scenes.forEach((scene, index) => {
    if (looks[index]) scene.look = looks[index];
  });
  // The opening varies too: a globe when the video is about places, a big icon for its topic, the question it answers
  // in big letters, the years its opening spans rolling by, or a plain title card.
  const titleScene = storyboard.scenes[0];
  if (titleScene?.kind === "title") {
    const years = [...new Set(yearsIn(titleScene.narration))].sort((a, b) => a - b);
    const intro = pickIntro(
      introOptions(titleScene, {
        question,
        years: years.length >= 2 ? [years[0], years[years.length - 1]] : undefined,
        places: storyboard.scenes.some((scene) => scene.kind === "map"),
      }),
      script.title,
      [...templatesShown, ...looks.flatMap((look) => (look ? [look.template] : []))],
    );
    if (intro) titleScene.look = intro;
  }
  console.log(`[direct] looks: ${storyboard.scenes.map((scene) => scene.look?.template ?? (scene.kind === "template" ? scene.template : scene.kind)).join(", ")}`);

  const problems = storyboardProblems(storyboard, facts.map((fact) => fact.id));
  if (problems.length > 0) throw new Error(`The storyboard is not valid: ${problems.join("; ")}`);
  // Drawings that passed their checks go into the library as the model gave them, so later scenes about similar things
  // can learn from them.
  await Promise.all(
    visuals.flatMap((visual, index) =>
      visual.kind === "drawing" && !onUnitGrid(visual) ? [saveDrawing(rest[index].narration, { title: visual.title, parts: visual.parts, labels: visual.labels })] : [],
    ),
  );
  return { storyboard, usage };
}
