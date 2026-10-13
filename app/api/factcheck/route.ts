import { FactCheckInputSchema, factCheck } from "@/lib/factcheck";
import { runStep } from "@/lib/run-step";

export const maxDuration = 60;

export async function POST(request: Request) {
  return runStep(request, FactCheckInputSchema, factCheck);
}
