// Words of a text, for comparing what two texts say.

const STOPWORDS = new Set(
  "about after also before between during from have into more most only over some than that their them then there these they this those very were what when which while with your".split(" "),
);
// Short words that carry no claim of their own.
const GLUE = new Set("a an the of and or in on at to for by as is was are be it its s how why who did do does".split(" "));

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

// The longer words of a text, the ones that carry its meaning.
export const contentWords = (text: string) => words(text).filter((word) => word.length >= 4 && !STOPWORDS.has(word));

// Every word that could carry a claim, short ones included: "No", "Few", "Won" and "XVI" count, "the" and "of"
// do not. Used where every word of a label must be backed, so a one-word answer cannot be made up.
export const claimWords = (text: string) => words(text).filter((word) => !GLUE.has(word) && !STOPWORDS.has(word));

// Every word but the glue, small words like "more", "only" and "before" included.
const plainWords = (text: string) => words(text).filter((word) => !GLUE.has(word));

// A word without its plural ending: "kings" is "king", "navies" is "navy", "churches" is "church".
function singular(word: string): string {
  if (word.length <= 3 || /(?:ss|us|is)$/.test(word)) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(?:x|z|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

// What two forms of a word share: the singular, cut to 5 letters, so "summons" matches "summoned" and "kings"
// matches "king". "XV" does not match "XVI".
export const wordKey = (word: string) => singular(word).slice(0, 5);

// How much of a text is backed by a source: how many of its claim words also appear there. With `strict`, small
// words like "more" or "only" must be backed too, so "Only army" does not pass where the narration says "army".
export function groundedWords(text: string, source: string, { strict = false } = {}): { matched: number; total: number } {
  const keys = new Set(plainWords(source).map(wordKey));
  const claims = strict ? plainWords(text) : claimWords(text);
  return { matched: claims.filter((word) => keys.has(wordKey(word))).length, total: claims.length };
}

// Words that say a claim may not hold, as in "may have helped end feudalism", or only sets its upper bound, as in "up to
// half". "Could" and "estimated" are left out: "peasants could demand higher wages" is no hedge, and an estimated
// number is shown as the number.
const HEDGE = /\b(may|might|possibly|probably|perhaps|likely|reportedly|allegedly|believed|thought to|suggests?|up to|as many as)\b/i;

// Whether a text on screen states as certain what the narration only says may be true: most of its words come from a
// hedged part of the narration, but it keeps no hedge. "End of feudalism" drops the "may" of "may have helped end
// feudalism".
export function dropsHedge(text: string, narration: string): boolean {
  if (HEDGE.test(text)) return false;
  const textKeys = [...new Set(contentWords(text).map(wordKey))];
  if (textKeys.length === 0) return false;
  return narration
    .split(/[.;:!?,]|\band\b|\bbut\b/i)
    .filter((clause) => HEDGE.test(clause))
    .some((clause) => {
      const keys = new Set(contentWords(clause).map(wordKey));
      return textKeys.filter((key) => keys.has(key)).length >= Math.ceil(textKeys.length / 2);
    });
}

// Whether two labels say the same thing in other forms of the same words, like "Europe population killed" and
// "European population killed".
export function sameWords(a: string, b: string): boolean {
  const keys = (text: string) => [...new Set(plainWords(text).map(wordKey))].sort().join(" ");
  return keys(a) !== "" && keys(a) === keys(b);
}

// A period after one of these does not end a sentence: "U.S. Army", "Dr. King", "c. 1350", "Dec. 7", "10:56 p.m.",
// or an initial like the F in "John F. Kennedy" or the W in "G.W. Goethals".
const ABBREVIATION =
  /(?:^|[\s(.])(?:\p{Lu}|U\.S|U\.K|U\.N|Dr|Mr|Mrs|Ms|Prof|St|Mt|Ft|Gen|Col|Maj|Lt|Capt|Sgt|Adm|Gov|Sen|Rep|Rev|Jr|Sr|No|Nos|Vol|Inc|Ltd|Co|Corp|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|c|ca|e\.g|i\.e|vs|approx|[ap]\.m)\.$/u;

// The sentences of a text. A sentence ends at ".", "!" or "?" (and any closing quote) before a new sentence that
// starts with a capital letter, a digit or an opening quote. "World War I." ends one, though "I" looks like an initial.
export function sentencesOf(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?]+["”’')\]]*(?=\s+["“‘'(]?[\p{Lu}\d])/gu)) {
    const end = match.index + match[0].length;
    const upToPeriod = text.slice(start, match.index + 1);
    if (match[0].startsWith(".") && ABBREVIATION.test(upToPeriod) && !/\bWar I\.$/.test(upToPeriod)) continue;
    sentences.push(text.slice(start, end).trim());
    start = end;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
}

// Whether a piece of text is a sentence on its own: it starts like one and ends like one. The start of a quote cut
// from the middle of a sentence is not.
const isWholeSentence = (sentence: string) => /^["“‘'(]?[\p{Lu}\d]/u.test(sentence) && /[.!?]["”’')\]]*$/.test(sentence);

// The whole sentences of a text, like the ones a quote scene may show. Words someone said, in quote marks inside a
// sentence, count too: "We shall fight on the beaches." in 'He said: "We shall fight on the beaches."'.
export function wholeSentencesOf(text: string): string[] {
  const spoken = [...text.matchAll(/[“"]([^“”"]+)[”"]/g)].map((match) => match[1].trim());
  return [...sentencesOf(text), ...spoken].filter(isWholeSentence);
}

// Text as plain words for comparing: no markdown, straight quotes and dashes, single spaces, and no quote marks or
// end punctuation around it.
const plain = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'(\s]+|["')\s.!?]+$/g, "");

// Whether a quote is one whole sentence of the source, word for word: not a sentence cut short, not the end of one,
// and not two.
export const isSentenceOf = (quote: string, source: string) =>
  plain(quote).length > 0 && wholeSentencesOf(source).some((sentence) => plain(sentence) === plain(quote));
