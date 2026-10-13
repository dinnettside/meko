import { DirectInputSchema, direct } from "@/lib/direct";
import { runStep } from "@/lib/run-step";

export const maxDuration = 120;

export async function POST(request: Request) {
  return runStep(request, DirectInputSchema, direct);
}
