import { readFile } from "node:fs/promises";
import path from "node:path";
import { MakeVideo } from "@/components/MakeVideo";
import { demoCodeRequired } from "@/lib/demo-code";
import { EXAMPLES, exampleMeta } from "@/lib/example";
import type { Example } from "@/lib/example";

// The start page. The examples' facts for the gallery (length, sources, checks) are read from their files here, on the
// server, so the page arrives with them.
export default async function Home() {
  const examples = await Promise.all(
    EXAMPLES.map(async ({ slug }) => {
      const example = JSON.parse(await readFile(path.join(process.cwd(), "public", "examples", `${slug}.json`), "utf8")) as Example;
      return exampleMeta(slug, example);
    }),
  );
  return <MakeVideo codeRequired={demoCodeRequired()} examples={examples} />;
}
