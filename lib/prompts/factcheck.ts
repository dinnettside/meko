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
        "Judge each sentence only against the quotes of its own facts. Do not use outside knowledge, even when you know a claim is true.",
        "First split the sentence into its separate claims: every person, number, date, place, action, cause and description.",
        "For each claim, set supported to true only if the quotes state it. Small changes in wording are fine. A date worked out from two quotes is fine.",
        'Then set the status. "supported": every claim is supported. "revised": some claims are not supported, so put a new version in "revised" that leaves them out and still sounds natural when spoken. "removed": the main claim is not supported.',
        'Set "revised" to an empty string unless the status is "revised". Give a short reason, or an empty string for supported sentences.',
        "Check every sentence, in the order given.",
      ].join("\n"),
    },
    { role: "user", content: JSON.stringify(sentences, null, 1) },
  ];
}
