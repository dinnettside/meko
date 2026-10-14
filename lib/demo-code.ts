import { timingSafeEqual } from "node:crypto";

// On the hosted demo, making a video needs the code in DEMO_CODE, so strangers cannot spend the API credits.
// Locally, without DEMO_CODE, every request is let through. On Vercel a missing DEMO_CODE shuts the paid routes
// instead of opening them: Vercel only applies a variable to new deployments, so a gate that falls open when the
// variable is missing would be easy to miss.

// Spaces and newlines around the code are dropped. A pasted value can end in one, and a header never carries them.
const expectedCode = () => (process.env.DEMO_CODE ?? "").trim();

// VERCEL is "1" on Vercel, at build time and at runtime, while the project exposes its system environment variables
// (the default).
const onVercel = () => Boolean(process.env.VERCEL);

// "ok" lets the request through. "wrong" is a missing or wrong code. "unset" means the app runs on Vercel without
// DEMO_CODE, so no code can be right.
export function checkDemoCode(request: Request): "ok" | "wrong" | "unset" {
  const expected = expectedCode();
  if (!expected) return onVercel() ? "unset" : "ok";
  const given = Buffer.from((request.headers.get("x-demo-code") ?? "").trim());
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? "ok" : "wrong";
}

// Whether the page asks for a code. On Vercel it always does, so a missing DEMO_CODE shows up as refused requests
// instead of an open site.
export const demoCodeRequired = () => onVercel() || expectedCode() !== "";
