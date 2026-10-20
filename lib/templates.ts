import { z } from "zod";
import { barIsStated, hasPhrase, isNotAPerson, isYearLike, roleOf, statedTogether, unitKey, unitSaidWith } from "./grounding.ts";
import { iconKey } from "./icons.ts";
import { isDateIn, isNameNumber, numbersIn, statesDate, yearsIn } from "./numbers.ts";
import { groundedWords, sameWords, sentencesOf } from "./words.ts";

// Trym's filmmotor templates (remotion/filmmotor) as kinds of scene the director can choose. Each template says what
// it shows, when it fits, the reply the model fills, which of its texts must be backed by the narration and facts,
// and how the reply becomes the template's params. A template's kind is its name in remotion/filmmotor.

// Kinds that look alike on screen. Two scenes of one family in a row feel like the same picture twice.
export type Family = "map" | "time" | "number" | "chart" | "words" | "chain" | "structure" | "sides" | "cards" | "people" | "picture";

// What a template needs to know about a scene to tell whether it fits.
export type SceneData = {
  narration: string;
  source: string; // the narration and the scene's facts
  amounts: string[]; // amounts in the source, without dates and numbers in names
  years: number[]; // years in the source
  dates: string[]; // days and months in the source, like "20 July"
  percents: number; // how many amounts in the source are in percent
  namesPerson: boolean;
  quotable: string[]; // whole sentences of the scene's source quotes, which may be shown word for word
};

// A text a template shows, with the most words it may have, and the most characters where the template has room for
// only one short line. Exact texts, like names, need every word in the narration or facts; others need more than half.
// An optional text, like a label on a drawing, is left out when it breaks a rule, instead of costing another try.
export type Shown = { text: string | undefined; words: number; chars?: number; exact?: boolean; optional?: boolean };

// Whether a text passes the checks for shown texts: backed, not too long and only with numbers from the narration.
export type Keep = (text: string | undefined, words: number, exact?: boolean) => boolean;

export type CheckContext = { narration: string; source: string; quotable: string[] };

type Template<S extends z.ZodObject> = {
  family: Family;
  plan: string; // what it shows, for the plan's menu
  prompt: string; // how to fill it, for the scene's prompt
  schema: S;
  fits(scene: SceneData): boolean;
  shown(visual: z.infer<S>): Shown[];
  check?(visual: z.infer<S>, context: CheckContext): string[]; // rules beyond the shown texts
  // The visual without the parts that break a rule, or null when too little is left. Without it, a visual with a
  // problem after the retries shows the scene's lines instead.
  repair?(visual: z.infer<S>, keep: Keep, context: CheckContext): z.infer<S> | null;
  params?(visual: z.infer<S>, extra: Extra): Record<string, unknown>;
  // A drawing made for one topic, like the volcano: the director makes sure a video uses one when its narration fits.
  signature?: boolean;
};

// What the params may use besides the reply: the title of the scene's source, the narration, and the narration with
// the facts behind it (`source`), so the code can set what a drawing claims from what they say.
type Extra = { sourceTitle?: string; narration?: string; source?: string };

const template = <S extends z.ZodObject>(spec: Template<S>) => spec;

// The problem when two texts in a list say the same thing.
const distinct = (texts: string[], problem: string) =>
  texts.some((text, index) => texts.slice(0, index).some((other) => sameWords(other, text))) ? [problem] : [];

// A model's icon as a name the video can draw, or nothing.
const icon = (name?: string) => iconKey(name);

// A unit as the suffix of a number: "45%" but "25 million".
const suffix = (unit?: string) => {
  const trimmed = unit?.trim() ?? "";
  if (trimmed === "") return "";
  return /^(%|percent|per cent)$/i.test(trimmed) ? "%" : ` ${trimmed}`;
};
const decimalsOf = (value: number) => (String(value).split(".")[1] ?? "").length;

// What is wrong with a number shown with a label: one sentence must give it for that thing, and it must be an amount,
// not a year, a date or part of a name like Apollo 11.
function amountProblems(stat: { value: number; label: string; unit?: string }, source: string): string[] {
  // A number like 1000 is a year unless the narration writes it with a separator, as in "1,000 applicants".
  const looksLikeYear = isYearLike(stat.value) && !source.includes(stat.value.toLocaleString("en-US"));
  if (isDateIn(stat.value, source) || (!stat.unit && looksLikeYear)) return [`${stat.value} is a year or a date, not an amount to show here.`];
  if (isNameNumber(stat.value, source)) return [`${stat.value} is part of a name here, like Apollo 11, not an amount.`];
  if (!barIsStated(stat, stat.unit, source)) return [`No sentence of this scene gives ${stat.value} for "${stat.label}". Show numbers the narration or facts give for that thing.`];
  return [];
}

// Whether a sentence gives the year and the amount of a point together.
const pointIsStated = (point: { year: number; value: number }, source: string) =>
  point.value !== point.year && sentencesOf(source).some((sentence) => yearsIn(sentence).includes(point.year) && numbersIn(sentence).includes(String(point.value)));

// Whether a sentence names both things, so a line may join them.
// Demand and supply as nouns that go up or down. "Peasants could demand higher wages" uses demand as a verb, which
// once drew a rise in demand for a scene about a labor supply that collapsed.
const DEMAND_RISES = /\b(demand\s+(?:\w+\s+){0,2}(?:rose|rises|rising|increas\w*|grew|grows|growing|jumped|soared|surged|went up)|(?:rising|higher|greater|growing|increased|increasing|more)\s+demand)\b/i;
const DEMAND_FALLS = /\b(demand\s+(?:\w+\s+){0,2}(?:fell|falls|falling|dropp\w*|drops|decreas\w*|declin\w*|shr[ai]nk\w*|collaps\w*|went down)|(?:falling|lower|less|weaker|decreased|declining)\s+demand)\b/i;
const SUPPLY_RISES = /\b(supply\s+(?:\w+\s+){0,2}(?:rose|rises|rising|increas\w*|grew|grows|growing|jumped|soared|surged|went up)|(?:rising|higher|greater|growing|increased|bigger|more)\s+(?:\w+\s+)?supply|surplus|glut)\b/i;
const SUPPLY_FALLS = /\b(supply\s+(?:\w+\s+){0,2}(?:fell|falls|falling|dropp\w*|drops|decreas\w*|declin\w*|shr[ai]nk\w*|collaps\w*|went down|ran out)|(?:shatter\w*|collaps\w*|cut|reduc\w*|shr[ai]nk\w*|disrupt\w*)\s+(?:\w+\s+){0,2}supply|(?:falling|lower|less|smaller|reduced|shrinking)\s+(?:\w+\s+)?supply|shortages?|scarc\w*)\b/i;

// Units that measure the same thing, so two numbers in them side by side are one number twice: "30,000 °C" and
// "50,000 °F" in a lightning video.
const MEASURE_FAMILIES = [
  /^(°\s?c|°\s?f|celsius|fahrenheit|kelvin|degrees( celsius| fahrenheit)?)$/i,
  /^(km|kilomet(re|er)s?|mi|miles?)$/i,
  /^(kg|kilograms?|lbs?|pounds?)$/i,
  /^(m|metres?|meters?|ft|feet|foot)$/i,
  /^(km\/h|mph|kilomet(re|er)s per hour|miles per hour)$/i,
];
const sameMeasure = (a?: string, b?: string) =>
  Boolean(a && b) && unitKey(a ?? "") !== unitKey(b ?? "") && MEASURE_FAMILIES.some((family) => family.test((a ?? "").trim()) && family.test((b ?? "").trim()));

const namedTogether = (a: string, b: string, source: string) =>
  sentencesOf(source).some((sentence) => groundedWords(a, sentence).matched > 0 && groundedWords(b, sentence).matched > 0);

// A year said of a person: in a sentence that names them, with a word for birth or death.
const yearOfPerson = (name: string, year: number, words: RegExp, source: string) =>
  sentencesOf(source).some((sentence) => groundedWords(name, sentence).matched > 0 && yearsIn(sentence).includes(year) && words.test(sentence));

// The times of day a text gives, in minutes after midnight: "10:56 p.m.", "4:17 PM", "20:17" or "9 a.m.". A number
// with neither a colon nor a.m. or p.m. is not a time.
function timesIn(text: string): number[] {
  const times: number[] = [];
  for (const [, hours, minutes, half] of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?![\d:])/gi)) {
    if (minutes === undefined && half === undefined) continue;
    let hour = Number(hours);
    const minute = Number(minutes ?? 0);
    if (hour > 23 || minute > 59) continue;
    if (half) hour = (hour % 12) + (/p/i.test(half) ? 12 : 0);
    times.push(hour * 60 + minute);
  }
  return times;
}
const clockMinutes = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : null;
};

// A formula without spaces and multiplication signs, so "E = m·c²" matches "E=mc²".
const formulaKey = (text: string) => text.replace(/[\s·×*⋅]/g, "").toLowerCase();

// The names the narration may use for each molecule the template can draw.
const MOLECULES = { H2O: /\b(water|h2o)\b/i, CO2: /\b(carbon dioxide|co2)\b/i, CH4: /\b(methane|ch4)\b/i, O2: /\b(oxygen|o2)\b/i, NH3: /\b(ammonia|nh3)\b/i };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

// Words that tell something comes round again, so it can be drawn as a loop.
const CYCLE_WORDS = /\b(cycles?|cyclical|repeats?|repeated|repeating|again|loops?|circulat\w*|recycl\w*|over and over|back to|round and round|returns? to)\b/i;
// Words that tell of a hierarchy, so it can be drawn as a pyramid.
const HIERARCHY_WORDS = /\b(top|bottom|highest|lowest|hierarch\w*|pyramid|ranks?|ranked|classes|estates?|tiers?|above|below|beneath|apex|social order)\b/i;
const SHARED_WORDS = /\b(both|shared?|shares|common|overlap\w*|alike|similar\w*|likewise)\b/i;
const GOOD_WORDS = /\b(advantages?|benefits?|benefited|pros|upsides?|helped|helps|improv\w*|better|safer|cheaper|faster|easier|gains?|strengths?)\b/i;
const BAD_WORDS = /\b(disadvantages?|drawbacks?|downsides?|cons|costs?|risks?|harm\w*|hurt|problems?|dangers?|dangerous|worse|slower|weakness\w*|criticis\w*|side effects?)\b/i;
const BEFORE_AFTER_WORDS = /\b(before|after|until|since|used to|no longer|once|now|today|became|changed|transformed|replaced)\b/i;
// Words that tell the narration explains a term.
const DEFINITION_WORDS = /\b(means?|meaning|called|refers? to|defined|definition|known as|term|is an?|are an?)\b/i;
// Words that tell a belief is wrong. A myth card strikes a belief out, so the narration itself must say it is wrong.
const MYTH_WORDS = /\b(myths?|misconceptions?|legends?|popular(?:ly)? belie\w*|commonly believed|widely believed|often said|wrongly|mistaken(?:ly)?|false(?:ly)?|not true|untrue|in fact|actually|contrary to|debunk\w*)\b/i;
const SCALE_WORDS = /\b(inside|within|made (?:up )?of|consists? of|contains?|tiny|smaller|smallest|microscopic|cells?|atoms?|molecules?|zoom\w*)\b/i;
const DIVISION_WORDS = /\b(divided|divides|split|branch(?:es)?|consists? of|made up of|includes?|types?|kinds?|parts?|categor(?:y|ies)|groups?|sections?)\b/i;
const LAYER_WORDS = /\b(layers?|on top of|built on|foundations?|beneath|underneath|stack(?:ed)?|strata|tiers?)\b/i;
const LINK_WORDS = /\b(connect\w*|link\w*|network\w*|allies|allied|alliances?|between|influenc\w*|relations?|ties|trad(?:e|ed|ing) with|spread)\b/i;
const DOCUMENT_WORDS = /\b(treat(?:y|ies)|act|laws?|constitution|declaration|charter|bill|decree|edict|accord|convention|agreement|manifesto|proclamation|magna carta|ordinance)\b/i;
const LETTER_WORDS = /\b(letters?|wrote|writes|diar(?:y|ies)|journal|telegram|postcard|note)\b/i;
const SCALE_WORDS_2 = /\b(scale|ph|decibels?|db|richter|magnitude|degrees?|temperature|°[cf]?)\b/i;
const PLANET_WORDS = /\b(mercury|venus|mars|jupiter|saturn|uranus|neptune)\b/gi;
const SEAT_WORDS = /\b(seats?|parliament\w*|mandates?|majority|coalition|assembly|congress|senate|chamber)\b/i;

// Words that tell where a cutaway takes place. A body, the sea or the ground is drawn only when the narration or facts
// speak of it; a box (a machine, a building, a container) fits anything with an inside.
const SETTING_WORDS = {
  ground: /\b(underground|beneath|below|ground|soil|roots?|rocks?|caves?|mines?|wells?|layers?|buried|tunnels?|aquifers?|bedrock|groundwater|magma|crust|surface)\b/i,
  sea: /\b(seas?|oceans?|underwater|fish|ships?|waves?|coral|seabed|seafloor|marine|deep water|surface)\b/i,
  body: /\b(body|organs?|blood|heart|lungs?|stomach|brain|liver|kidneys?|muscles?|bones?|skin|intestines?|digest\w*|chest|belly|throat)\b/i,
  // A box is a thing with an inside you could cut open: a machine, a building or a container, not an idea.
  box: /\b(machines?|devices?|engines?|motors?|buildings?|houses?|homes?|factory|factories|containers?|tanks?|boxes|box|fridges?|refrigerators?|computers?|chambers?|cases?|casings?|cylinders?|reactors?|ovens?|boilers?|pumps?|batter(y|ies)|wells?|pipes?|walls?|rooms?|hulls?|ships?)\b/i,
} as const;
// Common words like "under" (under a king) and "inside" (inside the palace) are left out: they fit history too.
const CUTAWAY_WORDS = /\b(beneath|underground|underwater|layers?|soil|roots?|seabed|seafloor|organs?|chambers?|compartments?|interior|cut open|aquifers?|bedrock|groundwater)\b/i;
// Words that tell one thing travels through places or stages in order.
const JOURNEY_WORDS = /\b(travel\w*|moves?|moved|moving|pass(es|ed)?|flows?|flowed|goes|went|journey|route|through|reach(es|ed)?|enters?|entered|carried|transported|sent|delivered|on to|onward)\b/i;
// Words that tell a thing turns into something else on the way.
const CHANGE_WORDS = /\b(becomes?|became|turns? into|turned into|changes? into|changed into|convert\w*|broken down|breaks? down|absorbed|transform\w*)\b/i;
// Words that tell a process takes things in, and words that tell it gives things out; a scene needs both.
const INTAKE_WORDS = /\b(takes? in|took in|uses?|used|absorbs?|absorbed|consumes?|consumed|burns?|burned|eats?|needs?|draws? in)\b/i;
const OUTPUT_WORDS = /\b(produc\w*|makes?|made|gives? off|releases?|released|turns? \w+( \w+)? into|convert\w*|creates?|generat\w*)\b/i;
// Words for physical forces. "Forces" and "pressure" alone are left out: armies and politics have them too.
const FORCE_WORDS = /\b(gravity|gravitational|thrust|drag|friction|buoyan\w*|upthrust|air resistance|aerodynamic\w*)\b/i;
const LIFT_WORDS = /\blift\b.*\b(wings?|planes?|aircraft|airplanes?|air)\b|\b(wings?|planes?|aircraft|airplanes?)\b.*\blift\b/i;
// Words that compare the size of forces, without which they are drawn the same size.
const STRENGTH_WORDS = /\b(strong\w*|weak\w*|greater|bigger|larger|smaller|less|more than|exceeds?|outweighs?|overcomes?|balanced?|equal)\b/i;
// Words that tell which way a thing moves, by direction.
const MOVE_WORDS = {
  up: /\b(rises?|rose|rising|climbs?|climbed|lifts? off|takes? off|took off|floats? up|goes up|upward\w*|ascend\w*)\b/i,
  down: /\b(falls?|fell|falling|sinks?|sank|sinking|drops?|dropped|descend\w*|downward\w*|goes down)\b/i,
  left: /\b(slows?|slowed|backward\w*|brakes?|braking|stops?)\b/i,
  right: /\b(moves? forward|speeds? up|accelerat\w*|forward\w*|travels?|flies|flying|drives?)\b/i,
} as const;
// Forces whose direction is part of what they are.
const FORCE_DIRECTIONS: { words: RegExp; direction: "up" | "down" }[] = [
  { words: /\b(gravity|weight)\b/i, direction: "down" },
  { words: /\b(lift|buoyan\w*|upthrust)\b/i, direction: "up" },
];

// Where a label's main words first come in the narration, or undefined when they do not; for keeping things in the
// narration's order.
function firstMention(label: string, narration: string): number | undefined {
  const text = narration.toLowerCase();
  const places = label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .map((word) => text.search(new RegExp(`\\b${word.slice(0, Math.max(4, word.length - 2))}`)))
    .filter((place) => place >= 0);
  return places.length > 0 ? Math.min(...places) : undefined;
}

// A kit picture's icon: the one named, else one its label names ("Water table" draws a drop), else none, and the
// template draws a plain disc.
const kitIcon = (name: string | undefined, label?: string) =>
  icon(name) ??
  label
    ?.split(/[^A-Za-z]+/)
    .map((word) => iconKey(word))
    .find((key) => key !== undefined);

// Whether a phrase is, word for word, inside something the text puts in quotes.
const quotedIn = (phrase: string, text: string) =>
  [...text.matchAll(/["“”'‘’]([^"“”'‘’]{1,120})["“”'‘’]/g)].some(([, quoted]) => hasPhrase(phrase, quoted));

// What is wrong with the icons of a template: names the video cannot draw, even through an alias (lib/icons.ts). The
// kit pictures leave this out: there an unknown icon is drawn as a plain disc beside its label.
const iconProblems = (names: (string | undefined)[]) =>
  names.flatMap((name) => (name !== undefined && !iconKey(name) ? [`"${name}" is not an icon. Use one from the list.`] : []));

// A drawn diagram from the library (remotion/filmmotor/templates/diagrams-*.js) whose words are all optional labels,
// one per part, under `labels`. Each label is at most 3 words, mostly the narration's; a part without one, or with one
// that breaks a rule, is drawn without a label. `options` are the diagram's other params, like which kind of plate
// boundary it shows.
function labelDiagram<N extends string, P extends string, O extends z.ZodRawShape>(spec: {
  name: N;
  plan: string;
  prompt: string;
  parts: readonly P[];
  fits: (scene: SceneData) => boolean;
  options: O;
  check?: (visual: Record<string, unknown>, context: CheckContext) => string[];
  params?: (visual: Record<string, unknown>, extra: Extra) => Record<string, unknown>;
  cue?: RegExp; // the word for the moment the drawing turns on, like "erupts"; it then happens as the narration says it
}) {
  const labels = z.object(Object.fromEntries(spec.parts.map((part) => [part, z.string().optional()])) as Record<P, z.ZodOptional<z.ZodString>>);
  const labelsOf = (visual: unknown) => (visual as { labels: Record<string, string | undefined> }).labels;
  const textsOf = (visual: unknown) => Object.values(labelsOf(visual)).filter((text): text is string => Boolean(text));
  return template({
    family: "picture",
    signature: true,
    plan: spec.plan,
    prompt: `${spec.prompt} Every label is optional, at most 3 words in the narration's words; give only labels for parts the narration or facts name, and leave the others out.`,
    schema: z.object({ kind: z.literal(spec.name), labels, ...spec.options }),
    fits: spec.fits,
    shown: (visual) => textsOf(visual).map((text) => ({ text, words: 3, optional: true })),
    check: spec.check,
    repair: (visual, keep, context) => {
      const repaired = { ...visual, labels: Object.fromEntries(Object.entries(labelsOf(visual)).filter(([, text]) => text && keep(text, 3))) };
      return (spec.check?.(repaired, context) ?? []).length === 0 ? repaired : null;
    },
    params: (visual, extra) => {
      const { kind, labels, ...params } = visual as Record<string, unknown>;
      void kind;
      // Labels are names on a drawing, so they start with a capital, like "Right ventricle".
      const named = Object.fromEntries(Object.entries(labels as Record<string, string>).map(([part, text]) => [part, text.charAt(0).toUpperCase() + text.slice(1)]));
      const all = { ...params, labels: named };
      return { ...cueAt(extra.narration, spec.cue), ...(spec.params ? spec.params(all, extra) : all) };
    },
  });
}

// The word of the narration that marks the moment a drawing turns on, as its "at" param, so the template plays that
// moment as the word is said (see TemplateScene). Without such a word, the template keeps its own timing.
function cueAt(narration: string | undefined, cue: RegExp | undefined): { at?: string } {
  const word = cue && narration?.match(cue)?.[0];
  return word ? { at: word } : {};
}

export const TEMPLATES = {
  cycle: template({
    family: "chain",
    plan: "the steps of something that comes round again in a loop, like the water cycle, when the scene names at least three of them",
    prompt:
      '"cycle" when the narration tells of something that comes round again in a loop, like the water cycle, a life cycle or a business cycle, and this scene names at least 3 of its steps: 3 to 6 "nodes" in the order they follow each other round the loop, each a "text" of 1 to 4 words and an optional "icon", and an optional "center" of at most 4 words that names the cycle, all in the narration\'s words.',
    schema: z.object({
      kind: z.literal("cycle"),
      center: z.string().optional(),
      nodes: z.array(z.object({ text: z.string(), icon: z.string().optional() })).min(3).max(6),
    }),
    fits: (scene) => CYCLE_WORDS.test(scene.narration),
    shown: (visual) => [{ text: visual.center, words: 4 }, ...visual.nodes.map((node) => ({ text: node.text, words: 4 }))],
    check: (visual) => distinct(visual.nodes.map((node) => node.text), "Two steps of the cycle are the same."),
    repair: (visual, keep) => {
      const nodes = visual.nodes.filter((node) => keep(node.text, 4));
      return nodes.length >= 3 ? { ...visual, nodes, center: keep(visual.center, 4) ? visual.center : undefined } : null;
    },
    params: (visual) => ({ center: visual.center, nodes: visual.nodes.map((node) => ({ text: node.text, icon: icon(node.icon) })) }),
  }),
  pyramid: template({
    family: "structure",
    plan: "a hierarchy with few at the top and many at the bottom, like the classes of a society, when the scene names at least three levels",
    prompt:
      '"pyramid" when the narration describes a hierarchy with few at the top and many at the bottom, like the estates of a society: 3 to 5 "levels" from the top down, each a "label" of 1 to 3 words and an optional "text" of at most 5 words, in the narration\'s words. Only when the narration or facts say which level is above which.',
    schema: z.object({
      kind: z.literal("pyramid"),
      levels: z.array(z.object({ label: z.string(), text: z.string().optional() })).min(3).max(5),
    }),
    fits: (scene) => HIERARCHY_WORDS.test(scene.source),
    shown: (visual) => visual.levels.flatMap((level) => [{ text: level.label, words: 3 }, { text: level.text, words: 5 }]),
    check: (visual) => distinct(visual.levels.map((level) => level.label), "Two levels have the same label."),
    // A level that goes would change the order, so the pyramid stays whole or not at all; only texts may go.
    repair: (visual, keep) =>
      visual.levels.every((level) => keep(level.label, 3))
        ? { ...visual, levels: visual.levels.map((level) => (keep(level.text, 5) ? level : { label: level.label })) }
        : null,
  }),
  venn: template({
    family: "structure",
    plan: "two or three things and what they have in common",
    prompt:
      '"venn" when the narration says what two or three things have in common: 2 or 3 "sets", each a "label" of 1 to 3 words naming the thing and an optional "text" of at most 4 words on what is only its own, and "overlap", at most 4 words on what they share, all in the narration\'s words.',
    schema: z.object({
      kind: z.literal("venn"),
      sets: z.array(z.object({ label: z.string(), text: z.string().optional() })).min(2).max(3),
      overlap: z.string(),
    }),
    fits: (scene) => SHARED_WORDS.test(scene.narration),
    shown: (visual) => [...visual.sets.flatMap((set) => [{ text: set.label, words: 3 }, { text: set.text, words: 4 }]), { text: visual.overlap, words: 4 }],
    check: (visual) => distinct(visual.sets.map((set) => set.label), "Two sets have the same label."),
    repair: (visual, keep) =>
      keep(visual.overlap, 4) && visual.sets.every((set) => keep(set.label, 3))
        ? { ...visual, sets: visual.sets.map((set) => (keep(set.text, 4) ? set : { label: set.label })) }
        : null,
  }),
  pros_cons: template({
    family: "sides",
    plan: "the good and the bad sides of one thing",
    prompt:
      '"pros_cons" when the narration weighs the good and the bad sides of one thing, like an invention or a decision: an optional "title" of at most 4 words naming the thing, and 1 to 3 "pros" and 1 to 3 "cons" of at most 5 short words (30 letters) each, in the narration\'s words. A pro is only what the narration calls good, a con only what it calls bad.',
    schema: z.object({
      kind: z.literal("pros_cons"),
      title: z.string().optional(),
      pros: z.array(z.string()).min(1).max(3),
      cons: z.array(z.string()).min(1).max(3),
    }),
    fits: (scene) => GOOD_WORDS.test(scene.narration) && BAD_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.title, words: 4 },
      ...visual.pros.map((text) => ({ text, words: 5, chars: 32 })),
      ...visual.cons.map((text) => ({ text, words: 5, chars: 32 })),
    ],
    repair: (visual, keep) => {
      const pros = visual.pros.filter((text) => keep(text, 5) && text.length <= 32);
      const cons = visual.cons.filter((text) => keep(text, 5) && text.length <= 32);
      return pros.length > 0 && cons.length > 0 ? { ...visual, pros, cons, title: keep(visual.title, 4) ? visual.title : undefined } : null;
    },
  }),
  before_after: template({
    family: "sides",
    plan: "how something was before and after a turning point",
    prompt:
      '"before_after" when the narration tells how something was before and after a turning point, like a reform, a war or an invention: "before" and "after", each with an optional "label" of at most 3 words like "Before 1789", a "title" of 1 to 3 words, an optional "text" of at most 6 words and an optional "icon", in the narration\'s words.',
    schema: z.object({
      kind: z.literal("before_after"),
      before: z.object({ label: z.string().optional(), title: z.string(), text: z.string().optional(), icon: z.string().optional() }),
      after: z.object({ label: z.string().optional(), title: z.string(), text: z.string().optional(), icon: z.string().optional() }),
    }),
    fits: (scene) => BEFORE_AFTER_WORDS.test(scene.narration),
    shown: (visual) =>
      [visual.before, visual.after].flatMap((side) => [
        { text: side.label, words: 3 },
        { text: side.title, words: 3 },
        { text: side.text, words: 6 },
      ]),
    check: (visual) => (sameWords(visual.before.title, visual.after.title) ? ["Before and after must differ."] : []),
    repair: (visual, keep) => {
      const side = (part: typeof visual.before) =>
        keep(part.title, 3) ? { ...part, label: keep(part.label, 3) ? part.label : undefined, text: keep(part.text, 6) ? part.text : undefined } : null;
      const [before, after] = [side(visual.before), side(visual.after)];
      return before && after ? { ...visual, before, after } : null;
    },
    params: (visual) => ({
      before: { ...visual.before, icon: icon(visual.before.icon) },
      after: { ...visual.after, icon: icon(visual.after.icon) },
    }),
  }),
  definition_card: template({
    family: "words",
    plan: "a term the narration explains, with what it means",
    prompt:
      '"definition_card" when the narration explains what a term means, like "A vaccine is…": "term" as the narration writes it, at most 3 words, a "definition" of at most 14 words, mostly the narration\'s words, and an optional "example" of at most 10 words that the narration or facts give.',
    schema: z.object({ kind: z.literal("definition_card"), term: z.string(), definition: z.string(), example: z.string().optional() }),
    fits: (scene) => DEFINITION_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.term, words: 3, exact: true },
      { text: visual.definition, words: 14 },
      { text: visual.example, words: 10 },
    ],
    check: (visual, { narration }) => (hasPhrase(visual.term, narration) ? [] : [`The narration does not name "${visual.term}". The term is a word the narration explains.`]),
    repair: (visual, keep, { narration }) =>
      keep(visual.term, 3, true) && keep(visual.definition, 14) && hasPhrase(visual.term, narration)
        ? { ...visual, example: keep(visual.example, 10) ? visual.example : undefined }
        : null,
    // The template's word class, like "noun", is left out: the narration never gives it.
    params: (visual) => ({ term: visual.term, definition: visual.definition, example: visual.example }),
  }),
  myth_buster: template({
    family: "words",
    plan: "a common belief the narration says is wrong, and the truth",
    prompt:
      '"myth_buster" when the narration says a common belief is wrong and gives the truth: "myth" is the belief and "fact" the truth, each at most 12 words, in the narration\'s words. Only when the narration itself says the belief is wrong.',
    schema: z.object({ kind: z.literal("myth_buster"), myth: z.string(), fact: z.string() }),
    fits: (scene) => MYTH_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.myth, words: 12 },
      { text: visual.fact, words: 12, chars: 80 },
    ],
    check: (visual) => (sameWords(visual.myth, visual.fact) ? ["The myth and the fact must differ."] : []),
  }),
  did_you_know: template({
    family: "words",
    plan: "one surprising fact on a card, with its source",
    prompt: '"did_you_know" for one surprising fact: "fact" in at most 16 words, mostly the narration\'s words. The card names its source itself.',
    schema: z.object({ kind: z.literal("did_you_know"), fact: z.string() }),
    fits: () => true,
    shown: (visual) => [{ text: visual.fact, words: 16 }],
    params: (visual, { sourceTitle }) => ({ label: "Did you know?", fact: visual.fact, source: sourceTitle ? `Source: ${sourceTitle}` : undefined }),
  }),
  big_statement: template({
    family: "words",
    plan: "the main point as one short sentence in big letters",
    prompt:
      '"big_statement" for the scene\'s main point as one short sentence of at most 12 words, mostly the narration\'s words, with "emphasis" listing 1 or 2 of its words to color.',
    schema: z.object({ kind: z.literal("big_statement"), text: z.string(), emphasis: z.array(z.string()).max(2) }),
    fits: () => true,
    shown: (visual) => [{ text: visual.text, words: 12 }],
    // A word that is not in the statement is left out of the emphasis; it is not worth a retry.
    params: (visual) => {
      const words = visual.text.split(/\s+/);
      const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      return { text: visual.text, emphasis: visual.emphasis.flatMap((wanted) => words.find((word) => bare(word) === bare(wanted)) ?? []) };
    },
  }),
  kinetic_words: template({
    family: "words",
    plan: "2 to 5 key words that hit the screen one by one",
    prompt: '"kinetic_words" for 2 to 5 key words or short phrases of the narration, at most 3 words each, in the order they are spoken.',
    schema: z.object({ kind: z.literal("kinetic_words"), words: z.array(z.string()).min(2).max(5) }),
    fits: () => true,
    shown: (visual) => visual.words.map((text) => ({ text, words: 3, exact: true })),
    check: (visual) => distinct(visual.words, "Two key words are the same."),
    repair: (visual, keep) => {
      const words = visual.words.filter((text, index) => keep(text, 3, true) && distinct(visual.words.slice(0, index + 1), "").length === 0);
      return words.length >= 2 ? { ...visual, words } : null;
    },
  }),
  question_card: template({
    family: "words",
    plan: "a question the narration asks, shown big",
    prompt: '"question_card" when the narration asks a question: "question" is that question, copied exactly.',
    schema: z.object({ kind: z.literal("question_card"), question: z.string() }),
    fits: (scene) => scene.narration.includes("?"),
    // The question is a sentence of the narration, word for word, so its words need no other check.
    shown: () => [],
    check: (visual, { narration }) =>
      sentencesOf(narration).some((sentence) => sentence.trim() === visual.question.trim() && sentence.trim().endsWith("?"))
        ? visual.question.split(/\s+/).length > 20
          ? ["The question is too long for a card. Use another kind."]
          : []
        : ["Copy the question exactly as the narration asks it, from its first word to the question mark."],
    params: (visual) => ({ question: visual.question }),
  }),
  year_roll: template({
    family: "time",
    plan: "a jump in time from one year to another, or how long something lasted",
    prompt:
      '"year_roll" when the narration jumps from one year to another, or tells how long something lasted: "from" and "to" are years the narration or facts give for it, "label" says in at most 6 words what happened, and an optional "sub" of at most 6 words.',
    schema: z.object({ kind: z.literal("year_roll"), from: z.number().int(), to: z.number().int(), label: z.string(), sub: z.string().optional() }),
    fits: (scene) => new Set(scene.years).size >= 2,
    shown: (visual) => [
      { text: visual.label, words: 6 },
      { text: visual.sub, words: 6 },
    ],
    check: (visual, { source }) => [
      ...[visual.from, visual.to].filter((year) => !yearsIn(source).includes(year)).map((year) => `${year} is not a year this scene's narration or facts give.`),
      ...(visual.from < visual.to ? [] : ['"from" must be the earlier year.']),
    ],
    repair: (visual, keep) => ({ ...visual, sub: keep(visual.sub, 6) ? visual.sub : undefined }),
  }),
  calendar_date: template({
    family: "time",
    plan: "one date that matters, as a calendar page",
    prompt:
      '"calendar_date" when one date matters and the narration or facts give its day, month and year: "day" as a number, "month" as its English name, "year", and a "label" of at most 6 words saying what happened that day.',
    schema: z.object({ kind: z.literal("calendar_date"), day: z.number().int(), month: z.enum(MONTHS), year: z.number().int(), label: z.string() }),
    fits: (scene) => scene.dates.length > 0 && scene.years.length > 0,
    shown: (visual) => [{ text: visual.label, words: 6 }],
    check: (visual, { source }) =>
      statesDate(`${visual.day} ${visual.month}`, source, visual.year) ? [] : [`The narration and facts do not give ${visual.day} ${visual.month} ${visual.year} as a date.`],
  }),
  stat_trio: template({
    family: "number",
    plan: "two or three numbers about the same thing, side by side",
    prompt:
      '"stat_trio" when the narration gives two or three numbers about the same subject: 2 or 3 "stats", each a "value" from the amounts listed for this scene, an optional "unit" like "million" or "%", and a "label" of at most 5 words saying what it counts, from the sentence that gives the number.',
    schema: z.object({
      kind: z.literal("stat_trio"),
      stats: z.array(z.object({ value: z.number(), unit: z.string().optional(), label: z.string() })).min(2).max(3),
    }),
    fits: (scene) => scene.amounts.length >= 2,
    shown: (visual) => visual.stats.flatMap((stat) => [{ text: stat.label, words: 5 }, { text: stat.unit, words: 2 }]),
    check: (visual, { source }) => [
      ...distinct(visual.stats.map((stat) => stat.label), "Two numbers have the same label."),
      ...visual.stats.flatMap((stat) => amountProblems(stat, source)),
      ...visual.stats.flatMap((stat) => {
        const said = unitSaidWith(stat.value, source);
        return said && !stat.unit ? [`Give the unit the narration gives with ${stat.value}: "${said}".`] : [];
      }),
      ...(visual.stats.some((stat, index) => visual.stats.slice(0, index).some((other) => sameMeasure(stat.unit, other.unit)))
        ? ["Two numbers show the same thing in two units. Show it once."]
        : []),
    ],
    repair: (visual, keep, { source }) => {
      const stats = visual.stats
        .map((stat) => (stat.unit ? stat : { ...stat, unit: unitSaidWith(stat.value, source) }))
        .filter((stat) => keep(stat.label, 5) && keep(stat.unit, 2) && amountProblems(stat, source).length === 0)
        .filter((stat, index, all) => !all.slice(0, index).some((other) => sameMeasure(stat.unit, other.unit)));
      return stats.length >= 2 && distinct(stats.map((stat) => stat.label), "").length === 0 ? { ...visual, stats } : null;
    },
    params: (visual) => ({
      stats: visual.stats.map((stat) => ({ value: stat.value, decimals: decimalsOf(stat.value), suffix: suffix(stat.unit), label: stat.label })),
    }),
  }),
  donut_chart: template({
    family: "chart",
    plan: "how a whole is split into parts, in percent",
    prompt:
      '"donut_chart" when the narration or facts give how a whole splits into parts, in percent: a "title" of at most 6 words and 2 to 5 "parts", each a "label" of 1 to 3 words and its "value" in percent, from the sentence that gives it.',
    schema: z.object({
      kind: z.literal("donut_chart"),
      title: z.string(),
      parts: z.array(z.object({ label: z.string(), value: z.number() })).min(2).max(5),
    }),
    fits: (scene) => scene.percents >= 2,
    shown: (visual) => [{ text: visual.title, words: 6 }, ...visual.parts.map((part) => ({ text: part.label, words: 3 }))],
    check: (visual, { source }) => [
      ...distinct(visual.parts.map((part) => part.label), "Two parts have the same label."),
      ...visual.parts.flatMap((part) => amountProblems({ ...part, unit: "%" }, source)),
      ...(visual.parts.reduce((sum, part) => sum + part.value, 0) > 100.5 ? ["The parts add up to more than 100%. A donut shows the parts of one whole."] : []),
    ],
    // The parts are drawn out of 100, so the rest of the whole stays empty instead of being shared out.
    params: (visual) => ({ title: visual.title, data: visual.parts.map(({ label, value }) => ({ label, value })), donut: true, unit: "%", total: 100 }),
  }),
  line_chart: template({
    family: "chart",
    plan: "how one amount rose or fell over three or more years",
    prompt:
      '"line_chart" when the narration or facts give one amount for three or more years: a "title" of at most 6 words, an optional "unit", and 3 to 8 "points" in time order, each a "year" and the "value" that one sentence of the narration or facts gives for that year.',
    schema: z.object({
      kind: z.literal("line_chart"),
      title: z.string(),
      unit: z.string().optional(),
      points: z.array(z.object({ year: z.number().int(), value: z.number() })).min(3).max(8),
    }),
    fits: (scene) => new Set(scene.years).size >= 3 && scene.amounts.length >= 3,
    shown: (visual) => [
      { text: visual.title, words: 6 },
      { text: visual.unit, words: 2 },
    ],
    check: (visual, { source }) => [
      ...visual.points.filter((point) => !pointIsStated(point, source)).map((point) => `No sentence of this scene gives ${point.value} for ${point.year}.`),
      ...(visual.points.every((point, index) => index === 0 || point.year > visual.points[index - 1].year) ? [] : ["List the points in time order, one per year."]),
    ],
    repair: (visual, keep, { source }) => {
      const points = visual.points.filter((point, index) => pointIsStated(point, source) && (index === 0 || point.year > visual.points[index - 1].year));
      return points.length >= 3 ? { ...visual, points, unit: keep(visual.unit, 2) ? visual.unit : undefined } : null;
    },
    params: (visual) => ({
      title: visual.title,
      xLabel: "",
      yLabel: visual.unit ?? "",
      series: [{ name: "", points: visual.points.map((point) => [point.year, point.value]) }],
    }),
  }),
  split_bar: template({
    family: "chart",
    plan: "a vote or a whole split between two sides, in percent",
    prompt:
      '"split_bar" when the narration or facts give how a vote or a whole split between two sides, in percent: a "title" of at most 6 words, and "left" and "right", each a "label" of 1 to 3 words and its "value" in percent, from the sentence that gives it.',
    schema: z.object({
      kind: z.literal("split_bar"),
      title: z.string(),
      left: z.object({ label: z.string(), value: z.number() }),
      right: z.object({ label: z.string(), value: z.number() }),
    }),
    fits: (scene) => scene.percents >= 2,
    shown: (visual) => [
      { text: visual.title, words: 6 },
      { text: visual.left.label, words: 3 },
      { text: visual.right.label, words: 3 },
    ],
    check: (visual, { source }) => [
      ...[visual.left, visual.right].flatMap((side) => amountProblems({ ...side, unit: "%" }, source)),
      ...(Math.abs(visual.left.value + visual.right.value - 100) <= 1.5 ? [] : ["The two sides must add up to 100%: a split bar shows one whole split in two."]),
    ],
    params: (visual) => ({ title: visual.title, left: visual.left, right: visual.right, unit: "%" }),
  }),
  parliament_seats: template({
    family: "chart",
    plan: "the seats each party won in a parliament",
    prompt:
      '"parliament_seats" when the narration or facts give the seats parties won: a "title" of at most 6 words, 2 to 6 "parties", each a "name" as the narration writes it and its "seats" from the sentence that gives them, and "majority", the seats a majority needs, only when stated, else 0.',
    schema: z.object({
      kind: z.literal("parliament_seats"),
      title: z.string(),
      parties: z.array(z.object({ name: z.string(), seats: z.number().int() })).min(2).max(6),
      majority: z.number().int(),
    }),
    fits: (scene) => SEAT_WORDS.test(scene.source) && scene.amounts.length >= 2,
    shown: (visual) => [{ text: visual.title, words: 6 }, ...visual.parties.map((party) => ({ text: party.name, words: 4, exact: true }))],
    check: (visual, { source }) => [
      ...distinct(visual.parties.map((party) => party.name), "Two parties have the same name."),
      ...visual.parties.flatMap((party) => amountProblems({ label: party.name, value: party.seats }, source)),
      ...(visual.majority > 0 && !numbersIn(source).includes(String(visual.majority)) ? [`${visual.majority} is not in this scene's narration or facts. Give 0 for majority.`] : []),
    ],
    params: (visual) => ({ title: visual.title, parties: visual.parties, majority: visual.majority > 0 ? visual.majority : undefined }),
  }),
  profile_card: template({
    family: "people",
    plan: "one person the scene is about, with their role and key facts",
    prompt:
      '"profile_card" when the scene is about one person it names: "name" as the narration writes it, an optional "role" in their words, at most 6 words, "born" and "died" years only when the narration or facts give them for this person (else 0), and up to 3 "facts" about them of at most 8 words each, in the narration\'s words.',
    schema: z.object({
      kind: z.literal("profile_card"),
      name: z.string(),
      role: z.string().optional(),
      born: z.number().int(),
      died: z.number().int(),
      facts: z.array(z.string()).max(3),
    }),
    fits: (scene) => scene.namesPerson,
    shown: (visual) => [{ text: visual.name, words: 4, exact: true }, ...visual.facts.map((text) => ({ text, words: 8 }))],
    check: (visual, { source }) => [
      ...(isNotAPerson(visual.name, source) ? [`"${visual.name}" is not a person here. A profile is of a person.`] : []),
      ...(visual.role && (visual.role.split(/\s+/).length > 6 || !roleOf(visual.name, visual.role, source))
        ? [`The role "${visual.role}" must be what the narration or facts call ${visual.name}, at most 6 words, in their words.`]
        : []),
      ...(visual.born > 0 && !yearOfPerson(visual.name, visual.born, /\b(born|birth)\b/i, source) ? [`The narration and facts do not say ${visual.name} was born in ${visual.born}. Give 0.`] : []),
      ...(visual.died > 0 && !yearOfPerson(visual.name, visual.died, /\b(died|death|killed|executed|assassinated)\b/i, source)
        ? [`The narration and facts do not say ${visual.name} died in ${visual.died}. Give 0.`]
        : []),
    ],
    repair: (visual, keep, { source }) => {
      if (!keep(visual.name, 4, true) || isNotAPerson(visual.name, source)) return null;
      const role = visual.role && visual.role.split(/\s+/).length <= 6 && roleOf(visual.name, visual.role, source) ? visual.role : undefined;
      const born = visual.born > 0 && yearOfPerson(visual.name, visual.born, /\b(born|birth)\b/i, source) ? visual.born : 0;
      const died = visual.died > 0 && yearOfPerson(visual.name, visual.died, /\b(died|death|killed|executed|assassinated)\b/i, source) ? visual.died : 0;
      return { ...visual, role, born, died, facts: visual.facts.filter((text) => keep(text, 8)) };
    },
    params: (visual) => ({
      name: visual.name,
      role: visual.role ?? "",
      years: visual.born > 0 && visual.died > 0 ? `${visual.born}–${visual.died}` : visual.born > 0 ? `Born ${visual.born}` : visual.died > 0 ? `Died ${visual.died}` : "",
      facts: visual.facts,
    }),
  }),
  zoom_into: template({
    family: "chain",
    plan: "from something big down to its tiny parts, like the body to a cell to DNA, when the scene names at least three of them",
    prompt:
      '"zoom_into" when the narration goes from something big down to its smaller parts, like the body to a cell to DNA: 3 to 5 "levels" from the biggest to the smallest, each a "label" of 1 to 3 words in the narration\'s words and an optional "icon".',
    schema: z.object({
      kind: z.literal("zoom_into"),
      levels: z.array(z.object({ label: z.string(), icon: z.string().optional() })).min(3).max(5),
    }),
    fits: (scene) => SCALE_WORDS.test(scene.narration),
    shown: (visual) => visual.levels.map((level) => ({ text: level.label, words: 3 })),
    check: (visual) => distinct(visual.levels.map((level) => level.label), "Two levels have the same label."),
    params: (visual) => ({ levels: visual.levels.map((level) => ({ label: level.label, icon: icon(level.icon) })) }),
  }),
  tree_chart: template({
    family: "structure",
    plan: "one thing divided into branches or types, when the scene names them",
    prompt:
      '"tree_chart" when the narration divides one thing into branches or types, like the branches of a government: a "root" of 1 to 3 words, and 2 to 4 "branches", each a "label" of 1 to 3 words with up to 2 "items" of at most 3 words under it, all in the narration\'s words.',
    schema: z.object({
      kind: z.literal("tree_chart"),
      root: z.string(),
      branches: z.array(z.object({ label: z.string(), items: z.array(z.string()).max(2) })).min(2).max(4),
    }),
    fits: (scene) => DIVISION_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.root, words: 3 },
      ...visual.branches.flatMap((branch) => [{ text: branch.label, words: 3 }, ...branch.items.map((text) => ({ text, words: 3 }))]),
    ],
    check: (visual) => distinct(visual.branches.map((branch) => branch.label), "Two branches have the same label."),
    repair: (visual, keep) => {
      const branches = visual.branches
        .filter((branch) => keep(branch.label, 3))
        .map((branch) => ({ ...branch, items: branch.items.filter((text) => keep(text, 3)) }));
      return keep(visual.root, 3) && branches.length >= 2 ? { ...visual, branches } : null;
    },
    params: (visual) => ({ root: visual.root, children: visual.branches.map((branch) => ({ label: branch.label, children: branch.items })) }),
  }),
  layer_stack: template({
    family: "structure",
    plan: "layers built on top of each other, from the bottom up, when the scene names at least three",
    prompt:
      '"layer_stack" when the narration describes layers on top of each other, like the layers of the atmosphere or of the Earth: 3 to 5 "layers" from the bottom up, each a "label" of 1 to 3 words and an optional "text" of at most 5 words, in the narration\'s words.',
    schema: z.object({
      kind: z.literal("layer_stack"),
      layers: z.array(z.object({ label: z.string(), text: z.string().optional() })).min(3).max(5),
    }),
    fits: (scene) => LAYER_WORDS.test(scene.narration),
    shown: (visual) => visual.layers.flatMap((layer) => [{ text: layer.label, words: 3 }, { text: layer.text, words: 5 }]),
    check: (visual) => distinct(visual.layers.map((layer) => layer.label), "Two layers have the same label."),
    repair: (visual, keep) =>
      visual.layers.every((layer) => keep(layer.label, 3))
        ? { ...visual, layers: visual.layers.map((layer) => (keep(layer.text, 5) ? layer : { label: layer.label })) }
        : null,
  }),
  network: template({
    family: "structure",
    plan: "several people, places or ideas linked to each other, when the scene names at least three",
    prompt:
      '"network" when the narration tells how several people, places or ideas are linked: 3 to 6 "nodes", each a "label" of 1 to 3 words in the narration\'s words and an optional "icon", "links" between nodes by their position in the list (from 0), only between two things one sentence names together, and "center", the position of the node the others link to, or -1 for none.',
    schema: z.object({
      kind: z.literal("network"),
      nodes: z.array(z.object({ label: z.string(), icon: z.string().optional() })).min(3).max(6),
      links: z.array(z.object({ from: z.number().int(), to: z.number().int() })).max(8),
      center: z.number().int(),
    }),
    fits: (scene) => LINK_WORDS.test(scene.narration),
    shown: (visual) => visual.nodes.map((node) => ({ text: node.label, words: 3 })),
    check: (visual, { source }) => [
      ...distinct(visual.nodes.map((node) => node.label), "Two nodes have the same label."),
      ...visual.links.flatMap((link) => {
        const [from, to] = [visual.nodes[link.from], visual.nodes[link.to]];
        if (!from || !to || link.from === link.to) return [`A link joins nodes ${link.from} and ${link.to}, but nodes are counted from 0 and a link joins two different nodes.`];
        return namedTogether(from.label, to.label, source) ? [] : [`No sentence names "${from.label}" and "${to.label}" together. Link only things the narration links.`];
      }),
      ...(visual.links.length === 0 ? ["Link the nodes the narration links."] : []),
    ],
    repair: (visual, keep, { source }) => {
      const links = visual.links.filter((link) => {
        const [from, to] = [visual.nodes[link.from], visual.nodes[link.to]];
        return from && to && link.from !== link.to && keep(from.label, 3) && keep(to.label, 3) && namedTogether(from.label, to.label, source);
      });
      return visual.nodes.every((node) => keep(node.label, 3)) && links.length > 0 ? { ...visual, links } : null;
    },
    params: (visual) => ({
      nodes: visual.nodes.map((node) => ({ label: node.label, icon: icon(node.icon) })),
      links: visual.links.map((link) => [link.from, link.to]),
      center: visual.center >= 0 && visual.center < visual.nodes.length ? visual.center : undefined,
    }),
  }),
  // Diagrams of how things work, drawn by the template. Their own labels are names (the planets, the parts of a cell)
  // or textbook terms (wavelength, supply, demand), and each fits only a scene about exactly that. Fixed numbers they
  // used to show, like the Moon's 29.5 days, are left out, since no source backs them.
  solar_system: template({
    family: "picture",
    plan: "the Sun and the eight planets going round it, when the scene is about the planets or the solar system",
    prompt: '"solar_system" when the scene is about the solar system or its planets: the Sun and the eight planets in orbit, with their names, drawn by the video. It needs no other fields.',
    schema: z.object({ kind: z.literal("solar_system") }),
    fits: (scene) => /\bsolar system\b/i.test(scene.narration) || new Set((scene.narration.match(PLANET_WORDS) ?? []).map((word) => word.toLowerCase())).size >= 2,
    shown: () => [],
  }),
  moon_phases: template({
    family: "picture",
    plan: "the eight phases of the Moon in order, when the scene is about the Moon's phases",
    prompt: '"moon_phases" when the scene is about the phases of the Moon: the eight phases in order with their names, drawn by the video. It needs no other fields.',
    schema: z.object({ kind: z.literal("moon_phases") }),
    fits: (scene) => /\b(phases? of the moon|lunar phases?|moon'?s phases|new moon|full moon|crescent|waxing|waning|gibbous)\b/i.test(scene.narration),
    shown: () => [],
    params: () => ({}),
  }),
  states_of_matter: template({
    family: "picture",
    plan: "particles in a solid, a liquid and a gas, when the scene is about states of matter",
    prompt:
      '"states_of_matter" when the scene is about solids, liquids and gases, like ice, water and steam: "labels" are the names of the three states in the narration\'s words, the solid first, then the liquid, then the gas, 1 or 2 words each.',
    schema: z.object({ kind: z.literal("states_of_matter"), labels: z.array(z.string()).length(3) }),
    fits: (scene) => new Set((scene.narration.match(/\b(solids?|liquids?|gas(?:es)?|ice|steam|vapou?r)\b/gi) ?? []).map((word) => word.toLowerCase())).size >= 2,
    shown: (visual) => visual.labels.map((text) => ({ text, words: 2, exact: true })),
    check: (visual) => distinct(visual.labels, "Two states have the same name."),
  }),
  dna_helix: template({
    family: "picture",
    plan: "a turning DNA double helix, when the scene is about DNA",
    prompt: '"dna_helix" when the scene is about DNA: a turning double helix with its base pairs, drawn by the video, and an optional "label" of at most 3 words in the narration\'s words, like "DNA".',
    schema: z.object({ kind: z.literal("dna_helix"), label: z.string().optional() }),
    fits: (scene) => /\b(dna|double helix)\b/i.test(scene.narration),
    shown: (visual) => [{ text: visual.label, words: 3, exact: true }],
    params: (visual) => ({ label: visual.label ?? "DNA" }),
  }),
  cell_diagram: template({
    family: "picture",
    plan: "an animal or a plant cell with its parts labeled, when the scene is about the parts of a cell",
    prompt: '"cell_diagram" when the scene is about the parts of a cell: "cell" is "animal" or "plant", as the narration says. The video labels the nucleus and the other parts.',
    schema: z.object({ kind: z.literal("cell_diagram"), cell: z.enum(["animal", "plant"]) }),
    fits: (scene) =>
      /\bcells?\b/i.test(scene.narration) && /\b(nucleus|membranes?|mitochondri\w*|chloroplasts?|cell walls?|organelles?|cytoplasm)\b/i.test(scene.source),
    shown: () => [],
    check: (visual, { source }) => (visual.cell === "plant" && !/\bplants?\b/i.test(source) ? ['The narration does not speak of plant cells. Use "animal".'] : []),
    params: (visual) => ({ kind: visual.cell }),
  }),
  greenhouse_effect: template({
    family: "picture",
    plan: "sunlight coming in and heat held back by greenhouse gases, when the scene explains the greenhouse effect",
    prompt: '"greenhouse_effect" when the scene explains how greenhouse gases keep heat in: sunlight comes in, some heat escapes and some is sent back, drawn by the video. It needs no other fields.',
    schema: z.object({ kind: z.literal("greenhouse_effect") }),
    fits: (scene) => /\bgreenhouse\b/i.test(scene.narration) && /\b(heat|warm\w*|trap\w*|infrared|radiat\w*)\b/i.test(scene.source),
    shown: () => [],
  }),
  seasons: template({
    family: "picture",
    plan: "the Earth going round the Sun on its tilted axis, when the scene explains the seasons",
    prompt: '"seasons" when the scene explains why there are seasons: the Earth on its orbit with its tilted axis, drawn by the video. It needs no other fields.',
    schema: z.object({ kind: z.literal("seasons") }),
    fits: (scene) => /\bseasons?\b/i.test(scene.narration) && /\b(tilt\w*|axis|hemispheres?|orbit\w*)\b/i.test(scene.source),
    shown: () => [],
    params: () => ({}),
  }),
  magnet_field: template({
    family: "picture",
    plan: "a bar magnet with its field lines, when the scene is about magnets or magnetic fields",
    prompt: '"magnet_field" when the scene is about a magnet or a magnetic field: a bar magnet with its north and south poles and its field lines, drawn by the video. It needs no other fields.',
    schema: z.object({ kind: z.literal("magnet_field") }),
    fits: (scene) => /\bmagnet\w*\b/i.test(scene.narration) && /\b(fields?|poles?|north|south)\b/i.test(scene.source),
    shown: () => [],
    params: () => ({}),
  }),
  circuit: template({
    family: "picture",
    plan: "a battery, a switch and a bulb in a circuit, when the scene explains electric current",
    prompt: '"circuit" when the scene explains a simple electric circuit or current: a battery, a switch and a bulb that lights up when the switch closes, drawn by the video. It needs no other fields.',
    schema: z.object({ kind: z.literal("circuit") }),
    fits: (scene) => /\b(circuits?|electric current|current flows|batter(?:y|ies)|switch|bulbs?)\b/i.test(scene.narration),
    shown: () => [],
  }),
  supply_demand: template({
    family: "chart",
    plan: "supply and demand curves meeting at a price, when the scene explains how prices are set",
    prompt:
      '"supply_demand" when the scene explains supply and demand: the two curves and where they meet, drawn by the video. "demand" is "rises" or "falls" when the narration says demand goes up or down, and "supply" is "rises" or "falls" when it says the supply goes up or down, like workers growing scarce; each is "same" otherwise.',
    schema: z.object({ kind: z.literal("supply_demand"), demand: z.enum(["rises", "falls", "same"]), supply: z.enum(["rises", "falls", "same"]) }),
    fits: (scene) => /\bsupply\b/i.test(scene.narration) && /\b(demand|prices?|wages?|costs?)\b/i.test(scene.narration),
    shown: () => [],
    check: (visual, { narration }) => [
      ...(visual.demand === "rises" && !DEMAND_RISES.test(narration) ? ['The narration does not say demand rises. Use "same".'] : []),
      ...(visual.demand === "falls" && !DEMAND_FALLS.test(narration) ? ['The narration does not say demand falls. Use "same".'] : []),
      ...(visual.supply === "rises" && !SUPPLY_RISES.test(narration) ? ['The narration does not say the supply rises. Use "same".'] : []),
      ...(visual.supply === "falls" && !SUPPLY_FALLS.test(narration) ? ['The narration does not say the supply falls. Use "same".'] : []),
    ],
    params: (visual) => ({
      shift: visual.demand === "rises" ? 140 : visual.demand === "falls" ? -140 : 0,
      supplyShift: visual.supply === "rises" ? 140 : visual.supply === "falls" ? -140 : 0,
    }),
  }),
  wave: template({
    family: "picture",
    plan: "a moving wave with its wavelength and amplitude marked, when the scene explains waves",
    prompt:
      '"wave" when the scene explains waves, like sound, light or water waves: a moving wave with its wavelength and amplitude marked, drawn by the video, and an optional "label" of at most 4 words in the narration\'s words.',
    schema: z.object({ kind: z.literal("wave"), label: z.string().optional() }),
    fits: (scene) =>
      /\bwaves?\b/i.test(scene.narration) && /\b(sound|light|water|ocean|radio|frequenc\w*|wavelengths?|amplitude|vibrat\w*|electromagnetic)\b/i.test(scene.source),
    shown: (visual) => [{ text: visual.label, words: 4 }],
  }),
  ecg_heartbeat: template({
    family: "number",
    plan: "a heartbeat on a monitor with the pulse, when the scene gives a heart rate",
    prompt: '"ecg_heartbeat" when the scene gives a heart rate: "bpm" is the beats per minute the narration or facts give, and an optional "label" of at most 4 words saying whose pulse it is, in their words.',
    schema: z.object({ kind: z.literal("ecg_heartbeat"), bpm: z.number(), label: z.string().optional() }),
    fits: (scene) => /\bheart\w*\b/i.test(scene.source) && /\b(beats? (?:a|per) minute|bpm|pulse|heart rate)\b/i.test(scene.source) && scene.amounts.length > 0,
    shown: (visual) => [{ text: visual.label, words: 4 }],
    check: (visual, { source }) =>
      sentencesOf(source).some((sentence) => numbersIn(sentence).includes(String(visual.bpm)) && /\b(beats?|bpm|pulse|heart rate)\b/i.test(sentence))
        ? []
        : [`No sentence of this scene gives ${visual.bpm} as a heart rate.`],
  }),
  // Added on Oct 18, 2026, so the director has more to choose from.
  funnel: template({
    family: "chart",
    plan: "a group that shrinks step by step, like how many of 1,000 applicants were hired, when the scene gives each number",
    prompt:
      '"funnel" when the narration gives how a group shrinks step by step, like 1,000 applicants, 200 interviews and 20 hires: 3 or 4 "stages" from the largest down, each a "label" of 1 to 4 words and its "value" from the sentence that gives it, and an optional "unit".',
    schema: z.object({ kind: z.literal("funnel"), stages: z.array(z.object({ label: z.string(), value: z.number() })).min(3).max(4), unit: z.string().optional() }),
    fits: (scene) => scene.amounts.length >= 3,
    shown: (visual) => [...visual.stages.map((stage) => ({ text: stage.label, words: 4 })), { text: visual.unit, words: 2 }],
    check: (visual, { source }) => [
      ...distinct(visual.stages.map((stage) => stage.label), "Two stages have the same label."),
      ...visual.stages.flatMap((stage) => amountProblems({ ...stage, unit: visual.unit }, source)),
      ...(visual.stages.every((stage, index) => index === 0 || stage.value < visual.stages[index - 1].value) ? [] : ["Each stage must be smaller than the one before it."]),
    ],
    params: (visual) => ({ stages: visual.stages, unit: suffix(visual.unit) }),
  }),
  document_closeup: template({
    family: "words",
    plan: "a document like a law, a treaty or a declaration, when the scene is about one",
    prompt:
      '"document_closeup" when the scene is about a document, like a law, a treaty, a charter or a declaration: "heading" is its name as the narration writes it, at most 6 words, an optional "subheading" of at most 6 words, an optional "date" as the narration or facts give it, and an optional "stamp" of 1 or 2 words the narration says of it, like "Signed" or "Abolished".',
    schema: z.object({
      kind: z.literal("document_closeup"),
      heading: z.string(),
      subheading: z.string().optional(),
      date: z.string().optional(),
      stamp: z.string().optional(),
    }),
    fits: (scene) => DOCUMENT_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.heading, words: 6, exact: true },
      { text: visual.subheading, words: 6 },
      { text: visual.date, words: 5, exact: true },
      { text: visual.stamp, words: 2, exact: true },
    ],
    // The template draws grey lines for the document's text, never words.
    params: (visual) => ({ heading: visual.heading, subheading: visual.subheading, date: visual.date, lines: 8, stamp: visual.stamp, tone: "true" }),
  }),
  letter_handwritten: template({
    family: "words",
    plan: "a letter or a diary page with the writer's own words, when the facts quote one",
    prompt:
      '"letter_handwritten" when the scene is about a letter, a diary or a note and the facts quote its words: "lines" are 1 to 3 whole sentences copied exactly from "Sentences you may quote", an optional "greeting" and "sign" (the writer\'s name) only as the facts give them, and an optional "date" as the narration or facts give it.',
    schema: z.object({
      kind: z.literal("letter_handwritten"),
      lines: z.array(z.string()).min(1).max(3),
      greeting: z.string().optional(),
      sign: z.string().optional(),
      date: z.string().optional(),
    }),
    fits: (scene) => LETTER_WORDS.test(scene.narration) && scene.quotable.length > 0,
    shown: (visual) => [
      { text: visual.greeting, words: 4, exact: true },
      { text: visual.sign, words: 4, exact: true },
      { text: visual.date, words: 5, exact: true },
    ],
    check: (visual, { quotable }) =>
      visual.lines
        .filter((line) => !quotable.includes(line.trim()))
        .map((line) => `"${line}" is not one of the sentences you may quote. Copy whole sentences exactly.`),
    repair: (visual, keep, { quotable }) => {
      const lines = visual.lines.filter((line) => quotable.includes(line.trim()));
      if (lines.length === 0) return null;
      return { ...visual, lines, greeting: keep(visual.greeting, 4, true) ? visual.greeting : undefined, sign: keep(visual.sign, 4, true) ? visual.sign : undefined, date: keep(visual.date, 5, true) ? visual.date : undefined };
    },
  }),
  clock_time: template({
    family: "time",
    plan: "a clock whose hands move from one time of day to another, when the scene gives the times",
    prompt: '"clock_time" when the narration gives times of day, like 10:56 p.m.: "from" and "to" as 24-hour "HH:MM" times the narration or facts give, a "label" of at most 6 words saying what happened, and an optional "sub" of at most 6 words.',
    schema: z.object({ kind: z.literal("clock_time"), from: z.string(), to: z.string(), label: z.string(), sub: z.string().optional() }),
    fits: (scene) => timesIn(scene.source).length > 0,
    shown: (visual) => [
      { text: visual.label, words: 6 },
      { text: visual.sub, words: 6 },
    ],
    check: (visual, { source }) => {
      const stated = timesIn(source);
      return [visual.from, visual.to].flatMap((time) => {
        const minutes = clockMinutes(time);
        if (minutes === null) return [`Write "${time}" as a 24-hour time, like 22:56.`];
        return stated.includes(minutes) ? [] : [`The narration and facts do not give the time ${time}.`];
      });
    },
  }),
  scale_ladder: template({
    family: "chart",
    plan: "things placed on one scale, like the pH of liquids or the loudness of sounds, when the scene gives their values",
    prompt:
      '"scale_ladder" when the narration places things on one scale, like pH, decibels or temperature: a "title" of at most 5 words, an optional "unit", and 2 to 5 "marks", each a "value" and a "label" of 1 to 3 words from the sentence that gives that value.',
    schema: z.object({
      kind: z.literal("scale_ladder"),
      title: z.string(),
      unit: z.string().optional(),
      marks: z.array(z.object({ value: z.number(), label: z.string() })).min(2).max(5),
    }),
    fits: (scene) => scene.amounts.length >= 2 && SCALE_WORDS_2.test(scene.source),
    shown: (visual) => [{ text: visual.title, words: 5 }, { text: visual.unit, words: 2 }, ...visual.marks.map((mark) => ({ text: mark.label, words: 3 }))],
    check: (visual, { source }) => [
      ...distinct(visual.marks.map((mark) => mark.label), "Two marks have the same label."),
      ...visual.marks.flatMap((mark) => amountProblems({ ...mark, unit: visual.unit }, source)),
    ],
    // The scale runs from the lowest mark to the highest, so its ends are numbers the narration gives too.
    params: (visual) => {
      const values = visual.marks.map((mark) => mark.value);
      return { title: visual.title, unit: suffix(visual.unit), min: Math.min(...values), max: Math.max(...values), marks: visual.marks.map((mark) => ({ v: mark.value, label: mark.label })) };
    },
  }),
  formula_reveal: template({
    family: "words",
    plan: "a formula built up part by part, like E = mc², when the narration or facts give it",
    prompt:
      '"formula_reveal" when the narration or facts give a formula, like E = mc² or F = ma: its "parts" in order, each a "text" (a symbol, a number or a sign like = or +) and an optional "note" of 1 to 3 words saying what it stands for, as the narration or facts say, and an optional "caption" of at most 8 words.',
    schema: z.object({
      kind: z.literal("formula_reveal"),
      parts: z.array(z.object({ text: z.string(), note: z.string().optional() })).min(2).max(7),
      caption: z.string().optional(),
    }),
    fits: (scene) => /=|\bequals\b/i.test(scene.source),
    shown: (visual) => [...visual.parts.map((part) => ({ text: part.note, words: 3 })), { text: visual.caption, words: 8 }],
    check: (visual, { source }) =>
      formulaKey(source).includes(formulaKey(visual.parts.map((part) => part.text).join(""))) ? [] : ["The narration and facts do not give this formula. Write it as they do."],
    repair: (visual, keep) => ({ ...visual, parts: visual.parts.map((part) => (keep(part.note, 3) ? part : { text: part.text })), caption: keep(visual.caption, 8) ? visual.caption : undefined }),
  }),
  molecule: template({
    family: "picture",
    plan: "a model of a simple molecule like water or carbon dioxide, when the scene is about it",
    prompt: '"molecule" when the scene is about one of these molecules: H2O (water), CO2 (carbon dioxide), CH4 (methane), O2 (oxygen) or NH3 (ammonia). "formula" names it; the video draws its atoms and bonds.',
    schema: z.object({ kind: z.literal("molecule"), formula: z.enum(["H2O", "CO2", "CH4", "O2", "NH3"]) }),
    fits: (scene) => Object.values(MOLECULES).some((words) => words.test(scene.narration)) && /\b(molecules?|atoms?|bonds?|formula|chemical)\b/i.test(scene.source),
    shown: () => [],
    check: (visual, { narration }) => (MOLECULES[visual.formula].test(narration) ? [] : [`The narration does not name ${visual.formula}. Show the molecule it names.`]),
  }),
  data_table: template({
    family: "chart",
    plan: "a small table comparing three or four things on two or three points, when the scene gives every value",
    prompt:
      '"data_table" when the narration compares three or four things on two or three points: an optional "title" of at most 6 words, "columns" with the points as headings (the first heading may be empty), and 2 to 4 "rows", each starting with the thing\'s name and then its value for each column, every cell at most 4 words in the narration\'s words.',
    schema: z.object({
      kind: z.literal("data_table"),
      title: z.string().optional(),
      columns: z.array(z.string()).min(2).max(4),
      rows: z.array(z.array(z.string())).min(2).max(4),
    }),
    fits: (scene) => scene.amounts.length >= 3 || SHARED_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.title, words: 6 },
      // The first heading only names what the rows are, like "Planet"; the others say what the values mean.
      ...visual.columns.slice(1).map((text) => ({ text, words: 4 })),
      ...visual.rows.flatMap((row) => row.map((text) => ({ text, words: 4, exact: true }))),
    ],
    check: (visual, { source }) => [
      ...(visual.rows.every((row) => row.length === visual.columns.length) ? [] : ["Every row needs one cell for each column."]),
      // A number in a row is said of that row's thing, in one sentence.
      ...visual.rows.flatMap((row) =>
        row.slice(1).flatMap((cell) =>
          numbersIn(cell).length > 0 && !sentencesOf(source).some((sentence) => numbersIn(cell).every((number) => numbersIn(sentence).includes(number)) && groundedWords(row[0], sentence).matched > 0)
            ? [`No sentence gives "${cell}" for "${row[0]}".`]
            : [],
        ),
      ),
    ],
  }),
  people_ideas: template({
    family: "people",
    plan: "two or three people, each with the idea or work the narration ties to them",
    prompt:
      '"people_ideas" when the narration names two or three people and what each is known for: "people", each with a "name" as the narration writes it and a "keyword" of 1 to 3 words the narration says of that person, and an optional "title" of at most 5 words.',
    schema: z.object({
      kind: z.literal("people_ideas"),
      title: z.string().optional(),
      people: z.array(z.object({ name: z.string(), keyword: z.string() })).min(2).max(3),
    }),
    fits: (scene) => scene.namesPerson,
    shown: (visual) => [{ text: visual.title, words: 5 }, ...visual.people.flatMap((person) => [{ text: person.name, words: 4, exact: true }, { text: person.keyword, words: 3 }])],
    check: (visual, { source }) => [
      ...distinct(visual.people.map((person) => person.name), "Two people have the same name."),
      ...visual.people.flatMap((person) => (isNotAPerson(person.name, source) ? [`"${person.name}" is not a person here.`] : [])),
      ...visual.people
        .filter((person) => !statedTogether(person.name, person.keyword, source))
        .map((person) => `"${person.keyword}" must be what the narration says of ${person.name}, in the same sentence.`),
    ],
    params: (visual) => ({ title: visual.title, people: visual.people.map(({ name, keyword }) => ({ name, keyword })) }),
  }),
  // The kit (remotion/filmmotor/templates/kit-*.js, added on Oct 18, 2026): pictures for any topic. The model says what
  // is in them, by name, icon and place in words, and the template lays them out and moves them.
  cutaway: template({
    family: "picture",
    plan: "a cross-section of a place, under the ground, in the sea, inside the body or inside a machine or building, with the things the narration names in it and what moves between them",
    prompt:
      '"cutaway" when the narration explains what is inside or under something and what happens there: "setting" is "ground", "sea", "body" or "box" (a machine, a building or a container, named in "boxLabel"). "layers" (ground and sea only) are 0 to 4 layers from the top down, each with an optional "label", only those the narration names; in the sea they are depths of water, and the seabed is always drawn below them. "items" are 2 to 6 things the narration names, each with an "icon", a "label" of 1 to 3 words in its words, a "zone" ("sky" in the air above; "surface" on the ground or the water, or the head of a body; "upper" just below the surface, or the chest; "lower" deep down, or the belly) and a "side" ("left", "center" or "right"). "flows" are 0 to 4 movements the narration speaks of, from one item to another by their position in the list (from 0), each with an optional "label".',
    schema: z.object({
      kind: z.literal("cutaway"),
      setting: z.enum(["ground", "sea", "body", "box"]),
      boxLabel: z.string().optional(),
      layers: z.array(z.object({ label: z.string().optional() })).max(4),
      items: z
        .array(z.object({ icon: z.string(), label: z.string().optional(), zone: z.enum(["sky", "surface", "upper", "lower"]), side: z.enum(["left", "center", "right"]) }))
        .min(2)
        .max(6),
      flows: z.array(z.object({ from: z.number().int(), to: z.number().int(), label: z.string().optional() })).max(4),
    }),
    fits: (scene) => CUTAWAY_WORDS.test(scene.narration),
    shown: (visual) => [
      { text: visual.boxLabel, words: 3 },
      ...visual.layers.map((layer) => ({ text: layer.label, words: 3 })),
      ...visual.items.map((item) => ({ text: item.label, words: 3 })),
      ...visual.flows.map((flow) => ({ text: flow.label, words: 3 })),
    ],
    check: (visual, { source }) => {
      const labelOf = (index: number) => visual.items[index]?.label;
      return [
        ...(SETTING_WORDS[visual.setting].test(source) ? [] : [`The narration does not speak of the ${visual.setting}. Pick the setting it describes.`]),
        ...(visual.items.filter((item) => item.label).length >= 2 ? [] : ["Label at least two items in the narration's words."]),
        ...distinct(visual.items.flatMap((item) => (item.label ? [item.label] : [])), "Two items have the same label."),
        ...visual.flows.flatMap((flow) => {
          const [from, to] = [labelOf(flow.from), labelOf(flow.to)];
          if (!visual.items[flow.from] || !visual.items[flow.to] || flow.from === flow.to) return [`A flow joins items ${flow.from} and ${flow.to}, but items are counted from 0 and a flow joins two different items.`];
          // A flow says one thing moves to the other, so one sentence must name both.
          return from && to && namedTogether(from, to, source) ? [] : [`No sentence names both ends of the flow from item ${flow.from} to item ${flow.to}. Show only movements the narration speaks of, between labeled items.`];
        }),
      ];
    },
    repair: (visual, keep, { source }) => {
      const items = visual.items.map((item) => (keep(item.label, 3) ? item : { ...item, label: undefined }));
      const flows = visual.flows
        .filter((flow) => items[flow.from] && items[flow.to] && flow.from !== flow.to)
        .filter((flow) => {
          const [from, to] = [items[flow.from].label, items[flow.to].label];
          return from && to && namedTogether(from, to, source);
        })
        .map((flow) => (keep(flow.label, 3) ? flow : { ...flow, label: undefined }));
      const layers = visual.layers.map((layer) => (keep(layer.label, 3) ? layer : {}));
      const repaired = { ...visual, boxLabel: keep(visual.boxLabel, 3) ? visual.boxLabel : undefined, layers, items, flows };
      return items.filter((item) => item.label).length >= 2 && SETTING_WORDS[visual.setting].test(source) ? repaired : null;
    },
    params: (visual) => ({
      setting: visual.setting,
      ...(visual.boxLabel ? { boxLabel: visual.boxLabel } : {}),
      ...(visual.setting === "ground" || visual.setting === "sea" ? { layers: visual.layers } : {}),
      items: visual.items.map((item) => ({ ...item, icon: kitIcon(item.icon, item.label) })),
      // A flow label that repeats an item's label, or an earlier flow's, is clutter: "Crystals form" stood on an item
      // and on the flow next to it.
      flows: visual.flows.map((flow, index) =>
        flow.label &&
        (visual.items.some((item) => item.label && sameWords(item.label, flow.label ?? "")) ||
          visual.flows.slice(0, index).some((other) => other.label && sameWords(other.label, flow.label ?? "")))
          ? { from: flow.from, to: flow.to }
          : flow,
      ),
    }),
  }),
  journey: template({
    family: "chain",
    plan: "one thing travelling through places or stages in order and changing on the way, like food through the body, electricity from a power plant to a home or a data packet across the internet",
    prompt:
      '"journey" when the narration follows one thing on its way through places or stages in order: "traveller" is the thing that moves, with an "icon" and an optional "label" of 1 to 3 words; "stations" are 2 to 6 places or stages it passes, in the order the narration gives, each with an "icon", a "label" of 1 to 3 words in the narration\'s words, and an optional "becomes", the icon of what the traveller turns into after that station, only when the narration says it changes there.',
    schema: z.object({
      kind: z.literal("journey"),
      traveller: z.object({ icon: z.string(), label: z.string().optional() }),
      stations: z.array(z.object({ icon: z.string(), label: z.string(), becomes: z.string().optional() })).min(2).max(6),
    }),
    fits: (scene) => JOURNEY_WORDS.test(scene.narration),
    shown: (visual) => [{ text: visual.traveller.label, words: 3 }, ...visual.stations.map((station) => ({ text: station.label, words: 3 }))],
    check: (visual, { narration, source }) => {
      // The stations go in the narration's order, as far as it names them.
      const mentions = visual.stations.map((station) => firstMention(station.label, narration)).filter((place): place is number => place !== undefined);
      return [
        // Turning into a plain disc says nothing, so a change needs an icon the video can draw.
        ...iconProblems(visual.stations.map((station) => station.becomes)),
        ...distinct(visual.stations.map((station) => station.label), "Two stations have the same label."),
        ...(mentions.every((place, index) => index === 0 || place >= mentions[index - 1]) ? [] : ["The stations are not in the order the narration names them. Keep its order."]),
        ...(visual.stations.some((station) => station.becomes) && !CHANGE_WORDS.test(source) ? ['The narration does not say the traveller changes. Leave "becomes" out.'] : []),
      ];
    },
    repair: (visual, keep, { source }) => {
      const stations = visual.stations
        .filter((station) => keep(station.label, 3))
        .map((station) => (station.becomes && iconKey(station.becomes) && CHANGE_WORDS.test(source) ? station : { ...station, becomes: undefined }));
      const traveller = { ...visual.traveller, label: keep(visual.traveller.label, 3) ? visual.traveller.label : undefined };
      return stations.length >= 2 ? { ...visual, traveller, stations } : null;
    },
    params: (visual) => ({
      traveller: { ...visual.traveller, icon: kitIcon(visual.traveller.icon, visual.traveller.label) },
      stations: visual.stations.map((station) => ({ ...station, icon: kitIcon(station.icon, station.label), ...(station.becomes ? { becomes: icon(station.becomes) } : {}) })),
    }),
  }),
  input_output: template({
    family: "structure",
    plan: "a process in the middle with what goes in on the left and what comes out on the right, like a leaf turning sunlight, water and carbon dioxide into sugar and oxygen, or a power plant turning coal into electricity",
    prompt:
      '"input_output" when the narration says what a process, a machine or a living thing takes in and what it gives out: "process" with an "icon" and a "label" of 1 to 3 words; "inputs", 1 to 4 things that go in, and "outputs", 1 to 4 things that come out, each with an "icon" and a "label" of 1 to 3 words, all in the narration\'s words.',
    schema: z.object({
      kind: z.literal("input_output"),
      process: z.object({ icon: z.string(), label: z.string() }),
      inputs: z.array(z.object({ icon: z.string(), label: z.string() })).min(1).max(4),
      outputs: z.array(z.object({ icon: z.string(), label: z.string() })).min(1).max(4),
    }),
    fits: (scene) => INTAKE_WORDS.test(scene.narration) && OUTPUT_WORDS.test(scene.narration),
    shown: (visual) => [visual.process, ...visual.inputs, ...visual.outputs].map((item) => ({ text: item.label, words: 3 })),
    check: (visual, { source }) => {
      const all = [visual.process, ...visual.inputs, ...visual.outputs];
      // What goes in and comes out is said of this process: each is named in a sentence with the process or another part.
      const unsaid = [...visual.inputs, ...visual.outputs].filter((item) => !all.some((other) => other !== item && namedTogether(item.label, other.label, source)));
      return [
        ...distinct(all.map((item) => item.label), "Two parts have the same label."),
        ...unsaid.map((item) => `No sentence says "${item.label}" goes in or comes out of the process. Show only what the narration says.`),
      ];
    },
    repair: (visual, keep, { source }) => {
      const good = (item: { icon: string; label: string }) => keep(item.label, 3);
      const inputs = visual.inputs.filter(good);
      const outputs = visual.outputs.filter(good);
      const all = [visual.process, ...inputs, ...outputs];
      const said = (item: { label: string }) => all.some((other) => other !== item && namedTogether(item.label, other.label, source));
      const repaired = { ...visual, inputs: inputs.filter(said), outputs: outputs.filter(said) };
      return good(visual.process) && repaired.inputs.length >= 1 && repaired.outputs.length >= 1 ? repaired : null;
    },
    params: (visual, { narration }) => ({
      ...cueAt(narration, /\b(produc\w*|makes?|made|turns? into|turned into|convert\w*|releases?|released|gives? off|creates?|created)\b/i),
      process: { ...visual.process, icon: kitIcon(visual.process.icon, visual.process.label) },
      inputs: visual.inputs.map((item) => ({ ...item, icon: kitIcon(item.icon, item.label) })),
      outputs: visual.outputs.map((item) => ({ ...item, icon: kitIcon(item.icon, item.label) })),
    }),
  }),
  forces: template({
    family: "picture",
    plan: "the forces on one thing as arrows that push or pull it, like lift, weight, thrust and drag on a plane, or buoyancy and weight on a ship",
    prompt:
      '"forces" when the narration names forces that act on one thing: "object" with an "icon" and an optional "label"; "forces", 1 to 4, each with a "direction" ("up", "down", "left" or "right"; forward is right, so a plane\'s thrust points right), a "label" of 1 to 3 words in the narration\'s words, and an optional "strength" ("small", "medium" or "large") only when the narration compares them; "setting" is "air", "water", "ground", "space" or "none"; "moves" is the way the thing moves as a result, only when the narration says it moves, else "none".',
    schema: z.object({
      kind: z.literal("forces"),
      object: z.object({ icon: z.string(), label: z.string().optional() }),
      setting: z.enum(["air", "water", "ground", "space", "none"]),
      forces: z
        .array(z.object({ direction: z.enum(["up", "down", "left", "right"]), label: z.string(), strength: z.enum(["small", "medium", "large"]).optional() }))
        .min(1)
        .max(4),
      moves: z.enum(["up", "down", "left", "right", "none"]),
    }),
    fits: (scene) => FORCE_WORDS.test(scene.narration) || LIFT_WORDS.test(scene.narration),
    shown: (visual) => [{ text: visual.object.label, words: 3 }, ...visual.forces.map((force) => ({ text: force.label, words: 3 }))],
    check: (visual, { source }) => [
      ...distinct(visual.forces.map((force) => force.label), "Two forces have the same label."),
      // Gravity pulls down and lift pushes up, whatever the model says.
      ...visual.forces.flatMap((force) => {
        const known = FORCE_DIRECTIONS.find((entry) => entry.words.test(force.label));
        return known && known.direction !== force.direction ? [`"${force.label}" points ${known.direction}. Give it that direction.`] : [];
      }),
      ...(new Set(visual.forces.map((force) => force.strength ?? "medium")).size > 1 && !STRENGTH_WORDS.test(source)
        ? ["The narration does not compare the forces. Leave their strength out."]
        : []),
      ...(visual.moves !== "none" && !MOVE_WORDS[visual.moves].test(source) ? [`The narration does not say the thing moves ${visual.moves}. Give "moves" "none".`] : []),
    ],
    repair: (visual, keep, { source }) => {
      const forces = visual.forces
        .filter((force) => keep(force.label, 3))
        .map((force) => ({ ...force, direction: FORCE_DIRECTIONS.find((entry) => entry.words.test(force.label))?.direction ?? force.direction }));
      const sizes = STRENGTH_WORDS.test(source) ? forces : forces.map(({ strength, ...force }) => (void strength, force));
      const moves: typeof visual.moves = visual.moves !== "none" && MOVE_WORDS[visual.moves].test(source) ? visual.moves : "none";
      const object = { ...visual.object, label: keep(visual.object.label, 3) ? visual.object.label : undefined };
      return sizes.length >= 1 ? { ...visual, object, forces: sizes, moves } : null;
    },
    params: (visual) => ({
      object: { ...visual.object, icon: kitIcon(visual.object.icon, visual.object.label) },
      setting: visual.setting,
      forces: visual.forces,
      moves: visual.moves,
    }),
  }),
  // Drawn diagrams of how things work, from the library (added on Oct 18, 2026).
  volcano_cutaway: labelDiagram({
    name: "volcano_cutaway",
    cue: /\b(erupt\w*|burst\w*|explod\w*|blast\w*)\b/i,
    plan: "a cutaway of a volcano: magma rising from its chamber up the vent and erupting, when the scene explains an eruption or what is inside a volcano",
    prompt: '"volcano_cutaway" when the narration explains how a volcano erupts or what is inside it: a cutaway with the crust, the magma chamber, the conduit up to the crater, and the eruption with ash and lava. "labels" names the parts: chamber, conduit, crater, ash, lava, crust. "erupts" is false when the scene is only about magma gathering below, else true.',
    parts: ["chamber", "conduit", "crater", "ash", "lava", "crust"],
    fits: (scene) => /\bvolcan\w*/i.test(scene.source) && /\b(magma|erupt\w*|lava)\b/i.test(scene.narration),
    options: { erupts: z.boolean() },
    // The drawing bursts into an eruption only when the narration or facts speak of one.
    check: (visual, { source }) =>
      visual.erupts === true && !/\b(erupt\w*|burst\w*|explod\w*|explosi\w*)\b/i.test(source) ? ['The narration does not speak of an eruption. Give "erupts" false.'] : [],
  }),
  plate_boundary: labelDiagram({
    name: "plate_boundary",
    cue: /\b(earthquakes?|quakes?|slips?|slipped|jolts?)\b/i,
    plan: "two tectonic plates meeting, moving apart, colliding with one sliding under, or sliding past each other, when the scene explains plate tectonics",
    prompt: '"plate_boundary" when the narration explains how two tectonic plates move at their boundary: "boundary" is "divergent" (moving apart, magma rising between), "convergent" (one sliding under the other, with a volcano or mountains above) or "transform" (sliding past each other, with an earthquake), as the narration says. "labels" names the parts: left and right (the two plates; in convergent, left slides under), mantle, magma, crust, trench, volcano, mountains, fault, quake. "forms" is "volcano" or "mountains" for convergent.',
    parts: ["left", "right", "mantle", "magma", "crust", "trench", "volcano", "mountains", "fault", "quake"],
    fits: (scene) => /\b(tectonic\w*|plates?|subduct\w*|rift\w*|fault\w*)\b/i.test(scene.narration),
    options: { boundary: z.enum(["divergent", "convergent", "transform"]), forms: z.enum(["volcano", "mountains"]) },
    // The kind of boundary is a claim: the narration must say how the plates move.
    check: (visual, { source }) => {
      const words = {
        divergent: /\b(apart|spread\w*|rift\w*|diverg\w*|separat\w*|pull\w* away)\b/i,
        convergent: /\b(collid\w*|collision|converg\w*|subduct\w*|under|beneath|toward|crash\w*|push\w* together)\b/i,
        transform: /\b(past each other|slide\w* past|transform|sideways|grind\w*|horizontal\w*)\b/i,
      } as const;
      const boundary = visual.boundary as keyof typeof words;
      if (!words[boundary].test(source)) return [`The narration does not say the plates move as at a ${boundary} boundary. Pick the boundary it describes.`];
      // Above a convergent boundary rise volcanoes or mountains, as the narration says; either fits when it says neither.
      const volcanoes = /\bvolcan\w*/i.test(source);
      const mountains = /\b(mountains?|himalaya\w*|alps|andes|ranges?)\b/i.test(source);
      if (boundary === "convergent" && visual.forms === "volcano" && mountains && !volcanoes) return ['The narration speaks of mountains, not volcanoes. Give "forms" "mountains".'];
      if (boundary === "convergent" && visual.forms === "mountains" && volcanoes && !mountains) return ['The narration speaks of volcanoes, not mountains. Give "forms" "volcano".'];
      return [];
    },
    // The template calls the kind of boundary "kind".
    params: ({ boundary, ...params }) => ({ ...params, kind: boundary }),
  }),
  earthquake: labelDiagram({
    name: "earthquake",
    cue: /\b(slip\w*|snap\w*|break\w*|broke|ruptur\w*|jerk\w*|lurch\w*)\b/i,
    plan: "an earthquake: the ground slipping along a fault, with the focus underground, the epicenter above it and waves spreading out",
    prompt: '"earthquake" when the narration explains how an earthquake happens: a block of ground slipping along a fault, the focus below, the epicenter above it and the seismic waves spreading. "labels" names the parts: fault, focus, epicenter, waves.',
    parts: ["fault", "focus", "epicenter", "waves"],
    fits: (scene) => /\b(earthquakes?|quakes?)\b/i.test(scene.source) && /\bfaults?\b/i.test(scene.source),
    options: {},
  }),
  heart_pump: labelDiagram({
    name: "heart_pump",
    plan: "the heart beating, with blood flowing through its four chambers to the lungs and the body",
    prompt: '"heart_pump" when the narration explains how the heart pumps blood: the four chambers beating, blood without oxygen to the lungs and blood with oxygen out to the body. "labels" names the parts: rightAtrium, rightVentricle, leftAtrium, leftVentricle, lungs, body, and the two kinds of blood, withOxygen and withoutOxygen.',
    parts: ["rightAtrium", "rightVentricle", "leftAtrium", "leftVentricle", "lungs", "body", "withOxygen", "withoutOxygen"],
    // The drawing shows both loops, to the lungs and to the body. A scene in a video about the heart often names only a
    // chamber or the aorta, not the heart itself: "Oxygen-rich blood travels through the pulmonary veins to the left
    // atrium" got no diagram when the heart had to be named.
    fits: (scene) =>
      /\bblood\b/i.test(scene.narration) && /\b(hearts?|atri(um|a)|ventricles?|aorta|chambers?)\b/i.test(scene.narration) && /\b(lungs?|oxygen)\b/i.test(scene.source),
    options: {},
  }),
  lungs_breathing: labelDiagram({
    name: "lungs_breathing",
    plan: "the lungs breathing in and out, with the windpipe and the diaphragm, and oxygen in and carbon dioxide out",
    prompt: '"lungs_breathing" when the narration explains breathing: the lungs filling and emptying with the windpipe and the diaphragm. "labels" names the parts: windpipe, lungs, diaphragm, oxygen, carbonDioxide, breatheIn, breatheOut; the dots of oxygen and carbon dioxide show only when both are labeled.',
    parts: ["windpipe", "lungs", "diaphragm", "oxygen", "carbonDioxide", "breatheIn", "breatheOut"],
    fits: (scene) => /\blungs?\b/i.test(scene.narration) && /\b(breath\w*|inhal\w*|exhal\w*)\b/i.test(scene.narration),
    options: {},
  }),
  neuron_signal: labelDiagram({
    name: "neuron_signal",
    cue: /\b(signals?|impulses?|fires?|fired)\b/i,
    plan: "a nerve cell passing a signal along its axon to the next cell",
    prompt: '"neuron_signal" when the narration explains how nerve cells send signals: a neuron with dendrites, cell body and axon, and a signal travelling to the next cell. "labels" names the parts: dendrites, cellBody, axon, myelin, axonEndings, signal, synapse, messengers, nextCell. "myelin" is true only when the narration speaks of myelin.',
    parts: ["dendrites", "cellBody", "axon", "myelin", "axonEndings", "signal", "synapse", "messengers", "nextCell"],
    // The drawing shows a signal passing on to the next cell.
    fits: (scene) => /\b(neurons?|nerves?|nerve cells?)\b/i.test(scene.narration) && /\b(signals?|impulses?|messages?)\b/i.test(scene.narration),
    options: { myelin: z.boolean() },
    check: (visual, { source }) => (visual.myelin === true && !/\bmyelin\b/i.test(source) ? ["The narration does not speak of myelin. Give false."] : []),
  }),
  leaf_photosynthesis: labelDiagram({
    name: "leaf_photosynthesis",
    plan: "a leaf making sugar from sunlight, water and carbon dioxide, and giving off oxygen",
    prompt: '"leaf_photosynthesis" when the narration explains photosynthesis: sunlight, water and carbon dioxide going into a leaf, sugar made inside and oxygen going out. "labels" names the parts: sunlight, water, carbonDioxide, oxygen, sugar.',
    parts: ["sunlight", "water", "carbonDioxide", "oxygen", "sugar"],
    // Water, carbon dioxide, oxygen and sugar are always drawn, so the narration or its facts must speak of all four.
    fits: (scene) =>
      /\b(photosynthes\w*|leaf|leaves|plants?)\b/i.test(scene.narration) &&
      /\b(sun\w*|light)\b/i.test(scene.narration) &&
      [/\bwater\b/i, /\b(carbon dioxide|co2)\b/i, /\boxygen\b/i, /\b(sugars?|glucose|food)\b/i].every((words) => words.test(scene.source)),
    options: {},
  }),
  lightning_storm: labelDiagram({
    name: "lightning_storm",
    cue: /\b(strikes?|struck|bolts?|discharg\w*|flash\w*)\b/i,
    plan: "a storm cloud separating charges and a lightning bolt striking down, followed by thunder",
    prompt: '"lightning_storm" when the narration explains lightning: charges separating in a storm cloud, a bolt striking the ground and thunder spreading. "labels" names the parts: cloud, positive, negative, ground, lightning, thunder.',
    parts: ["cloud", "positive", "negative", "ground", "lightning", "thunder"],
    fits: (scene) => /\blightning\b/i.test(scene.narration) && /\b(charges?|charged|clouds?|electric\w*)\b/i.test(scene.narration),
    options: {},
    params: ({ labels, ...params }) => ({ ...params, ...(labels as object) }),
  }),
  ocean_tides: labelDiagram({
    name: "ocean_tides",
    plan: "the Moon pulling the oceans into bulges on the Earth, which follow it round as the tides",
    prompt: '"ocean_tides" when the narration explains the tides: the Moon going round the Earth with the oceans bulging toward it and on the far side. "labels" names the parts: earth, moon, highTide, lowTide.',
    parts: ["earth", "moon", "highTide", "lowTide"],
    fits: (scene) => /\btides?\b/i.test(scene.narration) && /\bmoon\b/i.test(scene.narration),
    options: {},
    params: ({ labels, ...params }) => ({ ...params, ...(labels as object) }),
  }),
  wind_turbine: labelDiagram({
    name: "wind_turbine",
    plan: "the wind turning a wind turbine, its generator making electricity that runs along a line to homes",
    prompt: '"wind_turbine" when the narration explains how wind power works: the wind turning the blades, the generator inside and the electricity running to homes. "labels" names the parts: wind, blades, generator, electricity, homes.',
    parts: ["wind", "blades", "generator", "electricity", "homes"],
    fits: (scene) => /\bwind\s?(turbines?|power|farms?|energy)\b/i.test(scene.narration) && /\b(electric\w*|power|energy)\b/i.test(scene.narration),
    options: {},
    params: ({ labels, ...params }) => ({ ...params, ...(labels as object) }),
  }),
  layers_of_earth_cutaway: labelDiagram({
    name: "layers_of_earth_cutaway",
    plan: "the Earth with a quarter cut away, showing the crust, the mantle, the outer core and the inner core",
    prompt: '"layers_of_earth_cutaway" when the narration names the layers inside the Earth: the Earth cut open to show them from the outside in. "labels" names the layers: crust, mantle, outerCore, innerCore. "focus" is the layer the scene is about, or "none".',
    parts: ["crust", "mantle", "outerCore", "innerCore"],
    fits: (scene) => [/\bcrust\b/i, /\bmantle\b/i, /\bcores?\b/i].filter((layer) => layer.test(scene.narration)).length >= 2,
    options: { focus: z.enum(["none", "crust", "mantle", "outerCore", "innerCore"]) },
    params: ({ focus, ...params }) => (focus === "none" ? params : { ...params, focus }),
  }),
  immune_response: labelDiagram({
    name: "immune_response",
    plan: "germs coming in, antibodies latching onto them and a white blood cell taking them in",
    prompt: '"immune_response" when the narration explains how the body fights germs: germs drifting in, antibodies latching onto them and a white blood cell taking them in. "labels" names the parts: germs, antibodies, whiteBloodCell.',
    parts: ["germs", "antibodies", "whiteBloodCell"],
    // The drawing shows antibodies latching on and a white blood cell taking the germs in.
    fits: (scene) =>
      /\b(germs?|bacteri\w*|virus\w*|pathogens?|microbes?)\b/i.test(scene.source) && /\bantibod\w*/i.test(scene.source) && /\bwhite blood cells?\b/i.test(scene.source),
    options: {},
  }),
  // More drawn diagrams (diagrams-ai.js, diagrams-physics.js, diagrams-life.js, diagrams-sky.js, added on Oct 18, 2026).
  neural_network: labelDiagram({
    name: "neural_network",
    plan: "an artificial neural network: layers of nodes joined by lines, with a signal flowing forward from the input layer to the output",
    prompt: '"neural_network" when the narration explains how an artificial neural network works: layers of connected nodes passing a signal forward. "labels" names the parts: input, hidden, output, signal. "hidden" is how many hidden layers to draw, 1 to 3.',
    parts: ["input", "hidden", "output", "signal"],
    fits: (scene) => /\b(neural networks?|deep learning|artificial neurons?)\b/i.test(scene.source),
    options: { hidden: z.number().int() },
    cue: /\b(signals?|inputs?|flows?)\b/i,
    // A number of hidden layers the narration gives is the number drawn.
    check: (visual, { source }) => {
      const said = source.match(/\b(one|two|three|1|2|3) hidden layers?\b/i)?.[1].toLowerCase();
      const count = said ? { one: 1, two: 2, three: 3 }[said] ?? Number(said) : undefined;
      return count !== undefined && count !== visual.hidden ? [`The narration speaks of ${count} hidden layers. Give "hidden" ${count}.`] : [];
    },
    params: ({ hidden, ...params }) => ({ ...params, hidden: Math.max(1, Math.min(3, Number(hidden) || 2)) }),
  }),
  next_word_prediction: template({
    signature: true,
    family: "picture",
    plan: "how a language model writes: the text so far as word tiles, candidate next words as bars, and the likeliest one added to the text",
    prompt:
      '"next_word_prediction" when the narration explains how a language model writes text by predicting the next word. "words" are the words of the text so far, and "candidates" 2 to 4 possible next words, the first being the one picked; take both only from an example the narration or facts give, word for word, else leave both empty and blank tiles are drawn. Optional "labels", each at most 3 words in the narration\'s words: "model", "text", "choice".',
    schema: z.object({
      kind: z.literal("next_word_prediction"),
      words: z.array(z.string()).max(8),
      candidates: z.array(z.string()).max(4),
      labels: z.object({ model: z.string().optional(), text: z.string().optional(), choice: z.string().optional() }),
    }),
    fits: (scene) => /\b(language models?|LLMs?|chatbots?|next word|predict\w* (the )?(next )?(word|token)s?|tokens?)\b/i.test(scene.source),
    shown: (visual) => Object.values(visual.labels).map((text) => ({ text, words: 3, optional: true })),
    // The tiles are an example the narration or facts give in quotes, like after "The cat sat on the" it picks "mat":
    // chopping one of their own sentences into tiles would show the model writing that sentence.
    check: (visual, { source }) => [
      ...(visual.words.length > 0 && !quotedIn(visual.words.join(" "), source) ? ["The words so far must be an example the narration or facts give in quotes, word for word. Else leave them empty."] : []),
      ...visual.candidates.filter((word) => !quotedIn(word, source)).map((word) => `"${word}" is not a quoted example in the narration or facts. Take the candidates from their example, or leave them empty.`),
      ...(visual.candidates.length === 1 ? ["Give 2 to 4 candidates, or none."] : []),
      // The longest bar is picked, so the narration must say the model picks the likeliest word.
      ...(visual.candidates.length > 0 && !/\b(likel\w*|probab\w*|most common|best guess|predicts?)\b/i.test(source) ? ["The narration does not say the model picks the likeliest word. Leave the candidates empty."] : []),
    ],
    params: ({ kind, ...visual }, { narration, source }) => (
      void kind,
      {
        ...cueAt(narration, /\b(picks?|chooses?|chosen|selects?|likeliest)\b/i),
        ...visual,
        repeat: /\b(word by word|one (word|token) at a time|again and again|over and over|repeats?)\b/i.test(source ?? ""),
      }
    ),
    repair: (visual, keep, { source }) => ({
      ...visual,
      words: visual.words.length > 0 && quotedIn(visual.words.join(" "), source) ? visual.words : [],
      candidates: visual.candidates.length >= 2 && visual.candidates.every((word) => quotedIn(word, source)) && /\b(likel\w*|probab\w*|most common|best guess|predicts?)\b/i.test(source) ? visual.candidates : [],
      labels: Object.fromEntries(Object.entries(visual.labels).filter(([, text]) => keep(text, 3))),
    }),
  }),
  gpu_parallel: labelDiagram({
    name: "gpu_parallel",
    plan: "a CPU with a few big cores working through tasks one after another, beside a GPU with many small cores doing many tasks at once",
    prompt: '"gpu_parallel" when the narration explains why a GPU does many calculations at once, unlike a CPU. "labels" names the parts: cpu, gpu, cores, tasks.',
    parts: ["cpu", "gpu", "cores", "tasks"],
    // The drawing shows the GPU working in parallel, so the narration must say so.
    fits: (scene) =>
      /\b(GPUs?|graphics (cards?|processors?|processing units?))\b/i.test(scene.source) &&
      /\b(CPUs?|central processing units?|processors?)\b/i.test(scene.source) &&
      /\b(parallel|at once|at the same time|simultaneous\w*|many (small )?cores|thousands of)\b/i.test(scene.source),
    options: {},
    cue: /\b(parallel|simultaneously|once)\b/i,
  }),
  model_training: labelDiagram({
    name: "model_training",
    plan: "how a model learns, as a loop: it guesses, compares with the right answer, and adjusts itself, with the error shrinking each round",
    prompt: '"model_training" when the narration explains how an AI model is trained: it makes a guess, compares it with the right answer and adjusts, again and again. "labels" names the parts: data, model, guess, answer, error, adjust. "rounds" is 2 to 4.',
    parts: ["data", "model", "guess", "answer", "error", "adjust"],
    fits: (scene) =>
      /\b(train\w*|learns?|learning)\b/i.test(scene.narration) &&
      /\b(models?|neural networks?|AI|machine learning|algorithms?)\b/i.test(scene.source) &&
      /\b(errors?|mistakes?|adjust\w*|weights?|feedback|correct\w*|improv\w*)\b/i.test(scene.source),
    options: { rounds: z.number().int() },
    params: ({ rounds, ...params }) => ({ ...params, rounds: Math.max(2, Math.min(4, Number(rounds) || 3)) }),
  }),
  internet_packets: labelDiagram({
    name: "internet_packets",
    plan: "data crossing the internet: a message split into packets that take different routes through routers and come back together",
    prompt: '"internet_packets" when the narration explains how data travels across the internet in packets. "labels" names the parts: sender, receiver, packets, routers, message.',
    parts: ["sender", "receiver", "packets", "routers", "message"],
    // The packets taking different routes through routers and coming back together are always drawn.
    fits: (scene) => /\bpackets?\b/i.test(scene.source) && /\b(routers?|routes?|paths?|reassembl\w*|back together)\b/i.test(scene.source),
    options: {},
    cue: /\b(split\w*|broken|divided|chopped)\b/i,
  }),
  airplane_lift: labelDiagram({
    name: "airplane_lift",
    plan: "air flowing over and under a wing, lower pressure above it, and lift pushing it up; weight, thrust and drag when the narration names them",
    prompt: '"airplane_lift" when the narration explains how a wing lifts a plane. "labels" names the parts: wing, airflow, lift, weight, thrust, drag, lowPressure, highPressure; weight, thrust and drag are drawn only when labeled.',
    parts: ["wing", "airflow", "lift", "weight", "thrust", "drag", "lowPressure", "highPressure"],
    // Faster air over the top and lower pressure above are always drawn, so the narration must explain lift that way.
    fits: (scene) =>
      /\blift\b/i.test(scene.source) &&
      /\b(wings?|planes?|aircraft|airplanes?|aeroplanes?|flight|fly|flies)\b/i.test(scene.narration) &&
      /\b(faster|pressure|speeds? up|quicker)\b/i.test(scene.source),
    options: {},
    cue: /\b(lifts?|upward|pushes (it )?up)\b/i,
  }),
  solar_panel: labelDiagram({
    name: "solar_panel",
    plan: "sunlight knocking electrons loose in a solar cell, and the current flowing through a wire to light a lamp or a house",
    prompt: '"solar_panel" when the narration explains how a solar panel turns sunlight into electricity. "labels" names the parts: sunlight, panel, electrons, current, device.',
    parts: ["sunlight", "panel", "electrons", "current", "device"],
    // Electrons knocked loose are always drawn.
    fits: (scene) => /\b(solar (panels?|cells?|power|energy)|photovoltaic)\b/i.test(scene.source) && /\belectrons?\b/i.test(scene.source),
    options: {},
    cue: /\b(hits?|strikes?|knocks?|absorb\w*|frees?)\b/i,
    // A house is lit only when the narration speaks of homes; a lamp otherwise.
    params: (params, { source }) => ({ ...params, powers: /\b(homes?|houses?|household\w*)\b/i.test(source ?? "") ? "house" : "lamp" }),
  }),
  battery_circuit: labelDiagram({
    name: "battery_circuit",
    plan: "a battery cut open, with electrons flowing from the anode through a wire to the cathode and lighting a bulb",
    prompt: '"battery_circuit" when the narration explains how a battery makes a current. "labels" names the parts: anode, cathode, electrolyte, electrons, ions, bulb.',
    parts: ["anode", "cathode", "electrolyte", "electrons", "ions", "bulb"],
    // Ions moving inside are always drawn.
    fits: (scene) => /\bbatter(y|ies)\b/i.test(scene.source) && /\belectrons?\b/i.test(scene.source) && /\b(ions?|electrolytes?)\b/i.test(scene.source),
    options: {},
    cue: /\b(flows?|flowing|connect\w*|switch\w* on)\b/i,
  }),
  nuclear_fission: labelDiagram({
    name: "nuclear_fission",
    plan: "a neutron splitting a large nucleus into two, releasing energy and more neutrons that split more nuclei in a chain reaction",
    prompt: '"nuclear_fission" when the narration explains nuclear fission. "labels" names the parts: neutron, nucleus, fragments, energy, chainReaction. "chain" is true only when the narration speaks of a chain reaction or the new neutrons splitting more nuclei.',
    parts: ["neutron", "nucleus", "fragments", "energy", "chainReaction"],
    fits: (scene) => /\b(fission|split\w* (the |an )?(atoms?|nucle\w*)|chain reaction|uranium)\b/i.test(scene.source) && /\bneutrons?\b/i.test(scene.source),
    options: { chain: z.boolean() },
    // Two new neutrons when the narration says two, else three.
    params: (params, { source }) => ({ ...params, neutrons: /\b(two|2) (new |more |free |extra )?neutrons\b/i.test(source ?? "") && !/\b(three|3) (new |more |free |extra )?neutrons\b/i.test(source ?? "") ? 2 : 3 }),
    cue: /\b(hits?|strikes?|struck|splits?|split)\b/i,
    check: (visual, { source }) =>
      visual.chain === true && !/\b(chain reaction|more neutrons|other (atoms|nuclei)|more (atoms|nuclei))\b/i.test(source) ? ['The narration does not speak of a chain reaction. Give "chain" false.'] : [],
  }),
  fridge_heat_pump: labelDiagram({
    name: "fridge_heat_pump",
    plan: "a fridge cut open, with the refrigerant carrying heat from the cold coils inside to the hot coils at the back",
    prompt: '"fridge_heat_pump" when the narration explains how a fridge, a freezer, an air conditioner or a heat pump moves heat. "labels" names the parts: compressor, condenser, expansionValve, evaporator, refrigerant, heatIn, heatOut, inside.',
    parts: ["compressor", "condenser", "expansionValve", "evaporator", "refrigerant", "heatIn", "heatOut", "inside"],
    // The whole loop is always drawn: the narration must say a refrigerant carries the heat.
    fits: (scene) => /\b(refrigerators?|fridges?|freezers?|air condition\w*|heat pumps?)\b/i.test(scene.source) && /\b(refrigerants?|coolants?)\b/i.test(scene.source) && /\bheat\b/i.test(scene.source),
    options: {},
  }),
  eye_vision: labelDiagram({
    name: "eye_vision",
    plan: "light entering the eye through the lens, landing on the retina, and a signal running along the optic nerve to the brain",
    prompt: '"eye_vision" when the narration explains how the eye sees. "labels" names the parts: light, cornea, pupil, lens, retina, opticNerve, brain.',
    parts: ["light", "cornea", "pupil", "lens", "retina", "opticNerve", "brain"],
    fits: (scene) => /\beyes?\b/i.test(scene.source) && /\b(retina|lens|cornea|pupil)\b/i.test(scene.source),
    options: {},
    // The picture on the retina is drawn upside down only when the narration says it lands that way, and the signal
    // along the optic nerve to the brain only when it speaks of them.
    params: (params, { source }) => ({
      ...params,
      image: /\b(upside[- ]down|inverted|flipped|reversed)\b/i.test(source ?? ""),
      signal: /\b(brain|optic nerve|nerves?)\b/i.test(source ?? ""),
    }),
  }),
  digestion: labelDiagram({
    name: "digestion",
    plan: "food moving down the digestive tract, from the mouth through the stomach to the intestines, with nutrients passing into the blood",
    prompt: '"digestion" when the narration explains how the body digests food. "labels" names the parts: mouth, esophagus, stomach, smallIntestine, largeIntestine, liver, nutrients.',
    parts: ["mouth", "esophagus", "stomach", "smallIntestine", "largeIntestine", "liver", "nutrients"],
    fits: (scene) => /\b(digest\w*|stomach|intestines?|esophagus)\b/i.test(scene.narration) && /\b(food|nutrients?|meal|eat\w*)\b/i.test(scene.source),
    options: {},
    // The close-up of nutrients passing into the blood only when the narration says they are absorbed.
    params: (params, { source }) => ({ ...params, zoom: /\bnutrients?\b/i.test(source ?? "") && /\b(absorb\w*|blood\w*)\b/i.test(source ?? "") }),
  }),
  virus_infection: labelDiagram({
    name: "virus_infection",
    plan: "a virus attaching to a cell, getting its genes inside, the cell making copies, and new viruses bursting out",
    prompt: '"virus_infection" when the narration explains how a virus infects a cell and makes copies of itself. "labels" names the parts: virus, cell, receptor, genes, copies.',
    parts: ["virus", "cell", "receptor", "genes", "copies"],
    // The virus's genes going into the cell are always drawn.
    fits: (scene) =>
      /\bvirus\w*/i.test(scene.source) &&
      /\bcells?\b/i.test(scene.source) &&
      /\b(copies|copy|replicat\w*|multipl\w*|reproduc\w*|hijack\w*)\b/i.test(scene.source) &&
      /\b(genes?|genetic|DNA|RNA|instructions)\b/i.test(scene.source),
    options: {},
    cue: /\b(attach\w*|binds?|bound|latch\w*|enters?)\b/i,
    // The cell bursts open only when the narration says so; else the new viruses leave through its wall.
    params: (params, { source }) => ({ ...params, bursts: /\b(burst\w*|breaks? open|broke open|ruptur\w*|explod\w*|lys\w*)\b/i.test(source ?? "") }),
  }),
  natural_selection: labelDiagram({
    name: "natural_selection",
    plan: "natural selection: creatures in a few colors, a predator catching the ones that stand out, and the next generations mostly the well-hidden color",
    prompt: '"natural_selection" when the narration explains natural selection through creatures that blend in surviving predators. "labels" names the parts: population, variation, predator, survivors, offspring. "generations" is 2 or 3.',
    parts: ["population", "variation", "predator", "survivors", "offspring"],
    // The drawing shows predators picking off the creatures that stand out.
    fits: (scene) => /\b(natural selection|evolution|evolv\w*|survival of the fittest)\b/i.test(scene.source) && /\b(predators?|camouflag\w*|eaten|blend in|stand out|hunted)\b/i.test(scene.source),
    options: { generations: z.number().int() },
    params: ({ generations, ...params }) => ({ ...params, generations: Math.max(2, Math.min(3, Number(generations) || 3)) }),
  }),
  food_chain: template({
    signature: true,
    family: "chain",
    plan: "energy passing along a food chain, from the sun to a plant to the animals that eat it, each link as an icon",
    prompt:
      '"food_chain" when the narration follows a food chain: "chain" is 3 to 5 links from the plant up to the top predator, each with an "icon" and a "label" of 1 to 3 words, in the narration\'s words; the sun is drawn already, so the chain starts with the plant. Optional "labels" "sun" and "energy", each at most 3 words.',
    schema: z.object({
      kind: z.literal("food_chain"),
      chain: z.array(z.object({ icon: z.string(), label: z.string() })).min(3).max(5),
      labels: z.object({ sun: z.string().optional(), energy: z.string().optional() }),
    }),
    fits: (scene) => /\b(food (chains?|webs?)|predators?|prey|herbivores?|carnivores?|producers?|consumers?)\b/i.test(scene.source) && /\b(eats?|eaten|feeds? on|energy)\b/i.test(scene.source),
    shown: (visual) => [...visual.chain.map((link) => ({ text: link.label, words: 3 })), ...Object.values(visual.labels).map((text) => ({ text, words: 3, optional: true }))],
    // Each link is eaten by the next, so one clause must name both, as in "foxes eat rabbits".
    check: (visual, { source }) => [
      ...visual.chain.slice(1).flatMap((link, index) =>
        statedTogether(visual.chain[index].label, link.label, source) ? [] : [`No clause names both "${visual.chain[index].label}" and "${link.label}". Each link must eat the one before, as the narration says.`],
      ),
    ],
    repair: (visual, keep) => ({ ...visual, labels: Object.fromEntries(Object.entries(visual.labels).filter(([, text]) => keep(text, 3))) }),
    // The arrows thin out up the chain only when the narration says energy is lost at each step.
    params: ({ kind, ...visual }, { source }) => (
      void kind,
      {
        ...visual,
        // The sun is drawn already, so a link for it would draw it twice.
        chain: visual.chain.filter((link) => !/^(the )?sun(light)?$/i.test(link.label.trim())).map((link) => ({ ...link, icon: kitIcon(link.icon, link.label) })),
        energyLoss: /\b(energy (is )?(lost|wasted)|loses? (some |most )?(of its )?energy|less energy|(10|ten) ?(%|percent))\b/i.test(source ?? ""),
      }
    ),
  }),
  water_cycle_landscape: labelDiagram({
    name: "water_cycle_landscape",
    plan: "the water cycle in a landscape: the sun, water evaporating from the sea, clouds over mountains, rain, and rivers running back to the sea",
    prompt: '"water_cycle_landscape" when the narration explains the water cycle. "labels" names the parts: sun, evaporation, condensation, precipitation, runoff, groundwater, collection.',
    parts: ["sun", "evaporation", "condensation", "precipitation", "runoff", "groundwater", "collection"],
    // The whole cycle is drawn, rivers and groundwater too, so the narration must name the cycle or follow the water back.
    fits: (scene) =>
      /\bwater cycle\b/i.test(scene.source) ||
      (/\bevaporat\w*/i.test(scene.source) && /\b(rain\w*|precipitation)\b/i.test(scene.source) && /\b(rivers?|runoff|groundwater|flows? back|back to the (sea|ocean))\b/i.test(scene.source)),
    options: {},
  }),
  hurricane: labelDiagram({
    name: "hurricane",
    plan: "a hurricane forming: warm ocean water, moist air rising into towering clouds, and the storm spinning round a calm eye",
    prompt: '"hurricane" when the narration explains how a hurricane, a typhoon or a cyclone forms. "labels" names the parts: warmOcean, risingAir, clouds, eye, wind.',
    parts: ["warmOcean", "risingAir", "clouds", "eye", "wind"],
    // Warm water, rising air and the spin round an eye are always drawn.
    fits: (scene) =>
      /\b(hurricanes?|typhoons?|tropical (storms?|cyclones?)|cyclones?)\b/i.test(scene.source) &&
      /\b(warm\w*|spin\w*|rotat\w*|swirl\w*|eye|ris(es|ing) air|air rises)\b/i.test(scene.narration),
    options: {},
    // It turns clockwise, as in the south, only when the narration says so; counterclockwise otherwise, as in the north.
    params: (params, { source }) => ({
      ...params,
      clockwise: /\b(southern hemisphere|south of the equator)\b/i.test(source ?? "") || /(?<!counter-?|anti-?)\bclockwise\b/i.test(source ?? ""),
    }),
  }),
  carbon_cycle: labelDiagram({
    name: "carbon_cycle",
    plan: "carbon moving between the air, plants, animals, the ocean and the ground, and burning fossil fuels putting it back into the air",
    prompt: '"carbon_cycle" when the narration explains the carbon cycle. "labels" names the parts: atmosphere, plants, animals, ocean, decay, fossilFuels, burning.',
    parts: ["atmosphere", "plants", "animals", "ocean", "decay", "fossilFuels", "burning"],
    // Plants, animals, decay, the ocean and burning fossil fuels are all drawn.
    fits: (scene) => /\bcarbon cycle\b/i.test(scene.source) || (/\bcarbon\b/i.test(scene.source) && /\bplants?\b/i.test(scene.source) && /\b(fossil fuels?|burn\w*)\b/i.test(scene.source)),
    options: {},
  }),
  eclipse: labelDiagram({
    name: "eclipse",
    plan: "an eclipse: the Sun, the Moon and the Earth lining up, with the Moon's shadow on the Earth, or the Moon in the Earth's shadow",
    prompt: '"eclipse" when the narration explains an eclipse. "eclipseKind" is "solar" when the Moon blocks the Sun, "lunar" when the Moon passes into the Earth\'s shadow, as the narration says. "labels" names the parts: sun, moon, earth, shadow, totality.',
    parts: ["sun", "moon", "earth", "shadow", "totality"],
    fits: (scene) => /\beclipses?\b/i.test(scene.source),
    options: { eclipseKind: z.enum(["solar", "lunar"]) },
    cue: /\b(totality|total|blocks?|covers?)\b/i,
    check: (visual, { source }) => {
      // The view from the ground always shows a total solar eclipse.
      if (visual.eclipseKind === "solar" && /\b(partial|annular)\b/i.test(source) && !/\btotal\w*/i.test(source)) return ["This drawing shows a total eclipse, and the narration speaks of a partial or annular one."];
      const solar = /\b(solar eclipse|moon (blocks|covers|passes in front of) the sun)\b/i.test(source);
      const lunar = /\b(lunar eclipse|earth'?s shadow)\b/i.test(source);
      if (visual.eclipseKind === "solar" && lunar && !solar) return ['The narration speaks of a lunar eclipse. Give "eclipseKind" "lunar".'];
      if (visual.eclipseKind === "lunar" && solar && !lunar) return ['The narration speaks of a solar eclipse. Give "eclipseKind" "solar".'];
      return [];
    },
    // The template calls the kind of eclipse "kind".
    params: ({ eclipseKind, ...params }) => ({ ...params, kind: eclipseKind }),
  }),
  black_hole: labelDiagram({
    name: "black_hole",
    plan: "a big star collapsing into a black hole, with a glowing disk of matter swirling round it and light bending at its edge",
    prompt: '"black_hole" when the narration explains black holes. "fromStar" is true only when the narration tells how a star collapses into one. "labels" names the parts: star, collapse, supernova, blackHole, eventHorizon, disk.',
    parts: ["star", "collapse", "supernova", "blackHole", "eventHorizon", "disk"],
    // A disk of matter and light bending round it are always drawn.
    fits: (scene) => /\bblack holes?\b/i.test(scene.source) && /\b(light|gravity|matter|disk|disc|gas|absorb\w*|swallow\w*|collaps\w*)\b/i.test(scene.source),
    options: { fromStar: z.boolean() },
    cue: /\b(collaps\w*|implod\w*)\b/i,
    // The collapse ends in a supernova flash, so the narration must tell both.
    check: (visual, { source }) =>
      visual.fromStar === true &&
      (!(/\b(collaps\w*|runs? out of fuel|dying star|implod\w*)\b/i.test(source) && /\b(supernova\w*|explod\w*|explosion)\b/i.test(source)) ||
        /\b(without|no) (a )?supernova/i.test(source))
        ? ['The narration does not tell how a star collapses and explodes. Give "fromStar" false.']
        : [],
  }),
  rocket_launch: template({
    signature: true,
    family: "picture",
    plan: "a rocket lifting off, turning over toward orbit and dropping its first stage",
    prompt: '"rocket_launch" when the narration explains how a rocket reaches orbit: liftoff, the turn toward orbit and the stages separating. "stages" is how many stages the narration speaks of (1 to 3). Optional labels in the narration\'s words, each at most 4 words: "stageLabels" (a name for each stage, bottom first, or empty), "liftoff", "separation" and "orbit".',
    schema: z.object({
      kind: z.literal("rocket_launch"),
      stages: z.number().int(),
      stageLabels: z.array(z.string()).max(3),
      liftoff: z.string().optional(),
      separation: z.string().optional(),
      orbit: z.string().optional(),
    }),
    fits: (scene) => /\brockets?\b/i.test(scene.narration) && /\borbit\w*/i.test(scene.narration),
    shown: (visual) => [...visual.stageLabels, visual.liftoff, visual.separation, visual.orbit].map((text) => ({ text, words: 4, optional: true })),
    check: (visual, { source }) => [
      ...(visual.stages >= 1 && visual.stages <= 3 ? [] : ["A rocket here has 1 to 3 stages."]),
      ...(visual.stages > 1 && !/\bstages?\b/i.test(source) ? ["The narration does not speak of stages. Give 1 stage."] : []),
    ],
    repair: (visual, keep) => ({
      ...visual,
      stages: Math.max(1, Math.min(3, visual.stages)),
      // The names go bottom stage first, so they are kept only all together.
      stageLabels: visual.stageLabels.every((text) => keep(text, 4)) ? visual.stageLabels : [],
      liftoff: keep(visual.liftoff, 4) ? visual.liftoff : undefined,
      separation: keep(visual.separation, 4) ? visual.separation : undefined,
      orbit: keep(visual.orbit, 4) ? visual.orbit : undefined,
    }),
    params: ({ kind, ...params }, { narration }) => {
      void kind;
      return { ...cueAt(narration, /\b(separat\w*|jettison\w*|detach\w*)\b/i), ...params };
    },
  }),
  engine_cycle: template({
    signature: true,
    family: "picture",
    plan: "a four-stroke petrol engine: the piston moving, the valves opening, the spark and the exhaust, one stroke after another",
    prompt: '"engine_cycle" when the narration explains how a piston engine works: "strokes" are the names of its four strokes in order (intake, compression, power, exhaust) as the narration names them, or empty; optional "parts" labels in its words, each at most 4 words: intakeValve, exhaustValve, sparkPlug, piston, rod, crankshaft, fuelAir, exhaustGas.',
    schema: z.object({
      kind: z.literal("engine_cycle"),
      strokes: z.array(z.string()).max(4),
      parts: z.object({
        intakeValve: z.string().optional(),
        exhaustValve: z.string().optional(),
        sparkPlug: z.string().optional(),
        piston: z.string().optional(),
        rod: z.string().optional(),
        crankshaft: z.string().optional(),
        fuelAir: z.string().optional(),
        exhaustGas: z.string().optional(),
      }),
    }),
    fits: (scene) =>
      /\bpistons?\b/i.test(scene.narration) && /\b(strokes?|four-stroke|spark\w*)\b/i.test(scene.narration) && !/\b(steam|diesel)\b/i.test(scene.narration),
    shown: (visual) => [...visual.strokes, ...Object.values(visual.parts)].map((text) => ({ text, words: 4, optional: true })),
    check: (visual) => (visual.strokes.length === 0 || visual.strokes.length === 4 ? [] : ["Name all four strokes, or none."]),
    repair: (visual, keep) => ({
      ...visual,
      strokes: visual.strokes.length === 4 && visual.strokes.every((text) => keep(text, 4)) ? visual.strokes : [],
      parts: Object.fromEntries(Object.entries(visual.parts).filter(([, text]) => keep(text, 4))),
    }),
  }),
};

export type TemplateName = keyof typeof TEMPLATES;
export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[];
export const isTemplateName = (name: string): name is TemplateName => Object.hasOwn(TEMPLATES, name);

// A template's reply, loosely typed, for code that handles every template the same way.
export type TemplateVisual = { kind: TemplateName } & Record<string, unknown>;

// The spec of a template, typed loosely so any template's reply fits. The methods are checked against their own
// template's schema above; here they take any reply, which is safe because a reply is always parsed with the schema
// of its own kind first.
type AnyTemplate = Omit<Template<z.ZodObject>, "shown" | "check" | "repair" | "params"> & {
  shown(visual: TemplateVisual): Shown[];
  check?(visual: TemplateVisual, context: CheckContext): string[];
  repair?(visual: TemplateVisual, keep: Keep, context: CheckContext): TemplateVisual | null;
  params?(visual: TemplateVisual, extra: Extra): Record<string, unknown>;
};
export const templateSpec = (name: TemplateName) => TEMPLATES[name] as unknown as AnyTemplate;

// The params the template is drawn with: its own mapping, or the reply without its kind.
export function templateParams(visual: TemplateVisual, extra: Extra): Record<string, unknown> {
  const spec = templateSpec(visual.kind);
  if (spec.params) return spec.params(visual, extra);
  const { kind, ...params } = visual;
  void kind;
  return params;
}
