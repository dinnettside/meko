import { timingSafeEqual } from "node:crypto";

// On the hosted demo, making a video needs the code in DEMO_CODE, so strangers cannot spend the API credits.
// Without DEMO_CODE, as in local development, every request is let through.
export function demoCodeIsWrong(request: Request): boolean {
  const expected = process.env.DEMO_CODE;
  if (!expected) return false;
  const given = Buffer.from(request.headers.get("x-demo-code") ?? "");
  const wanted = Buffer.from(expected);
  return given.length !== wanted.length || !timingSafeEqual(given, wanted);
}

export const demoCodeRequired = () => Boolean(process.env.DEMO_CODE);
