import { z } from "zod";

const MAX_BODY_CHARS = 300_000;

// Shared by the pipeline API routes: check the JSON body, run the step and return its result as JSON.
export async function runStep<I, O extends object>(
  request: Request,
  schema: z.ZodType<I>,
  step: (input: I) => Promise<O>,
): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_BODY_CHARS) {
    return Response.json({ error: "The request is too large." }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return Response.json({ error: "The request is not valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: `The request is not valid: ${z.prettifyError(parsed.error)}` }, { status: 400 });
  }

  const started = performance.now();
  try {
    const result = await step(parsed.data);
    return Response.json({ ...result, ms: Math.round(performance.now() - started) });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
