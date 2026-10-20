import { z } from "zod";
import { chatJson, emptyUsage, usageOf } from "./nebius.ts";
import type { Usage, VideoRequest } from "./pipeline.ts";
import { checkTopicPrompt } from "./prompts/check-topic.ts";

// A topic Meko will not make a video about. The route answers it with its own status, so the page can say so instead
// of offering to try again.
export class TopicRefusedError extends Error {}

const CATEGORIES = ["fits", "weapons", "drugs", "self-harm", "harm", "hacking", "sexual", "hate", "private person", "not a topic"] as const;
const TopicCheckSchema = z.object({ category: z.enum(CATEGORIES) });

// Why a topic is refused, in the page's words, so the model cannot phrase it badly.
const REASONS: Record<Exclude<(typeof CATEGORIES)[number], "fits">, string> = {
  weapons: "Meko does not make videos about this topic, because it asks how to make a weapon. Try another topic.",
  drugs: "Meko does not make videos about this topic, because it asks how to make or get drugs. Try another topic.",
  "self-harm": "Meko does not make videos about this. If you are going through something hard, please talk to someone you trust or to a local helpline.",
  harm: "Meko does not make videos about this topic, because it asks how to hurt someone or break the law. Try another topic.",
  hacking: "Meko does not make videos about this topic, because it asks how to break into a system or an account. Try another topic.",
  sexual: "Meko does not make videos about this topic, because it is sexual. Try another topic.",
  hate: "Meko does not make videos about this topic, because it attacks or demeans people. Try another topic.",
  "private person": "Meko does not make videos about this topic, because it is about a private person. Try another topic.",
  "not a topic": "That does not look like a topic. Type one, like \"The French Revolution\" or \"How vaccines work\".",
};

// Checks with Ultra that the topic fits an educational explainer (Lightning let a private person and requests to show
// its prompt through): not instructions for harm, not sexual, not
// an attack on a group or a person, not about a private person, and a topic at all. The model only names a category. Throws TopicRefusedError when it
// does not fit. When the check itself fails, the video goes on: the demo code already keeps strangers out, and a check
// that is down should not stop everyone else.
export async function checkTopic(request: VideoRequest, deadline: number): Promise<Usage> {
  let category: (typeof CATEGORIES)[number];
  let usage = emptyUsage();
  try {
    const reply = await chatJson({
      step: "research/topic",
      schemaName: "topic",
      schema: TopicCheckSchema,
      messages: checkTopicPrompt(request),
      maxTokens: 150,
      timeoutMs: 15_000,
      deadline,
    });
    category = reply.data.category;
    usage = reply.usage;
  } catch (error) {
    console.warn(`[research/topic] The topic check failed, going on without it: ${error}`);
    return usageOf(error);
  }
  if (category !== "fits") {
    console.warn(`[research/topic] Refused "${request.topic}": ${category}`);
    throw new TopicRefusedError(REASONS[category]);
  }
  return usage;
}
