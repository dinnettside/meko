import { z } from "zod";
import { addUsage, chatJson, emptyUsage } from "./nebius.ts";
import { CheckStatusSchema, ResearchFactSchema, ScriptSchema } from "./pipeline.ts";
import type { FactCheckReport, Script, SentenceCheck, Usage } from "./pipeline.ts";
import { factCheckPrompt } from "./prompts/factcheck.ts";
import { contentWords } from "./words.ts";
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

const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// "After X, A, and B" claims that A came after X and that B came after X. The model tends to check the link for
// the last part only, so each part gets its link claim spelled out.
const LINKS = ["after", "before", "when", "because", "once"];

function linkClaims(text: string): string[] {
  const match = text.match(/^(After|Before|When|Because|Once)\s+([^,]+),\s*(.+)$/i);
  if (!match) return [];
  const [, link, lead, rest] = match;
  const parts = rest.split(/,\s*and\s+|;\s*|,\s*while\s+/i).map((part) => part.trim().replace(/[.!?]$/, ""));
  return parts.length < 2 ? [] : parts.map((part) => `${part} ${link.toLowerCase()} ${lead.trim()}`);
}

// Words in a reason that say something about the sentence is not backed.
const DOUBT = /\b(not|no|unsupported|missing|incorrect|wrong|contradict\w*|unclear|cannot|doesn't|don't|isn't|aren't)\b/i;

// Problems that make a check unusable. `linkProblems` below are worth a retry, but not worth failing the step.
function checkProblems({ checks }: Checks, sentences: SentenceToCheck[]): string[] {
  const sentenceIds = sentences.map((sentence) => sentence.id);
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
    // The model sometimes explains what is wrong with a sentence and still calls it supported.
    if (check.status === "supported" && DOUBT.test(check.reason)) {
      problems.push(
        `Sentence ${check.sentenceId} is "supported", but its reason says: "${check.reason}". If a claim is not supported, mark it so and revise or remove the sentence. Otherwise leave the reason empty.`,
      );
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

// Two true facts joined by a false "after" make a false sentence, and the model only catches that when it judges
// the link as a claim of its own. A claim counts when it has the link word and nearly all the words of the link.
function linkProblems({ checks }: Checks, sentences: SentenceToCheck[]): string[] {
  return sentences.flatMap((sentence) => {
    const check = checks.find((candidate) => candidate.sentenceId === sentence.id);
    return (sentence.linkClaims ?? [])
      .filter((linkClaim) => {
        const [link] = linkClaim.split(" ").filter((word) => LINKS.includes(word)).slice(-1);
        const wanted = contentWords(linkClaim);
        return !check?.claims.some((claim) => {
          const words = new Set(contentWords(claim.claim));
          return plain(claim.claim).includes(link) && wanted.filter((word) => words.has(word)).length >= wanted.length * 0.8;
        });
      })
      .map((linkClaim) => `Sentence ${sentence.id}: add the claim "${linkClaim}" to its claims and judge it.`);
  });
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
      ...(linkClaims(sentence.text).length > 0 ? { linkClaims: linkClaims(sentence.text) } : {}),
    })),
  );

  // Two checks run side by side, and for each sentence the stricter one counts. One check alone sometimes lets a
  // false link through that the other catches, and running both at once costs no extra time.
  const runs = await Promise.allSettled(
    [1, 2].map((run) =>
      chatJson({
        step: `factcheck/${run}`,
        schemaName: "checks",
        schema: checksSchema(sentences.length),
        messages: factCheckPrompt(sentences),
        maxTokens: 10000,
        check: (result) => [...checkProblems(result, sentences), ...linkProblems(result, sentences)],
        // After the last retry, a check that only misses a link claim is still usable; a broken one is not.
        repair: (result) => {
          const problems = checkProblems(result, sentences);
          if (problems.length > 0) throw new Error(`factcheck/${run}: ${problems.join("; ")}`);
          return result;
        },
      }),
    ),
  );
  const done = runs.flatMap((run) => (run.status === "fulfilled" ? [run.value] : []));
  if (done.length === 0) throw runs.find((run) => run.status === "rejected")?.reason;
  const usage = done.reduce((total, run) => addUsage(total, run.usage), emptyUsage());
  const strictness = { supported: 0, revised: 1, removed: 2 };
  const checkById = new Map<string, z.infer<typeof CheckSchema>>();
  for (const check of done.flatMap((run) => run.data.checks)) {
    const other = checkById.get(check.sentenceId);
    if (!other || strictness[check.status] > strictness[other.status]) checkById.set(check.sentenceId, check);
  }
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
