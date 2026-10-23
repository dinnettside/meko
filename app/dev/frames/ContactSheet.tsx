"use client";

import { Thumbnail } from "@remotion/player";
import { useEffect, useState, useSyncExternalStore } from "react";
import { loadSavedVideo } from "@/components/saved-video";
import type { SavedVideo } from "@/components/saved-video";
import { EXAMPLES } from "@/lib/example";
import { sceneSites } from "@/remotion/sites";
import { StoryboardVideo, creditsFrames, sceneFrames, sceneStarts, storyboardFrames } from "@/remotion/StoryboardVideo";

// ?slugs=a,b picks videos (all of the feed by default); ?mode=openings shows only the first seconds of each, in feed
// order; ?t=12.5 shows only these moments of each video, in seconds; ?at=0.2,0.9 are the moments of each scene shown,
// as fractions of it (the middle by default); ?w= is the width of one frame in pixels. Every frame is a [data-frame] box named after its video and scene, so a script can look
// inside it.
type Shot = { label: string; frame: number };

// The query in the address, read in the browser only, so the server's page and the browser's first render match.
const noSubscribe = () => () => {};
const readSearch = () => window.location.search;

function shotsOf(video: SavedVideo, mode: string, moments: number[], times?: number[]): Shot[] {
  const { storyboard } = video;
  const fps = storyboard.fps;
  if (times) return times.map((seconds) => ({ label: `${seconds}s`, frame: Math.round(seconds * fps) }));
  const opening = [0.4, 1.2, 2.5].map((seconds) => ({ label: `opening ${seconds}s`, frame: Math.round(seconds * fps) }));
  if (mode === "openings") return opening;
  const starts = sceneStarts(storyboard);
  const scenes = storyboard.scenes.flatMap((scene, index) =>
    moments.map((moment) => ({
      label: `${index + 1} ${scene.look?.template ?? (scene.kind === "template" ? scene.template : scene.kind)}${moments.length > 1 ? ` @${moment}` : ""}`,
      frame: starts[index] + Math.round(sceneFrames(scene, fps) * moment),
    })),
  );
  const total = storyboardFrames(storyboard);
  const credits = creditsFrames(storyboard) > 0 ? [{ label: "credits", frame: total - Math.round(creditsFrames(storyboard) / 2) }] : [];
  return [...opening, ...scenes, ...credits];
}

export function ContactSheet() {
  const params = new URLSearchParams(useSyncExternalStore(noSubscribe, readSearch, () => null) ?? "");
  const slugs = params.get("slugs")?.split(",").filter(Boolean) ?? EXAMPLES.map((example) => example.slug);
  const mode = params.get("mode") ?? "scenes";
  const width = Number(params.get("w") ?? 320);
  const moments = (params.get("at") ?? "0.55").split(",").map(Number);
  const times = params.get("t")?.split(",").map(Number);
  const [videos, setVideos] = useState<Record<string, SavedVideo>>({});

  useEffect(() => {
    for (const slug of slugs) {
      void loadSavedVideo(slug).then((video) => setVideos((current) => ({ ...current, [slug]: video })));
    }
    // The slugs come from the address, which does not change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = slugs.every((slug) => videos[slug]);
  return (
    <main data-ready={ready ? "yes" : "no"} className="flex flex-col gap-6 bg-black p-4 text-white">
      {slugs.map((slug) => {
        const video = videos[slug];
        if (!video) return <p key={slug}>Loading {slug}…</p>;
        const { storyboard } = video;
        const props = { storyboard, voice: video.voice, sites: sceneSites(storyboard, video.facts), checks: video.report };
        return (
          <section key={slug} className="flex flex-col gap-2">
            <h2 className="font-mono text-sm">
              {slug} · {storyboard.theme ?? "night"} · {storyboard.title}
            </h2>
            <div className="flex flex-wrap gap-2">
              {shotsOf(video, mode, moments, times).map((shot) => (
                <figure key={shot.label} data-frame={`${slug}|${shot.label}`} className="flex flex-col gap-1" style={{ width }}>
                  <Thumbnail
                    component={StoryboardVideo}
                    inputProps={props}
                    frameToDisplay={shot.frame}
                    durationInFrames={storyboardFrames(storyboard)}
                    fps={storyboard.fps}
                    compositionWidth={storyboard.width}
                    compositionHeight={storyboard.height}
                    style={{ width }}
                  />
                  <figcaption className="font-mono text-[11px] text-neutral-400">{shot.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
