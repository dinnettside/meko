// Numbers, years and amounts in a text, so the video only shows numbers its facts state.

// Numbers without thousands separators, so "16,000" and "16000" match.
export const numbersIn = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((number) => number.replace(/,/g, ""));

// A number followed by one of these is an amount, not a year: "1500 years", "6400 km".
const UNIT_AFTER =
  /^\s*(years?|km|kilomet(er|re)s?|mi|miles?|m|met(er|re)s?|feet|ft|people|men|soldiers|ships|tons?|tonnes?|square|%|percent|BCE|BC|B\.C\.|CE|AD|A\.D\.)(?![A-Za-z])/i;

// The years a text states, like "in 1227", "73 AD" or "138 BC". Years BC are negative, as on the timeline.
// Centuries ("the 15th century") and decades ("the 1860s") are not years. A number under 1000 without AD or BC
// only counts after a word like "in", and when no lowercase word follows, so "around 400 merchants" is no year.
export function yearsIn(text: string): number[] {
  const years = new Set<number>();
  for (const match of text.matchAll(/\b(\d{1,4})\s*(BCE|BC|B\.C\.)/g)) years.add(-Number(match[1]));
  for (const match of text.matchAll(/\b(\d{1,4})\s*(CE|AD|A\.D\.)(?![A-Za-z])/g)) years.add(Number(match[1]));
  for (const match of text.matchAll(/\b(AD|A\.D\.)\s*(\d{1,4})\b/g)) years.add(Number(match[2]));
  for (const match of text.matchAll(/(?<![\d.,])(\d{4})(?!\d|[.,]\d|'?s\b)/g)) {
    const value = Number(match[1]);
    if (value >= 1000 && value <= 2100 && !UNIT_AFTER.test(text.slice((match.index ?? 0) + 4))) years.add(value);
  }
  const shortYear = /\b([Ii]n|[Bb]y|[Uu]ntil|[Ff]rom|to|[Ss]ince|[Aa]round|[Cc]irca|c\.)\s+(\d{2,3})(?=[,.;:)]|$|\s+(and|to|when|the|after|before|until|[A-Z]))/g;
  for (const match of text.matchAll(shortYear)) {
    if (!UNIT_AFTER.test(text.slice((match.index ?? 0) + match[0].length))) years.add(Number(match[2]));
  }
  return [...years].sort((a, b) => a - b);
}

// The amounts a text states, like "6,400 km" or "24 million", once per number. Years, decades ("the 1400s") and
// ordinals ("15th") are left out.
export function amountsIn(text: string): string[] {
  const years = new Set(yearsIn(text).map((year) => String(Math.abs(year))));
  const amounts = new Map<string, string>();
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)*)(st|nd|rd|th|'?s\b)?(\s+(?:million|billion|thousand))?(\s*(?:%|[A-Za-z]+))?/g)) {
    const number = match[1].replace(/,/g, "");
    if (!match[2] && !years.has(number) && !amounts.has(number)) amounts.set(number, match[0].trim());
  }
  return [...amounts.values()];
}

// Whether a text uses the number as a date: as a year, or as a decade like "the 1400s".
export function isDateIn(value: number, text: string): boolean {
  return yearsIn(text).includes(value) || new RegExp(`(^|[^\\d.,])${value}'?s\\b`).test(text.replace(/(\d),(?=\d{3})/g, "$1"));
}
