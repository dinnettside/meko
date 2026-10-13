"use client";

import { Player } from "@remotion/player";
import { TestComposition } from "@/remotion/TestComposition";

export function VideoPlayer() {
  return (
    <Player
      component={TestComposition}
      durationInFrames={150}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      controls
      acknowledgeRemotionLicense
      style={{ width: "100%" }}
    />
  );
}
