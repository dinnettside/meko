import { pingModel } from "./nebius.ts";
import type { ModelRole } from "./nebius.ts";
import { serviceProblem } from "./service-errors.ts";
import { searchCredits } from "./tavily.ts";
import { voiceCredits } from "./elevenlabs.ts";

// Whether the paid services can still make a video, for the daily health check (.github/workflows/health.yml), so
// Trym hears about empty credits before a judge does. Says only ok, low, out or error for each service, never a number
// or a key. "unknown" means the service could not say, and "off" that it is not set up.
export type ServiceState = "ok" | "low" | "out" | "error" | "unknown" | "off";
// `models` is the main and the scene model, which every video needs. The fast model is reported on its own: when it
// does not answer, its calls go to the scene model (see chatJson in lib/nebius.ts), so a video can still be made.
export type Health = { models: ServiceState; fastModel: ServiceState; search: ServiceState; voice: ServiceState; checkedAt: string };

// One check per server instance in this time; calls in between get the same answer and cost nothing.
const CACHE_MS = 10 * 60_000;
// The route has 30 s (app/api/health). A service that has not answered in this time counts as an error, so the check
// says which service hangs instead of timing out as a whole.
const ANSWER_MS = 24_000;
let last: { at: number; health: Health } | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One token from a model. A model that fails gets one more try after a short wait, so one slow answer does not send a
// false alarm. Two tries of 10 s (see pingModel) and the wait fit in ANSWER_MS.
async function model(role: ModelRole): Promise<ServiceState> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pingModel(role);
      return "ok";
    } catch (error) {
      console.warn(`[health] Token Factory, ${role} model, try ${attempt}: ${error}`);
      if (/run out of credit/.test(serviceProblem(error) ?? "")) return "out";
      if (attempt === 2) return "error";
      await wait(1_000);
    }
  }
}

// A service that fails to answer, or answers too late, counts as an error, which the daily check reports.
async function stateOf(check: () => Promise<ServiceState>, name: string): Promise<ServiceState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<ServiceState>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[health] ${name}: no answer in ${ANSWER_MS / 1000} s`);
      resolve("error");
    }, ANSWER_MS);
  });
  try {
    return await Promise.race([check(), late]);
  } catch (error) {
    console.warn(`[health] ${name}: ${error}`);
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(): Promise<Health> {
  if (last && Date.now() - last.at < CACHE_MS) return last.health;
  const [main, scene, fastModel, search, voice] = await Promise.all([
    stateOf(() => model("main"), "Token Factory, main model"),
    stateOf(() => model("scene"), "Token Factory, scene model"),
    stateOf(() => model("fast"), "Token Factory, fast model"),
    stateOf(searchCredits, "Tavily"),
    stateOf(voiceCredits, "ElevenLabs"),
  ]);
  // A model that is no longer served stops every new video as surely as empty credit.
  const models: ServiceState = [main, scene].includes("out") ? "out" : [main, scene].includes("error") ? "error" : "ok";
  const health: Health = { models, fastModel, search, voice, checkedAt: new Date().toISOString() };
  // An error is not kept, so the next check tries again at once.
  last = [models, search, voice].includes("error") ? null : { at: Date.now(), health };
  return health;
}
