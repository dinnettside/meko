import { readSocial, SocialQuerySchema } from "@/lib/social";
import { readJson } from "@/lib/run-step";

export const maxDuration = 15;

// The likes and comments of the videos in the feed. Reading them needs no demo code; a store that cannot be reached
// shows none.
export async function POST(request: Request) {
  const body = await readJson(request, SocialQuerySchema, 4_000);
  if ("refusal" in body) return body.refusal;
  try {
    return Response.json({ social: await readSocial(body.data) });
  } catch (error) {
    console.error("[social] Could not read likes and comments:", error);
    return Response.json({ social: {} });
  }
}
