import { pingModel } from "./nebius.ts";
import { serviceProblem } from "./service-errors.ts";
import { searchCredits } from "./tavily.ts";
import { voiceCredits } from "./elevenlabs.ts";

// Whether the paid services can still make a video, for the daily health check (.github/workflows/health.yml), so
// Trym hears about empty credits before a judge does. Says only ok, low, out or error for each service, never a number
// or a key. "unknown" means the service could not say, and "off" that it is not set up.
export type ServiceState = "ok" | "low" | "out" | "error" | "unknown" | "off";
export type Health = { models: ServiceState; search: ServiceState; voice: ServiceState; checkedAt: string };

// One check per server instance in this time; calls in between get the same answer and cost nothing.
const CACHE_MS = 10 * 60_000;
let last: { at: number; health: Health } | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// All three models must answer: one that is no longer served stops every new video as surely as empty credit. A model
// that fails gets one more try after a short wait, so one slow answer does not send a false alarm.
async function models(): Promise<ServiceState> {
  const states = await Promise.all(
    (["main", "scene", "fast"] as const).map(async (role): Promise<ServiceState> => {
      for (let attempt = 1; ; attempt++) {
        try {
          await pingModel(role);
          return "ok";
        } catch (error) {
          console.warn(`[health] Token Factory, ${role} model, try ${attempt}: ${error}`);
          if (/run out of credit/.test(serviceProblem(error) ?? "")) return "out";
          if (attempt === 2) return "error";
          await wait(2_000);
        }
      }
    }),
  );
  return states.includes("out") ? "out" : states.includes("error") ? "error" : "ok";
}

// A service that fails to answer counts as an error, which the daily check reports.
async function stateOf(check: () => Promise<ServiceState>, name: string): Promise<ServiceState> {
  try {
    return await check();
  } catch (error) {
    console.warn(`[health] ${name}: ${error}`);
    return "error";
  }
}

export async function checkHealth(): Promise<Health> {
  if (last && Date.now() - last.at < CACHE_MS) return last.health;
  const [modelState, search, voice] = await Promise.all([models(), stateOf(searchCredits, "Tavily"), stateOf(voiceCredits, "ElevenLabs")]);
  const health = { models: modelState, search, voice, checkedAt: new Date().toISOString() };
  // An error is not kept, so the next check tries again at once.
  last = [modelState, search, voice].includes("error") ? null : { at: Date.now(), health };
  return health;
}
