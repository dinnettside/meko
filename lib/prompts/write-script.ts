import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { VideoRequest } from "../pipeline.ts";
import type { Fact } from "../storyboard.ts";

export function writeScriptPrompt(
  request: VideoRequest,
  facts: Fact[],
  targets: {
    words: number;
    maxWords: number;
    minScenes: number;
    maxScenes: number;
    maxSceneWords: number;
    maxOpeningWords: number;
  },
): ChatCompletionMessageParam[] {
  const language = request.language === "no" ? "Norwegian bokmål" : "English";
  return [
    {
      role: "system",
      content: [
        "You write the narration for a short explainer video.",
        `Write about ${targets.words} words in total, so it takes about ${request.lengthSec} seconds to say.`,
        `Split it into ${targets.minScenes} to ${targets.maxScenes} scenes of 1 to 3 sentences and at most ${targets.maxSceneWords} words each.`,
        `The first scene is a short hook of 10 to ${targets.maxOpeningWords} words. The last scene wraps up.`,
        "Tell one clear story. Pick the most important facts and leave the rest out.",
        "Name concrete places, years and numbers from the facts where they help the story. The video shows them on maps, timelines and charts.",
        `Write for this audience: ${request.audience}. Use plain, spoken language and short sentences.`,
        "Every sentence must be backed by facts from the list. Put the IDs of those facts in factIds.",
        "Only say what the cited facts say. Do not add names, numbers, dates or claims that are not in them.",
        "Do not join two facts with when, after, before, because or so unless a fact states that link. Keep each number and date with the event it belongs to.",
        `Write in ${language}. The title is a short title for the video.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: `Topic: ${request.topic}\n\nFacts:\n${facts.map((fact) => `${fact.id}: ${fact.text}`).join("\n")}`,
    },
  ];
}
