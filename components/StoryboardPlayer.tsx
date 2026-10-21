"use client";

import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import type { Ref } from "react";
import type { Storyboard } from "@/lib/storyboard";
import type { CheckCounts } from "@/remotion/Credits";
import type { SceneVoice } from "@/lib/voice";
import { StoryboardVideo, storyboardFrames } from "@/remotion/StoryboardVideo";
import { APP_COLORS } from "@/lib/theme";

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
  // Remotion's space key works by moving the focus to its play button whenever a player loads, plays or pauses. That
  // pulled the focus out of the feed's search box while someone typed, so it is off, and the pages handle the space
  // bar themselves (Feed, MakeVideo).
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
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
      style={{ width: "100%" }}
      renderPoster={() => <Poster title={storyboard.title} />}
      showPosterWhenUnplayed
    />
  );
}

// Shown before the first play, since the video opens on a dark frame while the title fades in. It is drawn in the app's
// dark mode in both modes, like a screen that is off.
function Poster({ title }: { title: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-start justify-center gap-6 px-[9%] pb-[8%]"
      style={{ background: APP_COLORS.dark.bg, color: APP_COLORS.dark.fg }}
    >
      <p className="font-serif text-[clamp(1.5rem,4vw,3.5rem)] leading-tight">{title}</p>
      <span className="rounded-full px-5 py-2 text-sm font-medium" style={{ background: APP_COLORS.dark.fg, color: APP_COLORS.dark.bg }}>
        ▶ Play
      </span>
    </div>
  );
}
