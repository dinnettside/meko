import { z } from "zod";
import { THEME_NAMES } from "./themes.ts";

// Zod version of the storyboard contract in CLAUDE.md. Change only with Trym's OK.

// How a person is drawn: by the role the narration gives them, never by gender or skin color.
export const FIGURE_LOOKS = ["person", "astronaut", "scientist", "soldier", "ruler", "worker", "explorer", "doctor"] as const;
// What a space scene can show.
export const SPACE_BODIES = ["earth", "moon", "sun", "mars"] as const;

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  // Only web addresses, so a link to a source can never run code in the page.
  url: z.string().regex(/^https?:\/\//i, "must be an http or https address"),
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
  // A template from remotion/filmmotor that draws this scene instead of its own scene, with the params it is drawn
  // with, picked for variety. The scene's own fields still hold what it shows, checked as usual.
  look: z.object({ template: z.string(), params: z.record(z.string(), z.unknown()) }).optional(),
};

// `icon` is a big icon for the topic, drawn beside the heading in a video without places, where there is no globe.
const TitleSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("title"),
  heading: z.string(),
  subheading: z.string().optional(),
  icon: z.string().optional(),
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
  // Trade and travel routes drawn along their way: a land route through the places it passed, a sea route through
  // water from port to port. `year` is when the journey took place, so a sea route only uses canals open then, and
  // `icon` is what travels along it (a ship, a camel, a horse), or a plain arrowhead without one.
  routes: z
    .array(
      z.object({
        stops: z.array(z.object({ lon: z.number(), lat: z.number(), label: z.string().optional() })),
        by: z.enum(["land", "sea"]),
        label: z.string().optional(),
        year: z.number().optional(),
        icon: z.string().optional(),
      }),
    )
    .optional(),
});

// `date` is a day and month like "20 July", so events from the same year can share a timeline. `eras` are periods,
// like a dynasty or a war, drawn as bands under the events.
const TimelineSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("timeline"),
  events: z.array(z.object({ year: z.number(), label: z.string(), date: z.string().optional() })),
  focusIndex: z.number(),
  eras: z.array(z.object({ start: z.number(), end: z.number(), label: z.string() })).optional(),
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

// A process or a chain of causes, drawn as boxes with arrows. `icons` has an icon name per step, or none.
const StepsSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("steps"),
  steps: z.array(z.string()),
  icons: z.array(z.string()).optional(),
});

// Two to four things of one kind side by side, like types, goods or effects, drawn as cards without arrows. A card
// can show an icon, like gold bars for "Gold".
const ListSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("list"),
  items: z.array(z.object({ title: z.string(), detail: z.string().optional(), icon: z.string().optional() })),
});

// Two sides compared point by point, like a scoreboard: each row names a point and what it is for each side.
const VersusSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("versus"),
  left: z.string(),
  right: z.string(),
  leftIcon: z.string().optional(),
  rightIcon: z.string().optional(),
  rows: z.array(z.object({ label: z.string(), left: z.string(), right: z.string() })),
});

// The people the narration names, as simple figures with their names, like the crew of Apollo 11. A figure can hold
// something, like a scientist with a flask.
const PeopleSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("people"),
  people: z.array(
    z.object({ name: z.string(), role: z.string().optional(), look: z.enum(FIGURE_LOOKS), prop: z.string().optional() }),
  ),
});

// Space: a craft flying between bodies ("journey"), or the Moon's near side with its large seas and the sites the
// narration names ("moon"). Sites are names from a fixed table, placed by the code.
const SpaceSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("space"),
  view: z.enum(["journey", "moon"]),
  bodies: z.array(z.enum(SPACE_BODIES)).optional(),
  craft: z.object({ from: z.enum(SPACE_BODIES), to: z.enum(SPACE_BODIES), label: z.string().optional() }).optional(),
  sites: z.array(z.string()).optional(),
});

// A free picture the director composes from icons and figures with labels, placed on a 0-100 grid across the free
// part of the frame, with arrows between them.
const IllustrationSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("illustration"),
  title: z.string().optional(),
  items: z.array(
    z.object({
      icon: z.string().optional(),
      figure: z.enum(FIGURE_LOOKS).optional(),
      label: z.string().optional(),
      x: z.number(),
      y: z.number(),
      size: z.enum(["small", "medium", "large"]).optional(),
    }),
  ),
  links: z.array(z.object({ from: z.number(), to: z.number(), label: z.string().optional() })).optional(),
});

// An old name or status struck through and replaced by the new one, like Constantinople becoming Istanbul.
const ChangeSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("change"),
  from: z.string(),
  to: z.string(),
  year: z.number().optional(),
});

// One of Trym's filmmotor templates (remotion/filmmotor), like a cycle, a pyramid or a myth card, with the params it
// is drawn with. The director checks every text and number in them against the narration and facts.
const TemplateSceneSchema = z.object({
  ...sceneBase,
  kind: z.literal("template"),
  template: z.string(),
  params: z.record(z.string(), z.unknown()),
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
  VersusSceneSchema,
  ChangeSceneSchema,
  PeopleSceneSchema,
  SpaceSceneSchema,
  IllustrationSceneSchema,
  TemplateSceneSchema,
]);

export const StoryboardSchema = z.object({
  title: z.string(),
  language: z.enum(["en", "no"]),
  // The look of the whole video (lib/themes.ts), picked by the director from the topic. Night atlas when left out.
  theme: z.enum(THEME_NAMES).optional(),
  fps: z.literal(30),
  width: z.literal(1920),
  height: z.literal(1080),
  scenes: z.array(SceneSchema),
  sources: z.array(SourceSchema),
});

export type Source = z.infer<typeof SourceSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type FigureLook = (typeof FIGURE_LOOKS)[number];
export type SpaceBody = (typeof SPACE_BODIES)[number];
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
