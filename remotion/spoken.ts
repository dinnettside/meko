import type { TimedWord } from "@/lib/elevenlabs";
import { contentWords } from "@/lib/words";

// A picture lands a moment before its word is heard, so it is in place as the word is said.
const LEAD_SEC = 0.2;

// The words worth listening for: the longer words and every number, without thousands separators.
const listenFor = (text: string) => {
  const plain = text.replace(/(\d),(?=\d{3}\b)/g, "$1");
  return [...contentWords(plain).map((word) => word.slice(0, 5)), ...(plain.match(/\d+/g) ?? [])];
};

// When the narration first says one of the words of `text`, in seconds into the scene, or null if it never does.
// Words match on their first five letters, so "traveled" matches "travel". Words said before `afterSec` are skipped.
export function spokenAt(words: TimedWord[], text: string, afterSec = 0): number | null {
  const wanted = new Set(listenFor(text));
  if (wanted.size === 0) return null;
  const word = words.find((candidate) => candidate.start >= afterSec && listenFor(candidate.text).some((token) => wanted.has(token)));
  return word ? word.start : null;
}

// When a picture should appear for something the narration says: as it is said, else at `fallbackSec`. Never
// before `firstSec`, and never in the last second of the scene.
export function revealAt(words: TimedWord[], text: string, fallbackSec: number, firstSec: number, durationSec: number): number {
  const spoken = spokenAt(words, text);
  const wanted = spoken === null ? fallbackSec : spoken - LEAD_SEC;
  return Math.min(Math.max(firstSec, durationSec - 1), Math.max(firstSec, wanted));
}

// When each item of a list appears: as the narration says it, else spread evenly over `spreadSec`. The items keep
// their order and come at least `gapSec` apart, so a word said early cannot pull a later item ahead.
export function revealTimes(
  texts: string[],
  words: TimedWord[],
  { firstSec, spreadSec, gapSec, durationSec }: { firstSec: number; spreadSec: number; gapSec: number; durationSec: number },
): number[] {
  const latest = Math.max(firstSec, durationSec - 1);
  const times: number[] = [];
  let heardSec = 0;
  texts.forEach((text, index) => {
    const spoken = spokenAt(words, text, heardSec);
    if (spoken !== null) heardSec = spoken;
    const wanted = spoken === null ? firstSec + (index * spreadSec) / Math.max(1, texts.length) : spoken - LEAD_SEC;
    const earliest = index === 0 ? firstSec : times[index - 1] + gapSec;
    times.push(Math.min(latest, Math.max(earliest, wanted)));
  });
  return times;
}
