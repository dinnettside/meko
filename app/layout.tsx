import type { Metadata } from "next";
import { Archivo, Big_Shoulders, Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Work_Sans, Young_Serif } from "next/font/google";
import { cssVariables } from "@/lib/theme";
import "./globals.css";

// Fraunces for headings and Archivo for everything else, in the app and in the videos.
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const body = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// The fonts of the other two video looks (lib/themes.ts). They load only when a video uses them.
// Blueprint: Big Shoulders for headings (its display cut at large sizes), IBM Plex Sans for text and Plex Mono for labels.
const blueprintDisplay = Big_Shoulders({ variable: "--font-big-shoulders", subsets: ["latin"], axes: ["opsz"], preload: false });
const blueprintBody = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], preload: false });
const blueprintLabel = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "600"], preload: false });
// Field guide: Young Serif for headings and Work Sans for everything else.
const fieldDisplay = Young_Serif({ variable: "--font-young-serif", subsets: ["latin"], weight: "400", preload: false });
const fieldBody = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"], preload: false });
const themeFonts = [blueprintDisplay, blueprintBody, blueprintLabel, fieldDisplay, fieldBody].map((font) => font.variable).join(" ");

export const metadata: Metadata = {
  title: "Meko",
  description: "Turn a topic into a short, fact-checked, animated explainer video.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${themeFonts} h-full antialiased`} style={cssVariables}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
