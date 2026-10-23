"use client";

import { Thumbnail } from "@remotion/player";
import { useSyncExternalStore } from "react";
import { AbsoluteFill } from "remotion";
import { THEMES, THEME_NAMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import { TPL } from "@/remotion/filmmotor/engine";
import type { TemplateParams } from "@/remotion/filmmotor/engine";
import "@/remotion/filmmotor/templates";
import { Ground } from "@/remotion/Ground";
import { TemplateScene } from "@/remotion/scenes/TemplateScene";
import { ThemeProvider } from "@/remotion/theme";

// ?names=a,b picks templates (all by default); ?params= is JSON params for every picked template instead of its
// example; ?theme= is night, blueprint or field (all three by default); ?at=0.3,0.95 are the moments shown, as
// fractions of the scene. Every frame is a [data-frame] box named "template|theme|moment".
// The query in the address, read in the browser only, so the server's page and the browser's first render match.
const noSubscribe = () => () => {};
const readSearch = () => window.location.search;
const FPS = 30;
const SECONDS = 8;

function TemplateVideo({ template, params, theme }: { template: string; params: TemplateParams; theme: ThemeName }) {
  const look = THEMES[theme];
  return (
    <ThemeProvider value={look}>
      <AbsoluteFill style={{ backgroundColor: look.colors.ink, color: look.colors.paper, fontFamily: look.fonts.body }}>
        <Ground />
        <TemplateScene template={template} params={params} words={[]} durationSec={SECONDS} />
      </AbsoluteFill>
    </ThemeProvider>
  );
}

export function TemplateGallery() {
  const query = new URLSearchParams(useSyncExternalStore(noSubscribe, readSearch, () => null) ?? "");
  const names = query.get("names")?.split(",").filter(Boolean) ?? Object.keys(TPL).sort();
  const themes = (query.get("theme")?.split(",") ?? [...THEME_NAMES]).filter((name): name is ThemeName => (THEME_NAMES as readonly string[]).includes(name));
  const moments = (query.get("at") ?? "0.95").split(",").map(Number);
  const given = query.get("params");
  const width = Number(query.get("w") ?? 320);
  return (
    <main data-ready="yes" className="flex flex-col gap-6 bg-black p-4 text-white">
      {names.map((name) => {
        const template = TPL[name];
        if (!template) return <p key={name}>No template called {name}</p>;
        const params = (given ? JSON.parse(given) : (template.example ?? {})) as TemplateParams;
        return (
          <section key={name} className="flex flex-col gap-2">
            <h2 className="font-mono text-sm">
              {name} · {template.title}
            </h2>
            <div className="flex flex-wrap gap-2">
              {themes.flatMap((theme) =>
                moments.map((moment) => (
                  <figure key={`${theme}${moment}`} data-frame={`${name}|${theme}|${moment}`} className="flex flex-col gap-1" style={{ width }}>
                    <Thumbnail
                      component={TemplateVideo}
                      inputProps={{ template: name, params, theme }}
                      frameToDisplay={Math.round(moment * (SECONDS - 0.8) * FPS)}
                      durationInFrames={SECONDS * FPS}
                      fps={FPS}
                      compositionWidth={1920}
                      compositionHeight={1080}
                      style={{ width }}
                    />
                    <figcaption className="font-mono text-[11px] text-neutral-400">
                      {theme} {moment}
                    </figcaption>
                  </figure>
                )),
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
