"use client";

import { Player } from "@remotion/player";
import type { Storyboard } from "@/lib/storyboard";
import type { SceneVoice } from "@/lib/voice";
import { StoryboardVideo, storyboardFrames } from "@/remotion/StoryboardVideo";

export function StoryboardPlayer({ storyboard, voice }: { storyboard: Storyboard; voice: Record<string, SceneVoice> }) {
  return (
    <Player
      component={StoryboardVideo}
      inputProps={{ storyboard, voice }}
      durationInFrames={storyboardFrames(storyboard)}
      fps={storyboard.fps}
      compositionWidth={storyboard.width}
      compositionHeight={storyboard.height}
      controls
      acknowledgeRemotionLicense
      style={{ width: "100%" }}
    />
  );
}
