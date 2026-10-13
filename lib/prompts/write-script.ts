import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { VideoRequest } from "../pipeline.ts";
import type { Fact } from "../storyboard.ts";

export function writeScriptPrompt(
  request: VideoRequest,
  facts: Fact[],
  targets: { words: number; maxWords: number; minScenes: number; maxScenes: number },
): ChatCompletionMessageParam[] {
  const language = request.language === "no" ? "Norwegian bokmål" : "English";
  return [
    {
      role: "system",
      content: [
        "You write the narration for a short explainer video.",
        `Write ${targets.words} words in total and never more than ${targets.maxWords}, so it takes about ${request.lengthSec} seconds to say.`,
        `Split it into ${targets.minScenes} to ${targets.maxScenes} scenes of 1 to 3 sentences each. The first scene opens with a hook, and the last scene wraps up.`,
        "Tell one clear story. Pick the most important facts and leave the rest out.",
        `Write for this audience: ${request.audience}. Use plain, spoken language and short sentences.`,
        "Every sentence must be backed by facts from the list. Put the IDs of those facts in factIds.",
        "Only say what the cited facts say. Do not add names, numbers, dates or claims that are not in them.",
        `Write in ${language}. The title is a short title for the video.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: `Topic: ${request.topic}\n\nFacts:\n${facts.map((fact) => `${fact.id}: ${fact.text}`).join("\n")}`,
    },
  ];
}
