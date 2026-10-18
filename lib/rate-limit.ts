// A rough limit on requests per address and kind, per server instance, for the feed's likes and comments: enough to
// stop a script from flooding them, not a guarantee across instances.
const WINDOW_MS = 10 * 60_000;
const seen = new Map<string, number[]>();

export function overLimit(request: Request, kind: string, maxPerWindow: number): boolean {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const key = `${kind}:${address}`;
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  seen.set(key, recent);
  // Keeps the map from growing without end on a long-running instance.
  if (seen.size > 5_000) seen.clear();
  return recent.length > maxPerWindow;
}
