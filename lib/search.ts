import type { FeedItem } from "./example.ts";

// Search through the feed's videos. Every word typed must begin a word of the video, so "volc" finds "How volcanoes
// erupt", and a video whose title or topic holds the words comes before one that only says them in its narration or
// cites them in a source title. Videos that match as well keep their order in the feed. The words a question wraps
// around its subject are left out, so "why do volcanoes erupt" searches for "volcanoes erupt".

// The words of a text as search compares them: lower case, without accents and without punctuation, so "Pompéi" is
// "pompei" and "fact-checked" is "fact" and "checked".
export function searchWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Question words, pronouns, small linking and helping words, and "explain" in its forms ("s" is what is left of
// "what's"). A video seldom says "what is", "we" or "explained", so requiring them would find nothing for "what is the
// black death", "how did we land on the moon" or "earthquakes explained". A search of only these words, like "how",
// still searches for them.
const FILLER = new Set(
  "what why how when where who whom whose which is are was were be been being do does did have has had will would shall should can could may might must a an the of on in into at to for from by with about and or s i me my we us our you your they them their it its tell explain explains explained explaining explainer explanation".split(" "),
);

// A word without a simple plural ending: "volcanoes" is "volcano", "arteries" is "artery", "churches" is "church".
// Words that only look like plurals, like "virus" or "analysis", stay as they are. Short words lose only their "s", so
// "toes" is "toe" and "dies" is "die", not "to" and "dy", which begin far too many words.
function singular(word: string): string {
  if (word.length <= 3 || /(?:ss|us|is)$/.test(word)) return word;
  if (word.endsWith("ies")) return word.length > 4 ? `${word.slice(0, -3)}y` : word.slice(0, -1);
  if (/(?:x|z|ch|sh|ss)es$/.test(word) || (word.length > 5 && word.endsWith("oes"))) return word.slice(0, -2);
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

// Whether a typed word begins a word of the video, in either number: "volcano" finds "volcanoes", "volcanoes" finds
// "volcano" and "artery" finds "arteries".
function begins(typed: string, word: string): boolean {
  return word.startsWith(typed) || word.startsWith(singular(typed)) || singular(word).startsWith(singular(typed));
}

const found = (typed: string, words: string[]) => words.some((word) => begins(typed, word));

// The videos that match a search, best first. An empty search keeps the whole feed in its order.
export function searchFeed<T extends Pick<FeedItem, "title" | "topic" | "searchText">>(items: T[], query: string): T[] {
  const words = searchWords(query);
  if (words.length === 0) return items;
  const subject = words.filter((word) => !FILLER.has(word));
  const typed = subject.length > 0 ? subject : words;
  return items
    .map((item, order) => {
      const headline = searchWords(`${item.title} ${item.topic}`);
      const everything = searchWords(item.searchText);
      // Every typed word must be somewhere in the video; the ones in its title or topic count for its place.
      const matches = typed.every((word) => found(word, headline) || found(word, everything));
      return { item, order, matches, score: typed.filter((word) => found(word, headline)).length };
    })
    .filter((result) => result.matches)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((result) => result.item);
}
