import { z } from "zod";
import { addUsage, chatJson, emptyUsage } from "./nebius.ts";
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

// Words that join two facts into a claim of their own.
const LINK_WORDS = /\b(after|before|when|while|because|since|until|so|then|led to|due to|thanks to)\b/gi;

const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// "After X, A, and B" claims that A came after X and that B came after X. The model tends to check the link for
// the last part only, so each part gets its link claim spelled out.
function linkClaims(text: string): string[] {
  const match = text.match(/^(After|Before|When|While|Because|Since|Until|Once)\s+([^,]+),\s*(.+)$/i);
  if (!match) return [];
  const [, link, lead, rest] = match;
  const parts = rest.split(/,\s*and\s+|;\s*|,\s*while\s+/i).map((part) => part.trim().replace(/[.!?]$/, ""));
  return parts.length < 2 ? [] : parts.map((part) => `${part} ${link.toLowerCase()} ${lead.trim()}`);
}

// Words in a reason that say something about the sentence is not backed.
const DOUBT = /\b(not|no|unsupported|missing|incorrect|wrong|contradict\w*|unclear|cannot|doesn't|don't|isn't|aren't)\b/i;

function checkProblems({ checks }: Checks, sentences: SentenceToCheck[]): string[] {
  const sentenceIds = sentences.map((sentence) => sentence.id);
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const check of checks) {
    // Two true facts joined by a false "after" or "because" make a false sentence, and the model only catches
    // that when it writes the link down as a claim of its own.
    const sentence = sentences.find((candidate) => candidate.id === check.sentenceId);
    const text = sentence?.text ?? "";
    for (const link of new Set((text.match(LINK_WORDS) ?? []).map((word) => word.toLowerCase()))) {
      if (!check.claims.some((claim) => claim.claim.toLowerCase().includes(link))) {
        problems.push(`Sentence ${check.sentenceId} says "${link}". Add that link as a claim of its own, like "A happened ${link} B", and judge it against the quotes.`);
      }
    }
    for (const linkClaim of sentence?.linkClaims ?? []) {
      if (!check.claims.some((claim) => plain(claim.claim) === plain(linkClaim))) {
        problems.push(`Sentence ${check.sentenceId}: add the claim "${linkClaim}" to its claims, word for word, and judge it.`);
      }
    }
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
        check: (result) => checkProblems(result, sentences),
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
