import { LikeInputSchema, setLike } from "@/lib/social";
import { readJson } from "@/lib/run-step";
import { overLimit } from "@/lib/rate-limit";

export const maxDuration = 15;

// Likes or unlikes a video in the feed for one viewer, without an account.
export async function POST(request: Request) {
  if (overLimit(request, "like", 120)) return Response.json({ error: "Too many likes at once. Wait a minute." }, { status: 429 });
  const body = await readJson(request, LikeInputSchema, 500);
  if ("refusal" in body) return body.refusal;
  try {
    const result = await setLike(body.data);
    return "error" in result ? Response.json(result, { status: 409 }) : Response.json(result);
  } catch (error) {
    console.error("[social] Could not save a like:", error);
    return Response.json({ error: "The like could not be saved. Try again." }, { status: 500 });
  }
}
