import type { Look } from "./looks.ts";
import type { Scene } from "./storyboard.ts";

// What an opening may draw on: the question the video answers when the narration backs it, the years its opening
// narration spans, and whether the video has maps.
export type IntroContext = { question?: string; years?: [number, number]; places: boolean };

// More ways to open a video, drawn by the templates in remotion/filmmotor/templates/intros.js. An opening shows only
// the title scene's own words, and words and numbers its narration says word for word.
export function moreIntroLooks(scene: Extract<Scene, { kind: "title" }>, context: IntroContext): Look[] {
  void scene;
  void context;
  return [];
}
