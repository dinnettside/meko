import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type SentenceToCheck = {
  id: string;
  text: string;
  facts: { id: string; text: string; quote: string }[];
};

export function factCheckPrompt(sentences: SentenceToCheck[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You fact-check the narration of an explainer video, one sentence at a time.",
        "Each sentence comes with the facts it cites. Each fact has a quote: the exact words from its source.",
        "Judge each sentence only against the quotes of its own facts. Do not use outside knowledge.",
        'Use "supported" when the quotes state everything the sentence claims. Small changes in wording are fine.',
        'Use "revised" when part of the sentence is not backed by the quotes. Put a new version in "revised" that only says what the quotes back and still sounds natural when spoken.',
        'Use "removed" when the main claim of the sentence is not backed by the quotes.',
        'Set "revised" to an empty string unless the status is "revised". Give a short reason, or an empty string for supported sentences.',
        "Check every sentence, in the order given.",
      ].join("\n"),
    },
    { role: "user", content: JSON.stringify(sentences, null, 1) },
  ];
}
