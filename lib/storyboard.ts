import { z } from "zod";

// Zod version of the storyboard contract in CLAUDE.md. Change only with Trym's OK.

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
});

export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceId: z.string(),
});

const sceneBase = {
  id: z.string(),
  narration: z.string(),
  factIds: z.array(z.string()),
  durationSec: z.number(),
};

const TitleSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("title"),
  heading: z.string(),
  subheading: z.string().optional(),
});

const TextSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("text"),
  lines: z.array(z.string()),
});

const MapSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("map"),
  frame: z.array(z.string()),
  highlights: z.array(
    z.object({
      country: z.string(),
      label: z.string().optional(),
      tone: z.enum(["primary", "secondary", "muted"]),
    }),
  ),
  arrows: z
    .array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() }))
    .optional(),
  markers: z
    .array(z.object({ lon: z.number(), lat: z.number(), label: z.string() }))
    .optional(),
});

// `date` is a day and month like "20 July", so events from the same year can share a timeline.
const TimelineSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("timeline"),
  events: z.array(z.object({ year: z.number(), label: z.string(), date: z.string().optional() })),
  focusIndex: z.number(),
});

// One big number. With `total`, the video draws `value` out of `total` as a grid of dots. With `valueMax`, the
// number is a range, like 25 to 50 million, and the uncertain part is drawn as an outline.
const StatSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("stat"),
  value: z.number(),
  valueMax: z.number().optional(),
  unit: z.string().optional(),
  label: z.string(),
  total: z.number().optional(),
});

// A bar chart. All bars share one unit.
const CompareSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("compare"),
  title: z.string(),
  unit: z.string().optional(),
  bars: z.array(z.object({ label: z.string(), value: z.number() })),
});

// A source's exact words, shown with the source's name.
const QuoteSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("quote"),
  text: z.string(),
  sourceId: z.string(),
});

// A process or a chain of causes, drawn as boxes with arrows.
const StepsSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("steps"),
  steps: z.array(z.string()),
});

// Two to four things of one kind side by side, like types, goods or effects, drawn as cards without arrows.
const ListSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("list"),
  items: z.array(z.object({ title: z.string(), detail: z.string().optional() })),
});

export const SceneSchema = z.discriminatedUnion("kind", [
  TitleSceneSchema,
  TextSceneSchema,
  MapSceneSchema,
  TimelineSceneSchema,
  StatSceneSchema,
  CompareSceneSchema,
  QuoteSceneSchema,
  StepsSceneSchema,
  ListSceneSchema,
]);

export const StoryboardSchema = z.object({
  title: z.string(),
  language: z.enum(["en", "no"]),
  fps: z.literal(30),
  width: z.literal(1920),
  height: z.literal(1080),
  scenes: z.array(SceneSchema),
  sources: z.array(SourceSchema),
});

export type Source = z.infer<typeof SourceSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

// Rules zod cannot check on its own. Returns one line per problem, empty when all is fine.
export function storyboardProblems(storyboard: Storyboard, factIds: string[]): string[] {
  const problems: string[] = [];
  const knownFacts = new Set(factIds);
  const isCountryCode = (code: string) => /^[A-Z]{3}$/.test(code);

  const sourceIds = new Set(storyboard.sources.map((source) => source.id));
  for (const scene of storyboard.scenes) {
    if (scene.kind === "quote" && !sourceIds.has(scene.sourceId)) {
      problems.push(`Scene ${scene.id}: the quote's source "${scene.sourceId}" is not in the source list`);
    }
    if (!(scene.durationSec > 0)) {
      problems.push(`Scene ${scene.id}: durationSec must be above 0, got ${scene.durationSec}`);
    }
    for (const factId of scene.factIds) {
      if (!knownFacts.has(factId)) {
        problems.push(`Scene ${scene.id}: unknown fact ID "${factId}"`);
      }
    }
    if (scene.kind === "map") {
      const codes = [
        ...scene.frame,
        ...scene.highlights.map((highlight) => highlight.country),
        ...(scene.arrows ?? []).flatMap((arrow) => [arrow.from, arrow.to]),
      ];
      for (const code of codes) {
        if (!isCountryCode(code)) {
          problems.push(`Scene ${scene.id}: "${code}" is not a 3-letter country code`);
        }
      }
    }
  }
  return problems;
}
