import { readFile } from "node:fs/promises";
import path from "node:path";
import { EXAMPLES, feedItem } from "./example.ts";
import type { Example, FeedItem } from "./example.ts";

// The feed's videos in order, read from their files in public/examples, on the server. A video whose file is missing
// is left out.
export async function loadFeedItems(): Promise<FeedItem[]> {
  const items = await Promise.all(
    EXAMPLES.map(async ({ slug }) => {
      try {
        const example = JSON.parse(await readFile(path.join(process.cwd(), "public", "examples", `${slug}.json`), "utf8")) as Example;
        return feedItem(slug, example);
      } catch {
        return null;
      }
    }),
  );
  return items.filter((item) => item !== null);
}
