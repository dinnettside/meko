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
// Words that belong to the number before them, as in "4.5 billion" or "50 percent". "per" only does before "cent".
const SCALE_WORDS = new Set("hundred thousand million billion trillion percent cent hundre tusen millioner milliard milliarder prosent".split(" "));
// Numbers in words, which can be half of a measure or a range with a number in figures, as in "169 degrees, nine
// minutes".
const NUMBER_WORDS = new Set(
  (
    "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen " +
    "nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion dozen"
  ).split(" "),
);
// Words that count or measure without ending in s, as in "50 million people" or "6,400 km".
const PLURALS = new Set("people men women children feet teeth mice geese cattle police data staff crew sheep fish deer aircraft km kg mg mm cm m mi ft lb lbs mph ml år barn mennesker personer".split(" "));
// Words that deny or hedge what a sentence says, in English and Norwegian. A highlight that left one out would sweep
// over the claim the sentence denies or only supposes: "vaccines cause autism" in "There is no evidence that vaccines
// cause autism", or "come from bats" in "The virus may have come from bats".
const DENIALS = new Set(
  (
    "not no never none nobody nothing nowhere neither nor without cannot myth myths false untrue wrong misconception " +
    "debunked unproven unlikely hardly rarely seldom barely scarcely little few fewer zero may might could would should " +
    "possibly perhaps maybe probably likely allegedly supposedly reportedly ikke ingen intet inget ingenting aldri uten " +
    "myte usant feil kanskje muligens trolig sannsynligvis antakelig antagelig neppe knapt sjelden lite få færre"
  ).split(" "),
);
// Words that say a sentence passes on what someone says, believes, claims, doubts or disproves instead of stating it,
// in English and Norwegian. A highlight would mark the claim as the video's own, so a sentence with one of them gets
// none, wherever the word stands: "Herodotus claimed the Persian army had 2 million soldiers", "Doctors once thought
// smoking was good for you". A clause after "that", "whether" or "if" is a claim of that kind too, as in "Scientists
// disproved the idea that vaccines cause autism", so those words count, even where they mean something else.
const HEARSAY = new Set(
  (
    "that whether if unless according say says saying said told wrote writes written noted stated taught so-called " +
    "citing contrary unclear unknown denied denies denial deny hvorvidt dersom hvis ifølge tror trodde trudde mener " +
    "mente sier sa sies skrev antar antok antas antatt regnes regner regnet angivelig visstnok uklart ukjent"
  ).split(" "),
);
// And the words that start like these, in all their forms: "believed", "claims", "reportedly", "described",
// "recorded", "påstår", "sagt", "etter sigende".
const HEARSAY_STARTS = (
  "believ belief think thought claim alleg rumor rumour report reput purport suppos presum assum suggest indicat " +
  "consider estimat predict forecast doubt argu suspect fear theor hypothes speculat legend myth seem appear apparent " +
  "ostensib disprov refut debunk disput misconcep wrong mistak fals uncertain declar warn insist explain announc remark " +
  "quot describ depict portray record recount recall mention reckon guess accus blam boast cite fake fabricat exaggerat " +
  "nonsens fantas imagin superstit trope påst hevd ansl myte tvil usikker feilaktig motbevis avkreft uttal erklær " +
  "advar sagt fortalt fortell skrevet sigende innbill forestill teori rykt beskriv beskrev skildr berett nevn omtal " +
  "gjett anklag skryt skrøt siter spekul hypote overdriv oppdikt overtro"
).split(" ");
// Pairs of words that report a claim the same way: "is said to have had", "as Einstein put it", "skal ha sagt".
const REPORTED = new Set(["to have", "put it", "skal ha", "skal være"]);
// Who or what a sentence may pass a number or a claim on from rather than state it, as in "Chroniclers recorded 25
// million deaths", "Polo's book mentions 12,000 bridges" or "Movies show 10 ninjas attacking one at a time". A sentence
// that names one gets no highlight, whatever its verb, since a list of verbs is never complete.
const SOURCES = new Set("book books paper papers story stories tale tales saga sagas poem poems epic epics roman romanen romaner bok boka boken bøker".split(" "));
const SOURCE_STARTS = (
  "historian chronicl source account witness expert official scholar author writer movie film novel headline hoax " +
  "folklor tradition fiction fabl bible scriptur historiker kilde krønik beretning vitne ekspert myndighet forfatter " +
  "sagn eventyr"
).split(" ");
// Verbs that put a figure on something when "at" follows within a few words, as in "Herodotus put the Persian army at 2
// million men" or "Officials put the death toll at 2,000": an estimate, as "estimated" would say.
const PLACING = new Set("put puts putting place places placed placing set sets setting peg pegs pegged".split(" "));
// Small words only Norwegian has, so a sentence with one of them, or with æ, ø or å, reads as Norwegian. There "at" is
// "that" and "om" is "whether", so they count as the English words do, as in "Mange innbiller seg at vi bruker 10
// prosent av hjernen". In English, "at" is only a preposition, as in "at 30 kilometres per second".
const NORWEGIAN = new Set("og ikke er av som det den har var vi seg blir ble hadde jeg dere sitt noe noen mange alle etter mellom fra til med hvor hva kan skal vil enn mot".split(" "));
// Words that open a sentence with a frame, as "In the movies,", "To medieval scholars," or "Per the CDC," do: what
// follows may hold only inside the frame, so a sentence that starts with one gets no highlight, unless the frame is a
// number, as in "In 1918" or "Over 1,500", or a bound or a day (see OPENINGS). "Of" opens a share instead, as in "Of the
// 2,224 people aboard, 1,500 died".
const FRAMES = new Set(
  (
    "in on at to for by with from during among across throughout within after before since until till per like unlike " +
    "despite as under over around i på til blant hos etter før siden fra med uten innen gjennom"
  ).split(" "),
);
// Words that bound a number from one side, which go into its phrase as a denial does, as in "under 10%", "up to 90%" or
// "nearly 7 million": left out, "Under 10% of plastic gets recycled" would mark "10% of plastic gets recycled". Words
// that only round a number, like "about" and "around", may stay out.
const BOUNDS = new Set("over under below above nearly almost exceed exceeds exceeded passed topped surpassed opptil nesten nærmere minst drøyt".split(" "));
const BOUND_PAIRS = new Set(["more than", "less than", "fewer than", "at least", "at most", "up to", "mer enn", "mindre enn", "flere enn", "færre enn"]);
const OPENINGS = new Set([...BOUND_PAIRS, "i dag", "i år", "i fjor", "i går"]);
// Words that add to what a number counts, as "and crew" in "2,224 passengers and crew" or "and women" in "50% of men
// and women", so a phrase never stops before one.
const ADDING = new Set("and or nor plus og eller samt".split(" "));
// Words that narrow the group a share is of, as "in the town" in "3 of 5 people in the town" or "who smoke" in "1 in 3
// adults who smoke", so a share never stops before one.
const NARROWING = new Set("in on at from with without under over aged living born among across between of who which whose whom where i på fra med uten blant som hvor".split(" "));
// Words after which a number is the second half of a share or a rate, as in "1 in 3", "2 out of 5", "700 of the
// 2,224", "among 300" or "per 100,000".
const SHARE_BEFORE = new Set("in of out per every among i av blant".split(" "));
// Words that join two numbers into a range, as in "20 to 80" or "70 – 85 million". "and" only does after "between", as
// in "between 20 and 80": elsewhere it joins two things, as in "206 bones and 600 muscles".
const RANGE_WORDS = new Set("to or til eller - – —".split(" "));
// Words for a change, after which "to" says where a number ended up rather than closing a range, as in "Sales grew 50%
// to $3 billion", "grew by 2 million to 10 million" or "rose from 500 to 2,000".
const CHANGES = new Set("by from med fra".split(" "));
const CHANGE_STARTS = "ris rose grew grow fell fall drop increas decreas climb jump soar plung plummet declin surg shr sank sink doubl tripl halv steg stig øk falt vokst voks sunk".split(" ");
// Words after which a number names something instead of counting, as in "phase 3 trials", "a category 5 hurricane",
// "type 2 diabetes" or "by age 5".
const LABELS = new Set(
  (
    "type model version mark phase stage level category grade class size number no chapter page room flight route gate " +
    "track episode season volume part article section figure table age aged ages modell versjon fase nivå kategori " +
    "klasse nummer nr kapittel side rute sesong del trinn alder alderen klokka klokken kl"
  ).split(" "),
);
// Words that may stand between such a word and its number, as in "of the 2,224", "of Europe's 75 million" or "out of
// every 4".
const DETERMINERS = new Set("the a an its their his her our my your these those this all both each every den det de sine sitt sin hans hennes hver hvert".split(" "));
// Words with a capital that start a sentence with an amount after them, not a name, as in "Today 1 in 3" against
// "Apollo 11" or "Covid 19 cases". Small words like "About" never start a name.
const OPENERS = new Set("today now still another between approximately exactly precisely fully nå omtrent cirka mellom".split(" "));
// Words after which a bare number of two or three figures may be a year, as in "By 800 monks had copied the gospels",
// unless a unit of time follows, as in "after 102 hours".
const YEAR_BEFORE = new Set("by after before until till since circa".split(" "));
// Machines that a bare number of three figures is often the model of, as in "Airlines still fly 747 jets".
const MACHINES = new Set("jet jets jetliner jetliners airliner airliners plane planes aircraft bomber bombers fighter fighters engine engines car cars truck trucks tank tanks rifle rifles locomotive locomotives helicopter helicopters".split(" "));
// What makes a number a time of day, as in "9 pm" or "6 o'clock".
const CLOCK = /^(a\.?m|p\.?m|o['’]clock)\.?[,;:!]?$/i;
// Words that start a clause going on from the one before, as "then" in ", then erupts violently.", and the joining
// words a marked last clause leaves off.
const CONTINUES = new Set("and but so then og men så".split(" "));
const JOINING = new Set("and but or nor so yet then the a an og men eller så da".split(" "));
// What a rate can be per without "per", as in "100,000 times a day", and words that are a rate on their own.
const RATE_WORDS = new Set("a an each every hver hvert".split(" "));
const TIME_UNITS = new Set(
  (
    "second seconds minute minutes hour hours day days night nights week weeks month months year years decade decades " +
    "century centuries sekund sekunder minutt minutter dag dager døgn uke uker måned måneder år"
  ).split(" "),
);
const RATES = new Set("daily nightly weekly monthly yearly annually hourly daglig ukentlig månedlig årlig".split(" "));
// Words that make a span or a distance before them one from something, as "ahead" in "60 years ahead of time" or "away"
// in "10 km away from the coast", which a phrase never stops before.
const SPAN_AFTER = new Set("ahead behind apart away later earlier before after".split(" "));

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
// A word that reports a claim or names a source: one of the words above, or one that starts like them.
const reports = (word: string) => HEARSAY.has(plain(word)) || HEARSAY_STARTS.some((start) => plain(word).startsWith(start));
const cites = (word: string) => SOURCES.has(plain(word)) || SOURCE_STARTS.some((start) => plain(word).startsWith(start));
// A word for a change: one of the words above, or one that starts like them.
const changes = (word?: string) => word !== undefined && (CHANGES.has(plain(word)) || CHANGE_STARTS.some((start) => plain(word).startsWith(start)));
// A word that looks like what a number counts, so a verb may come after it: a plural or a unit.
const plural = (word: string) => PLURALS.has(plain(word)) || /[^siu]s$/.test(plain(word));
// A word ending in 's or s', as in "Europe's" or "soldiers'".
const possessive = (word: string) => /['’]s?$/.test(word);
// A word with a number in it, in figures or in words.
const numeric = (word: string) => /\d/.test(word) || NUMBER_WORDS.has(plain(word));
// The first number in a word, as lib/numbers.ts reads it: "1,500," is 1500 and "45%" is 45.
const numberOf = (word: string) => Number(numbersIn(word)[0]);
// A word that is a plain number: figures with only a sign, currency, unit or punctuation around them, as in "2,224",
// "$80", "45%" or "1.5°C". Not one with letters joined to its figures, which names something or is not a count, as in
// "COVID-19", "A380", "CO2", "1990s" or "15th", and not a time, date or fraction, as in "9:30" or "4/7".
const figure = (word: string) => /\d/.test(word) && !/\p{L}-?\p{N}|\p{N}-?\p{L}/u.test(word) && !/\d[:/]\d/.test(word);
// Four figures from 1000 to 2100 with nothing around them could be a year, as in "In 1347 ships", even where
// lib/numbers.ts reads a count, since "1347 ships" alone looks the same.
const yearLike = (word: string) => {
  const bare = word.replace(/^[("“‘[]+|[)"”’\].,;:!?]+$/g, "");
  return /^\d{4}$/.test(bare) && Number(bare) >= 1000 && Number(bare) <= 2100;
};

// The phrase a highlighter sweeps over in a sentence, or none when no phrase is worth marking or one could mislead.
// Either a number with what it counts, as in "4.5 billion years old" or "50% of people", so a number is never split
// from its unit; or the clause after the sentence's only comma or semicolon, when it goes on from the clause before. A
// phrase needs at least two words that say something. Always words of the sentence itself, in their order and with
// their punctuation, found once in it, and never the whole sentence. A word that denies or hedges must be inside the
// phrase, so a sentence like "Vaccines have never been shown to cause autism" gets none. A question, a sentence that
// reports a claim or names a source (see HEARSAY and SOURCES), and one with a frame (see FRAMES) get none at all. When
// a case is unclear, no phrase is marked: the sentence is still shown, only without a highlight.
function markedPhrase(text: string): string | undefined {
  const words = text.trim().split(/\s+/);
  if (words.length < 4 || text.includes("?")) return undefined;
  const norwegian = /[æøå]/i.test(text) || words.some((word) => NORWEGIAN.has(plain(word)));
  const hearsay = (word: string, index: number) =>
    reports(word) ||
    cites(word) ||
    REPORTED.has(`${plain(word)} ${plain(words[index + 1] ?? "")}`) ||
    (norwegian && /^(at|om)$/.test(plain(word))) ||
    (PLACING.has(plain(word)) && words.slice(index + 1, index + 6).some((next) => plain(next) === "at"));
  if (words.some(hearsay)) return undefined;
  if (FRAMES.has(plain(words[0])) && !/\d/.test(words[1]) && !OPENINGS.has(`${plain(words[0])} ${plain(words[1])}`)) return undefined;
  // A colon or a dash between words sets a frame or an aside, as in "The headline: vaccines cause autism" or
  // "Hollywood's version — quicksand swallows people whole", and a highlight would drop it. A dash between two numbers
  // makes a range instead, as in "70 – 85 million".
  const dash = (index: number) => {
    const word = words[index];
    if (/^[-—–]$/.test(word)) return !(numeric(words[index - 1] ?? "") && numeric(words[index + 1] ?? ""));
    return /[—–]$/.test(word) ? !(numeric(word) && numeric(words[index + 1] ?? "")) : /\p{L}[—–]\p{L}/u.test(word);
  };
  if (words.some((word, index) => /:$/.test(word) || dash(index))) return undefined;
  const sentence = words.join(" ");
  const phrase = (from: number, to: number) => words.slice(from, to).join(" ");
  // The templates mark the last place the phrase is found, so it must be found only once.
  const good = (from: number, to: number) =>
    to - from >= 2 &&
    to - from <= 6 &&
    to - from < words.length &&
    words.slice(from, to).filter(saysSomething).length >= 2 &&
    !words.some((word, index) => (index < from || index >= to) && denies(word)) &&
    sentence.indexOf(phrase(from, to)) === sentence.lastIndexOf(phrase(from, to));

  // A number that counts: a plain number (see figure) that is not a year, a date or a time of day, as in "In 1347
  // ships brought", "On July 4 colonists" or "At 9 pm sirens", and not one that names something. Three figures before a
  // machine are a model, as in "fly 747 jets". After a word with a capital letter it is part of a name, as in "Apollo
  // 11", "Covid 19 cases" or "iPhone 15", except after a first word like "Today". After a word like "phase" or "age" it
  // is a label, and a bare number after a word like "the", "their" or "last" may be a model, as in "a 747 jet", unless
  // it is written as an amount, as in "the 2,224 passengers" or "a 30% rise". After a word like "by" it may be a year.
  const amount = (index: number) =>
    figure(words[index]) &&
    !yearLike(words[index]) &&
    !isDateIn(numberOf(words[index]), text) &&
    !CLOCK.test(words[index + 1] ?? "") &&
    !(/^\d{3}$/.test(words[index]) && MACHINES.has(plain(words[index + 1] ?? "")));
  const counted = (index: number) => {
    const before = words[index - 1];
    if (!amount(index) || before === undefined || endsPart(before)) return amount(index);
    const bare = !/[,.]\d|%|[$£€¥]/.test(words[index]) && !SCALE_WORDS.has(plain(words[index + 1] ?? ""));
    const name = /\p{Lu}/u.test(before) && saysSomething(before) && !(index === 1 && OPENERS.has(plain(before)));
    const model = bare && (DETERMINERS.has(plain(before)) || /^(en|ei|et|last|first|siste|første)$/.test(plain(before)) || possessive(before));
    const year =
      bare &&
      /^\d{2,3}[,.;]?$/.test(words[index]) &&
      (YEAR_BEFORE.has(plain(before)) || (index === 1 && plain(before) === "around")) &&
      !TIME_UNITS.has(plain(words[index + 1] ?? ""));
    return !name && !model && !year && !LABELS.has(plain(before));
  };
  // Whether the number is the second half of a share or a rate, with only words like "the" between, as in "of the
  // 2,224": then its phrase would say the total is the count, as "2,224 passengers survived" in "Only 700 of the 2,224
  // passengers survived".
  const second = (index: number) => {
    for (let back = index - 1; back >= Math.max(0, index - 3) && !endsPart(words[back]); back--) {
      if (SHARE_BEFORE.has(plain(words[back]))) return true;
      if (!DETERMINERS.has(plain(words[back])) && !possessive(words[back])) return false;
    }
    return false;
  };
  // Whether the word joins the number before it to a number after it, as "to" in "20 to 80" or "and" in "between 20 and
  // 80". With `loose`, any "and" does, as in "$10 and $20".
  const joins = (index: number, loose = false) =>
    index < words.length &&
    (RANGE_WORDS.has(words[index].toLowerCase()) || (/^(and|og)$/.test(plain(words[index])) && (loose || /^(between|mellom)$/.test(plain(words[index - 2] ?? "")))));
  // A share or an amount of money, as in "50%", "50 percent" or "$3", so a range only joins two of a kind, or a bare
  // number to one, as in "5 to 10%".
  const kind = (index: number) => {
    const next = plain(words[index + 1] ?? "");
    const share = /%/.test(words[index]) || /^(percent|prosent)$/.test(next) || (next === "per" && plain(words[index + 2] ?? "") === "cent");
    return `${share ? "%" : ""}${words[index].match(/[$£€¥]/)?.[0] ?? ""}`;
  };
  // Whether a later word in the clause makes what comes before it a rate, as "a day" in "7,500 litres of blood a day".
  const rateAfter = (from: number) => {
    for (let at = from; at < words.length && !endsPart(words[at - 1]); at++) {
      const word = plain(words[at]);
      if (word === "per" || RATES.has(word) || (RATE_WORDS.has(word) && TIME_UNITS.has(plain(words[at + 1] ?? "")))) return true;
    }
    return false;
  };

  // A number with its scale words, then what it counts, as "of people" or "years", and what a rate is per. A range, as
  // in "20 to 80 people", or a share, as in "1 in 3", "2 out of 5" or "700 of the 2,224", is marked whole or not at
  // all. One more word only when that ends the clause, as in "1 in 3 adults smoke.": one in the middle could cut a
  // phrase short, as "go" would in "1 in 9 people go hungry".
  for (let index = 0; index < words.length; index++) {
    if (!counted(index) || second(index)) continue;
    // The second number of a range is marked with the first or not at all, so "70 – 85 million" is never "85 million",
    // and a number just after another may end a measure or a list, even after a comma, as "7 inches" in "5 feet 7
    // inches" or "19 minutes" in "13 degrees, 19 minutes".
    if (index >= 2 && joins(index - 1, true) && /\d/.test(words[index - 2])) continue;
    if ([index - 1, index - 2].some((at) => at >= 0 && (counted(at) || NUMBER_WORDS.has(plain(words[at]))))) continue;
    let from = index;
    // A bound or a denial right before the number goes into its phrase, as in "up to 90%", "under 10%" or "not 100%
    // effective", so it is never left out.
    if (from >= 2 && !endsPart(words[from - 2]) && BOUND_PAIRS.has(`${plain(words[from - 2])} ${plain(words[from - 1])}`)) from -= 2;
    else if (from > 0 && BOUNDS.has(plain(words[from - 1])) && !endsPart(words[from - 1])) from--;
    if (from > 0 && denies(words[from - 1]) && !endsPart(words[from - 1])) from--;
    let end = index + 1;
    let share = kind(index).includes("%");
    const goesOn = () => end < words.length && !endsPart(words[end - 1]);
    const scale = () => {
      while (goesOn() && (SCALE_WORDS.has(plain(words[end])) || (plain(words[end]) === "per" && plain(words[end + 1] ?? "") === "cent"))) end++;
    };
    scale();
    // A range of two numbers of a kind, or of a bare number and one of a kind, as in "5 to 10%". Not of two kinds, as
    // in "50% to $3 billion", and not after a word for a change, as in "rose from 500 to 2,000": there the phrase stops
    // before "to" and is refused below.
    if (goesOn() && joins(end) && end + 1 < words.length && amount(end + 1) && [kind(end + 1), ""].includes(kind(index)) && !changes(words[from - 1])) {
      end += 2;
      scale();
    }
    // The whole of a share: "in 3", "of 5", "out of 5", "out of every 4" or "of the 2,224" after the number.
    const joined = plain(words[end] ?? "") === "out" && plain(words[end + 1] ?? "") === "of" ? 2 : /^(in|of|av)$/.test(plain(words[end] ?? "")) ? 1 : 0;
    let whole = end + joined;
    while (joined && whole < end + joined + 2 && whole < words.length && (DETERMINERS.has(plain(words[whole])) || possessive(words[whole]))) whole++;
    if (joined && whole < words.length && amount(whole) && !words.slice(end - 1, whole).some(endsPart)) {
      end = whole + 1;
      share = true;
      scale();
    } else if (joined === 2) continue;
    if (end + 1 < words.length && goesOn() && plain(words[end]) === "of" && !endsPart(words[end]) && counts(words[end + 1])) {
      end += 2;
      share = true;
    } else if (goesOn() && counts(words[end])) end++;
    // And the plural after a word like "new" in "300 new towns".
    if (goesOn() && !plural(words[end - 1]) && counts(words[end]) && plural(words[end])) end++;
    // "ago" after a span of time says when, as in "66 million years ago".
    if (goesOn() && TIME_UNITS.has(plain(words[end - 1])) && /^(ago|siden)$/.test(plain(words[end]))) end++;
    // A rate goes on through what it is per, as in "299,792 kilometres per second", "12 people per 100,000",
    // "100,000 times a day" or "100,000 times daily".
    while (
      goesOn() &&
      (RATES.has(plain(words[end])) ||
        (end + 1 < words.length && !endsPart(words[end]) && (plain(words[end]) === "per" ? saysSomething(words[end + 1]) : RATE_WORDS.has(plain(words[end])) && TIME_UNITS.has(plain(words[end + 1])))))
    ) {
      end += RATES.has(plain(words[end])) ? 1 : 2;
      if (/\d/.test(words[end - 1])) scale();
    }
    // A comparative after the phrase goes in with what it compares with, as in "109 times wider than Earth.", since "109
    // times" alone says something else. When what it compares with is longer, as in "10.8% points better than the
    // runner-up", the phrase is refused. After "times", anything else that goes on would be cut short too, as "15
    // times more" in "15 times more likely to".
    const comparative = /^\p{Ll}{3,}er$/u.test(plain(words[end] ?? "")) && !SMALL_WORDS.has(plain(words[end] ?? ""));
    if (goesOn() && (/^(times|ganger)$/.test(plain(words[end - 1])) || (comparative && plain(words[end + 1] ?? "") === "than"))) {
      if (!comparative || plain(words[end - 1]) === "ganger") continue;
      end++;
      if (goesOn() && plain(words[end]) === "than") {
        const last = [end + 1, end + 2].find((at) => at < words.length && (endsPart(words[at]) || at === words.length - 1) && !words.slice(end, at).some(endsPart));
        if (last === undefined) continue;
        end = last + 1;
      }
    }
    if (goesOn() && counts(words[end]) && (endsPart(words[end]) || end === words.length - 1)) end++;
    // A phrase cut short is refused: one that stops before a number or a word before one, as "8 minutes" in "8 minutes
    // 20 seconds", "169 degrees," in "169 degrees, nine minutes", "10% of children" in "10% of children under 5" or
    // "50%" in "Sales grew 50% to $3 billion"; one that stops before a word that adds to what it counts, as "2,224
    // passengers" in "2,224 passengers and crew", or before the rest of a list, as "300 soldiers," in "300 soldiers,
    // sailors and civilians"; a share that stops before words that narrow its group, as "3 of 5 people" in "3 of 5
    // people in the town"; a span before a word that says from what, as "~60 years" in "~60 years ahead of time"; a
    // count or a measure that leaves out a rate later in its clause, as "7,500 litres" in "7,500 litres of blood a
    // day"; and one that stops before a word in small letters that could still belong to it, as "towns" after "300
    // new". Only a plural or a unit may stop before such a word, since that is likely a verb, as in "1 in 9 people go
    // hungry".
    const next = words[end];
    if (next !== undefined) {
      if (numeric(next) || numeric(words[end + 1] ?? "") || ADDING.has(plain(next)) || next === "&") continue;
      if (endsClause(words[end - 1]) && /^\p{Ll}/u.test(next)) continue;
      if (share && !endsPart(words[end - 1]) && NARROWING.has(plain(next))) continue;
      if (!endsPart(words[end - 1]) && SPAN_AFTER.has(plain(next))) continue;
      if (!share && rateAfter(end)) continue;
      if (goesOn() && counts(next) && !plural(words[end - 1])) continue;
    }
    if (good(from, end)) return phrase(from, end);
  }

  // Or the last clause, after the sentence's only comma or semicolon, with two words or more before it, when it goes on
  // from the clause before: it starts with a joining word, as "then erupts violently." in "Magma rises through cracks,
  // then erupts violently.", or with a word in -ing, as "ending an era." in "Rome fell in 476, ending an era.". A clause
  // after a lead-in, as in "In the movies, quicksand swallows people", says alone what the lead-in only frames, so it is
  // never marked. Joining words come off the clause's start, and it must start and end with words that say something,
  // so it is never cut short. It must have no number, so a number the loop above left out does not come back, and no
  // "and" or "or" after its first word, which would make it the end of a list, as "Michael Collins and Buzz Aldrin" in
  // "The crew was Neil Armstrong, Michael Collins and Buzz Aldrin".
  const breaks = words.flatMap((word, index) => (index < words.length - 1 && endsClause(word) ? [index] : []));
  if (breaks.length !== 1 || breaks[0] < 1) return undefined;
  let start = breaks[0] + 1;
  if (!CONTINUES.has(plain(words[start])) && !/^\p{Ll}{2,}ing$/u.test(words[start].replace(/[,;.!]+$/, ""))) return undefined;
  while (start < words.length && JOINING.has(plain(words[start]))) start++;
  const clause = words.slice(start);
  if (clause.length === 0 || !saysSomething(clause[0]) || !saysSomething(clause[clause.length - 1])) return undefined;
  if (clause.some((word, index) => /\p{N}/u.test(word) || numeric(word) || (index > 0 && /^(and|or|og|eller)$/.test(plain(word))))) return undefined;
  return good(start, words.length) ? phrase(start, words.length) : undefined;
}
