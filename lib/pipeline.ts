import { z } from "zod";
import { FactSchema, SourceSchema } from "./storyboard.ts";

// Data that moves between the pipeline steps. The storyboard contract itself is in storyboard.ts.

export const VideoRequestSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  audience: z.string().trim().min(2).max(80),
  lengthSec: z.number().int().min(30).max(180),
  language: z.enum(["en", "no"]),
});

// A source with the text we got from the web. Facts are checked against this text.
export const ResearchSourceSchema = SourceSchema.extend({ text: z.string() });

// A fact with the exact words from its source that back it.
export const ResearchFactSchema = FactSchema.extend({ quote: z.string() });

export const ScriptSentenceSchema = z.object({
  text: z.string(),
  factIds: z.array(z.string()),
});

export const ScriptSceneSchema = z.object({
  id: z.string(),
  sentences: z.array(ScriptSentenceSchema),
});

export const ScriptSchema = z.object({
  title: z.string(),
  // The question the video answers. It is shown on the title card, and the last scene answers it.
  question: z.string().optional(),
  scenes: z.array(ScriptSceneSchema),
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

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
