import { z } from "zod";
import { chatJson } from "./nebius.ts";
import { ResearchFactSchema, ScriptSentenceSchema, VideoRequestSchema, countWords } from "./pipeline.ts";
import type { Script, Usage } from "./pipeline.ts";
import { writeScriptPrompt } from "./prompts/write-script.ts";

const WORDS_PER_SECOND = 2.5;

export const ScriptInputSchema = z.object({
  request: VideoRequestSchema,
  facts: z.array(ResearchFactSchema),
});

export type ScriptResult = { script: Script; usage: Usage };

// About one scene every 8 to 15 seconds, and a word count that fits the length.
export function scriptTargets(lengthSec: number) {
  const words = Math.round(lengthSec * WORDS_PER_SECOND);
  const maxWords = Math.round(words * 1.15);
  const minScenes = Math.max(3, Math.round(lengthSec / 15));
  const maxScenes = Math.max(minScenes + 2, Math.round(lengthSec / 8));
  return { words, maxWords, minScenes, maxScenes };
}

// Scene and sentence counts go into the JSON Schema, where Token Factory enforces them.
function scriptSchema(targets: ReturnType<typeof scriptTargets>): z.ZodType<Script> {
  return z.object({
    title: z.string(),
    scenes: z
      .array(z.object({ id: z.string(), sentences: z.array(ScriptSentenceSchema).min(1).max(3) }))
      .min(targets.minScenes)
      .max(targets.maxScenes),
  });
}

function scriptProblems(script: Script, factIds: Set<string>, targets: ReturnType<typeof scriptTargets>): string[] {
  const problems: string[] = [];
  const sceneCount = script.scenes.length;
  if (sceneCount < targets.minScenes || sceneCount > targets.maxScenes) {
    problems.push(`Use ${targets.minScenes} to ${targets.maxScenes} scenes, not ${sceneCount}.`);
  }
  const sentences = script.scenes.flatMap((scene) => scene.sentences);
  const words = countWords(sentences.map((sentence) => sentence.text).join(" "));
  if (words < targets.words * 0.8 || words > targets.maxWords) {
    problems.push(`Write ${targets.words} words in total, at most ${targets.maxWords}. You wrote ${words}.`);
  }
  script.scenes.forEach((scene, index) => {
    if (scene.sentences.length < 1 || scene.sentences.length > 3) {
      problems.push(`Scene ${index + 1} has ${scene.sentences.length} sentences. Use 1 to 3.`);
    }
  });
  for (const sentence of sentences) {
    if (sentence.factIds.length === 0) problems.push(`This sentence cites no facts: "${sentence.text}"`);
    for (const id of sentence.factIds) {
      if (!factIds.has(id)) problems.push(`Unknown fact ID "${id}" in: "${sentence.text}"`);
    }
  }
  return problems;
}

export async function writeScript({ request, facts }: z.infer<typeof ScriptInputSchema>): Promise<ScriptResult> {
  const targets = scriptTargets(request.lengthSec);
  const factIds = new Set(facts.map((fact) => fact.id));
  const { data, usage } = await chatJson({
    step: "script",
    schemaName: "script",
    schema: scriptSchema(targets),
    messages: writeScriptPrompt(request, facts, targets),
    maxTokens: 4000,
    check: (script) => scriptProblems(script, factIds, targets),
  });
  // Our own scene IDs, so the fact-check can name sentences like "scene-2.1".
  const scenes = data.scenes.map((scene, index) => ({ ...scene, id: `scene-${index + 1}` }));
  return { script: { title: data.title, scenes }, usage };
}
