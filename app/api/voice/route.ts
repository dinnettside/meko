import { runStep } from "@/lib/run-step";
import { VoiceInputSchema, recordVoice } from "@/lib/voice";

export const maxDuration = 90;

export async function POST(request: Request) {
  return runStep(request, VoiceInputSchema, recordVoice);
}
