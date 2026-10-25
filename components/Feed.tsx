"use client";

import type { PlayerRef } from "@remotion/player";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FormEvent, RefObject, SyntheticEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { checkedLine } from "@/lib/example";
import type { FeedItem } from "@/lib/example";
import { viewerName } from "@/lib/names";
import { searchFeed, searchWords } from "@/lib/search";
import type { FeedComment, VideoSocial } from "@/lib/social";
import { APP_COLORS } from "@/lib/theme";
import { sceneSites } from "@/remotion/sites";
import { storyboardFrames } from "@/remotion/timing";
import { FactCheckReport } from "./FactCheckReport";
import { loadSavedVideo } from "./saved-video";
import type { SavedVideo } from "./saved-video";
import { sentenceSpans } from "./sentence-timing";

// The feed: videos made by Meko, one per screen like TikTok. The video on screen plays by itself, muted until the
// viewer turns sound on, and starts over when they scroll back to it. With likes and comments without an account, the
// fact-check behind each video, a search through all of them, and full screen. Where things sit, by the shape of the
// screen, is in app/watch/feed.css.

// The player and the whole video, with its scenes, drawings and maps, load only when a video is shown, so the page
// itself opens fast on a phone.
const StoryboardPlayer = dynamic(() => import("./StoryboardPlayer").then((module) => module.StoryboardPlayer), {
  ssr: false,
  loading: () => <div className="aspect-video w-full bg-black" />,
});

const VIEWER_KEY = "meko-viewer";
const COMMENT_CHARS = 280;
// How long a video that should play with sound may stand still before it plays on muted instead (see checkSound).
const SOUND_WAIT_MS = 1500;
// How many sound elements the feed's one player keeps (see `holder` in Feed). Remotion gives each sound playing at a
// moment one of its own, five unless told otherwise, and when the player changes videos in the middle of a scene, the
// new video's sounds take theirs before the old one's give theirs back. In today's videos that can reach all five, and
// one more is an error that stops the player. The tap on "Tap for sound" unlocks them all at once.
const SHARED_AUDIO_TAGS = 8;
// How far the arrow keys to the sides move the video on screen, in seconds.
const SEEK_STEP = 5;
// How long the large play or pause icon shows after a tap, and how long full screen waits, with nobody touching the
// screen, before its buttons fade where they would cover the picture.
const FLASH_MS = 700;
const IDLE_MS = 2500;
// How soon a second tap on the video must follow the first to like it, as on TikTok.
const DOUBLE_TAP_MS = 300;
// The header's height with and without the line that counts a search's matches, which the video stays under.
const HEAD = "64px";
const HEAD_WITH_COUNT = "112px";

// The feed is always dark, like a cinema, whatever mode the rest of the site is in, so the app's dark colors are set on
// it.
const DARK = {
  colorScheme: "dark",
  ...Object.fromEntries(Object.entries(APP_COLORS.dark).map(([name, value]) => [`--${name}`, value])),
} as CSSProperties;

// This browser's random viewer ID, made once and kept, so a viewer's likes and comments stay theirs. Storage can be
// blocked; then the ID lasts until the page reloads.
let viewerCache: string | null = null;
function readViewer(): string {
  if (viewerCache) return viewerCache;
  try {
    viewerCache = localStorage.getItem(VIEWER_KEY);
    if (!viewerCache) {
      viewerCache = crypto.randomUUID();
      localStorage.setItem(VIEWER_KEY, viewerCache);
    }
  } catch {
    viewerCache ??= crypto.randomUUID();
  }
  return viewerCache;
}
const noSubscribe = () => () => {};

// The search in the address, as /watch?q=volcano, so a search can be linked to and survives a reload. It is read in
// the browser only, since the page itself is the same for every search.
const readLinkedQuery = () => new URLSearchParams(window.location.search).get("q") ?? "";

// Whether the viewer asked their system for less motion. Then no video starts or moves on by itself.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

// Whether the screen is wide enough for the panels to open beside the feed rather than over it (Tailwind's sm).
const WIDE = "(min-width: 640px)";
function subscribeWide(onChange: () => void) {
  const media = window.matchMedia(WIDE);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const readWide = () => window.matchMedia(WIDE).matches;

// Whether full screen leaves black beside or above the video, wide enough for its buttons, so they never cover it.
function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
function readRoomy(): boolean {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return Math.max(width - Math.min(width, (height * 16) / 9), height - Math.min(height, (width * 9) / 16)) / 2 >= 60;
}

// Full screen as Safari names it, before the standard names reached it on iPads and Macs. Safari on an iPhone has
// neither for anything but a <video> element.
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
const fullscreenElement = () => document.fullscreenElement ?? (document as FullscreenDocument).webkitFullscreenElement ?? null;

// Keys that do not count as the viewer's first key press, since they move the focus or do nothing on their own.
const QUIET_KEYS = ["Tab", "Escape", "Shift", "Control", "Alt", "Meta", "CapsLock"];
// The keys that move the progress bar's slider (see the keys in Feed).
const SLIDER_KEYS = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "PageUp", "PageDown", "Home", "End"];
// Whether a phone's or a tablet's keyboard is up, which leaves less of the screen to the page than the page has. Not
// a hardware keyboard, nor a phone's keyboard hidden with the back gesture while the box keeps the focus. A browser
// without visualViewport is taken to have it up.
function keyboardUp(): boolean {
  const view = window.visualViewport;
  return !view || view.height * view.scale < document.documentElement.clientHeight * 0.85;
}

// A comment being written, for each video, so it is still there when its panel opens again, as after a tap on the
// video above the panel on a phone, which closes it. Kept until the page reloads.
const drafts = new Map<string, string>();

// Whether the player is playing and muted, as its events last said.
type Playback = { playing: boolean; muted: boolean };
const NOT_PLAYING: Playback = { playing: false, muted: true };

// The large icon a tap shows for a moment in the middle of the video: play, pause, or the heart of a double tap.
type FlashIcon = "play" | "pause" | "like";

const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error ?? `The server answered with HTTP ${response.status}.`);
  return json as T;
}

export function Feed({ items }: { items: FeedItem[] }) {
  const viewer = useSyncExternalStore(noSubscribe, readViewer, () => null);
  // False in the first render, which must match the server's, and true from then on in the browser.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const linkedQuery = useSyncExternalStore(noSubscribe, readLinkedQuery, () => "");
  // What the viewer typed in the search box; null until they type, while the search comes from the address.
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? linkedQuery;
  // On a phone the header shows a search button, which opens the box over the header. The box stays open while it
  // holds a search.
  const [searchOpen, setSearchOpen] = useState(false);
  const searching = searchOpen || query !== "";
  // A search needs a word: "?" alone searches for nothing and shows every video.
  const search = searchWords(query).length > 0 ? query.trim() : "";
  const visible = useMemo(() => searchFeed(items, search), [items, search]);
  const countShown = search !== "" && visible.length > 0;
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);
  // The video most in view, as the feed last saw it; null until it has looked, and again after a new search.
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const active = Math.max(0, visible.findIndex((item) => item.slug === activeSlug));
  // The video on screen, the only one that plays: the first one until the feed has looked.
  const current = visible[active]?.slug ?? null;
  const [videos, setVideos] = useState<Record<string, SavedVideo>>({});
  // The video the feed's one player shows (see `holder` below): the one on screen once its data has loaded, and until
  // then the one it showed before, since the player needs a video to stay drawn.
  const [shown, setShown] = useState<string | null>(null);
  if (current && videos[current] && shown !== current) setShown(current);
  // The video on screen once the player shows it. Null while its data loads; the player then hides behind its still.
  const live = current !== null && current === shown ? current : null;
  const shownVideo = shown ? videos[shown] : undefined;
  // The player is made anew only when its video failed (see FeedPlayer), since Remotion then shows an error in place of
  // the video until the player is made again, and with one player for the feed that stopped every video after. It is
  // made again at once, and should the same video fail again, once the viewer moves on to another. A new player has
  // sound elements no tap has unlocked, so on an iPhone "Tap for sound" comes back (see onPlayer).
  const [failed, setFailed] = useState<SavedVideo | null>(null);
  const [retried, setRetried] = useState<SavedVideo | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  if (failed && (failed !== retried || failed !== shownVideo)) {
    setRetried(failed === shownVideo ? failed : null);
    setFailed(null);
    setPlayerKey(playerKey + 1);
  }
  const [social, setSocial] = useState<Record<string, VideoSocial>>({});
  // The open panel. Its video is the one on screen, whose player the fact-check follows.
  const [sheet, setSheet] = useState<{ slug: string; kind: "comments" | "factcheck" } | null>(null);
  // The panel closes once the feed moves on from its video, as it can with a wheel or a search beside the panel on a
  // wide screen: it would go on showing the video before, its sentences could not play a video no longer in the
  // player, and the new video would wait under it unstarted. The video on screen is compared with the one the feed saw
  // last, so a panel opened while the feed scrolled on at the end of a video, and went back to it, stays open.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    if (sheet && sheet.slug === seen) setSheet(null);
  }
  // The line under the header that counts a search's matches. Not while a panel is open on a phone, which covers it
  // anyway: the video then moves up under the header alone, which leaves the panel more of the screen.
  const countInHeader = countShown && !(sheet && !wide);
  // Browsers only let a page play sound after a tap or a key press, so videos start muted. Once the viewer turns sound
  // on, it stays on for every video after.
  const [soundOn, setSoundOn] = useState(false);
  // The player once it has loaded, and what it last said it does, shown on the section on screen as data-playing and
  // data-muted for tests.
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [playback, setPlayback] = useState<Playback>(NOT_PLAYING);
  // The video that ended and that the feed scrolls on from (see onEnded), until the player plays again, so it shows no
  // paused icon on its way out.
  const [endedSlug, setEndedSlug] = useState<string | null>(null);
  // The video on screen once the viewer has played it. Until then, viewers who asked for less motion see its poster.
  // It is forgotten as soon as another video is on screen, so one they scroll back to shows its poster again.
  const [played, setPlayed] = useState<string | null>(null);
  if (played !== null && played !== live) setPlayed(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  // Full screen: the video on screen as large as it fits, on black, in the stage (see Stage). The browser's own full
  // screen holds the stage where there is one, on a computer, an Android phone or an iPad ("api"). Safari on an iPhone
  // shows only a <video> element full screen, and the feed draws its videos in the page, so there the stage is a layer
  // over the whole page ("overlay"), which fills the screen once the phone is turned on its side. The one player moves
  // into the stage and back as it moves between sections, so it plays on with its sound, and the videos after it, as
  // the feed moves on by itself or by the arrow keys, play there too.
  const [full, setFull] = useState<"api" | "overlay" | null>(null);
  // Whether nobody has touched the screen for a moment in full screen (see Stage).
  const [idle, setIdle] = useState(false);
  const roomy = useSyncExternalStore(subscribeResize, readRoomy, () => true);
  // The large play or pause icon a tap shows for a moment in the middle of the video.
  const [flash, setFlash] = useState<{ icon: FlashIcon; at: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scroller = useRef<HTMLElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  // Each section's video box, where the player goes while that video is on screen, the dock where it waits while no
  // video is shown, and the stage and its box for full screen.
  const boxes = useRef(new Map<string, HTMLElement>());
  const dock = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const stageBox = useRef<HTMLDivElement>(null);
  // The feed has one player for all its videos. It is made once and, unless a video fails (see `failed` above), never
  // made again: it takes each video's props as that video comes on screen. Safari on an iPhone lets a page start sound
  // only inside a tap, for each sound element on its own. A player keeps one set of sound elements for its whole life
  // (Remotion's shared audio tags), and the tap on "Tap for sound" unlocks them, so every video after plays through
  // them with sound, also one the feed moves on to by itself at the end of the last. With a player for each video,
  // every new one had sound elements no tap had unlocked, and the viewer had to tap again. The player is drawn through
  // a portal into this element of its own, which moves into the video box of the section on screen (see below): a
  // moved element is not drawn again, so the player, its sound elements and its AudioContext live on. It exists in the
  // browser only.
  const [holder] = useState(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    element.className = "h-full w-full";
    return element;
  });
  // Copies of the videos shown, the sound, whether videos start by themselves, the open panel and full screen, for the
  // player's listeners, which outlive a render. They are brought up to date after every render, just below, before the
  // video on screen is started (see startVideo), so a panel that closed in the same render as the feed moved on does
  // not keep the new video from starting.
  const visibleRef = useRef(visible);
  const soundRef = useRef(false);
  const autoplayRef = useRef(true);
  const sheetRef = useRef(sheet);
  const fullRef = useRef(full);
  // Whether the viewer has turned sound on or off themselves. Until then, their first tap on a video turns sound on
  // instead of pausing it, and their first key press turns it on too.
  const soundChosen = useRef(false);
  // The video on screen the player was last started for, so each video starts once as it comes on screen, and one the
  // viewer paused stays paused. Null while the video on screen still loads. The player's listeners read it as the video
  // the player plays.
  const playerSlug = useRef<string | null>(null);
  // The player the feed has, as soon as it is handed up or back (see onPlayer), which `player` says only from the next
  // render on (see startVideo).
  const playerNow = useRef<PlayerRef | null>(null);
  // The video that ended and that the feed scrolls on from (see onEnded), until the player plays again or is started for
  // another video.
  const movingOn = useRef<string | null>(null);
  // Whether the video on screen was paused because the tab was hidden, so it plays on when the tab is back.
  const pausedByHiding = useRef(false);
  const soundTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Whether the player waits for its pictures or sound to load.
  const buffering = useRef(false);
  // Whether the feed plays the player for a moment only to unlock its sound (see turnOnSound), which its listeners
  // then take no notice of.
  const unlocking = useRef(false);
  // How to take the player's listeners off again.
  const unlisten = useRef<() => void>(undefined);

  useLayoutEffect(() => {
    visibleRef.current = visible;
    soundRef.current = soundOn;
    autoplayRef.current = !reducedMotion;
    sheetRef.current = sheet;
    fullRef.current = full;
  });

  // Likes and comments for every video, once the viewer is known.
  useEffect(() => {
    if (!viewer) return;
    void postJson<{ social: Record<string, VideoSocial> }>("/api/social", { slugs: items.map((item) => item.slug), viewer })
      .then((result) => setSocial(result.social))
      .catch(() => {});
  }, [viewer, items]);

  // The video on screen becomes the active one: the one most in view.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const slug = best?.target.getAttribute("data-slug");
        if (slug) setActiveSlug(slug);
      },
      { root, threshold: [0.6, 0.9] },
    );
    sections.current.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [visible]);

  // The active video and its neighbours are loaded, so the player has the next video at once.
  const nearby = useMemo(() => visible.slice(Math.max(0, active - 1), active + 2).map((item) => item.slug), [visible, active]);
  useEffect(() => {
    for (const slug of nearby) {
      if (videos[slug]) continue;
      void loadSavedVideo(slug)
        .then((video) => setVideos((current) => ({ ...current, [slug]: video })))
        .catch(() => {});
    }
  }, [nearby, videos]);

  // The player is handed up once it has loaded, and handed back (null) should it ever go. Its listeners keep what it
  // does in `playback`, for the sound button and for tests, and come off with it.
  const onPlayer = useCallback((handle: PlayerRef | null) => {
    unlisten.current?.();
    unlisten.current = undefined;
    clearTimeout(soundTimer.current);
    buffering.current = false;
    playerSlug.current = null;
    playerNow.current = handle;
    setPlayer(handle);
    if (!handle) {
      setPlayback(NOT_PLAYING);
      return;
    }
    const update = (change: Partial<Playback>) => setPlayback((before) => ({ ...before, ...change }));
    update({ playing: handle.isPlaying(), muted: handle.isMuted() });
    // The browser refused the sound: the video plays on muted, and the "Tap for sound" button comes back, so the viewer's
    // next tap can unlock it.
    const refused = () => {
      soundRef.current = false;
      soundChosen.current = false;
      setSoundOn(false);
    };
    // Some browsers refuse sound that no tap started, like Safari on an iPhone before the viewer's first tap. Remotion
    // then waits for the sound and the video stands still. So a video that plays with sound but has not moved on after
    // a moment plays on muted, and the "Tap for sound" button comes back: a video never hangs. One still loading gets
    // longer.
    const checkSound = (tries = 0) => {
      clearTimeout(soundTimer.current);
      const slug = playerSlug.current;
      const from = handle.getCurrentFrame();
      soundTimer.current = setTimeout(() => {
        if (playerSlug.current !== slug || !handle.isPlaying() || handle.isMuted()) return;
        if (buffering.current && tries < 4) return checkSound(tries + 1);
        if (handle.getCurrentFrame() !== from) return;
        handle.mute();
        refused();
      }, SOUND_WAIT_MS);
    };
    const onPlay = () => {
      if (unlocking.current) return;
      movingOn.current = null;
      setEndedSlug(null);
      update({ playing: true });
      setPlayed(playerSlug.current);
      if (!handle.isMuted()) checkSound();
    };
    const onPause = () => {
      if (!unlocking.current) update({ playing: false });
    };
    // Remotion mutes the player itself when the browser refuses to start its sound, as Safari on an iPhone can for a
    // video no tap started. The feed mutes a video it plays only once its own sound is off, so a mute while it is on
    // is that refusal, and the button then never shows sound on over a muted video.
    const onMuteChange = ({ detail }: { detail: { isMuted: boolean } }) => {
      if (unlocking.current) return;
      update({ muted: detail.isMuted });
      if (detail.isMuted && soundRef.current && playerSlug.current) refused();
      else if (!detail.isMuted && handle.isPlaying()) checkSound();
    };
    const onWaiting = () => {
      buffering.current = true;
    };
    const onResume = () => {
      buffering.current = false;
    };
    // At the end, the next video comes up, like turning a page, also in full screen. Not for viewers who asked for less
    // motion, and not under an open panel, where the next video would start unseen and the fact-check would lose the
    // video it follows.
    const onEnded = () => {
      if (!autoplayRef.current || sheetRef.current) return;
      const list = visibleRef.current;
      const slug = playerSlug.current;
      const index = list.findIndex((item) => item.slug === slug);
      if (index < 0) return;
      // The last video plays again, as TikTok's do, rather than stop on its blank first frame with nothing after it.
      // Remotion pauses it as it says it ended, and a play before that pause has been drawn is lost, so it plays a
      // moment later, with no paused icon meanwhile.
      if (index === list.length - 1) {
        setEndedSlug(slug);
        setTimeout(() => {
          if (playerSlug.current === slug && !handle.isPlaying() && autoplayRef.current && !sheetRef.current) handle.play();
          else setEndedSlug(null);
        }, 100);
        return;
      }
      movingOn.current = playerSlug.current;
      setEndedSlug(playerSlug.current);
      sections.current.get(list[index + 1].slug)?.scrollIntoView({ behavior: "smooth" });
    };
    handle.addEventListener("play", onPlay);
    handle.addEventListener("pause", onPause);
    handle.addEventListener("mutechange", onMuteChange);
    handle.addEventListener("waiting", onWaiting);
    handle.addEventListener("resume", onResume);
    handle.addEventListener("ended", onEnded);
    unlisten.current = () => {
      handle.removeEventListener("play", onPlay);
      handle.removeEventListener("pause", onPause);
      handle.removeEventListener("mutechange", onMuteChange);
      handle.removeEventListener("waiting", onWaiting);
      handle.removeEventListener("resume", onResume);
      handle.removeEventListener("ended", onEnded);
    };
  }, []);

  // Only the video on screen plays, and always from its start: the player goes back to the start whenever it is started
  // for another video, so a video the viewer scrolls back to starts over, like TikTok. The video on screen starts by
  // itself, with sound if the viewer turned it on, unless they asked for less motion or a panel is open, under which
  // it waits at its start as one that ends there does (see onEnded); in a hidden tab it waits until the tab is shown.
  // Null only stops the player, while the video on screen still loads. Only the player the feed still has is started:
  // when the viewer moves on from a video that failed twice, the player is made again in the same render as the feed
  // moves on, and this first runs with the player before, which is gone, so taking the video as started then kept the
  // new player from starting it, and the next video stood still.
  const startVideo = useCallback(
    (slug: string | null) => {
      if (!player || player !== playerNow.current || playerSlug.current === slug) return;
      playerSlug.current = slug;
      movingOn.current = null;
      if (player.isPlaying()) player.pause();
      if (player.getCurrentFrame() !== 0) player.seekTo(0);
      if (!slug) return;
      if (soundRef.current) player.unmute();
      else player.mute();
      if (!autoplayRef.current || sheetRef.current) return;
      if (document.visibilityState === "hidden") pausedByHiding.current = true;
      else player.play();
    },
    [player],
  );

  // The player moves into the video box of the section on screen, or into the stage in full screen. Both this and the
  // start below happen before the browser paints, so a box is never seen empty, and a video never shows a frame from
  // where the one before it was. A search with no match leaves no box, and the player then waits in the dock, which
  // keeps it in the page at the same size: out of the page it measured nothing, and once back Remotion took two frames
  // to scale the video down to its box again, showing it huge. A moved element loses the focus, and while the next
  // video loads, its controls hide and the Pause button goes, so a keyboard on the progress bar or the Pause button
  // (holderFocus) gets it back there as the feed moves on, and again once that video is shown. That is forgotten once
  // the focus moves on to something else, or a finger or mouse presses anywhere but on the progress bar.
  const holderFocus = useRef<"slider" | "button" | null>(null);
  useLayoutEffect(() => {
    const box = (full ? stageBox.current : current ? boxes.current.get(current) : undefined) ?? dock.current;
    if (!holder || !box) return;
    if (holder.parentElement !== box) box.appendChild(holder);
    const now = document.activeElement;
    if (holderFocus.current && (!now || now === document.body)) holder.querySelector<HTMLElement>(holderFocus.current === "slider" ? "[role=slider]" : "button")?.focus({ preventScroll: true });
  }, [current, holder, full, live]);
  useLayoutEffect(() => startVideo(live), [live, startVideo]);

  // Sound on, for the video on screen and every one after it. The tap or key press passes its event, since Safari on an
  // iPhone lets sound start only inside it, for each sound element on its own: the player is unmuted at once rather
  // than on the next render, so its sound exists within the tap, and the video is played again, as Remotion unlocks
  // all its sound elements only in play(event), which only checks that it got an event, so a key press's will do.
  // Played again, the player also asks anew to start its AudioContext, which Chrome left waiting when the video started
  // muted before the browser allowed sound, so the video stood still once unmuted. That one tap unlocks the sound of
  // every video after, since they all play in the same player. Before the player has loaded there is nothing to unlock
  // yet: an iPhone then refuses the first video's sound, and the button comes back (see onPlayer).
  const turnOnSound = useCallback(
    (event: SyntheticEvent | KeyboardEvent) => {
      soundChosen.current = true;
      soundRef.current = true;
      setSoundOn(true);
      if (!player) return;
      const gesture = event as SyntheticEvent;
      // While the video on screen still loads, the player holds the one before, which must not be heard, and a key on
      // a paused video only turns sound on. Nor is a video that ended played again while the feed scrolls on from it:
      // Remotion plays an ended video from its start. The player is played muted for a moment all the same, since that
      // unlocks its sound within the tap or key press, and then paused again. The video on screen starts with sound
      // once it loads (see startVideo), or once the viewer plays it.
      if (!playerSlug.current || playerSlug.current === movingOn.current || (event instanceof KeyboardEvent && !player.isPlaying())) {
        unlocking.current = true;
        flushSync(() => player.mute());
        player.play(gesture);
        player.pause();
        unlocking.current = false;
        if (playerSlug.current) player.unmute();
        return;
      }
      flushSync(() => player.unmute());
      if (player.isPlaying()) player.pause();
      player.play(gesture);
    },
    [player],
  );

  const turnOffSound = useCallback(() => {
    soundChosen.current = true;
    soundRef.current = false;
    setSoundOn(false);
    player?.mute();
  }, [player]);

  const toggleSound = useCallback(
    (event: SyntheticEvent | KeyboardEvent) => (soundRef.current ? turnOffSound() : turnOnSound(event)),
    [turnOffSound, turnOnSound],
  );

  // A tap or the space bar plays or pauses the video on screen, and the large icon in its middle says which, for a
  // moment.
  const showFlash = useCallback((icon: FlashIcon) => {
    clearTimeout(flashTimer.current);
    setFlash({ icon, at: Date.now() });
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);
  const togglePlay = useCallback(
    (event?: SyntheticEvent, shown?: "like") => {
      if (!player) return;
      const icon = shown ?? (player.isPlaying() ? "pause" : "play");
      player.toggle(event);
      showFlash(icon);
    },
    [player, showFlash],
  );

  // Into full screen, from a tap, a click or the f key, since a browser enters its full screen only inside one. The
  // stage is drawn and holds the player before the browser is asked, and stays as the layer over the page should the
  // browser say no. On an Android phone the screen also turns on its side, as the video is wider than it is tall. A
  // panel open beside the feed on a wide screen closes first: full screen hides it, and while it is open the f key,
  // the arrow keys and the move to the next video all leave the feed alone, and Escape would close it along with full
  // screen. A viewer who came from the keyboard gets the focus back on the button they pressed when it closes.
  const fullOpener = useRef<HTMLElement | null>(null);
  const enterFull = useCallback(() => {
    const element = stage.current as FullscreenElement | null;
    if (!element || fullRef.current) return;
    const request =
      typeof element.requestFullscreen === "function"
        ? () => element.requestFullscreen({ navigationUI: "hide" })
        : typeof element.webkitRequestFullscreen === "function"
          ? () => Promise.resolve(element.webkitRequestFullscreen?.())
          : null;
    fullOpener.current = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible") ? document.activeElement : null;
    setIdle(false);
    sheetRef.current = null;
    flushSync(() => {
      setSheet(null);
      setFull(request ? "api" : "overlay");
    });
    fullRef.current = request ? "api" : "overlay";
    element.focus({ preventScroll: true });
    if (!request) return;
    request()
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }).lock?.("landscape"))
      .catch(() => {
        if (fullRef.current === "api" && !fullscreenElement()) setFull("overlay");
      });
  }, []);

  // A keyboard's focus in the stage as full screen closes is kept for the page too (see the effect below), since the
  // stage is hidden then, and while the browser leaves its own full screen the page takes no focus: on the progress
  // bar or the Pause button, which move back with the player, or, from the stage's own buttons, on the button that
  // opened full screen, or else the video's Full screen button.
  const keepFullFocus = useCallback(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || focused === stage.current || !stage.current?.contains(focused) || !focused.matches(":focus-visible")) return;
    fullOpener.current = holder?.contains(focused) ? focused : (fullOpener.current ?? document.querySelector<HTMLElement>('.feed-rail [aria-label="Full screen"]'));
  }, [holder]);

  const exitFull = useCallback(() => {
    const doc = document as FullscreenDocument;
    keepFullFocus();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
    fullRef.current = null;
    setFull(null);
  }, [keepFullFocus]);

  // The browser leaves its full screen by itself too, as with Escape, and the stage then goes with it.
  useEffect(() => {
    const onChange = () => {
      if (fullscreenElement()) return;
      try {
        screen.orientation?.unlock?.();
      } catch {}
      if (fullRef.current === "api") {
        keepFullFocus();
        fullRef.current = null;
        setFull(null);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [keepFullFocus]);

  // However full screen was left, the button that opened it from the keyboard gets the focus back (or what kept it, see
  // keepFullFocus), once the feed takes the focus again; the stage it had is hidden by then, which left the focus
  // nowhere. While the browser is still leaving its own full screen, as after the Escape key here, everything outside
  // the stage stays inert and takes no focus, so it waits for that. Should the feed have moved on in full screen, the
  // same button of the video now on screen gets it, so the focus stays where the viewer is.
  useEffect(() => {
    const opener = fullOpener.current;
    if (full || !opener) return;
    const restore = () => {
      if (fullscreenElement() || fullOpener.current !== opener) return;
      fullOpener.current = null;
      const label = opener.getAttribute("aria-label");
      const section = current ? sections.current.get(current) : undefined;
      const same = section && label && !section.contains(opener) ? section.querySelector<HTMLElement>(`.feed-rail [aria-label="${CSS.escape(label)}"]`) : null;
      (same ?? opener).focus({ preventScroll: true });
    };
    restore();
    document.addEventListener("fullscreenchange", restore);
    document.addEventListener("webkitfullscreenchange", restore);
    return () => {
      document.removeEventListener("fullscreenchange", restore);
      document.removeEventListener("webkitfullscreenchange", restore);
    };
  }, [full, current]);

  // In full screen, a moment with no touch, click, mouse move or key makes the stage idle (see Stage).
  useEffect(() => {
    if (!full) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    timer = setTimeout(() => setIdle(true), IDLE_MS);
    // Heard before anything on the page, which could stop the event on its way up.
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((type) => window.addEventListener(type, wake, true));
    return () => {
      clearTimeout(timer);
      events.forEach((type) => window.removeEventListener(type, wake, true));
    };
  }, [full]);

  // A link with #slug opens at that video, which then becomes the active one as it comes into view. It is read once the
  // page runs in the browser, when the search from the address is applied too. This effect must stay above the next
  // one, which writes the active video into the address: effects run in order, so the link is read before it is
  // replaced.
  useEffect(() => {
    if (!hydrated) return;
    // A broken link like /watch#50% cannot be decoded and names no video, since slugs are plain ASCII, so the feed
    // opens at its start rather than failing.
    let wanted = "";
    try {
      wanted = decodeURIComponent(window.location.hash.slice(1));
    } catch {}
    if (wanted && sections.current.has(wanted)) sections.current.get(wanted)?.scrollIntoView();
  }, [hydrated]);

  // The address follows the video on screen once the feed has seen which one that is, so a link's #slug is not replaced
  // by the first video's before the feed has scrolled to it.
  useEffect(() => {
    if (!hydrated) return;
    if (activeSlug && current && window.location.hash !== `#${current}`) window.history.replaceState(null, "", `#${current}`);
  }, [activeSlug, current, hydrated]);

  // The search follows into the address as the viewer types, so the page can be linked to or reloaded as it is.
  useEffect(() => {
    if (typed === null) return;
    const url = new URL(window.location.href);
    if (searchWords(typed).length > 0) url.searchParams.set("q", typed.trim());
    else url.searchParams.delete("q");
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [typed]);

  // A hidden tab pauses the video on screen, and it plays on when the tab is shown again.
  useEffect(() => {
    if (!player) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (player.isPlaying()) pausedByHiding.current = true;
        player.pause();
      } else if (pausedByHiding.current) {
        pausedByHiding.current = false;
        if (playerSlug.current) player.play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [player]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const item = visible[Math.min(visible.length - 1, Math.max(0, index))];
      if (item) sections.current.get(item.slug)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    },
    [visible, reducedMotion],
  );

  // The keyboard's focus follows the feed. Left on a button of a video the feed moved on from, as after j or an arrow
  // key, the next Tab or Enter would scroll back to that video and start it over, so the same button of the video now
  // on screen takes the focus instead.
  useEffect(() => {
    const focused = document.activeElement;
    const section = current ? sections.current.get(current) : undefined;
    const rail = focused instanceof HTMLButtonElement ? focused.closest(".feed-rail") : null;
    if (!section || !rail || section.contains(rail)) return;
    const index = [...rail.querySelectorAll("button")].indexOf(focused as HTMLButtonElement);
    section.querySelectorAll<HTMLElement>(".feed-rail button")[index]?.focus({ preventScroll: true });
  }, [current]);

  // On a phone the search box opens over the header from its button, and takes the focus inside the tap, as Safari
  // on an iPhone shows its keyboard only then. On a touch screen held sideways the header is hidden, and shows only
  // while the box has the focus (inBox), as after the / key on a tablet's keyboard, so it is shown before the box
  // takes the focus, which a hidden box cannot.
  const [inBox, setInBox] = useState(false);
  const openSearch = useCallback(() => {
    flushSync(() => {
      setSearchOpen(true);
      setInBox(true);
    });
    searchBox.current?.focus();
    if (document.activeElement !== searchBox.current) setInBox(false);
  }, []);

  // Whether the last press anywhere in the feed was in the panel (see the feed's onPointerDownCapture).
  const pressedInSheet = useRef(false);

  // Arrow keys and j/k move between videos, the space bar plays or pauses the one on screen, the arrows to the sides
  // move it back or on, m turns sound on or off, f goes in and out of full screen and / goes to the search box, unless
  // the viewer is typing. A button, a link or the fact-check keeps the space bar for itself, and an open panel keeps
  // the arrow keys, which scroll it while the feed behind stays where it is, as do the space bar after a click in it
  // and, from a control in the feed, Page Up and Down, Home and End. The progress bar, once the keyboard has reached
  // it, is a slider (see Progress): all four arrows move it, Page Up and Down three times as far, also beside an open
  // panel, and Home and End go to the start and the end; after a click on it, up and down still move between videos.
  // Until the player is ready, those keys and the space bar do nothing there, rather than scroll the feed on. The
  // viewer's first key press also turns sound on, like a first tap, except Enter or the space bar on a button or link:
  // that presses the control, like a tap on it, and the sound button then turns sound on by itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape" && full) {
        exitFull();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        if (!full) openSearch();
        return;
      }
      if (event.key === "m" || event.key === "M") {
        toggleSound(event);
        return;
      }
      const pressesControl = (event.key === "Enter" || event.key === " ") && Boolean(target?.closest?.("button, a, summary, select, [role=button]"));
      if (!soundChosen.current && !QUIET_KEYS.includes(event.key) && !pressesControl) turnOnSound(event);
      const slider = target?.getAttribute?.("role") === "slider" && target.matches(":focus-visible");
      if (slider && (SLIDER_KEYS.includes(event.key) || event.key === " ") && !(player && live && shownVideo)) {
        event.preventDefault();
        return;
      }
      if (slider && player && live && shownVideo && SLIDER_KEYS.includes(event.key)) {
        event.preventDefault();
        const frames = storyboardFrames(shownVideo.storyboard);
        const forward = event.key === "ArrowUp" || event.key === "ArrowRight" || event.key === "PageUp";
        const step = SEEK_STEP * shownVideo.storyboard.fps * (event.key.startsWith("Page") ? 3 : 1) * (forward ? 1 : -1);
        const to = Math.min(frames - 2, Math.max(0, event.key === "Home" ? 0 : event.key === "End" ? frames : player.getCurrentFrame() + step));
        // Beside a panel a video that ends goes back to its start and waits there (see onEnded), so one sent to its end
        // waits at the end instead, paused.
        if (sheet && to >= frames - 2) player.pause();
        player.seekTo(to);
        return;
      }
      if ((event.key === "f" || event.key === "F") && !sheet) {
        if (full) exitFull();
        else enterFull();
        return;
      }
      if (sheet && ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "j", "k", "PageDown", "PageUp", "Home", "End"].includes(event.key)) {
        // The browser scrolls what has the focus or was last clicked. The panel takes the focus when it opens (see
        // Sheet), but should a control in the feed get it back, the browser would scroll the feed.
        if (target?.closest?.("main")) event.preventDefault();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        scrollToIndex(active + 1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        scrollToIndex(active - 1);
      } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && player && live && shownVideo) {
        event.preventDefault();
        const step = SEEK_STEP * shownVideo.storyboard.fps * (event.key === "ArrowLeft" ? -1 : 1);
        player.seekTo(Math.min(storyboardFrames(shownVideo.storyboard) - 2, Math.max(0, player.getCurrentFrame() + step)));
      } else if (
        event.key === " " &&
        player &&
        live &&
        !target?.closest?.("button, a, summary, select, [role=button], .feed-sheet") &&
        // After a click on the text of the panel the focus is on the page, and the browser scrolls the panel.
        !(sheet && pressedInSheet.current && target === document.body)
      ) {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, enterFull, exitFull, full, live, openSearch, player, sheet, scrollToIndex, shownVideo, toggleSound, togglePlay, turnOnSound]);

  // A tap on the video: the viewer's first one turns sound on instead of pausing it, as on TikTok, and later ones play or
  // pause it. A second one soon after likes the video, as on TikTok, and plays or pauses it back, so it plays on as
  // before; after a first tap that only turned sound on, it only likes, so the video plays on with its sound. It is
  // taken as a click, which a swipe never makes, since the player's own click-to-play reacts as soon as a finger lands,
  // so a short swipe on the video paused it. The progress bar along the bottom of the video keeps its taps to itself
  // (see Progress). A finger that taps while the phone's keyboard is up, as for the search, only puts it away; a tap
  // while a text box has the focus with no keyboard up, as with a tablet's hardware keyboard, also leaves the box.
  const lastToggle = useRef(-Infinity);
  // Whether the last tap on the video only turned sound on.
  const soundTap = useRef(false);
  // What pressed last anywhere in the feed, a finger or a mouse, and whether a finger pressed while a text box had the
  // focus with the phone's keyboard up (see the feed's onPointerDownCapture).
  const lastPointer = useRef("mouse");
  const leavingBox = useRef(false);
  function tapVideo(event: React.MouseEvent) {
    if (!player || !live) return;
    const focused = document.activeElement;
    if (leavingBox.current || focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) (focused as HTMLElement | null)?.blur();
    if (leavingBox.current) return;
    if (!soundChosen.current) {
      turnOnSound(event);
      lastToggle.current = event.timeStamp;
      soundTap.current = true;
      return;
    }
    const double = event.timeStamp - lastToggle.current < DOUBLE_TAP_MS;
    lastToggle.current = double ? -Infinity : event.timeStamp;
    if (double && soundTap.current) showFlash("like");
    else togglePlay(event, double ? "like" : undefined);
    soundTap.current = false;
    if (double && !social[live]?.liked) void toggleLike(live);
  }

  // The sound button in the rail and in full screen. The second tap of an impatient double tap on "Tap for sound" is let
  // go: it would turn sound off again, or, landing where the pill was before it shrank to the speaker, pause the video
  // (see tapAround).
  const soundPressed = useRef(-Infinity);
  function pressSound(event: React.MouseEvent) {
    if (event.timeStamp - soundPressed.current < DOUBLE_TAP_MS) return;
    soundPressed.current = event.timeStamp;
    toggleSound(event);
  }

  // On a touch screen a tap in the black around the video counts as a tap on it, as anywhere on the screen does on
  // TikTok, since on a phone held upright the video is only a quarter of it. Not with a mouse, nor on the buttons. The
  // buttons are read from where the tap began, since one can draw another icon in place of the one tapped, as the sound
  // button does when sound turns on, and the tapped icon is then no longer in the page.
  function tapAround(event: React.MouseEvent<HTMLElement>) {
    const onControl = event.nativeEvent.composedPath().some((node) => node instanceof Element && node.matches("button, a, input, textarea, [data-seek]"));
    if (lastPointer.current !== "touch" || onControl || event.timeStamp - soundPressed.current < DOUBLE_TAP_MS) return;
    tapVideo(event);
  }

  // Clearing the search keeps the video on screen playing: once every video is back, the feed scrolls to it, since a
  // browser without scroll anchoring would otherwise leave another video on screen. It is cleared with Clear, with
  // "Show all videos", or by emptying the box, as with its own clear button; on a phone the box then closes too,
  // unless the viewer is still in it.
  const keepInView = useRef<string | null>(null);
  function clearSearch(value = "") {
    // Only with a search, since clearing "?" or spaces leaves the videos as they are: the effect below would not run
    // to use the video and forget it, and the next search would jump to it.
    if (search) keepInView.current = current;
    setTyped(value);
    if (document.activeElement !== searchBox.current) setSearchOpen(false);
    // With no match there was no video on screen, so the feed starts from its first video.
    if (!current) {
      setActiveSlug(null);
      scroller.current?.scrollTo({ top: 0 });
    }
  }
  // Any other new list of videos starts from its first one. The search box scrolls there as the viewer types, but that
  // is before the videos change order, and the browser's scroll anchoring then follows the video that was on screen to
  // its new place among the matches.
  useLayoutEffect(() => {
    const slug = keepInView.current;
    keepInView.current = null;
    if (slug) sections.current.get(slug)?.scrollIntoView({ block: "start" });
    else scroller.current?.scrollTo({ top: 0 });
  }, [visible]);

  async function toggleLike(slug: string) {
    if (!viewer) return;
    const before = social[slug] ?? { likes: 0, liked: false, comments: [] };
    const liked = !before.liked;
    setSocial((current) => ({ ...current, [slug]: { ...before, liked, likes: before.likes + (liked ? 1 : -1) } }));
    try {
      const result = await postJson<{ likes: number; liked: boolean }>("/api/social/like", { slug, viewer, liked });
      setSocial((current) => ({ ...current, [slug]: { ...(current[slug] ?? before), ...result } }));
    } catch {
      setSocial((current) => ({ ...current, [slug]: before }));
    }
  }

  function addComment(slug: string, comment: FeedComment) {
    setSocial((current) => {
      const before = current[slug] ?? { likes: 0, liked: false, comments: [] };
      return { ...current, [slug]: { ...before, comments: [comment, ...before.comments] } };
    });
  }

  // A panel opens over its video, which stays on screen under it. Opened while the feed scrolls on by itself at the end
  // of the video, the feed goes back to that video, so the next one does not start unseen under the panel and the
  // fact-check keeps the video it follows, which waits at its start until a sentence is chosen (see startVideo). A
  // smooth scroll under way can still move the feed a frame after it was stopped, and is stopped again then.
  function openSheet(slug: string, kind: "comments" | "factcheck") {
    const section = sections.current.get(slug);
    section?.scrollIntoView({ block: "start" });
    requestAnimationFrame(() => section?.scrollIntoView({ block: "start" }));
    setSheet({ slug, kind });
  }

  const sheetItem = sheet ? items.find((item) => item.slug === sheet.slug) : undefined;

  return (
    // No double tap here zooms the page, even once Safari has zoomed into a field, so a double tap always likes.
    <div
      data-sheet={sheet ? "" : undefined}
      data-count={countInHeader ? "" : undefined}
      className="relative h-[100dvh] touch-manipulation overflow-hidden bg-black text-fg"
      style={{ ...DARK, "--feed-head": countInHeader ? HEAD_WITH_COUNT : HEAD } as CSSProperties}
      onPointerDownCapture={(event) => {
        lastPointer.current = event.pointerType;
        const focused = document.activeElement;
        leavingBox.current = event.pointerType === "touch" && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) && keyboardUp();
        const target = event.target as Element;
        pressedInSheet.current = Boolean(target.closest?.(".feed-sheet"));
        if (!holder?.contains(target) || !target.closest?.("[data-seek]")) holderFocus.current = null;
      }}
    >
      {/* Black behind the feed too, so a phone that bounces the page shows no light edge. */}
      <style>{"html,body{background:#000}"}</style>
      {/* On a wider screen an open panel sits beside the feed, which makes room for it, so its video stays in view; on
          a phone on its side it takes no more than half the width (see Sheet). The header is laid out by the width this
          leaves the feed, not by the window's, so it fits beside the panel. In full screen the feed behind the stage
          takes no focus or clicks. */}
      <div inert={full !== null} className={`@container relative h-full ${sheet ? "sm:mr-[min(440px,50vw)]" : ""}`}>
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/80 to-transparent">
          <div
            data-open={inBox ? "" : undefined}
            className="feed-header-row flex h-14 items-center gap-2 px-3 @min-[640px]:h-16 @min-[640px]:gap-3 @min-[640px]:px-6"
          >
            <Link
              href="/"
              className={`pointer-events-auto h-11 items-center px-1 font-serif text-2xl font-semibold tracking-tight ${searching ? "hidden @min-[640px]:flex" : "flex"}`}
            >
              Meko
            </Link>
            <div className={`flex-1 ${searching ? "hidden @min-[640px]:block" : ""}`} />
            <label className={`pointer-events-auto relative min-w-0 @min-[640px]:block @min-[640px]:w-72 @min-[640px]:flex-none ${searching ? "flex-1" : "hidden"}`}>
              <span className="sr-only">Search the videos</span>
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchBox}
                type="search"
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  // Emptied, as with the box's own clear button, it keeps the video on screen, as Clear does.
                  if (search && searchWords(value).length === 0) {
                    clearSearch(value);
                    return;
                  }
                  // A new search starts from its first match, whatever an earlier Clear meant to keep on screen.
                  keepInView.current = null;
                  setTyped(value);
                  setActiveSlug(null);
                  scroller.current?.scrollTo({ top: 0 });
                }}
                onKeyDown={(event) => {
                  // Escape empties the box, and leaves it when it is empty already. Enter puts a phone's keyboard away.
                  if (event.key === "Escape") {
                    event.preventDefault();
                    if (query) clearSearch();
                    else event.currentTarget.blur();
                  } else if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onFocus={() => setInBox(true)}
                // On a phone an empty box closes again once the viewer leaves it.
                onBlur={() => {
                  setInBox(false);
                  if (!query) setSearchOpen(false);
                }}
                maxLength={100}
                enterKeyHint="search"
                aria-keyshortcuts="/"
                placeholder="Search the videos"
                className="h-11 w-full rounded-full border border-rule bg-surface/90 pl-10 pr-4 text-base text-fg outline-none placeholder:text-muted focus:border-fg @min-[640px]:pointer-fine:text-sm"
              />
            </label>
            {searching ? (
              <button
                type="button"
                // Pressed before the box loses the focus, which would close it and move this button away from the tap.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  clearSearch();
                  setSearchOpen(false);
                  searchBox.current?.blur();
                }}
                className="pointer-events-auto h-11 shrink-0 px-2 text-sm font-medium text-fg @min-[640px]:hidden"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search the videos"
                aria-keyshortcuts="/"
                title="Search the videos (/)"
                className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-white/10 @min-[640px]:hidden"
              >
                <SearchIcon className="h-[22px] w-[22px]" />
              </button>
            )}
            <Link
              href="/"
              className="pointer-events-auto hidden h-11 shrink-0 items-center rounded-full bg-fg px-4 text-sm font-medium text-bg hover:opacity-85 @min-[640px]:flex"
            >
              Make a video
            </Link>
          </div>
          {/* Always on the page, so a screen reader announces each new result as it is written in. */}
          <p role="status" className="sr-only">
            {search ? (visible.length > 0 ? `${visible.length} ${visible.length === 1 ? "video matches" : "videos match"} “${search}”` : `No video about “${search}” yet.`) : ""}
          </p>
          {countInHeader ? (
            <p className="feed-count pointer-events-auto mx-3 flex h-11 w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-white/10 pl-4 pr-2 text-sm text-fg/85 backdrop-blur-md @min-[640px]:ml-auto @min-[640px]:mr-6">
              <span className="min-w-0 truncate">
                {visible.length} {visible.length === 1 ? "video matches" : "videos match"} “{search}”
              </span>
              <span aria-hidden>·</span>
              <button type="button" onClick={() => clearSearch()} className="h-full shrink-0 px-2 font-medium text-fg underline decoration-white/40 underline-offset-4 hover:decoration-fg">
                Clear
              </button>
            </p>
          ) : null}
        </header>

        <main ref={scroller} className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <h1 className="sr-only">Videos made by Meko</h1>
          {/* The dock, where the player waits unseen while no video is shown. It is laid out like a section, so the
              player keeps its size. */}
          <div aria-hidden className="feed-section pointer-events-none invisible absolute inset-0">
            <div ref={dock} className="feed-box aspect-video" />
          </div>
          {search && visible.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="break-words font-serif text-3xl leading-tight">No video about “{search}” yet.</p>
              <p className="text-muted">Meko can research it on the web, check every sentence against its sources and animate it in about a minute.</p>
              <Link
                href={`/?topic=${encodeURIComponent(search)}`}
                className="mt-2 max-w-full break-words rounded-full bg-fg px-6 py-3 font-medium text-bg hover:opacity-85"
              >
                Make a video about “{search}”
              </Link>
              <button type="button" onClick={() => clearSearch()} className="min-h-11 px-3 text-sm text-muted underline decoration-rule underline-offset-4 hover:text-fg">
                Show all videos
              </button>
            </div>
          ) : null}
          {visible.map((item, index) => {
            const counts = social[item.slug];
            // Whether the player shows this video, on screen.
            const here = item.slug === live;
            // Only the buttons of the video on screen are in the order of the Tab key, so it goes from the header to that
            // video, and from its last button to an open panel, which follows the videos in the page: it never reaches
            // another video, which the browser would scroll to, closing the panel and starting that video over.
            const tab = item.slug === current ? undefined : -1;
            return (
              <section
                key={item.slug}
                data-slug={item.slug}
                data-playing={here && playback.playing ? "yes" : "no"}
                data-muted={here && !playback.muted ? "no" : "yes"}
                ref={(element) => {
                  if (element) sections.current.set(item.slug, element);
                  else sections.current.delete(item.slug);
                }}
                onClick={here ? tapAround : undefined}
                className="feed-section relative h-full snap-start snap-always overflow-hidden"
              >
                <div
                  ref={(element) => {
                    if (element) boxes.current.set(item.slug, element);
                    else boxes.current.delete(item.slug);
                  }}
                  className="feed-box aspect-video bg-black"
                >
                  {/* Every video but the one in the player shows its still. The first still is the largest thing on
                      screen until the player loads, so it loads first. */}
                  {here ? null : (
                    <Image src={`/examples/${item.slug}.jpg`} alt="" fill unoptimized loading={index === 0 ? "eager" : "lazy"} className="feed-round object-cover opacity-80" />
                  )}
                </div>
                {/* The caption and the buttons sit beside or under the picture, never on it: every corner of a video
                    holds something to read, like the year it is about and the source of what is being said, and its
                    captions run along the bottom. On a short upright phone the buttons are a row between the two
                    (app/watch/feed.css). */}
                <div className="feed-caption absolute bottom-[18px] left-4 right-[88px]">
                  <h2 className="line-clamp-2 font-serif text-xl font-semibold leading-snug sm:text-2xl">{item.title}</h2>
                  <p className="mt-1.5 font-mono text-[11px] leading-4 text-muted sm:text-xs">
                    {duration(item.seconds)} · {item.sources} sources · {checkedLine(item)}
                  </p>
                </div>
                <div data-clear={countShown ? "" : undefined} className="feed-rail absolute bottom-3.5 right-2 flex w-16 flex-col items-center gap-1">
                  <SoundButton on={soundOn} tabIndex={tab} onClick={pressSound} />
                  <RailButton label={counts?.liked ? "Unlike" : "Like"} caption={String(counts?.likes ?? 0)} pressed={Boolean(counts?.liked)} tabIndex={tab} onClick={() => void toggleLike(item.slug)}>
                    <HeartIcon filled={Boolean(counts?.liked)} />
                  </RailButton>
                  <RailButton label="Comments" caption={String(counts?.comments.length ?? 0)} tabIndex={tab} onClick={() => openSheet(item.slug, "comments")}>
                    <CommentIcon />
                  </RailButton>
                  <RailButton label="Fact-check" caption="Check" tabIndex={tab} onClick={() => openSheet(item.slug, "factcheck")}>
                    <CheckIcon />
                  </RailButton>
                  <ShareButton slug={item.slug} title={item.title} tabIndex={tab} />
                  <RailButton label="Full screen" caption="Full screen" title="Full screen (F)" keys="F" tabIndex={tab} onClick={enterFull}>
                    <ExpandIcon />
                  </RailButton>
                  {/* On a phone on its side the header and its count line are gone, so a search is cleared from here. */}
                  {countShown ? (
                    <RailButton label={`Clear the search for “${search}”`} caption="Clear" className="feed-clear" tabIndex={tab} onClick={() => clearSearch()}>
                      <SearchClearIcon />
                    </RailButton>
                  ) : null}
                </div>
              </section>
            );
          })}
        </main>
      </div>

      <Stage
        full={full}
        stageRef={stage}
        boxRef={stageBox}
        still={full && !live ? current : null}
        hideControls={idle && !roomy && playback.playing}
        soundOn={soundOn}
        onSound={pressSound}
        onTap={(event) => {
          if (lastPointer.current === "touch") tapVideo(event);
        }}
        onClose={exitFull}
        onSwipe={(step) => scrollToIndex(active + step)}
      />

      {/* The one player, in its holder in the video box of the section on screen or in the stage, with the progress bar,
          the play and pause icon a tap shows, and the play icon a paused video keeps. While that video's data loads,
          the player keeps the video before and hides behind the still. A double click, which likes, selects no word in
          the video. */}
      {holder && shownVideo
        ? createPortal(
            <div
              className="relative h-full w-full select-none"
              style={live ? undefined : { visibility: "hidden" }}
              onClick={tapVideo}
              onFocus={(event) => {
                holderFocus.current = event.target.getAttribute("role") === "slider" ? "slider" : event.target instanceof HTMLButtonElement ? "button" : null;
              }}
              onBlur={(event) => {
                if (event.relatedTarget instanceof Node && !holder.contains(event.relatedTarget)) holderFocus.current = null;
              }}
            >
              <div className="feed-round h-full w-full overflow-hidden">
                <FeedPlayer key={playerKey} video={shownVideo} onPlayer={onPlayer} onFailed={setFailed} posterShown={reducedMotion && played !== live} />
              </div>
              <Progress player={player} video={shownVideo} slug={live} sections={sections} />
              {live && player ? (
                <PlayPause
                  playing={playback.playing}
                  // Not while the large icon of a tap shows, nor over the poster's own play icon, nor on a video the
                  // feed scrolls on from at its end.
                  paused={!playback.playing && !flash && !(reducedMotion && played !== live) && endedSlug !== live}
                  onToggle={togglePlay}
                />
              ) : null}
              {flash ? <Flash key={flash.at} icon={flash.icon} still={reducedMotion} /> : null}
            </div>,
            holder,
          )
        : null}

      {sheet && sheetItem ? (
        <Sheet
          title={sheet.kind === "comments" ? `Comments on “${sheetItem.title}”` : `Fact-check of “${sheetItem.title}”`}
          onClose={() => setSheet(null)}
          previous={() => {
            const buttons = [...(sections.current.get(sheet.slug)?.querySelectorAll<HTMLElement>(".feed-rail button") ?? [])];
            return buttons.filter((button) => button.getBoundingClientRect().width > 0).at(-1) ?? null;
          }}
        >
          {sheet.kind === "comments" ? (
            <Comments
              key={sheet.slug}
              slug={sheet.slug}
              viewer={viewer}
              comments={social[sheet.slug]?.comments ?? []}
              onAdded={(comment) => addComment(sheet.slug, comment)}
            />
          ) : (
            <FactCheckSheet video={videos[sheet.slug]} player={sheet.slug === live ? player : null} />
          )}
        </Sheet>
      ) : null}
    </div>
  );
}

// The feed's one player (see `holder` in Feed). It hands itself up, so the feed can start the video on screen and the
// fact-check can play it from a sentence. The player loads after this mounts (see StoryboardPlayer above), so a callback
// ref hands it up when it arrives; an effect here would run too early and hand up nothing. It is drawn again only when
// its own props change, not each time the feed's state does, since redrawing a player redraws its whole video. It is
// made with sound on, and the feed mutes it before it first plays (see startVideo): Remotion makes a player's
// AudioContext the first time the player has sound, and every sound playing at that moment lost its sound element, so
// after the first "Tap for sound" the voice was gone for a scene or two, and in the next video too. It plays at full
// volume whatever the start page's volume slider was left at (see StoryboardPlayer), which also lets it make its
// AudioContext then. Remotion's control bar is hidden, since the feed draws its own progress bar (see Progress).
const FeedPlayer = memo(function FeedPlayer({
  video,
  onPlayer,
  onFailed,
  posterShown,
}: {
  video: SavedVideo;
  onPlayer: (player: PlayerRef | null) => void;
  onFailed: (video: SavedVideo) => void;
  posterShown: boolean;
}) {
  const sites = useMemo(() => sceneSites(video.storyboard, video.facts), [video]);
  const fail = useCallback(() => onFailed(video), [onFailed, video]);
  return (
    <StoryboardPlayer
      storyboard={video.storyboard}
      voice={video.voice}
      sites={sites}
      checks={video.report}
      playerRef={onPlayer}
      controls={false}
      poster={false}
      posterWhenPaused={posterShown}
      posterLook="icon"
      volumeControls={false}
      clickToPlay={false}
      sharedAudioTags={SHARED_AUDIO_TAGS}
      initialVolume={1}
      onError={fail}
    />
  );
});

// The progress bar along the bottom edge of the video on screen, in place of Remotion's control bar. It fills as the
// video plays, and seeks where it is clicked or dragged with a mouse, or tapped or dragged sideways with a finger: a
// finger that moves up or down on it scrolls the feed instead. For a keyboard and a screen reader it is a slider that
// says where the video is, as "0:07 of 1:03", and the arrow keys, Home and End move it (see the keys in Feed, which
// also lets the first of them turn sound on, and keeps full screen's controls from fading while they are pressed). It
// also writes the time of the video, in whole seconds, on its section as data-time, for tests. All of it changes on
// every frame, or every second, without a render.
function Progress({
  player,
  video,
  slug,
  sections,
}: {
  player: PlayerRef | null;
  video: SavedVideo;
  slug: string | null;
  sections: RefObject<Map<string, HTMLElement>>;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  // Whether the last press on the bar was a finger's, for its click, and whether the press that ends in this click began
  // on the bar. One on the video can end with its click on the bar: a tap that wakes full screen's faded controls
  // shows the bar under the finger before the click, and that click goes on to the video, which plays or pauses,
  // rather than seek to where it landed.
  const finger = useRef(false);
  const pressed = useRef(false);
  const [dragging, setDragging] = useState(false);
  const frames = storyboardFrames(video.storyboard);
  const fps = video.storyboard.fps;
  // Whole seconds, as the caption shows the length.
  const seconds = Math.floor(frames / fps);

  useEffect(() => {
    const section = slug ? sections.current.get(slug) : undefined;
    if (!player || !section) return;
    let second = -1;
    const show = (frame: number) => {
      if (fill.current) fill.current.style.transform = `scaleX(${Math.min(1, frame / Math.max(1, frames - 1))})`;
      const now = Math.floor(frame / fps);
      if (now === second) return;
      second = now;
      section.dataset.time = String(now);
      bar.current?.setAttribute("aria-valuenow", String(now));
      bar.current?.setAttribute("aria-valuetext", `${duration(now)} of ${duration(seconds)}`);
    };
    show(player.getCurrentFrame());
    const onFrame = ({ detail }: { detail: { frame: number } }) => show(detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      delete section.dataset.time;
    };
  }, [player, slug, sections, frames, fps, seconds]);

  // Heard before the bar's own press, which then says it began there.
  useEffect(() => {
    const forget = () => {
      pressed.current = false;
    };
    window.addEventListener("pointerdown", forget, true);
    return () => window.removeEventListener("pointerdown", forget, true);
  }, []);

  // Never quite the last frame, which Remotion takes as the end, so the feed would move on in the middle of a drag.
  const seekTo = (frame: number) => player?.seekTo(Math.min(frames - 2, Math.max(0, frame)));
  function seekAt(clientX: number) {
    const rect = track.current?.getBoundingClientRect();
    if (!player || !rect || rect.width === 0) return;
    const share = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(Math.round(share * (frames - 1)));
  }

  // A mouse seeks as it presses and drags, with the video paused meanwhile, as in Remotion's own seek bar, and it plays
  // on afterwards if it played before. A finger does the same once it has moved sideways along the bar, more than up
  // or down: until then its press may be a tap, which seeks on its click, or the start of a swipe, which the browser
  // takes to scroll the feed (touch-pan-y) and ends with pointercancel. The bar captures the pointer for the drag, so a
  // drag let go over the picture ends with its click on the bar, which keeps it, rather than on the video, which
  // would pause it just after the drag played it on. The end is also heard on the window, should the capture fail, and
  // a mouse that moves with no button held has lost its release, as to another window, and ends the drag too.
  // Only the pointer that pressed moves and ends the drag, so a second finger lifted elsewhere does not end it.
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const isFinger = event.pointerType === "touch";
    finger.current = isFinger;
    pressed.current = true;
    if ((!isFinger && event.button !== 0) || !player) return;
    const target = event.currentTarget;
    const id = event.pointerId;
    const from = { x: event.clientX, y: event.clientY };
    let wasPlaying = false;
    let seeking = false;
    const start = () => {
      seeking = true;
      try {
        target.setPointerCapture(id);
      } catch {}
      wasPlaying = player.isPlaying();
      if (wasPlaying) player.pause();
      setDragging(true);
    };
    const end = (ended: PointerEvent) => {
      if (ended.pointerId !== id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!seeking) return;
      setDragging(false);
      if (wasPlaying) player.play();
    };
    const move = (moved: PointerEvent) => {
      if (moved.pointerId !== id) return;
      if (!isFinger && moved.buttons === 0) return end(moved);
      if (!seeking) {
        const sideways = Math.abs(moved.clientX - from.x);
        if (sideways < 8 || sideways <= Math.abs(moved.clientY - from.y)) return;
        start();
      }
      seekAt(moved.clientX);
    };
    if (!isFinger) {
      event.preventDefault();
      start();
      seekAt(event.clientX);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <div
      ref={bar}
      data-seek
      data-dragging={dragging ? "" : undefined}
      role="slider"
      tabIndex={0}
      aria-label="Position in the video"
      aria-valuemin={0}
      aria-valuemax={seconds}
      // Set at the start only: from then on the effect above writes it, without a render.
      aria-valuenow={0}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (!pressed.current) return;
        pressed.current = false;
        // The tap is the bar's, not the video's, which would play or pause.
        event.stopPropagation();
        if (finger.current) seekAt(event.clientX);
      }}
      className="feed-seek peer/seek absolute inset-x-0 z-10 cursor-pointer touch-pan-y outline-none transition-opacity duration-300 group-data-[idle=yes]/stage:pointer-events-none group-data-[idle=yes]/stage:opacity-0"
    >
      <div ref={track} data-track className="feed-track absolute overflow-hidden rounded-full transition-[height] duration-150">
        <div ref={fill} data-progress className="feed-fill h-full w-full bg-white" />
      </div>
    </div>
  );
}

// The large play or pause icon in the middle of the video, for a moment after a tap, or a heart after a double tap.
// Viewers who asked for less motion see it fade without growing.
function Flash({ icon, still }: { icon: FlashIcon; still: boolean }) {
  const animate = useCallback(
    (element: HTMLSpanElement | null) => {
      element?.animate(
        still
          ? [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }]
          : [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "scale(1)", offset: 0.2 }, { opacity: 1, offset: 0.5 }, { opacity: 0, transform: "scale(1.15)" }],
        { duration: FLASH_MS, easing: "ease-out", fill: "forwards" },
      );
    },
    [still],
  );
  return (
    <div data-flash={icon} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {icon === "like" ? (
        <span ref={animate} className="flex h-24 w-24 items-center justify-center text-bad drop-shadow-lg sm:h-32 sm:w-32">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-full w-full">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
          </svg>
        </span>
      ) : (
        <span ref={animate} className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm sm:h-24 sm:w-24">
          {icon === "play" ? <PlayIcon /> : <PauseIcon />}
        </span>
      )}
    </div>
  );
}

// The play icon a paused video keeps in its middle, as on TikTok, so a paused video never looks like one that plays.
// It is also the one control that pauses and plays the video for a keyboard or a screen reader, since Remotion's
// control bar is gone: a button, read as Pause or Play, that shows only while the video is paused or while it has the
// keyboard's focus. Taps go through it to the video (see tapVideo), so the first tap still turns sound on, and the
// keyboard's Enter and space bar press it. It hides while the progress bar is dragged, which pauses the video.
function PlayPause({ playing, paused, onToggle }: { playing: boolean; paused: boolean; onToggle: (event: SyntheticEvent) => void }) {
  return (
    <button
      type="button"
      data-paused={paused ? "" : undefined}
      aria-label={playing ? "Pause" : "Play"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event);
      }}
      className="pointer-events-none absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/90 opacity-0 outline-none backdrop-blur-sm focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white data-[paused]:opacity-100 peer-data-[dragging]/seek:opacity-0 motion-safe:transition-opacity motion-safe:duration-200 sm:h-24 sm:w-24"
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

// Full screen (see `full` in Feed): the stage the one player moves into, with a sound button and a way out in its top
// corners. Where the screen leaves no black beside or above the video for them, they and the progress bar fade out
// while the video plays and nobody touches the screen, so they never cover the year and the source in its corners for
// long; any touch, click, mouse move or key brings them back. A finger swiped up or down moves to the next or the
// previous video, as in the feed, which a phone has no arrow keys for; the stage takes the whole gesture, so the page
// behind it never moves. The swipe is heard on the stage's element itself, not through React: the player is drawn
// through a portal from the feed, so React passes its touches up to the feed and never to the stage, though it lies
// in the stage, and a swipe on the video, most of the screen on a phone on its side, did nothing. One that starts on
// the progress bar seeks instead. A tap on the black around the video counts as a tap on it (onTap), as in the feed;
// taps on the video itself reach the feed through the portal and never come here. Its buttons are read from where the
// tap began, as in the feed (see tapAround).
function Stage({
  full,
  stageRef,
  boxRef,
  still,
  hideControls,
  soundOn,
  onSound,
  onTap,
  onClose,
  onSwipe,
}: {
  full: "api" | "overlay" | null;
  stageRef: RefObject<HTMLDivElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  still: string | null;
  hideControls: boolean;
  soundOn: boolean;
  onSound: (event: React.MouseEvent) => void;
  onTap: (event: React.MouseEvent) => void;
  onClose: () => void;
  onSwipe: (step: 1 | -1) => void;
}) {
  const swiped = useRef(onSwipe);
  useLayoutEffect(() => {
    swiped.current = onSwipe;
  });
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    let from: { x: number; y: number } | null = null;
    const start = (event: TouchEvent) => {
      const touch = event.touches[0];
      const onBar = event.target instanceof Element && event.target.closest("[data-seek]");
      from = event.touches.length === 1 && touch && !onBar ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const end = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const begun = from;
      from = null;
      if (!begun || !touch) return;
      const across = touch.clientX - begun.x;
      const down = touch.clientY - begun.y;
      if (Math.abs(down) > 60 && Math.abs(down) > Math.abs(across) * 1.5) swiped.current(down < 0 ? 1 : -1);
    };
    const cancel = () => {
      from = null;
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", cancel);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", cancel);
    };
  }, [stageRef]);
  return (
    <div
      ref={stageRef}
      tabIndex={-1}
      // Named, so a screen reader says what took the focus rather than reading out all that is in it.
      role={full ? "dialog" : undefined}
      aria-modal={full ? true : undefined}
      aria-label={full ? "Full screen video" : undefined}
      data-full={full ?? undefined}
      data-idle={hideControls ? "yes" : "no"}
      onClick={(event) => {
        if (!event.nativeEvent.composedPath().some((node) => node instanceof Element && node.matches("button, [data-seek]"))) onTap(event);
      }}
      className={`feed-stage group/stage fixed inset-0 z-50 touch-none bg-black outline-none ${full ? "" : "hidden"} ${hideControls ? "cursor-none" : ""}`}
    >
      <div ref={boxRef} className="feed-stage-box aspect-video">
        {/* The still of the next video while it loads. */}
        {still ? <Image src={`/examples/${still}.jpg`} alt="" fill unoptimized className="object-cover opacity-80" /> : null}
      </div>
      {/* On a phone held upright the video is no larger than in the feed, so the stage says how to make it larger. */}
      <p className="feed-stage-hint pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] items-center justify-center gap-2 text-sm text-white/70">
        <RotateIcon />
        Turn your screen sideways for a bigger picture
      </p>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 transition-opacity duration-300 ${hideControls ? "opacity-0" : ""}`}
      >
        <button
          type="button"
          onClick={(event) => {
            onSound(event);
            blurAfterClick(event);
          }}
          aria-label={soundOn ? "Turn sound off" : "Tap for sound"}
          aria-keyshortcuts="M"
          title={soundOn ? "Turn sound off (M)" : "Turn sound on (M)"}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${hideControls ? "" : "pointer-events-auto"} ${soundOn ? "bg-white/15 text-white ring-1 ring-white/15 backdrop-blur-md" : "bg-white text-black"}`}
        >
          {soundOn ? <SpeakerIcon /> : <MutedIcon />}
        </button>
        <button
          type="button"
          onClick={(event) => {
            onClose();
            blurAfterClick(event);
          }}
          aria-label="Exit full screen"
          aria-keyshortcuts="F"
          title="Exit full screen (F)"
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-white/25 ${hideControls ? "" : "pointer-events-auto"}`}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

// The sound button, first in the rail: a white "Tap for sound" pill while sound is off, reaching left into the black
// under the video on a phone held upright and a white icon with the words under it elsewhere (app/watch/feed.css), and
// a speaker like the other buttons once sound is on. It is outside the player, so tapping it never also pauses the
// video. Both are the same <button> in the same place, which React changes rather than replaces, so a keyboard keeps
// its focus on it as sound turns on and off.
function SoundButton({ on, tabIndex, onClick }: { on: boolean; tabIndex?: number; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const click = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick(event);
    blurAfterClick(event);
  };
  return (
    // As tall as the other buttons with their words, so the rail does not move when sound turns on.
    <div className="feed-sound-slot flex h-[58px] w-full flex-col items-center justify-center">
      {on ? (
        <button type="button" onClick={click} tabIndex={tabIndex} aria-label="Turn sound off" aria-keyshortcuts="M" title="Turn sound off (M)" className={`${RAIL_BUTTON} max-w-full`}>
          <span className={RAIL_ICON}>
            <SpeakerIcon />
          </span>
          <span className={RAIL_LABEL}>Sound</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={click}
          tabIndex={tabIndex}
          aria-keyshortcuts="M"
          title="Turn sound on (M)"
          className="feed-sound-off mr-2.5 flex h-11 items-center self-end rounded-full bg-white pl-4 text-black shadow-lg shadow-black/40 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <span className="feed-sound-text whitespace-nowrap text-[13px] font-semibold">Tap for sound</span>
          <span className="feed-sound-icon flex h-11 w-11 shrink-0 items-center justify-center">
            <MutedIcon />
          </span>
        </button>
      )}
    </div>
  );
}

// A mouse click leaves the focus on the button in Chrome, where the space bar would then press it again, as liking the
// video again undid the like, rather than play or pause the video. A keyboard keeps the focus.
function blurAfterClick(event: React.MouseEvent<HTMLButtonElement>) {
  if ((event.nativeEvent as PointerEvent).pointerType === "mouse") event.currentTarget.blur();
}

const RAIL_BUTTON = "group flex w-16 flex-col items-center gap-0.5 text-white outline-none";
const RAIL_ICON =
  "feed-icon flex h-11 w-11 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/10 transition-colors group-hover:bg-white/20 group-focus-visible:ring-2 group-focus-visible:ring-white";
const RAIL_LABEL = "feed-label whitespace-nowrap text-[11px] font-medium leading-3 tabular-nums text-white/85";

// A round button in the rail with a count or a word under it, like TikTok's. The name read aloud holds that word or
// count too, so voice control finds the button by what it shows.
function RailButton({
  label,
  caption,
  title,
  keys,
  pressed,
  className = "",
  tabIndex,
  onClick,
  children,
}: {
  label: string;
  caption: string;
  title?: string;
  keys?: string;
  pressed?: boolean;
  className?: string;
  tabIndex?: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  const name = label.toLowerCase().includes(caption.toLowerCase()) ? label : `${label}, ${caption}`;
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick(event);
        blurAfterClick(event);
      }}
      tabIndex={tabIndex}
      aria-label={name}
      aria-pressed={pressed}
      aria-keyshortcuts={keys}
      title={title ?? label}
      className={`${RAIL_BUTTON} ${className}`}
    >
      <span className={RAIL_ICON}>{children}</span>
      <span className={RAIL_LABEL}>{caption}</span>
    </button>
  );
}

// On a phone the system's share sheet opens, as on TikTok. On a computer, or should the phone have none, the link is
// copied, and the button says whether that worked.
function ShareButton({ slug, title, tabIndex }: { slug: string; title: string; tabIndex?: number }) {
  const [said, setSaid] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function say(words: string) {
    setSaid(words);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid(null), 1800);
  }
  async function share() {
    const url = `${window.location.origin}/watch#${slug}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The viewer closed the sheet; any other refusal falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say("Copied");
    } catch {
      say("Copy failed");
    }
  }
  return (
    <RailButton label="Share a link to this video" caption={said ?? "Share"} tabIndex={tabIndex} onClick={() => void share()}>
      <LinkIcon />
    </RailButton>
  );
}

// A panel over the feed: from the bottom on a phone, like TikTok's comments, up to the video, which moves up under the
// header to stay in view (app/watch/feed.css), and never over it, unless the screen is so short that the panel would
// leave too little room; on a phone on its side, where the video fills the height, it covers most of it. Beside the
// feed on a wide screen, where the feed makes room for it and stays usable, so the panel is no modal there; on a phone
// on its side it takes no more than half the width, so the video keeps the other half. Its title takes the focus when
// it opens, so the arrow keys never scroll the feed behind it from the button that opened it. The title holds none of
// the panel's text, so a click on that text still lets the arrow keys scroll it. A viewer who opened the panel from the
// keyboard gets the focus back on that button when it closes, unless the focus has gone elsewhere meanwhile, as to the
// search box, whose typing moves the feed on and so closes the panel; after a tap or click the focus stays on the
// page, so the space bar plays and pauses the video again. Shift+Tab from its top goes back to the buttons of its
// video (`previous`), even while the feed still scrolls back to that video, and Tab from its last button comes back
// into the panel, which follows the videos in the page: only the buttons of the video on screen are in the order of
// the Tab key. What it shows scrolls by itself (see Comments and FactCheckSheet).
function Sheet({
  title,
  onClose,
  previous,
  children,
}: {
  title: string;
  onClose: () => void;
  previous: () => HTMLElement | null;
  children: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);
  useEffect(() => {
    // Escape in a box with text in it, like a comment being written, only leaves the box, so the text is not thrown
    // away with the panel; the next Escape closes it. An Escape the search box has used already, to empty itself or to
    // let go of the focus, leaves the panel alone too.
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key === "Tab" && event.shiftKey) {
        const first = panel.current?.querySelector("a[href], button:not(:disabled), input, textarea, [tabindex='0']");
        const back = target === heading.current || target === first ? previous() : null;
        if (back) {
          event.preventDefault();
          back.focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if ((target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) && target.value) target.blur();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, previous]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible") ? document.activeElement : null;
    const box = panel.current;
    heading.current?.focus({ preventScroll: true });
    return () => {
      const now = document.activeElement;
      if (!now || now === document.body || box?.contains(now)) opener?.focus({ preventScroll: true });
    };
  }, []);

  // On a phone the panel's top, its handle and title, can be drawn down with a finger to close it, as on TikTok: far
  // enough, or with a flick, it closes, and otherwise it slides back.
  function grab(event: React.PointerEvent<HTMLDivElement>) {
    const sheet = panel.current;
    if (wide || !sheet || event.pointerType === "mouse" || (event.target as Element).closest("button")) return;
    const grip = event.currentTarget;
    const id = event.pointerId;
    const from = event.clientY;
    const at = event.timeStamp;
    let moved = 0;
    try {
      grip.setPointerCapture(id);
    } catch {}
    sheet.style.transition = "none";
    const move = (next: PointerEvent) => {
      if (next.pointerId !== id) return;
      moved = Math.max(0, next.clientY - from);
      sheet.style.transform = `translateY(${moved}px)`;
    };
    const end = (last: PointerEvent) => {
      if (last.pointerId !== id) return;
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", end);
      grip.removeEventListener("pointercancel", end);
      if (last.type === "pointerup" && (moved > 80 || (moved > 24 && moved / Math.max(1, last.timeStamp - at) > 0.6))) {
        onClose();
        return;
      }
      sheet.style.transition = readReducedMotion() ? "" : "transform 0.2s ease";
      sheet.style.transform = "";
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-end bg-black/25 sm:pointer-events-none sm:items-stretch sm:bg-transparent" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal={wide ? undefined : true}
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="feed-sheet pointer-events-auto flex h-[max(calc(100dvh-56.25vw-var(--feed-head)-8px),40dvh)] w-full flex-col rounded-t-2xl border border-b-0 border-rule bg-bg max-sm:landscape:h-[80dvh] sm:h-full sm:w-[min(440px,50vw)] sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div onPointerDown={grab} className="shrink-0 touch-none sm:touch-auto">
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
          <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-1.5 sm:py-4">
            <h2 ref={heading} tabIndex={-1} className="line-clamp-1 font-serif text-xl outline-none">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function Comments({ slug, viewer, comments, onAdded }: { slug: string; viewer: string | null; comments: FeedComment[]; onAdded: (comment: FeedComment) => void }) {
  // What the viewer writes is kept for the video as they write it (see drafts), and starts from what they wrote before.
  const [text, setTextState] = useState(() => drafts.get(slug) ?? "");
  function setText(value: string) {
    setTextState(value);
    if (value) drafts.set(slug, value);
    else drafts.delete(slug);
  }
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await postJson<{ comment: FeedComment }>("/api/social/comment", { slug, viewer, text });
      onAdded(result.comment);
      setText("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSending(false);
    }
  }

  // The comments scroll above the box to write one, which stays at the bottom of the panel, as on TikTok. The box is one
  // line until the viewer writes in it, so on a short phone the comments keep most of the panel; it then grows, and
  // says under which name the comment goes.
  const writing = focused || text !== "";
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {comments.length === 0 ? <p className="py-6 text-sm text-muted">No comments yet. Be the first.</p> : null}
        <ol className="flex flex-col">
          {comments.map((comment) => (
            <li key={comment.id} className="border-b border-rule py-3 last:border-b-0">
              <p className="text-sm">
                <span className="font-medium">{comment.name}</span> <span className="font-mono text-xs text-muted">· {timeAgo(comment.at)}</span>
              </p>
              <p className="mt-1 break-words text-sm leading-relaxed">{comment.text}</p>
            </li>
          ))}
        </ol>
        <p className="py-4 text-xs text-muted">Comments are from viewers. Unlike the videos, they are not fact-checked.</p>
      </div>
      <form
        onSubmit={(event) => void submit(event)}
        className="flex shrink-0 flex-col gap-2 border-t border-rule bg-bg px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className={writing ? "flex items-baseline justify-between gap-3" : "sr-only"}>
          <label className="min-w-0 text-xs text-muted" htmlFor="comment">
            Commenting as <span className="font-medium text-fg">{viewer ? viewerName(viewer) : "…"}</span>, no account needed.
          </label>
          <span className="shrink-0 font-mono text-xs text-muted">
            {text.length}/{COMMENT_CHARS}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            id="comment"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={COMMENT_CHARS}
            rows={writing ? 3 : 1}
            placeholder="Add a comment"
            // 16 px on a touch screen, also a phone on its side, like the search box, since Safari on an iPhone zooms into
            // a smaller field it focuses, and stays zoomed in.
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-rule bg-surface px-3 py-[9px] text-base leading-6 text-fg outline-none placeholder:text-muted focus:border-fg pointer-fine:text-sm"
          />
          <button
            type="submit"
            disabled={sending || text.trim().length === 0}
            className="h-11 shrink-0 rounded-full bg-fg px-5 text-sm font-medium text-bg hover:opacity-85 disabled:opacity-40"
          >
            {sending ? "Posting…" : "Post"}
          </button>
        </div>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </form>
    </>
  );
}

// The fact-check behind a video in the feed, with its sources, following the video as it plays. The panel scrolls as
// one, with the tabs kept at its top: on a short phone the list scrolling on its own under them and the words above
// it left a strip of a line or two to read it in.
function FactCheckSheet({ video, player }: { video?: SavedVideo; player: PlayerRef | null }) {
  const [tab, setTab] = useState<"factcheck" | "sources">("factcheck");
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const spans = useMemo(() => (video ? sentenceSpans(video.storyboard, video.voice, video.report.checks) : []), [video]);
  useEffect(() => {
    if (!player || spans.length === 0) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => setActiveSentence(spans.findLast((span) => span.startFrame <= detail.frame)?.sentenceId ?? null);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [player, spans]);
  if (!video) return <p className="px-5 py-6 text-sm text-muted">Loading…</p>;
  return (
    // The scroll padding is the tabs' height, so the sentence being spoken is scrolled into view below them.
    <div ref={scroller} className="min-h-0 flex-1 scroll-pt-13 overflow-y-auto px-5 pb-6">
      <div className="flex flex-col">
        <div role="tablist" className="sticky top-0 z-10 flex gap-6 border-b border-rule bg-bg pt-1">
          {(
            [
              ["factcheck", "Fact-check"],
              ["sources", `Sources (${video.storyboard.sources.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              // As tall as a finger needs, like every other control on a phone.
              className={`-mb-px flex min-h-11 items-center border-b-2 text-sm font-medium ${tab === id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "factcheck" ? (
          <FactCheckReport
            report={video.report}
            facts={video.facts}
            sources={video.sources}
            numbered={video.storyboard.sources}
            activeSentenceId={activeSentence}
            scroller={scroller}
            onSelect={(sentenceId) => {
              const span = spans.find((candidate) => candidate.sentenceId === sentenceId);
              if (span && player) {
                // Paused first: Remotion's seekTo on a playing video pauses it to resume by itself, and with play()
                // right after, that resume stays pending and undoes the viewer's next pause.
                player.pause();
                player.seekTo(span.startFrame);
                player.play();
              }
            }}
          />
        ) : (
          <ol className="mt-2 flex flex-col">
            {video.storyboard.sources.map((source, index) => (
              <li key={source.id} className="flex gap-3 border-b border-rule py-3 last:border-b-0">
                <span className="w-6 shrink-0 font-mono text-sm text-muted">{index + 1}</span>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words underline decoration-rule underline-offset-4 hover:decoration-fg">
                  {source.title}
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden className={filled ? "text-bad" : ""}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16v11H9l-5 4V5Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}
function ExpandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}
function RotateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M3 15a9 9 0 0 0 5 5M21 9a9 9 0 0 0-5-5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-1 h-1/2 w-1/2">
      <path d="M7 4.5v15l12.5-7.5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[45%] w-[45%]">
      <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" />
    </svg>
  );
}
function SearchClearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M8.5 8.5l4 4M12.5 8.5l-4 4" />
    </svg>
  );
}
function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}
function SpeakerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}
function MutedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </svg>
  );
}
