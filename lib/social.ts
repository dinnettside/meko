import { createHash, randomUUID } from "node:crypto";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { z } from "zod";
import { EXAMPLES } from "./example.ts";
import { libraryIsConfigured } from "./library.ts";
import { viewerName } from "./names.ts";

// Likes and comments on the videos in the feed, without accounts: each browser has a random viewer ID, and its
// comments go under a made-up name from that ID (lib/names.ts). Each video's likes and comments are one file in Vercel
// Blob, written only if nobody changed it since it was read, so two comments at once never overwrite each other.
// Without Blob (on a laptop), they live in memory until the server restarts.

export type FeedComment = { id: string; name: string; text: string; at: string };
export type VideoSocial = { likes: number; liked: boolean; comments: FeedComment[] };

type Stored = { likes: string[]; comments: (FeedComment & { by: string })[] };

const COMMENT_CHARS = 280;
const MAX_COMMENTS = 200; // the newest are kept
const SHOWN_COMMENTS = 50;
const COMMENT_GAP_MS = 20_000; // between two comments from one viewer
const MAX_PER_VIDEO = 5; // comments from one viewer on one video
const WRITE_TRIES = 4;

export const SLUGS = EXAMPLES.map((example) => example.slug) as [string, ...string[]];
const SlugSchema = z.enum(SLUGS);
const ViewerSchema = z.string().uuid();

export const SocialQuerySchema = z.object({ slugs: z.array(SlugSchema).max(50), viewer: ViewerSchema.optional() });
export const LikeInputSchema = z.object({ slug: SlugSchema, viewer: ViewerSchema, liked: z.boolean() });
export const CommentInputSchema = z.object({ slug: SlugSchema, viewer: ViewerSchema, text: z.string().max(2000) });

// The viewer ID is kept only as a salted hash, so the stored files cannot be tied back to a browser.
const hashViewer = (viewer: string) => createHash("sha256").update(`meko-viewer:${viewer}`).digest("hex").slice(0, 24);

const memory = new Map<string, Stored>();
const pathOf = (slug: string) => `social/${slug}.json`;
const empty = (): Stored => ({ likes: [], comments: [] });

async function load(slug: string, fresh: boolean): Promise<{ data: Stored; etag?: string }> {
  if (!libraryIsConfigured()) return { data: structuredClone(memory.get(slug) ?? empty()) };
  const result = await get(pathOf(slug), { access: "public", useCache: !fresh }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return { data: empty() };
  return { data: JSON.parse(await new Response(result.stream).text()) as Stored, etag: result.blob.etag };
}

// Reads the file, changes it and writes it back only if nobody changed it in between; else reads it again, a few
// times at most. `change` returns the new data, or a sentence saying why it cannot be changed.
async function update<T>(slug: string, change: (data: Stored) => { data: Stored; result: T } | string): Promise<T | { error: string }> {
  for (let attempt = 0; attempt < WRITE_TRIES; attempt++) {
    const { data, etag } = await load(slug, true);
    const changed = change(data);
    if (typeof changed === "string") return { error: changed };
    if (!libraryIsConfigured()) {
      memory.set(slug, changed.data);
      return changed.result;
    }
    try {
      await put(pathOf(slug), JSON.stringify(changed.data), {
        access: "public",
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      });
      return changed.result;
    } catch (error) {
      // Someone wrote in between, or created the file first: read it again.
      const conflict = error instanceof BlobPreconditionFailedError || /already exists/i.test(String(error));
      if (!conflict) throw error;
    }
  }
  return { error: "Too many people are commenting at once. Try again in a moment." };
}

const shown = (data: Stored, viewer?: string): VideoSocial => ({
  likes: data.likes.length,
  liked: viewer ? data.likes.includes(hashViewer(viewer)) : false,
  comments: data.comments
    .slice(-SHOWN_COMMENTS)
    .reverse()
    .map(({ id, name, text, at }) => ({ id, name, text, at })),
});

export async function readSocial({ slugs, viewer }: z.infer<typeof SocialQuerySchema>): Promise<Record<string, VideoSocial>> {
  const entries = await Promise.all(slugs.map(async (slug) => [slug, shown((await load(slug, false)).data, viewer)] as const));
  return Object.fromEntries(entries);
}

export async function setLike({ slug, viewer, liked }: z.infer<typeof LikeInputSchema>) {
  const me = hashViewer(viewer);
  return update(slug, (data) => {
    const likes = data.likes.filter((id) => id !== me).concat(liked ? [me] : []);
    return { data: { ...data, likes }, result: { likes: likes.length, liked } };
  });
}

// Links, words that are not friendly, and comments in a burst are turned away. Comments are not fact-checked, and
// the feed says so.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|info|biz|co|ly|me|app|dev)\b)/i;
const UNFRIENDLY = /\b(fuck\w*|shit\w*|cunt\w*|nigg\w*|fag\w*|retard\w*|whore\w*|slut\w*|bitch\w*|dick\w*|cock\w*|pussy\w*|kys)\b/i;

export function commentProblem(text: string): string | null {
  if (text.length === 0) return "Write something first.";
  if (text.length > COMMENT_CHARS) return `Keep it under ${COMMENT_CHARS} characters.`;
  if (LINK.test(text)) return "Links are not allowed in comments.";
  if (UNFRIENDLY.test(text)) return "Please keep it friendly.";
  return null;
}

export async function addComment({ slug, viewer, text }: z.infer<typeof CommentInputSchema>) {
  const clean = text.replace(/\s+/g, " ").trim();
  const problem = commentProblem(clean);
  if (problem) return { error: problem };
  const me = hashViewer(viewer);
  return update(slug, (data) => {
    const mine = data.comments.filter((comment) => comment.by === me);
    if (mine.length >= MAX_PER_VIDEO) return "You have commented on this video a few times already.";
    const last = mine.at(-1);
    if (last && Date.now() - Date.parse(last.at) < COMMENT_GAP_MS) return "Wait a moment before you comment again.";
    const comment = { id: randomUUID(), name: viewerName(viewer), text: clean, at: new Date().toISOString() };
    return { data: { ...data, comments: [...data.comments, { ...comment, by: me }].slice(-MAX_COMMENTS) }, result: comment };
  });
}
