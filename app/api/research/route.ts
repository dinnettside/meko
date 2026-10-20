import { VideoRequestSchema } from "@/lib/pipeline";
import { research } from "@/lib/research";
import { runStep } from "@/lib/run-step";
import { takeVideoSlot } from "@/lib/video-limits";

// Up to two rounds of search and fact extraction.
export const maxDuration = 180;

// Research starts every new video, so the limits on new videos are counted here, after the demo code.
export async function POST(request: Request) {
  return runStep(request, VideoRequestSchema, async (input) => {
    await takeVideoSlot(request);
    return research(input);
  });
}
