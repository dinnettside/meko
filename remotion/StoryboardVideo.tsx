import type { ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Series, interpolate, useCurrentFrame } from "remotion";
import type { Scene, Storyboard } from "@/lib/storyboard";
import type { SceneVoice } from "@/lib/voice";
import { Caption, estimateWords } from "./Caption";
import { MapScene } from "./scenes/MapScene";
import { TextScene } from "./scenes/TextScene";
import { TimelineScene } from "./scenes/TimelineScene";
import { TitleScene } from "./scenes/TitleScene";
import { COLORS, FONTS, MOTION } from "@/lib/theme";

export function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

export function storyboardFrames(storyboard: Storyboard): number {
  return storyboard.scenes.reduce((total, scene) => total + sceneFrames(scene, storyboard.fps), 0);
}

// `voice` holds the recorded narration by scene ID. Without it, the video plays silently with captions.
export function StoryboardVideo({ storyboard, voice = {} }: { storyboard: Storyboard; voice?: Record<string, SceneVoice> }) {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: FONTS.body }}>
      <Series>
        {storyboard.scenes.map((scene) => {
          const frames = sceneFrames(scene, storyboard.fps);
          return (
            <Series.Sequence key={scene.id} durationInFrames={frames}>
              <Fade frames={frames} fps={storyboard.fps}>
                <SceneView scene={scene} />
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

// Every scene fades in from the dark ground and back out to it.
function Fade({ frames, fps, children }: { frames: number; fps: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const fade = Math.min(MOTION.sceneFade * fps, frames / 3);
  const opacity = interpolate(frame, [0, fade, frames - fade, frames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function SceneView({ scene }: { scene: Scene }) {
  switch (scene.kind) {
    case "title":
      return <TitleScene heading={scene.heading} subheading={scene.subheading} />;
    case "text":
      return <TextScene lines={scene.lines} />;
    case "map":
      return <MapScene scene={scene} />;
    case "timeline":
      return <TimelineScene events={scene.events} focusIndex={scene.focusIndex} />;
  }
}
