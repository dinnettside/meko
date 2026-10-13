import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export function directPrompt(title: string, scenes: { id: string; narration: string }[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You direct a short explainer video. You get its scenes with their narration.",
        "For every scene, decide what is shown on screen while the narration plays. Use the scene IDs as keys.",
        `The first scene, ${scenes[0]?.id}, shows the title: a heading of at most 6 words and an optional subheading of at most 10 words.`,
        "Every other scene shows 1 to 3 short lines of at most 8 words each that sum up its narration. Do not repeat the narration word for word.",
        "Only use names, numbers and dates that appear in that scene's own narration.",
      ].join("\n"),
    },
    { role: "user", content: `Video title: ${title}\n\nScenes:\n${JSON.stringify(scenes, null, 1)}` },
  ];
}
