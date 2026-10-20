import { z } from "zod";

// Text to speech with ElevenLabs, called over plain HTTP.
// https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps

const API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const TIMEOUT_MS = 30_000;
// ElevenLabs answers 429 when it is busy or when too many requests run at once, as when two videos are voiced at the
// same time, and its docs say to retry with a growing wait. A turned-away request makes no speech, so a scene may
// wait through this many while the other videos finish: about 50 s in all. The step's deadline still ends the
// waiting in time.
const MAX_BUSY_RETRIES = 12;
// A 5xx, a dropped connection or a request that ran past its timeout gets at most this many retries. A request that
// timed out may still have cost credits.
const MAX_ERROR_RETRIES = 2;
// Waits double from 1 s up to this, even when Retry-After asks for more: 1, 2, 4, 5, 5, ... s.
const MAX_RETRY_WAIT_MS = 5_000;
// A request with less time than this left before the deadline would only be cut off, so it does not start.
const MIN_REQUEST_MS = 2_000;
// 64 kbps keeps a 90-second video under 1 MB of audio, so it fits in one API response.
const OUTPUT_FORMAT = "mp3_44100_64";
const BYTES_PER_SECOND = 64_000 / 8;
// Multilingual v2 is the most stable model for narration split into parts. It has no Norwegian, so
// Norwegian uses Flash v2.5.
const MODELS = { en: "eleven_multilingual_v2", no: "eleven_flash_v2_5" } as const;

const SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";
// Fewer characters than this left counts as low: about ten videos (one uses about 1,000).
const LOW_VOICE_CHARACTERS = 10_000;

const SubscriptionSchema = z.object({ character_count: z.number(), character_limit: z.number(), status: z.string() });

const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});

const SpeechSchema = z.object({
  audio_base64: z.string(),
  alignment: AlignmentSchema.nullish(),
});

// A spoken word and when it is said, in seconds from the start of the scene.
export type TimedWord = { text: string; start: number; end: number };

export type Speech = { audioBase64: string; durationSec: number; words: TimedWord[] };

export function voiceIsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

// Groups the character timings into words, so captions can follow the voice.
function wordsFromAlignment(alignment: z.infer<typeof AlignmentSchema>): TimedWord[] {
  const words: TimedWord[] = [];
  let current: TimedWord | null = null;
  for (let index = 0; index < alignment.characters.length; index++) {
    const character = alignment.characters[index];
    if (/\s/.test(character)) {
      if (current) words.push(current);
      current = null;
      continue;
    }
    current ??= { text: "", start: alignment.character_start_times_seconds[index], end: 0 };
    current.text += character;
    current.end = alignment.character_end_times_seconds[index];
  }
  if (current) words.push(current);
  return words;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// How long to wait before a retry: what Retry-After asks for, else 1 s, doubling with each retry, at most
// MAX_RETRY_WAIT_MS. Up to half a second more at random keeps the requests that were turned away together from all
// coming back at once.
function retryWaitMs(retryAfter: string | null, retry: number): number {
  const asked = Number(retryAfter) * 1000;
  const base = asked > 0 ? asked : 1000 * 2 ** retry;
  return Math.min(base, MAX_RETRY_WAIT_MS) + Math.random() * 500;
}

// One request. Returns ElevenLabs' answer, or `error` when no whole answer came back: the connection dropped
// ("fetch failed") or the request ran past its timeout.
async function post(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: string; retryAfter: string | null } | { error: string }> {
  try {
    const response = await fetch(url, init);
    return { status: response.status, body: await response.text(), retryAfter: response.headers.get("retry-after") };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// The text before and after helps the voice keep a natural flow across scenes. A request that fails is tried again
// after a growing wait while the deadline allows: after a 429 at most MAX_BUSY_RETRIES times, and after a 5xx, a
// dropped connection or a timeout at most MAX_ERROR_RETRIES times.
export async function speak(input: {
  text: string;
  previousText?: string;
  nextText?: string;
  language: keyof typeof MODELS;
  deadline?: number; // a Date.now() time: no request starts after it, and none runs past it
  stop?: AbortSignal; // aborted when the voice-over has failed anyway, so no new request starts
}): Promise<Speech> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error("ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not set.");

  const deadline = input.deadline ?? Infinity;
  let started = 0;
  let speechJson = "";
  let busyRetries = 0;
  let errorRetries = 0;
  // Every pass that goes on uses up one of the two retry budgets, so a scene makes at most
  // 1 + MAX_BUSY_RETRIES + MAX_ERROR_RETRIES requests.
  for (let retry = 0; ; retry++) {
    if (input.stop?.aborted) throw new Error("Stopped, since another scene's voice failed.");
    const timeoutMs = Math.min(TIMEOUT_MS, deadline - Date.now());
    if (timeoutMs < MIN_REQUEST_MS) throw new Error("The voice-over ran out of time.");
    started = performance.now();
    const answer = await post(`${API_URL}/${voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text: input.text,
        model_id: MODELS[input.language],
        previous_text: input.previousText,
        next_text: input.nextText,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ("status" in answer && answer.status >= 200 && answer.status < 300) {
      speechJson = answer.body;
      break;
    }
    // No answer at all, a 429 and a 5xx are worth another try. Any other status would come back the same.
    const busy = "status" in answer && answer.status === 429;
    const worthRetrying = "error" in answer || answer.status === 429 || answer.status >= 500;
    const retriesLeft = busy ? busyRetries < MAX_BUSY_RETRIES : errorRetries < MAX_ERROR_RETRIES;
    const waitMs = retryWaitMs("status" in answer ? answer.retryAfter : null, retry);
    const failure =
      "error" in answer
        ? `ElevenLabs did not answer: ${answer.error}`
        : `ElevenLabs failed with HTTP ${answer.status}: ${answer.body.slice(0, 200)}`;
    if (!worthRetrying || !retriesLeft || Date.now() + waitMs + MIN_REQUEST_MS > deadline) throw new Error(failure);
    if (busy) busyRetries++;
    else errorRetries++;
    const what = "error" in answer ? answer.error : `HTTP ${answer.status}`;
    console.warn(`[elevenlabs] ${what}. Trying again in ${(waitMs / 1000).toFixed(1)} s.`);
    await wait(waitMs);
  }
  const speech = SpeechSchema.parse(JSON.parse(speechJson));
  const words = speech.alignment ? wordsFromAlignment(speech.alignment) : [];

  // The speech ends when the last word ends. Without timings, estimate it from the file size.
  const lastWord = words.at(-1);
  const durationSec = lastWord ? lastWord.end : (speech.audio_base64.length * 0.75) / BYTES_PER_SECOND;
  console.log(
    `[elevenlabs] ${input.text.length} characters, ${durationSec.toFixed(1)} s of speech, ${Math.round(performance.now() - started)} ms`,
  );
  return { audioBase64: speech.audio_base64, durationSec, words };
}

// Whether this month's voice characters are running out, for the daily health check, from ElevenLabs' subscription
// endpoint, which costs nothing: "ok", "low" or "out". "unknown" when the key may not read the subscription, and
// "off" without a voice. A subscription with an unpaid invoice counts as low, since it may stop.
export async function voiceCredits(): Promise<"ok" | "low" | "out" | "unknown" | "off"> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !voiceIsConfigured()) return "off";
  const response = await fetch(SUBSCRIPTION_URL, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 401 || response.status === 403) return "unknown";
  if (!response.ok) throw new Error(`ElevenLabs subscription failed with HTTP ${response.status}`);
  const subscription = SubscriptionSchema.parse(await response.json());
  const left = subscription.character_limit - subscription.character_count;
  if (left <= 0) return "out";
  return left < LOW_VOICE_CHARACTERS || ["past_due", "incomplete"].includes(subscription.status) ? "low" : "ok";
}
