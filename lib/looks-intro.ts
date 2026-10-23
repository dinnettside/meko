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

// Words that say nothing on their own, in English and Norwegian, so a subtitle that only asks the heading again is
// found: "How do volcanoes erupt?" under "How Volcanoes Erupt".
const SMALL_WORDS = new Set(
  (
    "how why what when where who which do does did is are was were the a an of to in and it its " +
    "hva hvem hvordan hvorfor hvor hvilken hvilke hvilket når er var det en et ei og i på av som har"
  ).split(" "),
);
const ownWords = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !SMALL_WORDS.has(word));
// A heading that asks rather than states, as in "How Volcanoes Erupt" or "Hvorfor himmelen er blå".
const ASKS = /^(?:how|why|what|when|where|who|which|hvordan|hvorfor|hvilken|hvilke|hvilket|hva|hvem|hvor|når)(?!\p{L})/iu;
// Past forms that do not start with their verb, so "How the Berlin Wall Fell" and "How did the Berlin Wall fall?" ask
// the same.
const PAST_FORMS: Record<string, string> = {
  fell: "fall", fallen: "fall", sank: "sink", sunk: "sink", began: "begin", begun: "begin", built: "build", broke: "break",
  broken: "break", won: "win", got: "get", gotten: "get", rose: "rise", risen: "rise", grew: "grow", grown: "grow",
  took: "take", taken: "take", made: "make", came: "come", went: "go", gone: "go", ran: "run", gave: "give",
  given: "give", knew: "know", known: "know", held: "hold", fought: "fight", brought: "bring", became: "become",
  struck: "strike", flew: "fly", flown: "fly", froze: "freeze", frozen: "freeze", wrote: "write", written: "write",
  sold: "sell", sent: "send", spent: "spend", stood: "stand", told: "tell", kept: "keep", caught: "catch",
};
// Number words, which an ending changes into another amount: "ten" is not "tens", nor "hundred" "hundreds".
const NUMBER_WORDS = new Set("three four five seven eight nine eleven twelve twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion dozen".split(" "));
// The same word in another form, like "pump" and "pumps", "change" and "changed" or "fell" and "fall". A figure, a
// number word or a word under four letters only matches itself, so "10" is not "100", "no" is not "not" and "man" is
// not "many", and only an ending that inflects counts, so "cold" is not "colder".
const sameWord = (a: string, b: string) => {
  const [x, y] = [PAST_FORMS[a] ?? a, PAST_FORMS[b] ?? b];
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 4 || /\d/.test(long) || NUMBER_WORDS.has(short)) return false;
  const stem = short.endsWith("y") ? `${short.slice(0, -1)}i` : short;
  return [`${short}s`, `${short}es`, `${short}d`, `${short}ed`, `${stem}es`, `${stem}ed`].includes(long);
};

// The subheading, unless it only asks a heading that asks again with the same question word: then an opening shows
// the heading alone. Any other subheading stays, since "Was Napoleon short?" under "Napoleon Was Short", or "Do
// vaccines cause autism?" under "Why Vaccines Cause Autism", is what keeps the opening from showing a myth as a fact.
// The video's own title card (remotion/scenes/TitleScene.tsx) uses it too.
export function subtitleFor(heading: string, subheading?: string): string {
  const subtitle = subheading?.trim() ?? "";
  const asks = heading.trim().match(ASKS)?.[0].toLowerCase();
  if (!asks || subtitle.match(ASKS)?.[0].toLowerCase() !== asks) return subtitle;
  const words = ownWords(heading);
  return ownWords(subtitle).some((word) => !words.some((other) => sameWord(word, other))) ? subtitle : "";
}

// Small words before a number that it needs to stay true, so they stay with it: "over 1,500 years" is not "1,500 years".
const QUALIFIERS = String.raw`more than|less than|fewer than|at least|up to|just over|just under|over|under|about|around|nearly|almost|roughly|some|approximately|only|just`;
// A number in a sentence: a small word it needs, a currency sign, the number, a scale word, and the word after it,
// joined by a hyphen ("363-foot"), a space ("1,500 years", "25 million people") or nothing ("45%"). Whether that word
// is the number's unit is decided in numberHook. Not a number after a minus sign or inside a name like "A380" or
// "PM2.5", an ordinal like "15th" or a decade like "1960s", one whose digits touch a slash or a colon, as in "9/11" or
// "10:45", or a group of digits after other digits and a space, as in "25 148 km", where Norwegian and SI style group
// thousands. The scale word and the unit must be whole words, so "26 billionaires" is not "26 billion" and "people's"
// is not "people", and no word that goes on, like "50-year-old" or "km/h", counts. A unit may end in ², ³, 2 or 3, as
// in "km²" or "km2".
const NUMBER_PHRASE = new RegExp(
  String.raw`(?:\b(${QUALIFIERS})\s+)?(?<![\p{L}\d.,\-−–$£€¥/:])(?<!\d\s)([$£€¥])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d/:]|,\d|\p{L})(\s+(?:million|billion|trillion|thousand)(?![\p{L}\p{N}'’²³\-]))?(?:(%)|(-|\s+)([A-Za-z]+[²³23]?)(?![\p{L}\p{N}'’²³/\-]))?`,
  "giu",
);
// Words that measure, which a number shows as its unit: "1,500 years", "363-foot", "100,000 times", "799 dollars".
const MEASURES = new Set(
  (
    "year years month months week weeks day days hour hours minute minutes second seconds decade decades century centuries " +
    "mile miles km kilometer kilometers kilometre kilometres meter meters metre metres cm centimeter centimeters centimetre " +
    "centimetres mm millimeter millimeters millimetre millimetres foot feet ft inch inches ton tons tonne tonnes pound pounds " +
    "kg kilogram kilograms degree degrees times percent dollars euros yuan"
  ).split(" "),
);
// Words that count people or things, as lib/numbers.ts does. A number shows one as its unit only when it is plainly an
// amount, since a name's number comes before them too: "Apollo 13 men", "Flight 93 victims", "the 737 workers".
const COUNTED = new Set("people persons men women children dead soldiers troops ships sailors deaths cases victims prisoners workers villages towns cities".split(" "));
// Whether a word is one of the measures above, also squared or cubed, as in "km²" or "km2". Only as written in lower
// case, since a capital marks a name: "the 100 Years War", "Napoleon's 100 Days", "the 24 Hours of Le Mans".
const measures = (word: string) => MEASURES.has(word.replace(/[²³23]$/, ""));
// Whether a word after a space is a plural noun ("400 passengers", "300 soldiers"), and not a verb like "carried" or a
// small word like "on" or "was". A verb can end in s too ("runs"), so numberHook takes one only after a number that is
// plainly an amount.
const isPlural = (word: string, joiner: string) => joiner !== "-" && (COUNTED.has(word) || (/^[a-z]{3,}s$/.test(word) && !/(?:ss|us|is)$/.test(word)));
// Qualifiers that also come before a name's number, as in "some 737 workers" or "only 747 jets", so they never show
// that a number is an amount.
const NOT_AMOUNT = /^(?:some|only|just)$/i;
// The word right before a number, with only a space between them.
const wordBefore = (before: string) => before.match(/([\p{L}\p{N}'’]+)\s+$/u)?.[1] ?? "";
// Whether a number after these words may be a name, like a plane's or a phone's: "the 747", "their 737 jets", "two
// 747 jets", "Boeing's 737", "iPhone 15", "iOS 17".
const mayBeName = (before: string) =>
  /\b(?:a|an|the|its|their|his|her|our|my|your|this|that|these|those|all|both|each|every|several|many|one|two|three|four|five|six|seven|eight|nine|ten)\s+$/i.test(before) ||
  /(?:\p{L}['’]s|(?<!\p{L})\p{Ll}+\p{Lu}\p{L}*)\s+$/u.test(before);
// The measure after "square" or "cubic": "24 million square kilometers".
const NEXT_WORD = /^\s+([A-Za-z]+[²³23]?)(?![\p{L}\p{N}'’²³/\-])/u;
// The scale after "degrees": "50 degrees Celsius".
const TEMPERATURE = /^\s+(Celsius|Fahrenheit|Kelvin|C|F)(?![\p{L}\p{N}])/iu;
// A dash or a second number after the number, in figures or words, also after a comma. The number is then one end of
// a range, as in "25 million–50 million", "25 million to fifty million" or "46 years, or 47", or a dash sets off words
// that change it, as in "20 years – some say 30 years –", and the opening would cut them.
const GOES_ON = new RegExp(
  String.raw`^\s*,?\s*(?:[-–—]|(?:to|or|and|through|until)\s+(?:(?:${QUALIFIERS})\s+)?(?:[$£€¥]?\d|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\p{L}+teen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(?!\p{L})))`,
  "iu",
);
// The rest of a unit the opening would cut: a word that goes on with a slash, a power, a figure or a hyphen ("5
// million km/h", "m2", "year-old"), or "square", "cubic" or a temperature scale that did not join it.
const UNIT_GOES_ON = /^(?:[/²³]|\s+(?:\p{L}+[\d/²³\-]|(?:square|cubic|celsius|fahrenheit|kelvin)(?!\p{L})))/iu;
// A number right after one of these is a part, a ratio or the end of a range, which it does not say on its own:
// "1 in 3", "2 out of 5", "from 30 to 60", "25 million – 50 million".
const PART_BEFORE = /(?:\b(?:in|of|per|to|and|or|from|between|every)|[-–—])\s*$/i;
// A clause's first word, which adds nothing when it stands alone over the number: "For" in "For over 1,500 years",
// "a" in "a 363-foot rocket".
const LEAD_IN = /^(?:a|an|the|for|in|at|on|during|across|of|from)$/i;
// A clause's first word that bounds the number, so it goes with it: "24 hours" is not "Within 24 hours", nor "28 years"
// "After 28 years".
const BOUND = /^(?:within|after|before|since|until|till|by)$/i;
// The only part of the narration the opening may leave out after its label: nothing, or one last clause of the same
// sentence that gives another measure of the same thing, as in ", spanning 6,400 kilometers." Anything else may change
// what the number means, like ", the paper reported", ", at least", ", climbing to 3,000", ", using 2020 dollars" or a
// second sentence that corrects it, and no list of such words is ever complete.
const SPANNING = "spanning|covering|stretching|measuring|weighing|lasting";
const LEFT_OUT = new RegExp(
  String.raw`^\s*(?:,\s*(?:${SPANNING})\s+(?:(?:${QUALIFIERS})\s+)?[$£€¥]?\d(?:[^,.!?;:—–]|[,.](?=\d))*)?[.!]?\s*$`,
  "u",
);
// The figures of a text, with their separators: "1,500", "4.5", and "25 148" as two.
const FIGURES = /\d+(?:[.,]\d+)*/g;
// That last clause, whose figure is the only second figure an opening allows.
const SPAN_CLAUSE = new RegExp(String.raw`,\s*(?:${SPANNING})\b[^.!?;]*[.!]?\s*$`, "u");
// Words that take some away from a number, so the number alone says the opposite: "All but 3 of the 12 crew survived",
// "Everyone except 2 passengers survived".
const EXCLUDES = /\b(?:all but|except|excepting|excluding|apart from|aside from|other than|besides|save for|unntatt|bortsett fra|utenom)\b/i;
// Words in that one clause that still deny, doubt, attribute or limit what the sentence says, in English and
// Norwegian: ", spanning 6,400 kilometers by some estimates", ", assuming 2% growth".
const DOUBTS = new Set(
  (
    "not no never none nobody nothing neither nor without cannot though although but however yet unless except if may " +
    "might could possibly perhaps maybe probably likely unlikely reportedly allegedly supposedly apparently estimate " +
    "estimates estimated say says said claim claims claimed according believe believes believed think thinks thought " +
    "suggest suggests suggested argue argues argued doubt doubts doubted dispute disputes disputed contested debated myth " +
    "myths legend false wrong assuming excluding counting ignoring ikke ingen intet aldri uten men kanskje muligens trolig " +
    "sannsynligvis antakelig ifølge sier sa mener tror hevder påstår omstridt myte"
  ).split(" "),
);
const doubts = (text: string) => (text.toLowerCase().match(/[\p{L}'’]+/gu) ?? []).some((word) => DOUBTS.has(word) || /n['’]t$/.test(word));
// The digits TemplateScene listens for in a text (listenFor in remotion/spoken.ts): each run of digits without its
// thousands separators, and the first five digits of a longer run.
const digitsOf = (text: string) =>
  (text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []).flatMap((run) => (run.length > 5 ? [run, run.slice(0, 5)] : [run]));

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

type NumberHook = { value: number; decimals: number; sign: string; prefix: string; suffix: string; lead: string; label: string; at?: string };

// The first number the opening narration states with its unit, like "over 1,500 years", "363-foot" or "$4.5 billion",
// with the words of its clause around it, so it reads as the narration says it: "The Black Death killed" over "about
// 25 million people" and "in just five years" under it. Years, dates, names like "Apollo 11" or "the 747", ranges and
// parts like "1 in 3" are left out, since the number alone would say something else, and so is a number whose
// sentence goes on in a way the opening would cut (see LEFT_OUT). `at` is the number as the narration writes it, so it
// lands as it is said (see TIMING_KEYS in remotion/scenes/TemplateScene.tsx).
function numberHook(narration: string): NumberHook | undefined {
  // A question mark anywhere may doubt the number, as in "You use only 10% of your brain?", and quotation marks make
  // it someone's words. The opening would show it as a plain fact, so it is not offered.
  if (/[?"“”«»]/.test(narration)) return undefined;
  // One figure only. A second number may bound, split, correct or replace the first ("25 million–50 million", "2 hours
  // 40 minutes", "25 of Europe's 75 million", "1,200 people, climbing to 3,000"), and no list of rules catches every
  // way, so the opening is only offered when the number stands alone, or with another measure of it in a last clause.
  const second = (narration.match(SPAN_CLAUSE)?.[0].match(FIGURES) ?? []).length;
  if ((narration.match(FIGURES) ?? []).length - second > 1 || EXCLUDES.test(narration)) return undefined;
  const ranges = rangesIn(narration);
  for (const match of narration.matchAll(NUMBER_PHRASE)) {
    const [phrase, qualifier, sign, digits, fraction, scale, percent, joiner, word] = match;
    const start = match.index ?? 0;
    const before = narration.slice(0, start);
    const value = Number(`${digits.replace(/,/g, "")}${fraction ?? ""}`);
    let end = start + phrase.length;
    // "minus 40 degrees" is not 40 degrees, and neither is "− 40" or "‑40" with any dash.
    if (/(?:\b(?:minus|negative)|[-−‑‐‒–—﹣－])\s*$/iu.test(before)) continue;
    // A four-digit number without a separator may be a year, as in "By 1900 miles of track had been laid", and the
    // opening would add a comma the narration never wrote, which in Norwegian reads as a decimal point ("2,469 meter").
    if (/^\d{4,}$/.test(digits) && value >= 1000) continue;
    // "45 percent" and "45 per cent" are shown as "45%", like the stat scenes do.
    const cent = /^per$/i.test(word ?? "") ? narration.slice(end).match(/^\s+cent\b/i) : null;
    if (cent) end += cent[0].length;
    const isPercent = Boolean(percent) || Boolean(cent) || /^percent$/i.test(word ?? "");
    // A measure is the number's unit. A plural noun is its unit only after a number that is plainly an amount, with a
    // thousands separator or a scale word, since a bare number before one is often a name, as in "two 747 jets",
    // "Apollo 13 men" or "about 747 pilots", and the word may be a verb, as in "iOS 17 runs". A counted word may also
    // take a small word like "over" instead: "over 300 soldiers". After a word like "the", "their" or "Boeing's", or a
    // name like "iPhone", the amount needs a scale word.
    const amount = Boolean(scale || digits.includes(",") || (qualifier && !NOT_AMOUNT.test(qualifier) && COUNTED.has(word ?? "")));
    let unitWord: string | undefined;
    if (word && !isPercent) {
      if (/^(?:square|cubic)$/.test(word)) {
        // "Square" and "cubic" are half a unit and take the measure after them: "24 million square kilometers".
        const measure = narration.slice(end).match(NEXT_WORD);
        if (!measure || !measures(measure[1])) continue;
        unitWord = `${word} ${measure[1]}`;
        end += measure[0].length;
      } else if (measures(word)) unitWord = word;
      else if (amount && (scale || !mayBeName(before)) && isPlural(word, joiner)) unitWord = word;
      // A word that is not the unit stays in the text after the number: "25 million in Europe alone".
      else end -= joiner.length + word.length;
    }
    // A number right after a capitalised word, other than one that leads a clause in like "For" or "Within", is often
    // part of a name, as in "Apollo 13 days" or "Route 66 miles", unless a separator or scale word shows it is an amount.
    const named = wordBefore(before);
    if (/\p{Lu}/u.test(named) && !LEAD_IN.test(named) && !BOUND.test(named) && !isPercent && !scale && !digits.includes(",")) continue;
    // Degrees take their scale: "50 degrees Celsius".
    const scaleOf = unitWord && /^degrees?$/i.test(unitWord) ? narration.slice(end).match(TEMPERATURE) : null;
    if (scaleOf) {
      unitWord = `${unitWord} ${scaleOf[1]}`;
      end += scaleOf[0].length;
    }
    let unit = isPercent ? "%" : [scale?.trim(), unitWord].filter(Boolean).join(" ");
    // A word that belongs to the measure stays with it: "66 million years ago", "363 feet tall".
    const stays = unit && !isPercent ? narration.slice(end).match(/^\s+(ago|old|long|tall|high|wide|deep)\b/i) : null;
    if (stays) {
      unit = `${unit} ${stays[1]}`;
      end += stays[0].length;
    }
    if (!unit || !(value > 0) || PART_BEFORE.test(before)) continue;
    // A range, a dash or the rest of a unit after the number would be cut.
    const rest = narration.slice(end);
    if (GOES_ON.test(rest) || UNIT_GOES_ON.test(rest)) continue;
    // The opening plays out in its first seconds (OPENING_SEC in remotion/StoryboardVideo.tsx), so a number said after
    // more than about six words would count up before the voice gets to it.
    if (wordCount(before) + wordCount(qualifier ?? "") > 6) continue;
    // A whole number under 10 does not count up, and the word after it is often not its unit, as in "3 great voyages".
    if (value < 10 && !scale && !fraction && !isPercent) continue;
    if (isDateIn(value, narration) || isNameNumber(value, narration) || ranges.some((range) => range.low === value || range.high === value)) continue;
    // The words of its clause before the number go over it and the words after it under it. A number that leads its
    // sentence in, as in "For over 1,500 years, a vast network of routes ...", is explained by the clause after it.
    const opening = lastClauseOf(before);
    // The number lands as it is said, so a number said after another clause, as in "On July 16, 1969, a 363-foot
    // rocket", would leave the frame nearly empty for seconds. A short start like "In 1347," is fine.
    if (wordCount(before) - wordCount(opening) > 3) continue;
    // Words in a clause before the number's own say what the number depends on or when it held ("Each year,",
    // "Without vaccines,", "In 1800,"), so they stay over it with its clause.
    const earlier = before.slice(0, before.lastIndexOf(opening)).trim();
    const shown = earlier ? before.trim() : opening;
    const bound = BOUND.test(shown) ? shown : "";
    const lead = bound || LEAD_IN.test(shown) ? "" : shown;
    const label = clauseOf(rest) || (!lead && /^\s*,/.test(rest) ? clauseOf(rest.replace(/^\s*,/, "")) : "");
    if ((!lead && !label) || wordCount(lead) > 7 || wordCount(label) > 14) continue;
    // What the opening leaves out after its label must not change what it shows.
    const leftOut = label ? rest.slice(rest.indexOf(label) + label.length) : rest;
    if (!LEFT_OUT.test(leftOut) || doubts(leftOut)) continue;
    // A unit joined to the number in the narration stays joined: "363-foot", "45%". Scale words come with a space.
    const suffix = isPercent ? "%" : joiner === "-" && !scale ? `-${unit}` : ` ${unit}`;
    const said = `${digits}${fraction ?? ""}`;
    // TemplateScene finds `at` among the narration's words by its digits, so when the narration says one of them
    // earlier, as the "7" of "8.7" in "For 7 decades, Earth held 8.7 million species", the count would land early. It
    // then starts at once instead.
    const early = digitsOf(before).some((run) => digitsOf(said).includes(run));
    const prefix = [bound, qualifier].filter(Boolean).join(" ");
    return { value, decimals: fraction ? fraction.length - 1 : 0, sign: sign ?? "", prefix, suffix, lead, label, ...(early ? {} : { at: said }) };
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
