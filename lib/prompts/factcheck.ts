import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type SentenceToCheck = {
  id: string;
  text: string;
  facts: { id: string; text: string; quote: string }[];
  linkClaims?: string[]; // links the sentence makes, spelled out by the code
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
        "Links are claims too. When the sentence says one thing happened when, after, before, because of or so that another happened, list that link as a claim of its own, using the same word. The quotes must state that link. Two true facts joined by a link the quotes do not state make a false sentence.",
        'For example, "After the city fell in 1400, its population dropped to 10,000" makes three claims: the city fell in 1400, its population dropped to 10,000, and the drop came after the fall. If a quote says the population was 10,000 by 1400, the third claim is not supported.',
        'A link at the start of a sentence covers every part after it: "After X, A happened and B happened" claims that A came after X and that B came after X. Some sentences come with these links spelled out in "linkClaims": put each of them in claims word for word, and judge it.',
        'An order is a claim too. When the sentence puts steps in an order with words like "then", "next", "first", "finally" or "followed by", list that order as a claim, like "the cornea comes after the pupil". The quotes must give the same order: "Light passes the pupil, then the cornea" is not supported by a quote that says light passes the cornea and then the pupil.',
        'Certainty is a claim too. When the quotes hedge, with words like "might", "may", "possibly", "probably", "is thought to" or "some historians", the sentence must hedge as much: "The plague helped end feudalism" is not supported by a quote that says it "might have brought an end to feudalism". Revise it to say what the quote says, like "may have helped end".',
        "Every number and date must belong to the same thing, time and place as in the quotes.",
        "For each claim, set supported to true only if the quotes state it. Small changes in wording are fine. A date worked out from two quotes is fine.",
        'Then set the status. "supported": every claim is supported. "revised": some claims are not supported, so put a new version in "revised" that leaves them out and still sounds natural when spoken. "removed": the main claim is not supported.',
        'Set "revised" to an empty string unless the status is "revised". Give a short reason, or an empty string for supported sentences.',
        "Check every sentence, in the order given.",
      ].join("\n"),
    },
    { role: "user", content: JSON.stringify(sentences, null, 1) },
  ];
}
