import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { libraryIsConfigured } from "./library.ts";
import { overLimit } from "./rate-limit.ts";

// Limits on new videos, so a demo code that leaks, or a script, cannot spend the API credits faster than people watch:
// at most VIDEOS_PER_ADDRESS new videos from one address in ten minutes (counted per server instance), and
// VIDEOS_PER_DAY new videos a day in all (counted in the Blob store). Videos already made play from the library
// without either. Without a Blob store, as on a laptop, only the first limit holds.
const VIDEOS_PER_ADDRESS = 10;
export const VIDEOS_PER_DAY = 150;
const WRITE_TRIES = 4;

// A new video over one of the limits. The route answers it with 429 and the message.
export class VideoLimitError extends Error {}

// Counts a new video, or throws VideoLimitError when a limit is reached. When the count itself fails, the video goes
// on: turning people away because of a counter would be worse than one video too many.
export async function takeVideoSlot(request: Request): Promise<void> {
  if (overLimit(request, "video", VIDEOS_PER_ADDRESS)) {
    throw new VideoLimitError("You have started many videos in a short time. Wait ten minutes, then try again.");
  }
  if (!libraryIsConfigured()) return;
  const path = `limits/videos-${new Date().toISOString().slice(0, 10)}.json`;
  for (let attempt = 0; attempt < WRITE_TRIES; attempt++) {
    const found = await get(path, { access: "public", useCache: false }).catch(() => null);
    const stored = found && found.statusCode === 200 && found.stream ? found : null;
    const count = stored ? Number((JSON.parse(await new Response(stored.stream).text()) as { count?: number }).count) || 0 : 0;
    if (count >= VIDEOS_PER_DAY) {
      throw new VideoLimitError(`Meko has made its ${VIDEOS_PER_DAY} new videos for today. Videos already made still play; try again tomorrow.`);
    }
    try {
      await put(path, JSON.stringify({ count: count + 1 }), {
        access: "public",
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(stored ? { ifMatch: stored.blob.etag } : { allowOverwrite: false }),
      });
      return;
    } catch (error) {
      // Someone counted in between, or created the file first: read it again.
      const conflict = error instanceof BlobPreconditionFailedError || /already exists/i.test(String(error));
      if (!conflict) {
        console.warn(`[limits] Could not count the video, letting it through: ${error}`);
        return;
      }
    }
  }
}
