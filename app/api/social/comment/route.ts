import { addComment, CommentInputSchema } from "@/lib/social";
import { readJson } from "@/lib/run-step";
import { overLimit } from "@/lib/rate-limit";

export const maxDuration = 15;

// Adds a comment to a video in the feed, under the viewer's made-up name. Links, unfriendly words and bursts are
// turned away (lib/social.ts).
export async function POST(request: Request) {
  if (overLimit(request, "comment", 20)) return Response.json({ error: "Too many comments from here. Wait a while." }, { status: 429 });
  const body = await readJson(request, CommentInputSchema, 4_000);
  if ("refusal" in body) return body.refusal;
  try {
    const result = await addComment(body.data);
    return "error" in result ? Response.json(result, { status: 422 }) : Response.json({ comment: result });
  } catch (error) {
    console.error("[social] Could not save a comment:", error);
    return Response.json({ error: "The comment could not be saved. Try again." }, { status: 500 });
  }
}
