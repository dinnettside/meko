import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { z } from "zod";
import type { Example } from "./example.ts";
import { FactCheckReportSchema, ResearchFactListSchema, SourceListSchema, VideoRequestSchema } from "./pipeline.ts";
import type { VideoRequest } from "./pipeline.ts";
import { StoryboardSchema } from "./storyboard.ts";
import type { DrawingPart } from "./storyboard.ts";
import { contentWords } from "./words.ts";

// The library: finished videos saved in Vercel Blob, so a topic someone has asked for before plays at once and costs
// nothing. A video is found by its request: the topic in lower case without extra spaces, a question mark at the end
// or a "the" at the start, the audience, the length and the language. Saving needs the demo code, like making a video; watching does not.

// A video in the library: a saved example, with the address of each scene's MP3.
export type LibraryVideo = Example & { audio: Record<string, string> };

// A store connected to the Vercel project sets BLOB_STORE_ID, and the SDK signs in with the OIDC token Vercel sends
// with each request (not an environment variable at run time). A read-write token works anywhere, also on a laptop.
export const libraryIsConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export function libraryKey(request: VideoRequest): string {
  // "The Black Death?" and "black death" are the same topic.
  const topic = request.topic.toLowerCase().replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "").replace(/^(the|a|an) /, "");
  return createHash("sha256").update(JSON.stringify([topic, request.audience, request.lengthSec, request.language])).digest("hex").slice(0, 32);
}

// One scene's MP3 is about 16 kB a second as base64; a 25-second scene is under 600,000 characters.
const MAX_AUDIO_CHARS = 1_200_000;
const TimedWordSchema = z.object({ text: z.string().max(200), start: z.number(), end: z.number() });

export const FindInputSchema = z.object({ request: VideoRequestSchema });

export const SaveInputSchema = z.object({
  request: VideoRequestSchema,
  storyboard: StoryboardSchema,
  voice: z.record(
    z.string(),
    z.object({ audio: z.string().max(MAX_AUDIO_CHARS).regex(/^data:audio\/mpeg;base64,[A-Za-z0-9+/=]+$/), words: z.array(TimedWordSchema).max(400) }),
  ),
  report: FactCheckReportSchema,
  facts: ResearchFactListSchema,
  sources: SourceListSchema,
  costUsd: z.number(),
  ms: z.number(),
});

export async function findVideo({ request }: z.infer<typeof FindInputSchema>): Promise<{ video: LibraryVideo | null }> {
  if (!libraryIsConfigured()) return { video: null };
  const result = await get(`videos/${libraryKey(request)}.json`, { access: "public" });
  if (!result || result.statusCode !== 200 || !result.stream) return { video: null };
  return { video: JSON.parse(await new Response(result.stream).text()) as LibraryVideo };
}

export async function saveVideo(input: z.infer<typeof SaveInputSchema>): Promise<{ saved: boolean }> {
  if (!libraryIsConfigured()) return { saved: false };
  const { request, storyboard, voice } = input;
  // Only a whole video with a voice for every scene is kept.
  if (!storyboard.scenes.every((scene) => voice[scene.id])) return { saved: false };
  const key = libraryKey(request);
  // Each MP3 gets its own random address, so a newer video for the same request never plays an older cached voice.
  const audio = Object.fromEntries(
    await Promise.all(
      storyboard.scenes.map(async (scene) => {
        const base64 = voice[scene.id].audio.slice(voice[scene.id].audio.indexOf(",") + 1);
        const file = await put(`audio/${key}/${scene.id}.mp3`, Buffer.from(base64, "base64"), {
          access: "public",
          addRandomSuffix: true,
          contentType: "audio/mpeg",
        });
        return [scene.id, file.url];
      }),
    ),
  );
  const video: LibraryVideo = {
    request,
    madeAt: new Date().toISOString(),
    ms: input.ms,
    costUsd: input.costUsd,
    storyboard,
    words: Object.fromEntries(storyboard.scenes.map((scene) => [scene.id, voice[scene.id].words])),
    report: input.report,
    facts: input.facts,
    sources: input.sources,
    audio,
  };
  // A newer video for the same request replaces the older one; a minute's cache keeps that from lagging.
  await put(`videos/${key}.json`, JSON.stringify(video), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return { saved: true };
}

// Drawings the director made for its scenes, saved so a later scene about something similar can learn from them. Each
// is a file whose name holds the main words of its narration, so the library can be searched by listing names,
// without opening every file.
export type SavedDrawing = { narration: string; drawing: { title?: string; parts: DrawingPart[]; labels: { text: string; part: number }[] }; madeAt: string };

const DRAWINGS = "drawings/";
const wordsOf = (text: string) => [...new Set(contentWords(text).map((word) => word.replace(/[^a-z0-9]/g, "")).filter((word) => word.length >= 4))];

// Gives up after a short wait, so a slow library never holds up a video.
const within = <T>(ms: number, work: Promise<T>, fallback: T) =>
  Promise.race([work, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]).catch(() => fallback);

export async function saveDrawing(narration: string, drawing: SavedDrawing["drawing"]): Promise<void> {
  // Only clear drawings are worth learning from: a few parts, and labels that say what they are.
  if (!libraryIsConfigured() || drawing.parts.length > 10 || drawing.labels.length < 2) return;
  const name = wordsOf(narration).slice(0, 8).join("-") || "drawing";
  const hash = createHash("sha256").update(JSON.stringify(drawing)).digest("hex").slice(0, 10);
  const saved: SavedDrawing = { narration, drawing, madeAt: new Date().toISOString() };
  await within(4000, put(`${DRAWINGS}${name}--${hash}.json`, JSON.stringify(saved), { access: "public", allowOverwrite: true, contentType: "application/json" }), null);
}

// The saved drawings whose narration shares the most words with this one, at most `limit`, each sharing at least three.
export async function similarDrawings(narration: string, limit = 2): Promise<SavedDrawing[]> {
  if (!libraryIsConfigured()) return [];
  const wanted = new Set(wordsOf(narration));
  const listing = await within(2500, list({ prefix: DRAWINGS, limit: 1000 }), null);
  if (!listing) return [];
  const ranked = listing.blobs
    .map((blob) => {
      const words = blob.pathname.slice(DRAWINGS.length).split("--")[0].split("-");
      return { blob, shared: words.filter((word) => wanted.has(word)).length };
    })
    .filter((entry) => entry.shared >= 3)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit);
  const found = await Promise.all(
    ranked.map(({ blob }) => within(2500, fetch(blob.url).then((response) => (response.ok ? (response.json() as Promise<SavedDrawing>) : null)), null)),
  );
  return found.filter((entry): entry is SavedDrawing => entry !== null);
}
