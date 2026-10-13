import { VideoRequestSchema } from "@/lib/pipeline";
import { research } from "@/lib/research";
import { runStep } from "@/lib/run-step";

// Up to two rounds of search and fact extraction.
export const maxDuration = 120;

export async function POST(request: Request) {
  return runStep(request, VideoRequestSchema, research);
}
