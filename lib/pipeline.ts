import { z } from "zod";
import { FactSchema, SourceSchema } from "./storyboard.ts";

// Data that moves between the pipeline steps. The storyboard contract itself is in storyboard.ts.

export const VideoRequestSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  audience: z.string().trim().min(2).max(80),
  lengthSec: z.number().int().min(30).max(180),
  language: z.enum(["en", "no"]),
});

// Caps on the lists the API routes accept, well above what the pipeline makes, so one request cannot start a flood
// of model calls or a huge prompt. Research keeps at most 9 sources with 6 facts each. A 180-second script has at
// most 23 scenes of 1 to 3 sentences, and a sentence cites 1 to 5 facts. The fact ID cap is also in the script
// step's JSON Schema, so a script the model writes always fits.
const MAX_FACTS = 100;
const MAX_SOURCES = 20;
const MAX_SCENES = 30;
const MAX_SENTENCES_PER_SCENE = 5;
const MAX_FACT_IDS_PER_SENTENCE = 10;
// Caps on each text, four times or more the longest in 109 saved runs (fact 259 characters, quote 436, sentence 181),
// so one request cannot carry huge facts that the prompts then repeat.
const MAX_FACT_CHARS = 1_000;
const MAX_QUOTE_CHARS = 2_000;
const MAX_SENTENCE_CHARS = 1_000;

// A source with the text we got from the web. Facts are checked against this text.
export const ResearchSourceSchema = SourceSchema.extend({ text: z.string() });

// A fact with the exact words from its source that back it.
export const ResearchFactSchema = FactSchema.extend({
  text: z.string().max(MAX_FACT_CHARS),
  quote: z.string().max(MAX_QUOTE_CHARS),
});

// The facts and sources a route accepts.
export const ResearchFactListSchema = z.array(ResearchFactSchema).max(MAX_FACTS);
export const SourceListSchema = z.array(SourceSchema).max(MAX_SOURCES);

export const ScriptSentenceSchema = z.object({
  // A refinement instead of .max(), so the cap stays out of the JSON Schema the script step sends: Token Factory's
  // docs do not say whether it supports maxLength. A longer sentence from the model goes back to it like any other
  // schema problem, so the script step never makes a script the next route refuses.
  text: z.string().refine((text) => text.length <= MAX_SENTENCE_CHARS, `A sentence may have at most ${MAX_SENTENCE_CHARS} characters.`),
  factIds: z.array(z.string()).max(MAX_FACT_IDS_PER_SENTENCE),
});

export const ScriptSceneSchema = z.object({
  id: z.string(),
  sentences: z.array(ScriptSentenceSchema).max(MAX_SENTENCES_PER_SCENE),
});

export const ScriptSchema = z.object({
  title: z.string(),
  // The question the video answers. It is shown on the title card, and the last scene answers it.
  question: z.string().optional(),
  scenes: z.array(ScriptSceneSchema).max(MAX_SCENES),
});

export const CheckStatusSchema = z.enum(["supported", "revised", "removed"]);

export const SentenceCheckSchema = z.object({
  sentenceId: z.string(),
  factIds: z.array(z.string()), // the facts the sentence cites
  status: CheckStatusSchema,
  original: z.string(),
  revised: z.string(),
  reason: z.string(),
});

export const FactCheckReportSchema = z.object({
  checks: z.array(SentenceCheckSchema),
  supported: z.number(),
  revised: z.number(),
  removed: z.number(),
});

export type VideoRequest = z.infer<typeof VideoRequestSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchFact = z.infer<typeof ResearchFactSchema>;
export type Script = z.infer<typeof ScriptSchema>;
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;
export type CheckStatus = z.infer<typeof CheckStatusSchema>;
export type SentenceCheck = z.infer<typeof SentenceCheckSchema>;
export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;

// Tokens and cost of the model calls in one step.
export type Usage = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

// How fast the narrator speaks, in characters per second including spaces. Measured on the George voice with
// Multilingual v2: 14 to 16. Words per second varied more (2.1 to 2.6), because long words take longer.
export const CHARS_PER_SECOND = 15;
// Characters per word including the space, in our narrations: about 6.2 to 6.7.
export const CHARS_PER_WORD = 6.5;

// How long a text is when spoken, in characters, with numbers counted as the words the voice says: a year like
// "1347" is "thirteen forty-seven", "75%" is "seventy-five percent". Counted as digits, numbers took much longer to say
// than the script allowed for, and a 60-second video about the plague ran for 81 seconds.
export function spokenLength(text: string): number {
  return text
    .replace(/\b(?:1\d|20)\d{2}s?\b/g, "thirteen forty-seven")
    .replace(/\d+(?:[.,]\d+)*/g, (number) => "x".repeat(Math.min(25, 5 * number.replace(/[.,]/g, "").length)))
    .replace(/%/g, " percent").length;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
