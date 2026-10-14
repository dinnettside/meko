import type { SentenceCheck } from "@/lib/pipeline";
import type { Storyboard } from "@/lib/storyboard";
import type { SceneVoice } from "@/lib/voice";
import { estimateWords } from "@/remotion/Caption";
import { sceneFrames, sceneStarts } from "@/remotion/StoryboardVideo";

export type SentenceSpan = { sentenceId: string; startFrame: number; endFrame: number };

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

// When each spoken sentence starts and ends in the video, worked out from the word timings of its scene.
// Removed sentences are not spoken, so they get no span.
export function sentenceSpans(
  storyboard: Storyboard,
  voice: Record<string, SceneVoice>,
  checks: SentenceCheck[],
): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const starts = sceneStarts(storyboard);
  storyboard.scenes.forEach((scene, sceneIndex) => {
    const sceneStart = starts[sceneIndex];
    const frames = sceneFrames(scene, storyboard.fps);
    const words = voice[scene.id]?.words ?? estimateWords(scene.narration, scene.durationSec);
    const spoken = checks.filter((check) => check.sentenceId.startsWith(`${scene.id}.`) && check.status !== "removed");
    let wordIndex = 0;
    spoken.forEach((check, index) => {
      const firstWord = words[Math.min(wordIndex, words.length - 1)];
      const startFrame = index === 0 ? sceneStart : sceneStart + Math.round((firstWord?.start ?? 0) * storyboard.fps);
      if (index > 0) spans[spans.length - 1].endFrame = startFrame;
      spans.push({ sentenceId: check.sentenceId, startFrame, endFrame: sceneStart + frames });
      wordIndex += countWords(check.status === "revised" ? check.revised : check.original);
    });
  });
  return spans;
}
