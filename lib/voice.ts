import { z } from "zod";
import { speak, voiceIsConfigured } from "./elevenlabs.ts";
import type { Speech, TimedWord } from "./elevenlabs.ts";
import { StoryboardSchema } from "./storyboard.ts";
import type { Storyboard } from "./storyboard.ts";

const PAUSE_SEC = 0.6;
// The opening holds a little longer if needed, so the title and the globe have time to come in.
const MIN_OPENING_SEC = 4.5;
// ElevenLabs limits how many requests run at once. The Creator plan allows 5.
const CONCURRENCY = 4;
// About three and a half minutes of speech, well above the longest video Meko makes, so a request cannot spend
// a lot of voice credits at once.
const MAX_CHARACTERS = 4000;

export const VoiceInputSchema = z.object({ storyboard: StoryboardSchema });

// The recorded narration of one scene: an MP3 data URL and when each word is said.
export type SceneVoice = { audio: string; words: TimedWord[] };

export type VoiceResult = {
  storyboard: Storyboard;
  voice: Record<string, SceneVoice>; // by scene ID
  characters: number;
  skipped?: string; // why there is no voice, when there is none
};

// Runs `task` for every item, with at most `limit` running at the same time. Keeps the order.
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Records the narration of every scene. The scene lasts as long as its speech plus a short pause.
export async function recordVoice({ storyboard }: z.infer<typeof VoiceInputSchema>): Promise<VoiceResult> {
  if (!voiceIsConfigured()) {
    return { storyboard, voice: {}, characters: 0, skipped: "No ElevenLabs key is set up." };
  }
  const scenes = storyboard.scenes;
  const characters = scenes.reduce((total, scene) => total + scene.narration.length, 0);
  if (characters > MAX_CHARACTERS) throw new Error(`The narration has ${characters} characters, more than the ${MAX_CHARACTERS} a video may have.`);
  const speeches: Speech[] = await mapLimited(scenes, CONCURRENCY, (scene, index) =>
    speak({
      text: scene.narration,
      previousText: scenes[index - 1]?.narration,
      nextText: scenes[index + 1]?.narration,
      language: storyboard.language,
    }),
  );

  return {
    storyboard: {
      ...storyboard,
      scenes: scenes.map((scene, index) => {
        const seconds = speeches[index].durationSec + PAUSE_SEC;
        return { ...scene, durationSec: Math.round((index === 0 ? Math.max(MIN_OPENING_SEC, seconds) : seconds) * 10) / 10 };
      }),
    },
    voice: Object.fromEntries(
      scenes.map((scene, index) => [
        scene.id,
        { audio: `data:audio/mpeg;base64,${speeches[index].audioBase64}`, words: speeches[index].words },
      ]),
    ),
    characters,
  };
}
