import { FindInputSchema, findVideo } from "@/lib/library";
import { readJson } from "@/lib/run-step";

export const maxDuration = 15;

// Looks for a finished video of the same request in the library. Watching costs nothing, so it needs no demo code.
// A library that cannot be reached is the same as no video found: the page then makes a new one.
export async function POST(request: Request) {
  const body = await readJson(request, FindInputSchema, 2_000);
  if ("refusal" in body) return body.refusal;
  try {
    return Response.json(await findVideo(body.data));
  } catch (error) {
    console.error("[library] Could not look in the library:", error);
    return Response.json({ video: null });
  }
}
