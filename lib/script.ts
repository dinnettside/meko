import { z } from "zod";
import { chatJson } from "./nebius.ts";
import {
  CHARS_PER_SECOND,
  spokenLength,
  CHARS_PER_WORD,
  ResearchFactListSchema,
  ScriptSentenceSchema,
  VideoRequestSchema,
  countWords,
} from "./pipeline.ts";
import { numbersIn } from "./numbers.ts";
import type { Script, Usage } from "./pipeline.ts";
import { writeScriptPrompt } from "./prompts/write-script.ts";
import { groundedWords } from "./words.ts";

export const ScriptInputSchema = z.object({
  request: VideoRequestSchema,
  facts: ResearchFactListSchema,
});

export type ScriptResult = { script: Script; usage: Usage };

// The route may run 120 s. The model call stops in time to return the best script it has.
const DEADLINE_MS = 100_000;

// All the sentences of a script as one text.
const narrationOf = (scenes: Script["scenes"]) =>
  scenes.flatMap((scene) => scene.sentences.map((sentence) => sentence.text)).join(" ");

// What is wrong with the question on the title card, one line per problem. It must be one short question, and it
// may only ask about what the narration says: no number the narration does not have, and at least a third of its
// words backed by the narration. The fact-check and the direct step check it again, since the narration can change.
// Numbers written as words, like "half" or "seventy-five". "One" is left out: "How did one plague..." counts nothing.
const NUMBER_WORDS =
  /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|third|quarter|dozen|twice|double)\b/g;

export function questionProblems(question: string, narration: string): string[] {
  const text = question.trim();
  const problems: string[] = [];
  if (!text.endsWith("?") || countWords(text) < 3 || countWords(text) > 12) {
    problems.push(`The question must be one question of 3 to 10 words that ends with "?", not "${text}".`);
  }
  const narrationNumbers = new Set(numbersIn(narration));
  const narrationWords = new Set(narration.toLowerCase().match(/\p{L}+/gu) ?? []);
  const numberWords = text.toLowerCase().match(NUMBER_WORDS) ?? [];
  if (numbersIn(text).some((number) => !narrationNumbers.has(number)) || numberWords.some((word) => !narrationWords.has(word))) {
    problems.push("The question has a number the narration does not have.");
  }
  // At least half of what the question asks about must be in the narration, so it cannot rest on a claim the
  // fact-check took out.
  const { matched, total } = groundedWords(text, narration);
  if (total > 0 && matched * 2 < total) {
    problems.push("The question asks about things the narration does not say. Use the narration's own words.");
  }
  return problems;
}

// About one scene every 8 to 12 seconds, so the picture changes often, and a narration that fits the length.
// The short pauses between scenes take about 6% of the video, and the credits at the end about 6 seconds. The length
// is checked in spoken characters (numbers counted as the words the voice says), which predict the spoken time better
// than words; the prompt still asks for words, which the model counts better.
const CREDITS_SEC = 6;
export function scriptTargets(lengthSec: number) {
  const maxChars = Math.round((lengthSec * 0.94 - CREDITS_SEC) * CHARS_PER_SECOND);
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
    question: z.string(),
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
  const text = narrationOf(script.scenes);
  // The question frames the video on its title card.
  problems.push(...questionProblems(script.question ?? "", text));
  const spoken = spokenLength(text);
  if (spoken < targets.minChars || spoken > targets.maxChars) {
    const wordsNow = countWords(text);
    const change = Math.max(5, Math.round(Math.abs(wordsNow - targets.words) / 5) * 5);
    const advice = spoken > targets.maxChars ? `Cut about ${change} words by removing whole sentences` : `Add about ${change} words`;
    problems.push(`The narration does not fit the length. ${advice}, for about ${targets.words} words in total instead of ${wordsNow}.`);
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

// How many characters a script is outside the length it should have, 0 when it fits.
function lengthDistance(script: Script, targets: ReturnType<typeof scriptTargets>): number {
  const length = spokenLength(narrationOf(script.scenes));
  return Math.max(0, targets.minChars - length, length - targets.maxChars);
}

// A script still too long after the retries loses sentences until it fits: the last sentence of the longest scene that
// has more than one, never in the opening or the closing scene, which ask and answer the video's question. A sentence
// that goes takes away detail, never adds a claim. The model often cut only a third of what it was asked to.
function fitLength(script: Script, targets: ReturnType<typeof scriptTargets>): Script {
  const scenes = script.scenes.map((scene) => ({ ...scene, sentences: [...scene.sentences] }));
  const sceneLength = (scene: (typeof scenes)[number]) => spokenLength(scene.sentences.map((sentence) => sentence.text).join(" "));
  while (spokenLength(narrationOf(scenes)) > targets.maxChars) {
    const middle = scenes.slice(1, -1).filter((scene) => scene.sentences.length > 1);
    if (middle.length === 0) break;
    const longest = middle.reduce((best, scene) => (sceneLength(scene) > sceneLength(best) ? scene : best));
    longest.sentences.pop();
  }
  return { ...script, scenes };
}

// Makes a script that broke a rule usable. Sentences that cite no known fact go, since the fact-check could not back
// them, and so does a question that breaks its rules: the title card then shows a subheading the direct step checks.
// Throws when no sentence is left.
function repairScript(script: Script, factIds: Set<string>): Script {
  const scenes = script.scenes
    .map((scene) => ({
      ...scene,
      sentences: scene.sentences
        .map((sentence) => ({ ...sentence, factIds: sentence.factIds.filter((id) => factIds.has(id)) }))
        .filter((sentence) => sentence.factIds.length > 0),
    }))
    .filter((scene) => scene.sentences.length > 0);
  if (scenes.length === 0) throw new Error("script: no sentence cites a known fact.");
  const question =
    script.question && questionProblems(script.question, narrationOf(scenes)).length === 0 ? script.question : undefined;
  return { ...script, question, scenes };
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
    // When no script passes, a script a little too long or too short is still better than no video, so the one
    // closest to the length is repaired and kept.
    repair: (script) => repairScript(script, factIds),
    // The length that counts is the one after the repair, which can cut sentences. A script the repair cannot save
    // comes last, so a later try that it can save is kept instead.
    distance: (script) => {
      try {
        return lengthDistance(repairScript(script, factIds), targets);
      } catch {
        return Infinity;
      }
    },
    deadline: Date.now() + DEADLINE_MS,
  });
  // Our own scene IDs, so the fact-check can name sentences like "scene-2.1".
  const fitted = fitLength(data, targets);
  if (narrationOf(fitted.scenes) !== narrationOf(data.scenes)) {
    console.warn(`[script] Cut sentences to fit the length: ${spokenLength(narrationOf(data.scenes))} to ${spokenLength(narrationOf(fitted.scenes))} spoken characters`);
  }
  const scenes = fitted.scenes.map((scene, index) => ({ ...scene, id: `scene-${index + 1}` }));
  return { script: { title: fitted.title, question: fitted.question?.trim(), scenes }, usage };
}
