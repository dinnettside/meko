import type { ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Series, interpolate, useCurrentFrame } from "remotion";
import type { Scene, Storyboard } from "@/lib/storyboard";
import { COLORS, FONTS, MOTION } from "@/lib/theme";
import type { SceneVoice } from "@/lib/voice";
import { Caption, estimateWords } from "./Caption";
import { CompareScene } from "./scenes/CompareScene";
import { MapScene } from "./scenes/MapScene";
import { QuoteScene } from "./scenes/QuoteScene";
import { StatScene } from "./scenes/StatScene";
import { StepsScene } from "./scenes/StepsScene";
import { TextScene } from "./scenes/TextScene";
import { TimelineScene } from "./scenes/TimelineScene";
import { TitleScene } from "./scenes/TitleScene";

export function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

// Each scene starts a moment before the one before it ends, so they dissolve into each other.
// The overlap falls in the pause after each scene's narration, so voices never overlap.
const overlapFrames = (fps: number) => Math.round(MOTION.sceneFade * fps);

// The frame where each scene starts.
export function sceneStarts(storyboard: Storyboard): number[] {
  let start = 0;
  return storyboard.scenes.map((scene) => {
    const current = start;
    start += sceneFrames(scene, storyboard.fps) - overlapFrames(storyboard.fps);
    return current;
  });
}

export function storyboardFrames(storyboard: Storyboard): number {
  const last = storyboard.scenes.length - 1;
  if (last < 0) return 1;
  return sceneStarts(storyboard)[last] + sceneFrames(storyboard.scenes[last], storyboard.fps);
}

// `voice` holds the recorded narration by scene ID. Without it, the video plays silently with captions.
export function StoryboardVideo({ storyboard, voice = {} }: { storyboard: Storyboard; voice?: Record<string, SceneVoice> }) {
  const overlap = overlapFrames(storyboard.fps);
  // The opening globe turns to the countries of the first map in the video.
  const firstMap = storyboard.scenes.find((scene) => scene.kind === "map");
  const region = firstMap?.kind === "map" ? firstMap.highlights.map((highlight) => highlight.country) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: FONTS.body }}>
      <Series>
        {storyboard.scenes.map((scene, index) => {
          const frames = sceneFrames(scene, storyboard.fps);
          const isLast = index === storyboard.scenes.length - 1;
          return (
            <Series.Sequence key={scene.id} durationInFrames={frames} offset={index === 0 ? 0 : -overlap}>
              <Fade frames={frames} fade={overlap} fadeOut={isLast}>
                <SceneView scene={scene} storyboard={storyboard} region={region} />
                <Caption words={voice[scene.id]?.words ?? estimateWords(scene.narration, scene.durationSec)} />
              </Fade>
              {voice[scene.id] ? <Html5Audio src={voice[scene.id].audio} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
}

// A scene fades in over the one before it. Only the last scene fades out, to the dark ground.
function Fade({ frames, fade, fadeOut, children }: { frames: number; fade: number; fadeOut: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  const length = Math.max(1, Math.min(fade, frames / 3));
  const opacity = interpolate(
    frame,
    fadeOut ? [0, length, frames - length, frames] : [0, length],
    fadeOut ? [0, 1, 1, 0] : [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity, backgroundColor: COLORS.ink }}>{children}</AbsoluteFill>;
}

function SceneView({ scene, storyboard, region }: { scene: Scene; storyboard: Storyboard; region: string[] }) {
  switch (scene.kind) {
    case "title":
      return <TitleScene heading={scene.heading} subheading={scene.subheading} region={region} />;
    case "text":
      return <TextScene lines={scene.lines} durationSec={scene.durationSec} />;
    case "map":
      return <MapScene scene={scene} />;
    case "timeline":
      return <TimelineScene events={scene.events} focusIndex={scene.focusIndex} durationSec={scene.durationSec} />;
    case "stat":
      return <StatScene value={scene.value} unit={scene.unit} label={scene.label} total={scene.total} />;
    case "compare":
      return <CompareScene title={scene.title} unit={scene.unit} bars={scene.bars} />;
    case "quote":
      return <QuoteScene text={scene.text} source={storyboard.sources.find((source) => source.id === scene.sourceId)} />;
    case "steps":
      return <StepsScene steps={scene.steps} durationSec={scene.durationSec} />;
  }
}
