"use client";

import { Player } from "@remotion/player";
import type { Storyboard } from "@/lib/storyboard";
import { StoryboardVideo, storyboardFrames } from "@/remotion/StoryboardVideo";

export function StoryboardPlayer({ storyboard }: { storyboard: Storyboard }) {
  return (
    <Player
      component={StoryboardVideo}
      inputProps={{ storyboard }}
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
