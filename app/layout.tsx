import type { Metadata } from "next";
import { Archivo, Big_Shoulders, Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Newsreader, Work_Sans, Young_Serif } from "next/font/google";
import { appThemeCss, cssVariables } from "@/lib/theme";
import "./globals.css";

// The app: Newsreader for headings, Geist for everything else, Geist Mono for numbers (lib/theme.ts, APP_FONTS).
const appSerif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"] });
const appSans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const appMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The Night atlas look of the videos: Fraunces for headings and Archivo for everything else.
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
  title: "Meko: explainer videos you can check",
  description: "Turn a topic into a short, fact-checked, animated explainer video, with every claim checked against its sources.",
};

// Sets the light or dark mode the reader picked before the page is drawn, so it never flashes the other one. Storage can
// be blocked, and then the system's choice stands.
const THEME_SCRIPT = `try{var t=localStorage.getItem("meko-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [appSerif, appSans, appMono, display, body].map((font) => font.variable).join(" ");
  return (
    // The mode is set on <html> by the script before React runs, so the server's markup may differ there.
    <html lang="en" className={`${fonts} ${themeFonts} h-full antialiased`} style={cssVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: appThemeCss() }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
