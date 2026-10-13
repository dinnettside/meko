import { AbsoluteFill, Html5Audio, Series, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, Storyboard } from "@/lib/storyboard";

// Plays a storyboard. The look is neutral on purpose until the design direction is picked.

export function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

export function storyboardFrames(storyboard: Storyboard): number {
  return storyboard.scenes.reduce((total, scene) => total + sceneFrames(scene, storyboard.fps), 0);
}

// `audio` maps scene IDs to the recorded narration. Without it, the video plays silently with captions.
export function StoryboardVideo({ storyboard, audio = {} }: { storyboard: Storyboard; audio?: Record<string, string> }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "white", color: "#111", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <Series>
        {storyboard.scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene, storyboard.fps)}>
            <SceneView scene={scene} />
            <Caption text={scene.narration} />
            {audio[scene.id] ? <Html5Audio src={audio[scene.id]} /> : null}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

function SceneView({ scene }: { scene: Scene }) {
  if (scene.kind === "title") return <TitleScene heading={scene.heading} subheading={scene.subheading} />;
  if (scene.kind === "text") return <TextScene lines={scene.lines} />;
  // Map and timeline scenes come in Phase 2. Until then they show their narration.
  return <TextScene lines={[scene.narration]} />;
}

// Fades in and slides up over half a second, starting `delaySec` into the scene.
function useEntrance(delaySec: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [delaySec * fps, (delaySec + 0.5) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity: progress, transform: `translateY(${(1 - progress) * 40}px)` };
}

function TitleScene({ heading, subheading }: { heading: string; subheading?: string }) {
  const headingStyle = useEntrance(0.2);
  const subheadingStyle = useEntrance(0.7);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 160px 200px" }}>
      <div style={{ ...headingStyle, fontSize: 110, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>
        {heading}
      </div>
      {subheading ? (
        <div style={{ ...subheadingStyle, fontSize: 56, marginTop: 40, color: "#444", textAlign: "center" }}>
          {subheading}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function TextScene({ lines }: { lines: string[] }) {
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 200px 200px" }}>
      {lines.map((line, index) => (
        <Line key={index} text={line} delaySec={0.2 + index * 0.5} />
      ))}
    </AbsoluteFill>
  );
}

function Line({ text, delaySec }: { text: string; delaySec: number }) {
  const style = useEntrance(delaySec);
  return <div style={{ ...style, fontSize: 80, fontWeight: 700, lineHeight: 1.2, marginBottom: 36 }}>{text}</div>;
}

// No voice yet, so the narration is shown as a caption.
function Caption({ text }: { text: string }) {
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 60 }}>
      <div
        style={{
          maxWidth: 1600,
          padding: "20px 32px",
          backgroundColor: "rgba(0, 0, 0, 0.78)",
          color: "white",
          fontSize: 40,
          lineHeight: 1.35,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
