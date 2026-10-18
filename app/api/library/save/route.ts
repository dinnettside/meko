import { SaveInputSchema, saveVideo } from "@/lib/library";
import { runStep } from "@/lib/run-step";

export const maxDuration = 60;

// Saves a finished video, with its voice, in the library. It needs the demo code, like making one. The body carries
// every scene's MP3, so it may be much larger than the pipeline's requests, but stays under Vercel's 4.5 MB.
export async function POST(request: Request) {
  return runStep(request, SaveInputSchema, saveVideo, 4_400_000);
}
