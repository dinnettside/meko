import { checkHealth } from "@/lib/health";
import { overLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

// GET /api/health: whether the language model, the web search and the voice can still make a video. Needs no demo
// code and spends one token at most every ten minutes. Used by the daily check in .github/workflows/health.yml.
export async function GET(request: Request) {
  if (overLimit(request, "health", 30)) return Response.json({ error: "Too many checks. Try again later." }, { status: 429 });
  return Response.json(await checkHealth(), { headers: { "Cache-Control": "no-store" } });
}
