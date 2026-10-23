import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContactSheet } from "./ContactSheet";

// A contact sheet of the feed's videos for checking them by eye and by script: a few frames of each opening, the middle
// of every scene and the credits, side by side. Only on a laptop: `next dev`, or `next start` with MEKO_FRAMES=1.
export default async function Frames() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.MEKO_FRAMES !== "1") notFound();
  return <ContactSheet />;
}
