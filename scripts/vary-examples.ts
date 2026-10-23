// Picks how each example video in the feed opens and which look each of its scenes gets, for the whole feed at once,
// so that scrolling never shows two videos in a row that open the same way or share a look, and no look is used much
// more often than the others. It changes only the `look` of scenes in public/examples/<slug>.json: what the scenes say
// and show, their facts and their timing stay the same. Free to run: it calls no model and no API.
//   npm run vary-examples            prints the plan
//   npm run vary-examples -- --write writes it into the files
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EXAMPLES } from "../lib/example.ts";
import type { Example } from "../lib/example.ts";
import { introOptions, looksFor, showsAgain } from "../lib/looks.ts";
import type { Look } from "../lib/looks.ts";
import { yearsIn } from "../lib/numbers.ts";
import type { Scene } from "../lib/storyboard.ts";

const write = process.argv.includes("--write");
const STORY_OPENINGS = ["own title (globe)", "number_hook", "date_hook"];
const fileOf = (slug: string) => path.join(process.cwd(), "public", "examples", `${slug}.json`);

// A number from a text, the same every time (the same hash as lib/looks.ts), to break ties between equal choices.
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

// What a scene looks like on screen with a choice: the template of its look, or its own kind of drawing.
const drawn = (scene: Scene, look: Look | undefined) => look?.template ?? (scene.kind === "template" ? scene.template : scene.kind);

// The look options of each scene, as lib/direct.ts gives them when it makes a video: none for the title (it has its
// own options below) and for the director's own templates, which are what the scene says.
function sceneOptions(example: Example): (Look | undefined)[][] {
  const { storyboard, facts } = example;
  return storyboard.scenes.map((scene, index) => {
    if (index === 0 || scene.kind === "template") return [];
    const quoteFact =
      scene.kind === "quote" ? facts.find((fact) => fact.sourceId === scene.sourceId && fact.quote.includes(scene.text)) : undefined;
    const looks = looksFor(scene, {
      isLast: index === storyboard.scenes.length - 1,
      sourceTitle: scene.kind === "quote" ? storyboard.sources.find((source) => source.id === scene.sourceId)?.title : undefined,
      excerpt: quoteFact?.quote.trim(),
    });
    return [undefined, ...looks];
  });
}

// The opening options, as lib/direct.ts gives them: the question the title asks, the years its narration spans, and
// whether the video has maps. The video's own title card is `undefined`, when it has a picture.
function openingOptions(example: Example): (Look | undefined)[] {
  const title = example.storyboard.scenes[0];
  // A template the video shows as a scene of its own, which an opening must not show again. A stat scene counts as
  // "stat" too (see SAME_PICTURE in lib/looks.ts), so a video with one never opens with a number counting up: here its
  // look is picked after the opening, and it may keep its own drawing, which shows one.
  const shown = example.storyboard.scenes.flatMap((scene) => (scene.kind === "template" ? [scene.template] : scene.kind === "stat" ? ["stat"] : []));
  if (title?.kind !== "title") return [];
  const years = [...new Set(yearsIn(title.narration))].sort((a, b) => a - b);
  const options = introOptions(title, {
    question: title.subheading?.trim().endsWith("?") ? title.subheading.trim() : undefined,
    years: years.length >= 2 ? [years[0], years[years.length - 1]] : undefined,
    places: example.storyboard.scenes.some((scene) => scene.kind === "map"),
  });
  return [...(options.own ? [undefined] : []), ...options.looks.filter((look) => !showsAgain(look.template, shown))];
}

const examples = await Promise.all(
  EXAMPLES.map(async ({ slug }) => {
    const text = await readFile(fileOf(slug), "utf8");
    // Some files write letters beyond ASCII as \u escapes; they are written back the same way, so only looks change.
    return { slug, example: JSON.parse(text) as Example, escaped: !/[^\x00-\x7f]/.test(text) };
  }),
);
const asJson = (value: unknown, escaped: boolean) => {
  const text = JSON.stringify(value, null, 1);
  return (escaped ? text.replace(/[\u0080-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`) : text) + "\n";
};
const counts = new Map<string, number>(); // how many videos so far show each drawing
const count = (name: string) => counts.get(name) ?? 0;
let previous = new Set<string>(); // what the video before shows
let previousOpening = "";

for (const { slug, example, escaped } of examples) {
  const { storyboard } = example;
  const seed = storyboard.title;
  const shown = new Set<string>(storyboard.scenes.flatMap((scene) => (scene.kind === "template" ? [scene.template] : [])));

  // The opening: never the way the video before opened, then the way fewest videos have opened so far. Openings drawn
  // from the video's own story win a tie: a globe turning to its part of the world, or a number or a date it says.
  const openings = openingOptions(example);
  // The video's own title card shows a globe when the video has maps, else the topic's icon.
  const ownPicture = storyboard.scenes.some((scene) => scene.kind === "map") ? "globe" : "icon";
  const openingName = (look: Look | undefined) => (look ? look.template : `own title (${ownPicture})`);
  // Sorted as boxes, since sort() puts `undefined` (the video's own title card) last without comparing it.
  const opening = openings
    .map((look) => {
      const name = openingName(look);
      return { look, name, cost: (name === previousOpening ? 100 : 0) + count(name) - (STORY_OPENINGS.includes(name) ? 0.5 : 0) };
    })
    .sort((a, b) => a.cost - b.cost || hash(`${seed}#intro#${a.name}`) - hash(`${seed}#intro#${b.name}`))[0]?.look;

  // Each scene: never a template the video already shows, then avoid what the video before showed, what the scene
  // before looks like, and what many videos already show.
  const options = sceneOptions(example);
  const picks: (Look | undefined)[] = storyboard.scenes.map(() => undefined);
  if (opening) shown.add(opening.template);
  storyboard.scenes.forEach((scene, index) => {
    if (options[index].length === 0) return;
    // Nor one that shows the same picture as the opening, like a big number after a number opening.
    const free = options[index].filter((look) => !look || (!shown.has(look.template) && !(opening && showsAgain(opening.template, [look.template]))));
    const cost = (look: Look | undefined) => {
      const name = drawn(scene, look);
      // The scene before as this plan draws it: its pick when it has options, else its own look.
      const lookBefore = index - 1 === 0 ? opening : options[index - 1].length ? picks[index - 1] : storyboard.scenes[index - 1].look;
      const before = index > 0 ? drawn(storyboard.scenes[index - 1], lookBefore) : "";
      return (previous.has(name) ? 4 : 0) + (name === before ? 3 : 0) + 2 * count(name);
    };
    const best = free
      .map((look) => ({ look, cost: cost(look), tie: hash(`${seed}#${index}#${drawn(scene, look)}`) }))
      .sort((a, b) => a.cost - b.cost || a.tie - b.tie)[0]?.look;
    picks[index] = best;
    if (best) shown.add(best.template);
  });

  // What this video shows, for the next one and the totals.
  const names = new Set(storyboard.scenes.map((scene, index) => (index === 0 ? openingName(opening) : drawn(scene, options[index].length ? picks[index] : scene.look))));
  for (const name of names) counts.set(name, count(name) + 1);
  previous = names;
  previousOpening = openingName(opening);

  const changes: string[] = [];
  storyboard.scenes.forEach((scene, index) => {
    const next = index === 0 ? opening : options[index].length ? picks[index] : scene.look;
    if ((scene.look?.template ?? "") !== (next?.template ?? "")) changes.push(`${index + 1}: ${scene.look?.template ?? "own"} -> ${next?.template ?? "own"}`);
    if (index === 0 || options[index].length) {
      if (next) scene.look = next;
      else delete scene.look;
    }
  });
  console.log(`${slug.padEnd(16)} opens with ${openingName(opening).padEnd(22)} ${changes.length ? changes.join(", ") : "no change"}`);
  if (write) await writeFile(fileOf(slug), asJson(example, escaped));
}
console.log(write ? "Written." : "Nothing written; add --write to write it.");
