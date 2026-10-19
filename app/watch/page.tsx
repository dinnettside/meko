import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Feed } from "@/components/Feed";
import { EXAMPLES, feedItem } from "@/lib/example";
import type { Example } from "@/lib/example";

export const metadata: Metadata = {
  title: "Watch: videos made by Meko",
  description: "Scroll through fact-checked explainer videos made by Meko, with the sources and the fact-check behind each one.",
};

// The feed of videos made by Meko. What each shows under the video, and the text it is searched by, are read from the
// videos' files here, on the server. A video whose file is missing is left out.
export default async function Watch() {
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
  return <Feed items={items.filter((item) => item !== null)} />;
}
