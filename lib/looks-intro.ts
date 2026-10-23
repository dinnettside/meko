import { isIconName } from "./icons.ts";
import type { Look } from "./looks.ts";
import { isDateIn, isNameNumber, rangesIn, yearsIn } from "./numbers.ts";
import type { Scene } from "./storyboard.ts";

// What an opening may draw on: the question the video answers when the narration backs it, the years its opening
// narration spans, and whether the video has maps.
export type IntroContext = { question?: string; years?: [number, number]; places: boolean };

// More ways to open a video, drawn by the templates in remotion/filmmotor/templates/intros.js. An opening shows only
// the title scene's own words, and words and numbers its narration says word for word.
export function moreIntroLooks(scene: Extract<Scene, { kind: "title" }>, context: IntroContext): Look[] {
  // These openings need only the title scene itself.
  void context;
  const title = scene.heading.trim();
  const subtitle = subtitleFor(scene.heading, scene.subheading);
  const icon = scene.icon && isIconName(scene.icon) ? scene.icon : undefined;
  const looks: Look[] = [];
  if (icon) looks.push({ template: "icon_hero", params: { icon, title, subtitle } });
  // The split opening has half the frame for its words, so a long heading would get small there.
  if (icon && title.length <= 60) looks.push({ template: "split_title", params: { icon, title, subtitle } });
  const number = numberHook(scene.narration);
  if (number) looks.push({ template: "number_hook", params: { ...number, title } });
  const date = dateHook(scene.narration);
  if (date) looks.push({ template: "date_hook", params: { ...date, title } });
  if (title.split(/\s+/).length <= 8) looks.push({ template: "headline_words", params: { title, subtitle } });
  return looks;
}

// Words that say nothing on their own, so a subtitle that only asks the heading again is found: "How do volcanoes
// erupt?" under "How Volcanoes Erupt".
const SMALL_WORDS = new Set("how why what when where who which do does did is are was were the a an of to in and it its".split(" "));
const ownWords = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !SMALL_WORDS.has(word));
// The same word in another form, like "pump" and "pumps" or "change" and "changed".
const sameWord = (a: string, b: string) => {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && long.length - short.length <= 2;
};

// The subheading, unless it only says the heading again: then an opening shows the heading alone. The video's own
// title card (remotion/scenes/TitleScene.tsx) uses it too.
export function subtitleFor(heading: string, subheading?: string): string {
  const subtitle = subheading?.trim() ?? "";
  const words = ownWords(heading);
  return ownWords(subtitle).some((word) => !words.some((other) => sameWord(word, other))) ? subtitle : "";
}

// Small words before a number that it needs to stay true, so they stay with it: "over 1,500 years" is not "1,500 years".
const QUALIFIERS = String.raw`more than|less than|fewer than|at least|up to|just over|just under|over|under|about|around|nearly|almost|roughly|some|approximately|only|just`;
// A number in a sentence: a small word it needs, a currency sign, the number, a scale word, and the word after it,
// joined by a hyphen ("363-foot"), a space ("1,500 years", "25 million people") or nothing ("45%"). Whether that word
// is the number's unit is decided in numberHook. Not a number after a minus sign or inside a name like "A380" or
// "PM2.5", an ordinal like "15th" or a decade like "1960s". The scale word and the unit must be whole words, so
// "26 billionaires" is not "26 billion" and "people's" is not "people", and no word that goes on, like "50-year-old" or
// "km/h", counts. A unit may end in ² or ³, as in "km²".
const NUMBER_PHRASE = new RegExp(
  String.raw`(?:\b(${QUALIFIERS})\s+)?(?<![\p{L}\d.,\-−–$£€¥])([$£€¥])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d,]\d|\p{L})(\s+(?:million|billion|trillion|thousand)(?![\p{L}\p{N}'’²³\-]))?(?:(%)|(-|\s+)([A-Za-z]+[²³]?)(?![\p{L}\p{N}'’²³/\-]))?`,
  "giu",
);
// Words that measure or count, which a number shows as its unit: "1,500 years", "363-foot", "100,000 times".
const UNIT_WORDS = new Set(
  "year years month months week weeks day days hour hours minute minutes second seconds century centuries mile miles km kilometer kilometers kilometre kilometres meter meters metre metres foot feet ft inch inches ton tons tonne tonnes pound pounds kg kilogram kilograms degree degrees times percent dollars euros yuan people men women children dead".split(
    " ",
  ),
);
// Whether a word is one of the measures above, also squared or cubed, as in "km²".
const measures = (word: string) => UNIT_WORDS.has(word.toLowerCase().replace(/[²³]$/, ""));
// Whether the word after a number is its unit: a word above, or any other plural noun after a space ("400
// passengers"), but not a verb like "carried" or a small word like "on" or "was".
const isUnit = (word: string, joiner: string) => measures(word) || (joiner !== "-" && /^[a-z]{3,}s$/.test(word) && !/(?:ss|us|is)$/.test(word));
// A number right after one of these is a part, a ratio or the end of a range, which it does not say on its own:
// "1 in 3", "2 out of 5", "from 30 to 60".
const PART_BEFORE = /\b(in|of|per|to|and|or|from|between|every)\s*$/i;
// A clause's first word, which adds nothing when it stands alone over the number: "For" in "For over 1,500 years",
// "a" in "a 363-foot rocket".
const LEAD_IN = /^(?:a|an|the|for|in|by|within|after|at|on|during|across|of|from)$/i;
// A clause that only says when: "In 1347,", "By the 1500s,", "In the 14th century,".
const YEAR_ONLY = /^(?:in|by|around|since|until|from)\s+(?:the\s+)?(?:\d{3,4}s?|\d{1,2}(?:st|nd|rd|th)\s+century)\s*[,;:—–-]?$/i;

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
// The comma between a date and its year, as in "July 16, 1969", which does not end a clause.
const DATE_COMMA = new RegExp(String.raw`\b(?:${MONTHS})\s+\d{1,2}(?:st|nd|rd|th)?,(?=\s*\d)`, "g");
// The end of a clause: a comma, colon, dash or full stop, but not a comma or point inside a number, or the point after
// an initial, as in "44 B.C." or "U.S.".
const CLAUSE_END = /[;:!?—–]|,(?!\d)|(?<!\b[A-Z])\.(?!\d)/g;
// Where the clauses of a text end, as offsets. A date's comma is blanked out first, so it does not count.
const clauseEnds = (text: string) => [...text.replace(DATE_COMMA, (date) => date.replace(",", " ")).matchAll(CLAUSE_END)].map((end) => end.index ?? 0);
// The first clause of a text, and the last one, which is the part of its clause just before where the text ends.
const clauseOf = (text: string) => {
  const end = clauseEnds(text)[0];
  return (end === undefined ? text : text.slice(0, end)).trim();
};
const lastClauseOf = (text: string) => {
  const ends = clauseEnds(text);
  return (ends.length === 0 ? text : text.slice(ends[ends.length - 1] + 1)).trim();
};
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

type NumberHook = { value: number; decimals: number; sign: string; prefix: string; suffix: string; lead: string; label: string; at: string };

// The first number the opening narration states with its unit, like "over 1,500 years", "363-foot" or "$4.5 billion",
// with the words of its clause around it, so it reads as the narration says it: "The Black Death killed" over "about
// 25 million people" and "in just five years" under it. Years, dates, names like "Apollo 11", ranges and parts like
// "1 in 3" are left out, since the number alone would say something else. `at` is the number as the narration writes
// it, so it lands as it is said (see TIMING_KEYS in remotion/scenes/TemplateScene.tsx).
function numberHook(narration: string): NumberHook | undefined {
  const ranges = rangesIn(narration);
  for (const match of narration.matchAll(NUMBER_PHRASE)) {
    const [phrase, qualifier, sign, digits, fraction, scale, percent, joiner, word] = match;
    const start = match.index ?? 0;
    const before = narration.slice(0, start);
    const value = Number(`${digits.replace(/,/g, "")}${fraction ?? ""}`);
    let end = start + phrase.length;
    // "45 percent" and "45 per cent" are shown as "45%", like the stat scenes do.
    const cent = /^per$/i.test(word ?? "") ? narration.slice(end).match(/^\s+cent\b/i) : null;
    if (cent) end += cent[0].length;
    const isPercent = Boolean(percent) || Boolean(cent) || /^percent$/i.test(word ?? "");
    // A number right after "a" or "the", or after a name's "'s", with a word after it that is not a measure is often a
    // name: "the 747 carried", "Boeing's 737 jets".
    const mayBeName = /\b(?:a|an|the)\s+$/i.test(before) || /\p{Lu}\p{L}*['’]s\s+$/u.test(before);
    const unitWord = word && !isPercent && isUnit(word, joiner) && (measures(word) || !mayBeName) ? word : undefined;
    // A word that is not the unit stays in the text after the number: "25 million in Europe alone".
    if (word && !isPercent && !unitWord) end -= joiner.length + word.length;
    let unit = isPercent ? "%" : [scale?.trim(), unitWord].filter(Boolean).join(" ");
    // A word that belongs to the measure stays with it: "66 million years ago", "363 feet tall".
    const stays = unit && !isPercent ? narration.slice(end).match(/^\s+(ago|old|long|tall|high|wide|deep)\b/i) : null;
    if (stays) {
      unit = `${unit} ${stays[1]}`;
      end += stays[0].length;
    }
    if (!unit || !(value > 0) || PART_BEFORE.test(before)) continue;
    // The opening plays out in its first seconds (OPENING_SEC in remotion/StoryboardVideo.tsx), so a number said after
    // more than about six words would count up before the voice gets to it.
    if (wordCount(before) + wordCount(qualifier ?? "") > 6) continue;
    // A whole number under 10 does not count up, and the word after it is often not its unit, as in "3 great voyages".
    if (value < 10 && !scale && !fraction && !isPercent) continue;
    if (isDateIn(value, narration) || isNameNumber(value, narration) || ranges.some((range) => range.low === value || range.high === value)) continue;
    // The words of its clause before the number go over it and the words after it under it. A number that leads its
    // sentence in, as in "For over 1,500 years, a vast network of routes ...", is explained by the clause after it.
    const rest = narration.slice(end);
    const opening = lastClauseOf(before);
    // The number lands as it is said, so a number said after another clause, as in "On July 16, 1969, a 363-foot
    // rocket", would leave the frame nearly empty for seconds. A short start like "In 1347," is fine.
    if (wordCount(before) - wordCount(opening) > 3) continue;
    // Words in a clause before the number's own often say what the number depends on ("Each year,", "Without
    // vaccines,"), so they stay over it with its clause. Only a bare year ("In 1347,") is left out.
    const earlier = before.slice(0, before.lastIndexOf(opening)).trim();
    const shown = !earlier || YEAR_ONLY.test(earlier) ? opening : before.trim();
    const lead = LEAD_IN.test(shown) ? "" : shown;
    const label = clauseOf(rest) || (!lead && /^\s*,/.test(rest) ? clauseOf(rest.replace(/^\s*,/, "")) : "");
    if ((!lead && !label) || wordCount(lead) > 7 || wordCount(label) > 14) continue;
    // A unit joined to the number in the narration stays joined: "363-foot", "45%". Scale words come with a space.
    const suffix = isPercent ? "%" : joiner === "-" && !scale ? `-${unit}` : ` ${unit}`;
    return { value, decimals: fraction ? fraction.length - 1 : 0, sign: sign ?? "", prefix: qualifier ?? "", suffix, lead, label, at: `${digits}${fraction ?? ""}` };
  }
  return undefined;
}

// A full date written in one piece, with the year right after the day and month: "July 16, 1969", "16 July 1969",
// "15 March 44 BC" or "24 August 79 AD".
const FULL_DATE = new RegExp(
  String.raw`\b(?:(${MONTHS})\s+(\d{1,2})(?:st|nd|rd|th)?,?|(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTHS}),?)\s+(?:in\s+)?(\d{1,4})(?![\d,.]?\d)(?:\s*(BCE|B\.C\.E\.|BC|B\.C\.|CE|C\.E\.|AD|A\.D\.)(?![A-Za-z]))?`,
  "g",
);

// The first full date the opening narration states, like "July 16, 1969". A day and month are never joined to a year
// said elsewhere in the text, as in "On July 20, astronauts walked on the Moon, eight years after Kennedy's 1961 speech",
// and the number after a date must be a year, not a count, as in "on July 20, 600 million people watched".
function dateHook(narration: string): { day: number; month: string; year: number } | undefined {
  const years = yearsIn(narration);
  for (const match of narration.matchAll(FULL_DATE)) {
    const [, monthFirst, dayAfter, dayFirst, monthAfter, digits, era] = match;
    const day = Number(dayAfter ?? dayFirst);
    const year = (era && era.startsWith("B") ? -1 : 1) * Number(digits);
    if (day >= 1 && day <= 31 && years.includes(year)) return { day, month: monthFirst ?? monthAfter, year };
  }
  return undefined;
}
