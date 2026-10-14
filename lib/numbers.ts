// Numbers, years and amounts in a text, so the video only shows numbers its facts state.

// Thousands separators out, so "16,000" reads as 16000, and Indian grouping too, so "10,00,000" reads as 1000000.
const withoutSeparators = (text: string) =>
  text.replace(/\b\d{1,3}(?:,\d{2,3})+\b/g, (number) =>
    /^\d{1,3}(?:,\d{3})+$/.test(number) || /^\d{1,2}(?:,\d{2})*,\d{3}$/.test(number) ? number.replace(/,/g, "") : number,
  );

// A dash right before a number, after a space, is a minus sign: "−89.2" or "–89.2 °C". Between two numbers it joins
// them, as in "1347–1351".
const withMinusSigns = (text: string) => text.replace(/−/g, "-").replace(/(^|[\s(])[–—](?=\d)/g, "$1-");

// Numbers without thousands separators, so "16,000" and "16000" match. A minus sign counts when it starts the
// number ("-273.15", "−89.2"), not when it joins two numbers ("1347-1351").
export const numbersIn = (text: string): string[] =>
  withoutSeparators(withMinusSigns(text)).match(/(?:(?<=^|[\s(])-)?\d+(?:\.\d+)?/g) ?? [];

// Era markers. BCE and B.C.E. come before BC and B.C. so the longer form is read whole.
const BC = String.raw`(?:BCE|B\.C\.E\.|BC|B\.C\.)(?![A-Za-z])`;
const AD = String.raw`(?:CE|C\.E\.|AD|A\.D\.)(?![A-Za-z])`;
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
// Words after a number that measure something, so it is an amount and not a year: "1500 years", "6400 km".
const MEASURE_WORDS = String.raw`years?|months?|days?|hours?|km|kilomet(?:er|re)s?|mi|miles?|m|met(?:er|re)s?|feet|ft|tons?|tonnes?|square|%|percent|million|billion|thousand|hundred|dollars|pounds|euros|yuan`;
// Words after a number that count people or things: "1200 deaths". After "in" or "since" the number is still a year,
// as in "In 1918 women won the vote".
const COUNTED_WORDS = String.raw`people|persons|men|women|children|soldiers|troops|ships|sailors|deaths|dead|cases|victims|prisoners|workers|villages|towns|cities`;
const MEASURE_AFTER = new RegExp(String.raw`^\s*(?:${MEASURE_WORDS})(?![A-Za-z])`, "i");
const COUNTED_AFTER = new RegExp(String.raw`^\s*(?:${COUNTED_WORDS})(?![A-Za-z])`, "i");

// Replaces a matched span with spaces, so later passes do not read its numbers again.
const blank = (text: string, start: number, length: number) => text.slice(0, start) + " ".repeat(length) + text.slice(start + length);

// The years a text states, like "in 1227", "73 AD", "138 BC" or "from 1550 to 1070 BC". Years BC are negative,
// as on the timeline. Centuries ("the 15th century") and decades ("the 1860s") are not years, and neither are
// amounts like "1500 years", "around 18,000 people" or "300 Spartans". A number under 1000 without AD or BC only
// counts after a word like "in", "until" or "circa".
export function yearsIn(text: string): number[] {
  return [...new Set(yearSpans(text).flatMap((span) => span.years))].sort((a, b) => a - b);
}

// The periods a text states as a span of years, like "from 1451 to 1481", "206 BC–220 AD", "between 1347 and 1351"
// or "from 12 March 1947 to 26 December 1991", as [start, end] pairs. Two years joined by a plain "and", as in "in
// 1914 and 1939", are two years, not a period.
export function yearRangesIn(text: string): [number, number][] {
  return yearSpans(text).flatMap((span) => (span.years.length === 2 && span.years[0] < span.years[1] ? [span.years as [number, number]] : []));
}

// A number with or without thousands separators, as a year with an era marker can be written: "2,500 BC".
const ERA_NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d{1,5})`;
// "c. 1550", "ca. 1550" and "circa 1550" are years too.
const CIRCA = String.raw`(?:(?:[Cc]\.|[Cc]a\.|[Cc]irca)\s*)?`;
// The day and month a year can come with in a period: "12 March 1947", "September 5, 1793".
const DAY_MONTH = String.raw`(?:(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MONTHS})|(?:${MONTHS})\s+\d{1,2}(?:st|nd|rd|th)?,?)\s+)?`;
// What may follow a year under 1000 that has no era marker: punctuation, the end, a capital, or a few small words.
const SHORT_YEAR_AFTER = String.raw`\s*[,;:)]|\.(?!\d)|\s*$|\s+(?:and|to|when|the|after|before|until|while)\b`;

function yearSpans(input: string): { years: number[] }[] {
  let text = input;
  const spans: { years: number[] }[] = [];
  const take = (pattern: RegExp, read: (match: RegExpMatchArray, before: string, after: string) => number[] | null) => {
    for (const match of [...text.matchAll(pattern)]) {
      const start = match.index ?? 0;
      const years = read(match, text.slice(0, start), text.slice(start + match[0].length));
      if (!years) continue;
      spans.push({ years });
      text = blank(text, start, match[0].length);
    }
  };
  const eraValue = (number: string) => Number(number.replace(/,/g, ""));
  const sign = (marker: string | undefined) => (marker && /^B/i.test(marker) ? -1 : 1);
  // A span with era markers: "206 BC–220 AD", "27 BC to AD 14", or one marker at the end for both, "from 1550 to
  // 1070 BC". A plain "and" only joins two years after "between".
  take(
    new RegExp(String.raw`(?<![\d.,])${CIRCA}${ERA_NUMBER}\s*(${BC}|${AD})?\s*(-|–|—|to|until|through|and)\s*(${AD}\s*)?${CIRCA}${ERA_NUMBER}(?:\s*(${BC}|${AD}))?`, "g"),
    (match, before) => {
      const [, first, firstMarker, joiner, adBefore, second, secondMarker] = match;
      if (!secondMarker && !adBefore) return null;
      if (joiner.toLowerCase() === "and" && !/\bbetween\s*$/i.test(before)) return null;
      const start = (firstMarker ? sign(firstMarker) : sign(secondMarker)) * eraValue(first);
      const end = (secondMarker ? sign(secondMarker) : 1) * eraValue(second);
      return [start, end];
    },
  );
  take(new RegExp(String.raw`(?<![\d.,])${CIRCA}${ERA_NUMBER}\s*${BC}`, "g"), (match) => [-eraValue(match[1])]);
  take(new RegExp(String.raw`(?<![\d.,])${CIRCA}(\d{1,4})\s*${AD}`, "g"), (match) => [Number(match[1])]);
  take(/\b(?:AD|A\.D\.)\s*(\d{1,4})\b/g, (match) => [Number(match[1])]);
  // A span of plain years: "from 1451 to 1481", "1914-1918", "between 1347 and 1351", "from 618 to 907", "from 12
  // March 1947 to 26 December 1991". Numbers with thousands separators are amounts, never years.
  take(
    new RegExp(String.raw`(?<![\d.,$£€])${DAY_MONTH}${CIRCA}(\d{3,4})(?!\d|[.,]\d)\s*(-|–|—|to|until|through|and)\s*${DAY_MONTH}${CIRCA}(\d{3,4})(?!\d|[.,]\d)`, "gi"),
    (match, before, after) => {
      const [start, end] = [Number(match[1]), Number(match[3])];
      const plausible = (year: number) => year >= 100 && year <= 2100;
      if (!plausible(start) || !plausible(end) || end <= start) return null;
      if (match[2].toLowerCase() === "and" && !/\bbetween\s*$/i.test(before)) return null;
      // "from 75 to 200 million" or "grew from 300 to 900 people" are amounts.
      if (MEASURE_AFTER.test(after) || COUNTED_AFTER.test(after)) return null;
      // Short numbers need a word that marks a period before them and no noun after them, so "between 200 and 300
      // knights" and "300 to 400 ships" are not read as years.
      if (start < 1000 || end < 1000) {
        if (!/\b(?:from|between|in|during|c\.|circa)\s*$/i.test(before)) return null;
        if (!new RegExp(String.raw`^(?:${SHORT_YEAR_AFTER}|\s+\p{Lu})`, "u").test(after)) return null;
      }
      return [start, end];
    },
  );
  // A four-digit year on its own, not after a currency sign. A unit after it makes it an amount ("1500 years"), and so
  // do counted people or things, unless "in", "since" or "until" comes before it: "Over 1200 Americans died" is a
  // count, "In 1918 women won the vote" is a year.
  take(/(?<![\d.,$£€])(\d{4})(?!\d|[.,]\d|'?s\b)/g, (match, before, after) => {
    const value = Number(match[1]);
    if (value < 1000 || value > 2100 || MEASURE_AFTER.test(after)) return null;
    if (/\b(?:in|since|until|by|circa|c\.)\s*$/i.test(before)) return [value];
    return COUNTED_AFTER.test(after) || /^\s+\p{Lu}\p{Ll}+s\b/u.test(after) ? null : [value];
  });
  // A shorter year after a word that marks a date: "in 751", "until 907.", "In 793 Vikings raided", "circa 300".
  // After "by", a capital word means people, as in "held by 300 Spartans", so it is not a year then.
  take(new RegExp(String.raw`\b(?:[Ii]n|[Uu]ntil|[Ss]ince|[Cc]irca|c\.)\s+(\d{2,3})(?!\d|\.\d)(?=${SHORT_YEAR_AFTER}|\s+\p{Lu})`, "gu"), (match) => [
    Number(match[1]),
  ]);
  take(new RegExp(String.raw`\b[Bb]y\s+(\d{2,3})(?!\d|\.\d)(?=${SHORT_YEAR_AFTER})`, "g"), (match) => [Number(match[1])]);
  return spans;
}

// The amounts a text states, like "6,400 km" or "24 million", once per number. Years, decades ("the 1400s") and
// ordinals ("15th") are left out.
export function amountsIn(text: string): string[] {
  const plain = withoutSeparators(withMinusSigns(text));
  const years = new Set(yearsIn(text).map((year) => String(Math.abs(year))));
  const amounts = new Map<string, string>();
  for (const match of plain.matchAll(/((?:(?<=^|[\s(])-)?\d+(?:\.\d+)?)(st|nd|rd|th|'?s\b)?(\s+(?:million|billion|thousand))?(\s*(?:%|[A-Za-z]+))?/g)) {
    const number = match[1];
    if (!match[2] && !years.has(number.replace(/^-/, "")) && !amounts.has(number)) amounts.set(number, match[0].trim());
  }
  return [...amounts.values()];
}

// Whether a text uses the number as a date: as a year, a decade like "the 1400s", or a day like "July 1".
export function isDateIn(value: number, text: string): boolean {
  const plain = withoutSeparators(text);
  const years = yearsIn(text);
  return (
    years.includes(value) ||
    years.includes(-value) ||
    new RegExp(`(^|[^\\d.,])${value}'?s\\b`).test(plain) ||
    new RegExp(`\\b(${MONTHS})\\s+${value}\\b|\\b${value}(st|nd|rd|th)?\\s+(of\\s+)?(${MONTHS})\\b`, "i").test(plain)
  );
}

// Capitalized words that often come right before an amount, so "About 300" or "Likely 25" is an amount, not a name.
const AMOUNT_STARTERS =
  "About|Around|Over|Nearly|Almost|Some|In|By|On|At|From|To|Only|Just|More|Less|Fewer|Up|With|The|A|An|After|Before|Since|Until|Under|Roughly|Approximately|Exactly|Of|For|And|But|Or|All|Each|Every|Their|Its|His|Her|Our|Today|Then|Now|Still|Another|At least|Between|Perhaps|Possibly|Probably|Likely|Maybe|Estimates|Estimated|As|Fully|Precisely|Officially";

// Whether a number right after a name, like "Apollo 11" or "Chapter 11", names something rather than counting. A
// number with a unit after it is an amount, even after a name: "the Pacific Ocean 950 miles southwest of Hawaii".
export function isNameNumber(value: number, text: string): boolean {
  const number = String(value).replace(".", "\\.");
  return new RegExp(
    String.raw`(^|[^\p{L}])(?!(?:${AMOUNT_STARTERS})\s)\p{Lu}\p{L}+\s+${number}(?![\d.,])(?!\s*(?:${MEASURE_WORDS}|${COUNTED_WORDS})(?![A-Za-z]))`,
    "u",
  ).test(withoutSeparators(text));
}

// Whether a text says the value is part of the total, like "25 of Europe's 75 million" or "1 out of 3". A range
// ("4 to 5 million") or a later count is not, and dots for value out of total would mislead.
export function isPartOf(value: number, total: number, text: string): boolean {
  const plain = withoutSeparators(text);
  return new RegExp(`(^|[^\\d.])${value}(?![\\d.])[^.]{0,40}\\b(of|out of|among)\\b[^.]{0,25}(^|[^\\d.])${total}(?![\\d.])`, "i").test(plain);
}

const MONTH_NAMES = MONTHS.split("|");

// The month (1 to 12) and day of a date like "20 July", "July 20" or "July", or null when it names no month.
export function parseDate(date: string): { month: number; day: number | null } | null {
  const text = date.toLowerCase();
  const month = MONTH_NAMES.findIndex((name) => new RegExp(`\\b${name}\\b`).test(text)) + 1;
  if (month === 0) return null;
  const day = text.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
  return { month, day: day && Number(day[1]) <= 31 ? Number(day[1]) : null };
}

// Whether a date is only a day and a month ("20 July", "July 20"), with no year written into it.
export const isDayAndMonth = (date: string) => parseDate(date) !== null && !/\d{3,}/.test(date);

// Whether a text states the date in the given year: the day next to the month in either order, and the year next
// to it ("20 July 1969", "July 20, 1969"), or the date anywhere when the text states no other year.
export function statesDate(date: string, text: string, year?: number): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  const month = MONTH_NAMES[parsed.month - 1];
  const day = parsed.day === null ? "" : String(parsed.day);
  const dayMonth = parsed.day === null ? `\\b${month}\\b` : `(?:\\b${month}\\s+${day}(?:st|nd|rd|th)?\\b|\\b${day}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${month}\\b)`;
  if (!new RegExp(dayMonth, "i").test(text)) return false;
  if (year === undefined) return true;
  const nextToYear = new RegExp(`${dayMonth},?\\s+(?:in\\s+)?${Math.abs(year)}\\b`, "i").test(text);
  const years = yearsIn(text);
  return nextToYear || (years.length === 1 && years[0] === year);
}

// The dates a text states with a day and a month, written like "20 July".
export function datesIn(text: string): string[] {
  const found = new Set<string>();
  const pattern = new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS})\\b`, "gi");
  for (const match of text.matchAll(pattern)) {
    const month = (match[1] ?? match[4]).toLowerCase();
    const day = Number(match[2] ?? match[3]);
    if (day >= 1 && day <= 31) found.add(`${day} ${month[0].toUpperCase()}${month.slice(1)}`);
  }
  return [...found];
}

// A sort key for a point in time: the year, then the month and day when there is a date.
export function timeKey(year: number, date?: string): number {
  const parsed = date ? parseDate(date) : null;
  return year * 10_000 + (parsed?.month ?? 0) * 100 + (parsed?.day ?? 0);
}

// Small words that can follow a range without being its unit: "between 40,000 and 50,000 by 1453".
const FUNCTION_WORDS = new Set("by in of the and to from at for with on during before after when while as a an".split(" "));

// Words for a change over time, which is not an uncertain range: "rose from 30% to 60%".
const CHANGE_WORDS = /\b(rose|risen|rising|grew|grown|growing|increased|increasing|fell|fallen|falling|dropped|dropping|declined|declining|went|jumped|climbed|doubled|tripled|shrank|cut|reduced|expanded)\s+(?:\w+\s+){0,2}from\s*$/i;

// The ranges a text states, like "25 to 50 million", "25-50 percent", "between 25 and 50 people" or "vary from 14 to
// 18 million", with the unit word after them. A change like "rose from about 30% to 60%" is not a range, a plain
// "and" joins two separate things, and a span of years is not a range either.
export function rangesIn(text: string): { low: number; high: number; unit: string }[] {
  const plain = withoutSeparators(withMinusSigns(text));
  const years = yearsIn(text);
  const number = String.raw`((?:(?<=^|[\s(])-)?\d+(?:\.\d+)?)`;
  const pattern = new RegExp(String.raw`(?:\b(between|from)\s+(?:\w+\s+)?)?${number}\s*(?:%|percent)?\s*(-|–|—|to|and)\s*${number}\s*(%|[A-Za-z]+)?`, "gi");
  return [...plain.matchAll(pattern)].flatMap((match) => {
    const [low, high] = [Number(match[2]), Number(match[4])];
    const joiner = match[3].toLowerCase();
    const opener = match[1]?.toLowerCase();
    const before = plain.slice(0, match.index ?? 0);
    if (!(high > low) || (years.includes(low) && years.includes(high))) return [];
    if (joiner === "and" && opener !== "between") return [];
    if (opener === "from" && CHANGE_WORDS.test(`${before}from`)) return [];
    const unit = (match[5] ?? "").toLowerCase();
    return [{ low, high, unit: FUNCTION_WORDS.has(unit) ? "" : unit }];
  });
}
