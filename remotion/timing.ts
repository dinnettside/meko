// How long each scene and the whole video run, in frames, and when its words are said when there is no voice. Used by
// the player, the fact-check report and the feed, which load it without the rest of the video.
import type { TimedWord } from "../lib/elevenlabs.ts";
import type { Scene, Storyboard } from "../lib/storyboard.ts";
import { MOTION } from "../lib/theme.ts";

export function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

// Each scene starts a moment before the one before it ends, so they dissolve into each other.
// The overlap falls in the pause after each scene's narration, so voices never overlap.
export const overlapFrames = (fps: number) => Math.round(MOTION.sceneFade * fps);

// The frame where each scene starts.
export function sceneStarts(storyboard: Storyboard): number[] {
  let start = 0;
  return storyboard.scenes.map((scene) => {
    const current = start;
    start += sceneFrames(scene, storyboard.fps) - overlapFrames(storyboard.fps);
    return current;
  });
}

// The closing credits list every source, a little longer when there are many.
export function creditsFrames(storyboard: Storyboard): number {
  if (storyboard.sources.length === 0) return 0;
  return Math.round(Math.min(9, Math.max(4.5, 2.5 + 0.7 * storyboard.sources.length)) * storyboard.fps);
}

export function storyboardFrames(storyboard: Storyboard): number {
  const last = storyboard.scenes.length - 1;
  if (last < 0) return 1;
  const scenesEnd = sceneStarts(storyboard)[last] + sceneFrames(storyboard.scenes[last], storyboard.fps);
  const credits = creditsFrames(storyboard);
  // The credits dissolve in over the end of the last scene, like one scene into the next.
  return credits > 0 ? scenesEnd - overlapFrames(storyboard.fps) + credits : scenesEnd;
}

// Without recorded timings, spread the words evenly over the scene, leaving a short pause at the end.
export function estimateWords(narration: string, durationSec: number): TimedWord[] {
  const texts = narration.split(/\s+/).filter(Boolean);
  const step = Math.max(0.5, durationSec - 0.6) / Math.max(1, texts.length);
  return texts.map((text, index) => ({ text, start: index * step, end: (index + 1) * step }));
}
