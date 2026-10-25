import type { Metadata, Viewport } from "next";
import { Feed } from "@/components/Feed";
import { loadFeedItems } from "@/lib/feed";
import "./feed.css";

export const metadata: Metadata = {
  title: "Watch: videos made by Meko",
  description: "Scroll through fact-checked explainer videos made by Meko, with the sources and the fact-check behind each one.",
};

// The feed is always dark (see Feed), so the browser's own bars and controls are too.
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

// The feed of videos made by Meko. What each shows under the video, and the text it is searched by, are read from the
// videos' files on the server.
export default async function Watch() {
  return <Feed items={await loadFeedItems()} />;
}
