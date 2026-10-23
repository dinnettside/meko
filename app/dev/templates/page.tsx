import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TemplateGallery } from "./TemplateGallery";

// Every film engine template drawn with its example, or with params from the address, for checking them by eye and by
// script. Only on a laptop: `next dev`, or `next start` with MEKO_FRAMES=1.
export default async function Templates() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.MEKO_FRAMES !== "1") notFound();
  return <TemplateGallery />;
}
