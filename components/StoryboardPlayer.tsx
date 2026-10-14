"use client";

import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import type { Ref } from "react";
import type { Storyboard } from "@/lib/storyboard";
import type { CheckCounts } from "@/remotion/Credits";
import type { SceneVoice } from "@/lib/voice";
import { StoryboardVideo, storyboardFrames } from "@/remotion/StoryboardVideo";

export function StoryboardPlayer({
  storyboard,
  voice,
  sites,
  checks,
  playerRef,
}: {
  storyboard: Storyboard;
  voice: Record<string, SceneVoice>;
  sites: Record<string, string[]>;
  checks: CheckCounts;
  playerRef?: Ref<PlayerRef>;
}) {
  return (
    <Player
      ref={playerRef}
      component={StoryboardVideo}
      inputProps={{ storyboard, voice, sites, checks }}
      durationInFrames={storyboardFrames(storyboard)}
      fps={storyboard.fps}
      compositionWidth={storyboard.width}
      compositionHeight={storyboard.height}
      controls
      acknowledgeRemotionLicense
      style={{ width: "100%" }}
      renderPoster={() => <Poster title={storyboard.title} />}
      showPosterWhenUnplayed
    />
  );
}

// Shown before the first play, since the video opens on a dark frame while the title fades in.
function Poster({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-center gap-6 bg-ink px-[11%] pb-[10%] text-paper">
      <p className="font-display text-[clamp(1.5rem,4vw,3.5rem)] font-bold leading-tight">{title}</p>
      <span className="rounded bg-signal px-4 py-2 text-sm font-semibold text-ink">▶ Play</span>
    </div>
  );
}
