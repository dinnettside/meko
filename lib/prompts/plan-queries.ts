import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { VideoRequest } from "../pipeline.ts";

export function planQueriesPrompt(request: VideoRequest): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You plan the web research for a short, fact-checked explainer video.",
        "Write 3 to 6 web search queries that together cover what the video needs: the main events, people, places, dates, causes and effects.",
        "Each query is short and specific, the way a person types into a search engine. Write the queries in English.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `Topic: ${request.topic}\nAudience: ${request.audience}\nVideo length: ${request.lengthSec} seconds`,
    },
  ];
}
