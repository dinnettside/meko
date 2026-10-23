import type { Look, LookContext } from "./looks.ts";
import { isDateIn, numbersIn } from "./numbers.ts";
import type { Scene } from "./storyboard.ts";

// More looks for the kinds of scene almost every video has, drawn by the templates in
// remotion/filmmotor/templates/looks-more.js. Like the looks in looks.ts, a look only redraws what the scene already
// shows, after the same checks; it adds no text or number of its own beyond fixed words like "Source".
export function moreLooksFor(scene: Scene, context: LookContext): Look[] {
  switch (scene.kind) {
    case "quote": {
      // Both have room for about five lines of a quote.
      if (scene.text.length > 180) return [];
      const params = { quote: scene.text, source: context.sourceTitle ?? "" };
      return [
        { template: "pull_quote", params },
        { template: "quote_marks_big", params },
      ];
    }
    case "list": {
      // A title and its detail longer than about 55 letters get small in a tile, as in a bullet list (looks.ts).
      if (scene.items.some((item) => (item.detail ? `${item.title}: ${item.detail}` : item.title).length > 55)) return [];
      // Icons only when every item has one, so the tiles match.
      const icons = scene.items.every((item) => item.icon);
      const items = scene.items.map(({ title, detail, icon }) => ({ title, ...(detail ? { detail } : {}), ...(icons ? { icon } : {}) }));
      const count = scene.items.length;
      return [
        ...(count >= 2 && count <= 4 ? [{ template: "tile_grid", params: { items } }] : []),
        // Numbers would say the items come in an order. As the last scene they only count the points the video made, as
        // the key takeaways in looks.ts do.
        ...(context.isLast && count >= 2 && count <= 6 ? [{ template: "numbered_rows", params: { items: items.map(({ title, detail }) => ({ title, ...(detail ? { detail } : {}) })) } }] : []),
      ];
    }
    case "text": {
      const lines = scene.lines.map((line) => line.trim()).filter(Boolean);
      if (lines.length === 1) {
        const text = lines[0];
        // A sentence of up to about two lines of big type.
        if (text.length > 120 || text.split(/\s+/).length < 2) return [];
        const highlight = markedPhrase(text);
        return [
          ...(highlight ? [{ template: "marker_statement", params: { text, highlight } }] : []),
          { template: "typewriter_statement", params: { text, ...(highlight ? { highlight } : {}) } },
        ];
      }
      // A few short lines are typed one under the other, the first one brighter, as in the scene's own drawing.
      return lines.length <= 3 && lines.every((line) => line.length <= 48) ? [{ template: "typewriter_statement", params: { text: lines.join("\n") } }] : [];
    }
    case "steps": {
      const count = scene.steps.length;
      if (count < 2 || count > 6) return [];
      const icons = scene.icons ?? [];
      const nodes = scene.steps.map((text, index) => ({ text, ...(icons.length === count && icons.every(Boolean) ? { icon: icons[index] } : {}) }));
      // A road gives each stop's words room above or below it, a stair only its own step's width: fewer and shorter
      // steps fit there. A step is 1440 / count pixels wide, less a margin, and all the labels get one size, so one word
      // too long for its step would shrink them all: a word takes up to about 20 pixels a letter at the smallest size in
      // the widest look.
      const longest = Math.max(...scene.steps.map((step) => step.length));
      const longestWord = Math.max(...scene.steps.flatMap((step) => step.split(/\s+/).map((word) => word.length)));
      const stair = longest <= (count <= 3 ? 48 : count === 4 ? 36 : 26) && longestWord <= Math.floor((1440 / count - 30) / 20);
      // A road's label may be as wide as two stops' share of 1560 pixels, less a margin, up to 560.
      const road = longest <= 48 && longestWord <= Math.floor(Math.min(560, (2 * 1560) / count - 50) / 20);
      return [
        ...(stair ? [{ template: "stair_steps", params: { nodes } }] : []),
        ...(road ? [{ template: "road_path", params: { nodes } }] : []),
      ];
    }
    case "stat": {
      // The same number as the big number in looks.ts: not a range, not a share of a total, and up to nine figures.
      if (scene.valueMax !== undefined || scene.total !== undefined || !Number.isFinite(scene.value) || Math.abs(scene.value) >= 1e9) return [];
      // A number JavaScript writes with an exponent, like 5e-7, has no decimals to count, and would roll up to 0.
      const decimals = decimalsOf(scene.value);
      if (decimals > 2 || /e/i.test(String(scene.value))) return [];
      // The number as the narration writes it ("650", "1,500"), so the wheels land as it is said.
      const said = [String(scene.value), scene.value.toLocaleString("en-US", { maximumFractionDigits: 2 })].find((form) =>
        new RegExp(`(?<![\\d.,])${form.replace(/[.,]/g, "\\$&")}(?!\\d|[.,]\\d)`).test(scene.narration),
      );
      return [{ template: "odometer", params: { value: scene.value, decimals, suffix: suffix(scene.unit), label: scene.label, ...(said ? { at: said } : {}) } }];
    }
    default:
      return [];
  }
}

// A unit as the suffix of a number, with the same rule as looks.ts: "45%" but "25 million".
const suffix = (unit?: string) => {
  const trimmed = unit?.trim() ?? "";
  if (trimmed === "") return "";
  return /^(%|percent|per cent)$/i.test(trimmed) ? "%" : ` ${trimmed}`;
};
const decimalsOf = (value: number) => (String(value).split(".")[1] ?? "").length;

// Small words a marked phrase neither starts nor ends with, since a highlight on them says nothing: articles,
// pronouns, prepositions, joining words, helping verbs and words that only hedge a number.
const SMALL_WORDS = new Set(
  (
    "a an the of in on at to for by with and or but nor so yet from into onto as than then if " +
    "it its they them their he him his she her we us our you your i my me this that these those who whom which what there " +
    "is are was were be been being has have had do does did will would can could may might must shall should " +
    "about around over under up more less nearly almost roughly some just only ever per"
  ).split(" "),
);
// Words that belong to the number before them, as in "4.5 billion" or "50 per cent".
const SCALE_WORDS = new Set("hundred thousand million billion trillion percent per cent".split(" "));
// Words that deny or hedge what a sentence says, in English and Norwegian. A highlight that left one out would sweep
// over the claim the sentence denies or only supposes: "vaccines cause autism" in "There is no evidence that vaccines
// cause autism", or "come from bats" in "The virus may have come from bats".
const DENIALS = new Set(
  (
    "not no never none nobody nothing nowhere neither nor without cannot myth myths false untrue wrong misconception " +
    "debunked unproven unlikely hardly rarely may might could possibly perhaps maybe probably likely allegedly supposedly " +
    "reportedly ikke ingen intet inget ingenting aldri uten myte usant feil kanskje muligens trolig sannsynligvis antakelig"
  ).split(" "),
);
// Words after which a number is the second half of a share or a rate, as in "1 in 3", "2 out of 5" or "per 100,000".
const SHARE_BEFORE = new Set("in of out per every".split(" "));

// A word in lower case without the punctuation around it, as the lists above have it.
const plain = (word: string) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
// A word that says something: it has letters or figures and is not a small word. A lone dash is not one.
const saysSomething = (word: string) => plain(word) !== "" && !SMALL_WORDS.has(plain(word));
// A word that ends a clause: one with a comma, semicolon, colon or dash after it, or a dash on its own.
const endsClause = (word: string) => /[,;:—–]$/.test(word) || /^[-—–]$/.test(word);
// A word after which a number's phrase does not go on: the end of a clause, a sentence or a bracket.
const endsPart = (word: string) => endsClause(word) || /[.!?)]$/.test(word);
// A word that can say what a number counts: a word that says something, in small letters (one in capitals starts a
// name, as in "1969 Apollo").
const counts = (word?: string) => word !== undefined && saysSomething(word) && /^\p{Ll}/u.test(word.replace(/^[^\p{L}\p{N}]+/u, ""));
// A word that denies or hedges: one of the words above, or one ending in "n't".
const denies = (word: string) => DENIALS.has(plain(word)) || /n['’]t$/.test(plain(word));
// The first number in a word, as lib/numbers.ts reads it: "1,500," is 1500 and "45%" is 45.
const numberOf = (word: string) => Number(numbersIn(word)[0]);

// The phrase a highlighter sweeps over in a sentence, or none when no phrase is worth marking. In this order:
// - a number with what it counts, as in "4.5 billion years" or "50% of people", so a number is never split from its unit;
// - the clause after the last comma, semicolon, colon or dash, when that is two to six words;
// - the last three words.
// Small words are dropped from both ends, and a phrase needs at least two words that say something. Always words of the
// sentence itself, in their order and with their punctuation, and never the whole sentence. A word that denies or
// hedges must be inside the phrase, so a sentence like "Vaccines have never been shown to cause autism" gets none.
function markedPhrase(text: string): string | undefined {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return undefined;
  const good = (from: number, to: number) =>
    to - from >= 2 &&
    to - from <= 6 &&
    to - from < words.length &&
    words.slice(from, to).filter(saysSomething).length >= 2 &&
    !words.some((word, index) => (index < from || index >= to) && denies(word));
  const phrase = (from: number, to: number) => words.slice(from, to).join(" ");

  // A number with its scale words, then "of" and the word it counts, or up to two words that say what it counts. A
  // number after a name, as in "Apollo 11", is part of the name, and a range, as in "20 to 80 people", or a share, as in
  // "1 in 3" or "2 out of 5", is marked whole. A year or a date is not a count, as in "In 1347 ships brought".
  for (let index = 0; index < words.length; index++) {
    const before = words[index - 1];
    if (!/\d/.test(words[index]) || (before && /^\p{Lu}/u.test(before) && saysSomething(before))) continue;
    if ((before && SHARE_BEFORE.has(plain(before))) || isDateIn(numberOf(words[index]), text)) continue;
    const range = index >= 2 && /^(to|and|or)$/.test(plain(words[index - 1])) && /\d/.test(words[index - 2]) && !endsPart(words[index - 2]);
    const from = range ? index - 2 : index;
    let end = index + 1;
    while (end < words.length && !endsPart(words[end - 1]) && SCALE_WORDS.has(plain(words[end]))) end++;
    // The whole of a share: "in 3", "of 5" or "out of 5" after the number.
    const joined = plain(words[end] ?? "") === "out" && plain(words[end + 1] ?? "") === "of" ? 2 : /^(in|of)$/.test(plain(words[end] ?? "")) ? 1 : 0;
    const whole = words[end + joined];
    if (joined && whole && /\d/.test(whole) && !words.slice(end - 1, end + joined).some(endsPart) && !isDateIn(numberOf(whole), text)) end += joined + 1;
    if (end + 1 < words.length && !endsPart(words[end - 1]) && plain(words[end]) === "of" && !endsPart(words[end]) && counts(words[end + 1])) end += 2;
    else for (let taken = 0; taken < 2 && end < words.length && !endsPart(words[end - 1]) && counts(words[end]); taken++) end++;
    if (good(from, end)) return phrase(from, end);
  }

  // The last clause of the sentence, after its last comma, semicolon, colon or dash, without small words at its ends.
  let start = 0;
  for (let index = words.length - 2; index >= 1 && start === 0; index--) if (endsClause(words[index])) start = index + 1;
  const trimmed = (from: number, to: number) => {
    while (from < to && !saysSomething(words[from])) from++;
    while (to > from && !saysSomething(words[to - 1])) to--;
    // A phrase that would start just after a number takes the number in.
    if (from > 0 && /\d/.test(words[from - 1]) && !endsPart(words[from - 1])) from--;
    return [from, to] as const;
  };
  const clause = trimmed(start, words.length);
  if (start > 0 && good(...clause)) return phrase(...clause);
  // Or the last three words of that clause.
  const last = trimmed(Math.max(start, clause[1] - 3), clause[1]);
  return good(...last) ? phrase(...last) : undefined;
}
