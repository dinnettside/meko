import { z } from "zod";
import { chatJson } from "./nebius.ts";
import { CheckStatusSchema, ResearchFactSchema, ScriptSchema } from "./pipeline.ts";
import type { FactCheckReport, Script, SentenceCheck, Usage } from "./pipeline.ts";
import { factCheckPrompt } from "./prompts/factcheck.ts";
import type { SentenceToCheck } from "./prompts/factcheck.ts";

export const FactCheckInputSchema = z.object({
  script: ScriptSchema,
  facts: z.array(ResearchFactSchema),
});

export type FactCheckResult = { script: Script; report: FactCheckReport; usage: Usage };

// The model lists the claims in each sentence before it judges the sentence, so small added details get caught.
const CheckSchema = z.object({
  sentenceId: z.string(),
  claims: z.array(z.object({ claim: z.string(), supported: z.boolean() })).min(1).max(8),
  status: CheckStatusSchema,
  revised: z.string(),
  reason: z.string(),
});

// Exactly one check per sentence. Token Factory enforces the list length from the JSON Schema.
const checksSchema = (sentenceCount: number) => z.object({ checks: z.array(CheckSchema).length(sentenceCount) });

type Checks = { checks: z.infer<typeof CheckSchema>[] };

function checkProblems({ checks }: Checks, sentenceIds: string[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const check of checks) {
    seen.set(check.sentenceId, (seen.get(check.sentenceId) ?? 0) + 1);
    if (check.status === "revised" && check.revised.trim() === "") {
      problems.push(`Sentence ${check.sentenceId} is "revised" but has no revised text.`);
    }
    if (check.status === "supported" && check.claims.some((claim) => !claim.supported)) {
      problems.push(`Sentence ${check.sentenceId} has unsupported claims, so it cannot be "supported".`);
    }
  }
  for (const id of sentenceIds) {
    const count = seen.get(id) ?? 0;
    if (count !== 1) problems.push(`Sentence ${id} must be checked exactly once, not ${count} times.`);
  }
  const unknown = [...seen.keys()].filter((id) => !sentenceIds.includes(id));
  if (unknown.length > 0) problems.push(`Unknown sentence IDs: ${unknown.join(", ")}.`);
  return problems;
}

export async function factCheck({ script, facts }: z.infer<typeof FactCheckInputSchema>): Promise<FactCheckResult> {
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const sentences: SentenceToCheck[] = script.scenes.flatMap((scene) =>
    scene.sentences.map((sentence, index) => ({
      id: `${scene.id}.${index + 1}`,
      text: sentence.text,
      facts: sentence.factIds.flatMap((id) => {
        const fact = factsById.get(id);
        return fact ? [{ id, text: fact.text, quote: fact.quote }] : [];
      }),
    })),
  );

  const { data, usage } = await chatJson({
    step: "factcheck",
    schemaName: "checks",
    schema: checksSchema(sentences.length),
    messages: factCheckPrompt(sentences),
    maxTokens: 10000,
    check: (result) => checkProblems(result, sentences.map((sentence) => sentence.id)),
  });

  const checkById = new Map(data.checks.map((check) => [check.sentenceId, check]));
  const report: SentenceCheck[] = [];
  const scenes = script.scenes
    .map((scene) => ({
      id: scene.id,
      sentences: scene.sentences.flatMap((sentence, index) => {
        const sentenceId = `${scene.id}.${index + 1}`;
        // checkProblems made sure every sentence has exactly one check.
        const check = checkById.get(sentenceId);
        let status = check?.status ?? "removed";
        let revised = status === "revised" ? (check?.revised.trim() ?? "") : "";
        // A "revision" that changes nothing counts as supported.
        if (status === "revised" && revised === sentence.text.trim()) {
          status = "supported";
          revised = "";
        }
        report.push({
          sentenceId,
          factIds: sentence.factIds,
          status,
          original: sentence.text,
          revised,
          reason: check?.reason ?? "",
        });
        if (status === "removed") return [];
        return [{ text: status === "revised" ? revised : sentence.text, factIds: sentence.factIds }];
      }),
    }))
    .filter((scene) => scene.sentences.length > 0);

  if (scenes.length === 0) throw new Error("No sentence in the script could be backed by the sources.");
  const count = (status: SentenceCheck["status"]) => report.filter((check) => check.status === status).length;
  return {
    script: { title: script.title, scenes },
    report: { checks: report, supported: count("supported"), revised: count("revised"), removed: count("removed") },
    usage,
  };
}
