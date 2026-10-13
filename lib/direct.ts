import { z } from "zod";
import { chatJson } from "./nebius.ts";
import { ResearchFactSchema, ScriptSchema, VideoRequestSchema, countWords } from "./pipeline.ts";
import type { Usage } from "./pipeline.ts";
import { directPrompt } from "./prompts/direct.ts";
import { SourceSchema, StoryboardSchema, storyboardProblems } from "./storyboard.ts";
import type { Storyboard } from "./storyboard.ts";

const WORDS_PER_SECOND = 2.5;
const PAUSE_SEC = 0.6;
const MIN_SCENE_SEC = 2.5;

export const DirectInputSchema = z.object({
  request: VideoRequestSchema,
  script: ScriptSchema,
  facts: z.array(ResearchFactSchema),
  sources: z.array(SourceSchema),
});

export type DirectResult = { storyboard: Storyboard; usage: Usage };

// Phase 1 only renders title and text scenes.
const TitleVisualSchema = z.object({ heading: z.string(), subheading: z.string().optional() });
const TextVisualSchema = z.object({ lines: z.array(z.string()) });

type Visual = z.infer<typeof TitleVisualSchema> | z.infer<typeof TextVisualSchema>;
type Visuals = Record<string, Visual>;
type NarratedScene = { id: string; narration: string; factIds: string[] };

// One required key per scene ID, so the model cannot add, drop or reorder scenes.
// The first scene shows the title and the others show text.
function visualsSchema(narrated: NarratedScene[]): z.ZodType<Visuals> {
  const shape = Object.fromEntries(
    narrated.map((scene, index) => [scene.id, index === 0 ? TitleVisualSchema : TextVisualSchema]),
  );
  return z.object(shape);
}

// Estimated from the word count until we have voice-over.
export function sceneDuration(narration: string): number {
  const seconds = countWords(narration) / WORDS_PER_SECOND + PAUSE_SEC;
  return Math.max(MIN_SCENE_SEC, Math.round(seconds * 10) / 10);
}

const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)*/g) ?? [];

function visualProblems(visuals: Visuals, narrated: NarratedScene[]): string[] {
  const problems: string[] = [];
  for (const scene of narrated) {
    const visual = visuals[scene.id];
    const shown = "heading" in visual ? [visual.heading, visual.subheading ?? ""] : visual.lines;
    if ("lines" in visual && (visual.lines.length < 1 || visual.lines.length > 3)) {
      problems.push(`${scene.id} must have 1 to 3 lines.`);
    }
    // Numbers on screen must come from the fact-checked narration.
    const spoken = new Set(numbersIn(scene.narration));
    for (const number of shown.flatMap(numbersIn)) {
      if (!spoken.has(number)) problems.push(`${scene.id} shows "${number}", which is not in its narration.`);
    }
  }
  return problems;
}

export async function direct({ request, script, facts, sources }: z.infer<typeof DirectInputSchema>): Promise<DirectResult> {
  // The narration is the fact-checked text, word for word. The model only chooses what is shown.
  const narrated: NarratedScene[] = script.scenes.map((scene) => ({
    id: scene.id,
    narration: scene.sentences.map((sentence) => sentence.text).join(" "),
    factIds: [...new Set(scene.sentences.flatMap((sentence) => sentence.factIds))],
  }));

  const { data, usage } = await chatJson({
    step: "direct",
    schemaName: "visuals",
    schema: visualsSchema(narrated),
    messages: directPrompt(script.title, narrated.map(({ id, narration }) => ({ id, narration }))),
    maxTokens: 3000,
    check: (visuals) => visualProblems(visuals, narrated),
  });

  const usedFactIds = new Set(narrated.flatMap((scene) => scene.factIds));
  const usedSourceIds = new Set(facts.filter((fact) => usedFactIds.has(fact.id)).map((fact) => fact.sourceId));
  const storyboard = StoryboardSchema.parse({
    title: script.title,
    language: request.language,
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: narrated.map((scene, index) => ({
      ...data[scene.id],
      kind: index === 0 ? "title" : "text",
      id: scene.id,
      narration: scene.narration,
      factIds: scene.factIds,
      durationSec: sceneDuration(scene.narration),
    })),
    sources: sources
      .filter((source) => usedSourceIds.has(source.id))
      .map(({ id, title, url }) => ({ id, title, url })),
  });

  const problems = storyboardProblems(storyboard, facts.map((fact) => fact.id));
  if (problems.length > 0) throw new Error(`The storyboard is not valid: ${problems.join("; ")}`);
  return { storyboard, usage };
}
