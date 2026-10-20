import { z } from "zod";
import { ErrorWithUsage, addUsage, chatJson, emptyUsage, usageOf } from "./nebius.ts";
import { numbersIn } from "./numbers.ts";
import { CheckStatusSchema, ResearchFactListSchema, ScriptSchema } from "./pipeline.ts";
import type { CheckStatus, FactCheckReport, Script, SentenceCheck, Usage } from "./pipeline.ts";
import { factCheckPrompt } from "./prompts/factcheck.ts";
import { questionProblems } from "./script.ts";
import { contentWords, wordKey } from "./words.ts";
import type { SentenceToCheck } from "./prompts/factcheck.ts";

export const FactCheckInputSchema = z.object({
  script: ScriptSchema,
  facts: ResearchFactListSchema,
});

export type FactCheckResult = { script: Script; report: FactCheckReport; usage: Usage };

// The route may run 120 s. Both checks stop in time for the step to return what it has.
const DEADLINE_MS = 100_000;

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

type Check = z.infer<typeof CheckSchema>;
type Checks = { checks: Check[] };

// What a check means for the narration: its status, the text to say when it is revised, and the reason to show.
type Verdict = { status: CheckStatus; revised: string; reason: string };

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

// Hedges a quote can put on a claim, and the words that keep a claim uncertain in a sentence. A sentence that shares a
// hedged clause's words without any of them says more than its source: "is thought to have injected more than 250
// megatons" became "shot over 250 megatons", and "It was reportedly first introduced" lost its "reportedly". The model
// let both through until the hedge was spelled out as a claim of its own.
const QUOTE_HEDGE = /\b(may|might|possibly|probably|perhaps|likely|reportedly|allegedly|(?:is|are|was|were) (?:thought|believed|said) to|suggests?|suggested|some historians)\b/i;
const SENTENCE_HEDGE = /\b(may|might|could|possibly|probably|perhaps|likely|reportedly|allegedly|thought|believed|said to|suggests?|suggested|some historians|estimated|about|around|approximately|roughly|up to)\b/i;

function certaintyClaims(text: string, facts: { quote: string }[]): string[] {
  if (SENTENCE_HEDGE.test(text)) return [];
  const sentenceKeys = new Set(contentWords(text).map(wordKey));
  const claims = facts.flatMap((fact) =>
    fact.quote
      .split(/(?<=[.;!?])\s+|,\s+(?:and|but)\s+/)
      .flatMap((clause) => {
        const hedge = clause.match(QUOTE_HEDGE)?.[0];
        if (!hedge) return [];
        const keys = [...new Set(contentWords(clause.replace(QUOTE_HEDGE, " ")).map(wordKey))];
        const shared = keys.filter((key) => sentenceKeys.has(key)).length;
        return shared >= Math.max(2, Math.ceil(keys.length / 2)) ? [`The source says this ${hedge.toLowerCase()} be so, and the sentence must say so too`] : [];
      }),
  );
  return [...new Set(claims)];
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

// A sentence whose quotes hedge what it states for certain may not be called supported, as long as it still has no
// hedge of its own.
function certaintyProblems({ checks }: Checks, sentences: SentenceToCheck[]): string[] {
  return sentences.flatMap((sentence) => {
    const check = checks.find((candidate) => candidate.sentenceId === sentence.id);
    return (sentence.certaintyClaims ?? []).length > 0 && check?.status === "supported"
      ? [`Sentence ${sentence.id} states for certain what its quotes only say may be so. Revise it to keep the hedge, like "is thought to" or "reportedly", or remove it.`]
      : [];
  });
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

// A revision is narrated as written, and nothing checks it again, so it may only leave claims out. A "revision"
// that changes nothing keeps every claim, so it is supported only when every claim is, and removed otherwise.
// A revision counts as removed when it states a number that the quotes behind the sentence do not, unless the facts'
// own text has it and no claim marked unsupported does: research sometimes adds a name like "Apollo 11" or a year
// that its quote leaves out. So the number the check marked unsupported cannot stay in the video.
function verdictOf(check: Check, sentence: SentenceToCheck): Verdict {
  if (check.status !== "revised") return { status: check.status, revised: "", reason: check.reason };
  const note = (text: string) => [check.reason, text].filter(Boolean).join(" ");
  const revised = check.revised.trim();
  if (revised === sentence.text.trim()) {
    return check.claims.every((claim) => claim.supported)
      ? { status: "supported", revised: "", reason: check.reason }
      : { status: "removed", revised: "", reason: note("The rewrite left the sentence as it was.") };
  }
  const inQuotes = new Set(sentence.facts.flatMap((fact) => numbersIn(fact.quote)));
  const inFacts = new Set(sentence.facts.flatMap((fact) => numbersIn(fact.text)));
  const unsupported = new Set(check.claims.filter((claim) => !claim.supported).flatMap((claim) => numbersIn(claim.claim)));
  const unbacked = numbersIn(revised).filter(
    (number) => !inQuotes.has(number) && (!inFacts.has(number) || unsupported.has(number)),
  );
  if (unbacked.length > 0) {
    return { status: "removed", revised: "", reason: note(`The rewrite still said ${unbacked.join(", ")}, which its sources do not state.`) };
  }
  return { status: "revised", revised, reason: check.reason };
}

export async function factCheck({ script, facts }: z.infer<typeof FactCheckInputSchema>): Promise<FactCheckResult> {
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const sentences: SentenceToCheck[] = script.scenes.flatMap((scene) =>
    scene.sentences.map((sentence, index) => ({
      id: `${scene.id}.${index + 1}`,
      text: sentence.text,
      // Each fact once, so a sentence that cites one fact many times does not blow up the prompt.
      facts: [...new Set(sentence.factIds)].flatMap((id) => {
        const fact = factsById.get(id);
        return fact ? [{ id, text: fact.text, quote: fact.quote }] : [];
      }),
      ...(linkClaims(sentence.text).length > 0 ? { linkClaims: linkClaims(sentence.text) } : {}),
    })),
  );
  for (const sentence of sentences) {
    const claims = certaintyClaims(sentence.text, sentence.facts);
    if (claims.length > 0) sentence.certaintyClaims = claims;
  }

  // Two checks run side by side, and for each sentence the stricter one counts. One check alone sometimes lets a
  // false link through that the other catches, and running both at once costs no extra time.
  const deadline = Date.now() + DEADLINE_MS;
  const runs = await Promise.allSettled(
    [1, 2].map((run) =>
      chatJson({
        step: `factcheck/${run}`,
        schemaName: "checks",
        schema: checksSchema(sentences.length),
        messages: factCheckPrompt(sentences),
        maxTokens: 10000,
        check: (result) => [...checkProblems(result, sentences), ...linkProblems(result, sentences), ...certaintyProblems(result, sentences)],
        // When no check passes, a check that only misses a link claim is still usable; a broken one is not. So the
        // check to repair is one without broken parts, if there is one.
        repair: (result) => {
          const problems = checkProblems(result, sentences);
          if (problems.length > 0) throw new Error(`factcheck/${run}: ${problems.join("; ")}`);
          return result;
        },
        distance: (result) => checkProblems(result, sentences).length,
        deadline,
      }),
    ),
  );
  const done = runs.flatMap((run) => (run.status === "fulfilled" ? [run.value] : []));
  const failed = runs.flatMap((run) => (run.status === "rejected" ? [run.reason] : []));
  // A run that failed still cost tokens.
  const usage = [...done.map((run) => run.usage), ...failed.map(usageOf)].reduce(
    (total, runUsage) => addUsage(total, runUsage),
    emptyUsage(),
  );
  if (done.length === 0) {
    const reason = failed[0] instanceof Error ? failed[0].message : String(failed[0]);
    throw new ErrorWithUsage(reason, usage, { cause: failed[0] });
  }
  const strictness = { supported: 0, revised: 1, removed: 2 };
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const verdictById = new Map<string, Verdict>();
  for (const check of done.flatMap((run) => run.data.checks)) {
    const sentence = sentenceById.get(check.sentenceId);
    if (!sentence) continue;
    const verdict = verdictOf(check, sentence);
    const other = verdictById.get(check.sentenceId);
    if (!other || strictness[verdict.status] > strictness[other.status]) verdictById.set(check.sentenceId, verdict);
  }
  const report: SentenceCheck[] = [];
  const scenes = script.scenes
    .map((scene) => ({
      id: scene.id,
      sentences: scene.sentences.flatMap((sentence, index) => {
        const sentenceId = `${scene.id}.${index + 1}`;
        // checkProblems made sure every sentence has exactly one check.
        const verdict: Verdict = verdictById.get(sentenceId) ?? { status: "removed", revised: "", reason: "" };
        report.push({
          sentenceId,
          factIds: sentence.factIds,
          status: verdict.status,
          original: sentence.text,
          revised: verdict.revised,
          reason: verdict.reason,
        });
        if (verdict.status === "removed") return [];
        return [{ text: verdict.status === "revised" ? verdict.revised : sentence.text, factIds: sentence.factIds }];
      }),
    }))
    .filter((scene) => scene.sentences.length > 0);

  if (scenes.length === 0) throw new ErrorWithUsage("No sentence in the script could be backed by the sources.", usage);
  // The fact-check can remove or rewrite the sentence the question leans on, so the question is checked again against
  // the narration that is left. Without it, the title card shows a subheading that the direct step checks.
  const narration = scenes.flatMap((scene) => scene.sentences.map((sentence) => sentence.text)).join(" ");
  const questionIssues = script.question ? questionProblems(script.question, narration) : [];
  if (questionIssues.length > 0) {
    console.warn(`[factcheck] Leaving out the question "${script.question}": ${questionIssues.join(" ")}`);
  }
  const question = script.question && questionIssues.length === 0 ? script.question : undefined;
  const count = (status: SentenceCheck["status"]) => report.filter((check) => check.status === status).length;
  return {
    script: { title: script.title, question, scenes },
    report: { checks: report, supported: count("supported"), revised: count("revised"), removed: count("removed") },
    usage,
  };
}
