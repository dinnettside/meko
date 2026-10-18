import type { Metadata } from "next";
import { cookies } from "next/headers";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [appSerif, appSans, appMono, display, body].map((font) => font.variable).join(" ");
  // The mode the reader picked with the switch, kept in a cookie so the page arrives in it and never flashes the other.
  // Without one, the system's mode stands (lib/theme.ts, appThemeCss).
  const picked = (await cookies()).get("meko-theme")?.value;
  const theme = picked === "light" || picked === "dark" ? picked : undefined;
  return (
    // The switch changes data-theme on <html> after the page has loaded.
    <html lang="en" data-theme={theme} className={`${fonts} ${themeFonts} h-full antialiased`} style={cssVariables} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: appThemeCss() }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
