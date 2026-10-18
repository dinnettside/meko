import type { ResearchFact } from "@/lib/pipeline";
import type { Storyboard } from "@/lib/storyboard";
import { NoteMarks, noteStyle } from "./cards";
import { useEase } from "./motion";
import { useTheme } from "./theme";

const MAX_SITES = 2;

const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// The sites behind each scene's facts, by scene ID, at most two each, so the video can show where it comes from.
export function sceneSites(storyboard: Storyboard, facts: Pick<ResearchFact, "id" | "sourceId">[]): Record<string, string[]> {
  const sourceOf = new Map(facts.map((fact) => [fact.id, fact.sourceId]));
  const urlOf = new Map(storyboard.sources.map((source) => [source.id, source.url]));
  return Object.fromEntries(
    storyboard.scenes.map((scene) => {
      const sites = scene.factIds.map((id) => siteOf(urlOf.get(sourceOf.get(id) ?? "") ?? "")).filter(Boolean);
      return [scene.id, [...new Set(sites)].slice(0, MAX_SITES)];
    }),
  );
}

// A small, calm note in the top right corner: where what the narration says comes from.
export function SourceChip({ sites }: { sites: string[] }) {
  const theme = useTheme();
  const { colors, fonts } = theme;
  const appear = useEase(0.8, 0.6);
  if (sites.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        right: 56,
        padding: "10px 20px",
        backgroundColor: colors.captionBackground,
        fontFamily: fonts.label,
        fontSize: 28,
        color: colors.dim,
        opacity: appear,
        ...noteStyle(theme),
      }}
    >
      {sites.length > 1 ? "Sources" : "Source"}: <span style={{ color: colors.captionText }}>{sites.join(" · ")}</span>
      <NoteMarks />
    </div>
  );
}
