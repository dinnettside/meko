// The longer words of a text, the ones that carry its meaning, for comparing what two texts say.

const STOPWORDS = new Set(
  "about after also before between during from have into more most only over some than that their them then there these they this those very were what when which while with your".split(" "),
);

export const contentWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
