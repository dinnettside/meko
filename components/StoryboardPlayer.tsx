"use client";

import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import { useEffect } from "react";
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
  poster = true,
  posterWhenPaused = false,
  volumeControls = true,
  clickToPlay = true,
  sharedAudioTags,
  initialVolume,
  onError,
}: {
  storyboard: Storyboard;
  voice: Record<string, SceneVoice>;
  sites: Record<string, string[]>;
  checks: CheckCounts;
  playerRef?: Ref<PlayerRef>;
  // For the feed, whose videos play by themselves as they come into view: no poster (only viewers who asked for less
  // motion wait for a tap), and no Remotion sound button, since the feed draws its own beside the video and mutes and
  // unmutes the player itself. The feed also plays and pauses on taps itself: Remotion's click-to-play reacts as soon
  // as a finger lands, so a swipe through the feed paused the video it started on. The feed's one player shows one
  // video after another, and Remotion shows the poster only before a player's first play, so the feed says itself when
  // the poster shows: while posterWhenPaused is on and the video is paused. That player also keeps more sound elements
  // than Remotion's five, and is told when its video fails, so it can be made again (see Feed). It plays at the volume
  // it is given rather than the one Remotion saved in the browser from the last volume slider moved, here on the start
  // page: dragged to 0 there, the feed, which has no slider, was silent with its sound on.
  poster?: boolean;
  posterWhenPaused?: boolean;
  volumeControls?: boolean;
  clickToPlay?: boolean;
  sharedAudioTags?: number;
  initialVolume?: number;
  onError?: () => void;
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
      clickToPlay={clickToPlay}
      showVolumeControls={volumeControls}
      spaceKeyToPlayOrPause={false}
      numberOfSharedAudioTags={sharedAudioTags}
      initialVolume={initialVolume}
      acknowledgeRemotionLicense
      style={{ width: "100%" }}
      renderPoster={poster || posterWhenPaused ? () => <Poster title={storyboard.title} /> : undefined}
      showPosterWhenUnplayed={poster}
      showPosterWhenPaused={posterWhenPaused}
      errorFallback={onError ? () => <Failed onError={onError} /> : undefined}
    />
  );
}

// Shown in place of a video that failed, like Remotion's own, and it tells the page.
function Failed({ onError }: { onError: () => void }) {
  useEffect(() => onError(), [onError]);
  return <>⚠️</>;
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
