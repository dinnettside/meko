"use client";

import { useSyncExternalStore } from "react";

const COOKIE = "meko-theme";
const CHANGED = "meko-theme-change";
type Mode = "light" | "dark";

// The mode in use: the one the reader picked (data-theme on <html>, set before the page is drawn), or the system's.
function currentMode(): Mode {
  const picked = document.documentElement.dataset.theme;
  if (picked === "light" || picked === "dark") return picked;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The mode changes when the reader switches it here or the system switches it.
function subscribe(onChange: () => void) {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  system.addEventListener("change", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    system.removeEventListener("change", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

// Switches between the light and the dark mode and remembers the choice in a cookie for a year, so the server sends
// the next page in it (app/layout.tsx). On the server it does not know the mode, so it draws no icon until the page
// runs, and nothing jumps.
export function ThemeToggle() {
  const mode = useSyncExternalStore<Mode | null>(subscribe, currentMode, () => null);

  function toggle() {
    const next: Mode = currentMode() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(CHANGED));
  }

  const label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-fg transition-colors hover:bg-surface"
    >
      {mode === null ? null : mode === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}
