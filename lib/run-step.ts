import { z } from "zod";
import { checkDemoCode } from "./demo-code.ts";
import { TopicRefusedError } from "./topic-check.ts";

// Real requests are at most about 20,000 characters (saved runs: script 16k, factcheck 18k, direct 19k, voice 7k).
// A 180-second video with every fact as long as the longest seen stays under 50,000. A bigger body would only make
// the prompts of the direct step, which repeat the facts, bigger and dearer.
const MAX_BODY_CHARS = 60_000;
// A missing or wrong demo code waits this long for its answer, the same for both, so guessing codes is slow and the
// timing does not tell the two apart.
const WRONG_CODE_DELAY_MS = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Another website can send a plain-text or form POST without asking the browser first, but not a JSON one. Taking
// only JSON keeps other pages from making videos through a visitor's browser.
function isJson(request: Request): boolean {
  const type = request.headers.get("content-type") ?? "";
  return type.split(";")[0].trim().toLowerCase() === "application/json";
}

// The demo code's answer when it is missing or wrong, or null when the request may go on.
export async function demoCodeRefusal(request: Request): Promise<Response | null> {
  const code = checkDemoCode(request);
  if (code === "unset") {
    console.error("[demo-code] DEMO_CODE is not set and VERCEL is, so every request is refused. Set DEMO_CODE and deploy again.");
    // 503, not 401: no code can be right until the server is set up, so visitors should not keep retyping theirs.
    return Response.json(
      { error: "Making new videos is switched off on this site until its demo code is set up." },
      { status: 503 },
    );
  }
  if (code === "wrong") {
    await wait(WRONG_CODE_DELAY_MS);
    return Response.json({ error: "Making a video needs the right demo code." }, { status: 401 });
  }
  return null;
}

// The body of a JSON request, checked against the schema, or the answer that says what is wrong with it.
export async function readJson<I>(request: Request, schema: z.ZodType<I>, maxChars = MAX_BODY_CHARS): Promise<{ data: I } | { refusal: Response }> {
  if (!isJson(request)) {
    return { refusal: Response.json({ error: "The request must be JSON, sent with Content-Type: application/json." }, { status: 415 }) };
  }
  const body = await request.text();
  if (body.length > maxChars) {
    return { refusal: Response.json({ error: "The request is too large." }, { status: 413 }) };
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { refusal: Response.json({ error: "The request is not valid JSON." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { refusal: Response.json({ error: `The request is not valid: ${z.prettifyError(parsed.error)}` }, { status: 400 }) };
  }
  return { data: parsed.data };
}

// Shared by the pipeline API routes: check the demo code and the JSON body, run the step and return its result as JSON.
export async function runStep<I, O extends object>(
  request: Request,
  schema: z.ZodType<I>,
  step: (input: I) => Promise<O>,
  maxChars = MAX_BODY_CHARS,
): Promise<Response> {
  // Checked before anything else, so a request without the code never reaches a paid API.
  const refusal = await demoCodeRefusal(request);
  if (refusal) return refusal;
  const body = await readJson(request, schema, maxChars);
  if ("refusal" in body) return body.refusal;

  const started = performance.now();
  try {
    const result = await step(body.data);
    return Response.json({ ...result, ms: Math.round(performance.now() - started) });
  } catch (error) {
    // A topic Meko will not explain is an answer, not a failure: 422, so the page says why and offers no retry.
    if (error instanceof TopicRefusedError) return Response.json({ error: error.message, refused: true }, { status: 422 });
    console.error(error);
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
