import { amountsIn, isDateIn, isNameNumber, numbersIn } from "./numbers.ts";
import { namesAPlace } from "./regions.ts";
import { claimWords, groundedWords, sentencesOf } from "./words.ts";

// Tests of whether what a scene shows is backed by its narration and facts, shared by the director's own kinds and
// the templates.

// Labels that state something (steps, stats, charts, timeline events) need more than half their words backed by the
// narration and facts. A short label may have one other word, like "occurred" in "94 deaths occurred", but never
// only other words. This keeps the director from adding claims on screen that the narration does not make.
export function isGrounded(text: string, source: string): boolean {
  const loose = groundedWords(text, source);
  // A label of small words only, like "Before" or "After", must use the narration's own small words.
  const { matched, total } = loose.total > 0 ? loose : groundedWords(text, source, { strict: true });
  return total <= 3 ? matched >= Math.max(1, total - 1) : matched / total > 0.5;
}

// A scoreboard answer or a struck-out name is a claim in a word or two, so every word of it must be backed, small
// words like "more" or "only" too: no "No", no "More soldiers" and no "Louis XV" that the narration does not say.
export function isFullyGrounded(text: string, source: string): boolean {
  const { matched, total } = groundedWords(text, source, { strict: true });
  return total > 0 && matched === total;
}

// Summary lines may say things in other words, so a third is enough for them.
export function lineIsGrounded(text: string, source: string): boolean {
  const { matched, total } = groundedWords(text, source);
  return total === 0 || matched / total >= 1 / 3;
}

// The clauses of a text, split at commas (not those in "17,000"), semicolons and words like "and", so a role or a
// label is tied to the person or thing it is said about.
const CLAUSE_BREAK = /(?<!\d),|,(?!\d)|[;:]|\b(?:and|but|while|whereas)\b/;
export const clausesOf = (text: string) => sentencesOf(text).flatMap((sentence) => sentence.split(CLAUSE_BREAK));
export const statedTogether = (name: string, words: string, source: string) =>
  clausesOf(source).some((clause) => groundedWords(name, clause).matched > 0 && isGrounded(words, clause));
// A person's role, word for word in a clause that names them, or right after it as in "Marie Curie, a physicist":
// "Commander" under Michael Collins is not "Command Module Pilot", though the two share a stem, and in "Armstrong,
// the commander, and Aldrin, the pilot" the pilot is Aldrin.
export const roleOf = (name: string, role: string, source: string) =>
  sentencesOf(source).some((sentence) => {
    const clauses = sentence.split(CLAUSE_BREAK);
    const names = (clause: string | undefined) => clause !== undefined && groundedWords(name, clause).matched > 0;
    return clauses.some(
      (clause, index) => hasPhrase(role, clause) && (names(clause) || (/^\s*(?:a|an|the)\b/i.test(clause) && names(clauses[index - 1]))),
    );
  });

// Whether a name or phrase appears as a whole in a text, word for word, ignoring case, punctuation and small words
// like "the", "landing" or "site": "Sea of Tranquility" needs all of it, not only "Sea".
export const phraseWords = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word && !["the", "landing", "site", "area"].includes(word));
export function hasPhrase(phrase: string, text: string): boolean {
  const wanted = phraseWords(phrase).join(" ");
  return wanted !== "" && ` ${phraseWords(text).join(" ")} `.includes(` ${wanted} `);
}

export const isPercent = (unit?: string) => /^(%|percent|per cent)$/i.test(unit?.trim() ?? "");

// Units that mean the same: "km" and "kilometres", "%" and "per cent".
const UNIT_NAMES: Record<string, string> = {
  "%": "percent", "per cent": "percent", km: "kilometer", kilometre: "kilometer", kilometres: "kilometer", kilometers: "kilometer",
  mi: "mile", m: "meter", metre: "meter", metres: "meter", meters: "meter", kg: "kilogram", kilograms: "kilogram",
  lb: "pound", lbs: "pound", tonne: "ton", tonnes: "ton",
};
export const unitKey = (unit: string) => {
  const word = unit.trim().toLowerCase();
  return (UNIT_NAMES[word] ?? word).replace(/s$/, "");
};

// The amounts a text gives: not the day of a date like "9 November", and not a number in a name like "Apollo 11".
export const amountsFor = (text: string) =>
  amountsIn(text).filter((amount) => {
    const value = Number.parseFloat(amount);
    return !isDateIn(value, text) && !isNameNumber(value, text);
  });

export const isYearLike = (value: number) => Number.isInteger(value) && value >= 1000 && value <= 2100;

// Measure words a chart's numbers come with. A bar whose sentence gives its number in another of these, like "50
// percent" in a chart of millions, says something else.
const MEASURES = new Set(["percent", "million", "billion", "thousand", "hundred", "kilometer", "mile", "meter", "ton", "kilogram", "pound", "dollar", "euro", "year", "month", "day", "hour"]);

// Whether one sentence of the scene gives a bar's number for its thing. The label uses the sentence's words, every
// place it names is in the sentence, the number shares a clause with a word of the label, so "17,000 were executed
// and 10,000 died in prison" cannot pair 10,000 with "executed", and the number does not come in another measure
// than the chart's.
export function barIsStated(bar: { label: string; value: number }, unit: string | undefined, source: string): boolean {
  const value = String(bar.value);
  const chartUnit = unitKey((unit ?? "").split(/\s+/)[0] ?? "");
  return sentencesOf(source).some((sentence) => {
    const places = claimWords(bar.label).filter((word) => namesAPlace(word));
    if (!isGrounded(bar.label, sentence) || places.some((word) => groundedWords(word, sentence).matched === 0)) return false;
    // Clauses end at commas (not those in "17,000"), semicolons and words like "and".
    return sentence.split(/(?<!\d),|,(?!\d)|[;:]|\b(?:and|but|while|whereas)\b/).some((clause) => {
      const tokens = clause.match(/-?\d[\d,]*(?:\.\d+)?|%|\p{L}+/gu) ?? [];
      return tokens.some((token, index) => {
        if (numbersIn(token)[0] !== value) return false;
        const next = unitKey(tokens[index + 1] ?? "");
        const otherMeasure = unit !== undefined && MEASURES.has(next) && next !== chartUnit;
        return !otherMeasure && groundedWords(bar.label, clause).matched > 0;
      });
    });
  });
}

// Words that tell a name is an animal's or a thing's, like "the dog Laika" or "Columbia, the command module".
const NOT_PEOPLE = "dogs?|monkeys?|chimpanzees?|chimps?|apes?|sheep|cats?|horses?|mice|mouse|rats?|ships?|probes?|satellites?|rockets?|spacecraft|modules?|capsules?|landers?|rovers?";
export const isNotAPerson = (name: string, source: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:${NOT_PEOPLE})\\s+${escaped}\\b|\\b${escaped},?\\s+(?:the|a|an|our)\\s+(?:${NOT_PEOPLE})\\b`, "i").test(source);
};
