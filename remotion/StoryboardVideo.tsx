import { useMemo } from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Series, interpolate, useCurrentFrame } from "remotion";
import type { Scene, Storyboard } from "@/lib/storyboard";
import { COLORS, FONTS, MOTION } from "@/lib/theme";
import type { TimedWord } from "@/lib/elevenlabs";
import type { SceneVoice } from "@/lib/voice";
import { Caption, estimateWords } from "./Caption";
import { Credits } from "./Credits";
import type { CheckCounts } from "./Credits";
import { YearMark } from "./YearMark";
import { SourceChip } from "./SourceChip";
import { CompareScene } from "./scenes/CompareScene";
import { IllustrationScene } from "./scenes/IllustrationScene";
import { PeopleScene } from "./scenes/PeopleScene";
import { SpaceScene } from "./scenes/SpaceScene";
import { ChangeScene } from "./scenes/ChangeScene";
import { ListScene } from "./scenes/ListScene";
import { VersusScene } from "./scenes/VersusScene";
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

// The closing credits list every source, a little longer when there are many.
export function creditsFrames(storyboard: Storyboard): number {
  if (storyboard.sources.length === 0) return 0;
  return Math.round(Math.min(9, Math.max(4.5, 2.5 + 0.7 * storyboard.sources.length)) * storyboard.fps);
}

export function storyboardFrames(storyboard: Storyboard): number {
  const last = storyboard.scenes.length - 1;
  if (last < 0) return 1;
  const scenesEnd = sceneStarts(storyboard)[last] + sceneFrames(storyboard.scenes[last], storyboard.fps);
  const credits = creditsFrames(storyboard);
  // The credits dissolve in over the end of the last scene, like one scene into the next.
  return credits > 0 ? scenesEnd - overlapFrames(storyboard.fps) + credits : scenesEnd;
}

const NO_VOICE: Record<string, SceneVoice> = {};
const NO_SITES: Record<string, string[]> = {};

// `voice` holds the recorded narration by scene ID. Without it, the video plays silently with captions.
// `sites` holds the sites behind each scene's facts, shown in a corner of the scene. `checks` is the fact-check
// result, shown in the closing credits.
export function StoryboardVideo({
  storyboard,
  voice = NO_VOICE,
  sites = NO_SITES,
  checks,
}: {
  storyboard: Storyboard;
  voice?: Record<string, SceneVoice>;
  sites?: Record<string, string[]>;
  checks?: CheckCounts;
}) {
  const overlap = overlapFrames(storyboard.fps);
  const credits = creditsFrames(storyboard);
  // The opening globe turns to the countries of the first map in the video.
  const firstMap = storyboard.scenes.find((scene) => scene.kind === "map");
  const region = firstMap?.kind === "map" ? firstMap.highlights.map((highlight) => highlight.country) : [];
  // When each word is said, so captions and pictures can follow the voice. Estimated when there is no voice.
  const wordsByScene = useMemo(
    () => storyboard.scenes.map((scene) => voice[scene.id]?.words ?? estimateWords(scene.narration, scene.durationSec)),
    [storyboard, voice],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: FONTS.body }}>
      <Series>
        {storyboard.scenes.map((scene, index) => {
          const frames = sceneFrames(scene, storyboard.fps);
          // Without credits, the last scene fades out to the dark ground itself.
          const fadeOut = index === storyboard.scenes.length - 1 && credits === 0;
          const words = wordsByScene[index];
          return (
            <Series.Sequence key={scene.id} durationInFrames={frames} offset={index === 0 ? 0 : -overlap}>
              <Fade frames={frames} fade={overlap} fadeOut={fadeOut}>
                <SceneView
                  scene={scene}
                  previous={storyboard.scenes[index - 1]}
                  isLast={index === storyboard.scenes.length - 1}
                  words={words}
                  storyboard={storyboard}
                  region={region}
                />
                {/* A timeline shows its own years, and the title card is kept clear. */}
                {scene.kind !== "timeline" && scene.kind !== "title" ? <YearMark narration={scene.narration} /> : null}
                {/* The title has no claims to source, and a quote names its own source. */}
                {scene.kind !== "title" && scene.kind !== "quote" ? <SourceChip sites={sites[scene.id] ?? []} /> : null}
                <Caption words={words} />
              </Fade>
              {voice[scene.id] ? <Html5Audio src={voice[scene.id].audio} /> : null}
            </Series.Sequence>
          );
        })}
        {credits > 0 ? (
          <Series.Sequence durationInFrames={credits} offset={-overlap}>
            <Fade frames={credits} fade={overlap} fadeOut>
              <Credits sources={storyboard.sources} checks={checks} />
            </Fade>
          </Series.Sequence>
        ) : null}
      </Series>
    </AbsoluteFill>
  );
}

// A scene fades in over the one before it. Only the end of the video fades out, to the dark ground.
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

function SceneView({
  scene,
  previous,
  isLast,
  words,
  storyboard,
  region,
}: {
  scene: Scene;
  previous?: Scene;
  isLast: boolean;
  words: TimedWord[];
  storyboard: Storyboard;
  region: string[];
}) {
  const timing = { words, durationSec: scene.durationSec };
  switch (scene.kind) {
    case "title":
      return <TitleScene heading={scene.heading} subheading={scene.subheading} region={region} />;
    case "text":
      return <TextScene lines={scene.lines} {...timing} />;
    case "map":
      return <MapScene scene={scene} previous={previous?.kind === "map" ? previous : undefined} {...timing} />;
    case "timeline":
      return <TimelineScene events={scene.events} focusIndex={scene.focusIndex} eras={scene.eras} {...timing} />;
    case "stat":
      return <StatScene value={scene.value} valueMax={scene.valueMax} unit={scene.unit} label={scene.label} total={scene.total} {...timing} />;
    case "compare":
      return <CompareScene title={scene.title} unit={scene.unit} bars={scene.bars} {...timing} />;
    case "quote":
      return (
        <QuoteScene text={scene.text} source={storyboard.sources.find((source) => source.id === scene.sourceId)} durationSec={scene.durationSec} />
      );
    case "steps":
      return <StepsScene steps={scene.steps} icons={scene.icons} {...timing} />;
    case "list":
      return <ListScene items={scene.items} summary={isLast} {...timing} />;
    case "versus":
      return <VersusScene left={scene.left} right={scene.right} leftIcon={scene.leftIcon} rightIcon={scene.rightIcon} rows={scene.rows} {...timing} />;
    case "change":
      return <ChangeScene from={scene.from} to={scene.to} year={scene.year} {...timing} />;
    case "people":
      return <PeopleScene people={scene.people} {...timing} />;
    case "space":
      return <SpaceScene view={scene.view} bodies={scene.bodies} craft={scene.craft} sites={scene.sites} {...timing} />;
    case "illustration":
      return <IllustrationScene title={scene.title} items={scene.items} links={scene.links} {...timing} />;
  }
}
