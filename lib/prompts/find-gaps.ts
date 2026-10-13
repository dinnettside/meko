import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { VideoRequest } from "../pipeline.ts";

export function findGapsPrompt(request: VideoRequest, facts: string[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You review the research for a short explainer video.",
        "Decide if the facts are enough to tell the main story of the topic for this audience and video length.",
        "A short video cannot cover everything. Only list a gap if the main story cannot be told without it.",
        "List at most 3 gaps, with one web search query in English for each. If nothing essential is missing, return two empty lists.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Topic: ${request.topic}`,
        `Audience: ${request.audience}`,
        `Video length: ${request.lengthSec} seconds`,
        "",
        "Facts:",
        ...facts.map((fact) => `- ${fact}`),
      ].join("\n"),
    },
  ];
}
