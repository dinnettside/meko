import { z } from "zod";
import { chatJson } from "./nebius.ts";
import {
  CHARS_PER_SECOND,
  CHARS_PER_WORD,
  ResearchFactSchema,
  ScriptSentenceSchema,
  VideoRequestSchema,
  countWords,
} from "./pipeline.ts";
import type { Script, Usage } from "./pipeline.ts";
import { writeScriptPrompt } from "./prompts/write-script.ts";

export const ScriptInputSchema = z.object({
  request: VideoRequestSchema,
  facts: z.array(ResearchFactSchema),
});

export type ScriptResult = { script: Script; usage: Usage };

// About one scene every 8 to 12 seconds, so the picture changes often, and a narration that fits the length.
// The short pauses between scenes take about 6% of the video. The length is checked in characters, which predict
// the spoken time better than words; the prompt still asks for words, which the model counts better.
export function scriptTargets(lengthSec: number) {
  const maxChars = Math.round(lengthSec * 0.94 * CHARS_PER_SECOND);
  const minChars = Math.round(maxChars * 0.85);
  const words = Math.round(maxChars / CHARS_PER_WORD);
  const maxWords = words;
  const minScenes = Math.max(3, Math.round(lengthSec / 12));
  const maxScenes = Math.max(minScenes + 2, Math.round(lengthSec / 8));
  // Short scenes keep the picture moving: at most about 15 seconds each, and a quick opening.
  return { words, maxWords, minChars, maxChars, minScenes, maxScenes, maxSceneWords: 35, maxOpeningWords: 25 };
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
  const text = sentences.map((sentence) => sentence.text).join(" ");
  if (text.length < targets.minChars || text.length > targets.maxChars) {
    const wordsNow = countWords(text);
    const advice = text.length > targets.maxChars ? "Make it shorter" : "Make it longer";
    problems.push(`The narration does not fit the length. ${advice}: write about ${targets.words} words in total, not ${wordsNow}.`);
  }
  script.scenes.forEach((scene, index) => {
    if (scene.sentences.length < 1 || scene.sentences.length > 3) {
      problems.push(`Scene ${index + 1} has ${scene.sentences.length} sentences. Use 1 to 3.`);
    }
    const sceneWords = countWords(scene.sentences.map((sentence) => sentence.text).join(" "));
    // The opening needs a few seconds of narration while the title and the globe come in.
    if (index === 0 && sceneWords < 10) problems.push(`The opening has ${sceneWords} words. Use at least 10.`);
    const limit = index === 0 ? targets.maxOpeningWords : targets.maxSceneWords;
    // A few words over the limit is fine and not worth a retry.
    if (sceneWords > limit + 5) problems.push(`Scene ${index + 1} has ${sceneWords} words. Use at most ${limit}.`);
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
