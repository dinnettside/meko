import { runStep } from "@/lib/run-step";
import { ScriptInputSchema, writeScript } from "@/lib/script";

export const maxDuration = 120;

export async function POST(request: Request) {
  return runStep(request, ScriptInputSchema, writeScript);
}
