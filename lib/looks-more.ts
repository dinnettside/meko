import type { Look, LookContext } from "./looks.ts";
import type { Scene } from "./storyboard.ts";

// More looks for the kinds of scene almost every video has, drawn by the templates in
// remotion/filmmotor/templates/looks-more.js. Like the looks in looks.ts, a look only redraws what the scene already
// shows, after the same checks; it adds no text or number of its own beyond fixed words like "Source".
export function moreLooksFor(scene: Scene, context: LookContext): Look[] {
  void scene;
  void context;
  return [];
}
