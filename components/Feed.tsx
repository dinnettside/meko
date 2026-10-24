"use client";

import type { PlayerRef } from "@remotion/player";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, SyntheticEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { checkedLine, madeOn } from "@/lib/example";
import type { FeedItem } from "@/lib/example";
import { viewerName } from "@/lib/names";
import { searchFeed, searchWords } from "@/lib/search";
import type { FeedComment, VideoSocial } from "@/lib/social";
import { sceneSites } from "@/remotion/sites";
import { FactCheckReport } from "./FactCheckReport";
import { loadSavedVideo } from "./saved-video";
import type { SavedVideo } from "./saved-video";
import { sentenceSpans } from "./sentence-timing";
import { ThemeToggle } from "./ThemeToggle";

// The feed: videos made by Meko, one per screen like TikTok. The video on screen plays by itself, muted until the
// viewer turns sound on, and starts over when they scroll back to it. With likes and comments without an account, the
// fact-check behind each video, and a search through all of them.

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

// Keys that do not count as the viewer's first key press, since they move the focus or do nothing on their own.
const QUIET_KEYS = ["Tab", "Escape", "Shift", "Control", "Alt", "Meta", "CapsLock"];

// Whether a tap on the player should play or pause it. A tap on the picture does, and so does one on the bare
// strip of Remotion's control bar, as in Remotion itself; the bar's buttons, time and seek bar do their own thing. The
// bar is the last element in the player, with its buttons in its first row.
function tapsPicture(target: EventTarget, player: PlayerRef): boolean {
  const bar = player.getContainerNode()?.lastElementChild;
  if (!bar || !(target instanceof Node) || !bar.contains(target)) return true;
  return target === bar || target === bar.firstElementChild;
}

// Whether the player is playing and muted, as its events last said.
type Playback = { playing: boolean; muted: boolean };
const NOT_PLAYING: Playback = { playing: false, muted: true };

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
  // A search needs a word: "?" alone searches for nothing and shows every video.
  const search = searchWords(query).length > 0 ? query.trim() : "";
  const visible = useMemo(() => searchFeed(items, search), [items, search]);
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
  // Browsers only let a page play sound after a tap or a key press, so videos start muted. Once the viewer turns sound
  // on, it stays on for every video after.
  const [soundOn, setSoundOn] = useState(false);
  // The player once it has loaded, and what it last said it does, shown on the section on screen as data-playing and
  // data-muted for tests.
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [playback, setPlayback] = useState<Playback>(NOT_PLAYING);
  // The video on screen once the viewer has played it. Until then, viewers who asked for less motion see its poster.
  // It is forgotten as soon as another video is on screen, so one they scroll back to shows its poster again.
  const [played, setPlayed] = useState<string | null>(null);
  if (played !== null && played !== live) setPlayed(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const scroller = useRef<HTMLElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  // Each section's video box, where the player goes while that video is on screen, and the dock where it waits while
  // no video is shown.
  const boxes = useRef(new Map<string, HTMLElement>());
  const dock = useRef<HTMLDivElement>(null);
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
  // Copies of the videos shown, the sound, whether videos start by themselves and the open panel, for the player's
  // listeners, which outlive a render. They are brought up to date after every render, just below.
  const visibleRef = useRef(visible);
  const soundRef = useRef(false);
  const autoplayRef = useRef(true);
  const sheetRef = useRef(sheet);
  // Whether the viewer has turned sound on or off themselves. Until then, their first tap on a video turns sound on
  // instead of pausing it, and their first key press turns it on too.
  const soundChosen = useRef(false);
  // The video on screen the player was last started for, so each video starts once as it comes on screen, and one the
  // viewer paused stays paused. Null while the video on screen still loads. The player's listeners read it as the video
  // the player plays.
  const playerSlug = useRef<string | null>(null);
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

  useEffect(() => {
    visibleRef.current = visible;
    soundRef.current = soundOn;
    autoplayRef.current = !reducedMotion;
    sheetRef.current = sheet;
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
    // At the end, the next video comes up, like turning a page. Not for viewers who asked for less motion, and not
    // under an open panel, where the next video would start unseen and the fact-check would lose the video it follows.
    const onEnded = () => {
      if (!autoplayRef.current || sheetRef.current) return;
      const list = visibleRef.current;
      const index = list.findIndex((item) => item.slug === playerSlug.current);
      if (index < 0 || index >= list.length - 1) return;
      movingOn.current = playerSlug.current;
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
  // Null only stops the player, while the video on screen still loads.
  const startVideo = useCallback(
    (slug: string | null) => {
      if (!player || playerSlug.current === slug) return;
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

  // The player moves into the video box of the section on screen. Both this and the start below happen before the
  // browser paints, so a box is never seen empty, and a video never shows a frame from where the one before it was. A
  // search with no match leaves no box, and the player then waits in the dock, which keeps it in the page at the same
  // size: out of the page it measured nothing, and once back Remotion took two frames to scale the video down to its
  // box again, showing it huge.
  useLayoutEffect(() => {
    const box = (current ? boxes.current.get(current) : undefined) ?? dock.current;
    if (holder && box && holder.parentElement !== box) box.appendChild(holder);
  }, [current, holder]);
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
      if (item) sections.current.get(item.slug)?.scrollIntoView({ behavior: "smooth" });
    },
    [visible],
  );

  // Arrow keys and j/k move between videos, the space bar plays or pauses the one on screen, m turns sound on or off
  // and / goes to the search box, unless the viewer is typing. A button, a link or the fact-check keeps the space bar
  // for itself, and an open panel keeps the arrow keys, which scroll it while the feed behind stays where it is. The
  // viewer's first key press also turns sound on, like a first tap, except Enter or the space bar on a button or link:
  // that presses the control, like a tap on it, and the sound button then turns sound on by itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        searchBox.current?.focus();
        return;
      }
      if (event.key === "m" || event.key === "M") {
        if (soundRef.current) turnOffSound();
        else turnOnSound(event);
        return;
      }
      const pressesControl = (event.key === "Enter" || event.key === " ") && Boolean(target?.closest?.("button, a, summary, select, [role=button]"));
      if (!soundChosen.current && !QUIET_KEYS.includes(event.key) && !pressesControl) turnOnSound(event);
      if (sheet && ["ArrowDown", "ArrowUp", "j", "k"].includes(event.key)) {
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
      } else if (event.key === " " && player && live && !target?.closest?.("button, a, summary, select, [role=button], [role=dialog]")) {
        event.preventDefault();
        player.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, live, player, sheet, scrollToIndex, turnOnSound, turnOffSound]);

  // A tap on the video: the viewer's first one turns sound on instead of pausing it, as on TikTok, and later ones play or
  // pause it. It is taken as a click, which a swipe never makes, since the player's own click-to-play reacts as soon
  // as a finger lands, so a short swipe on the video paused it.
  function tapVideo(event: React.MouseEvent) {
    if (!player || !live || !tapsPicture(event.target, player)) return;
    if (!soundChosen.current) turnOnSound(event);
    else player.toggle(event);
  }

  // Clearing the search keeps the video on screen playing: once every video is back, the feed scrolls to it, since a
  // browser without scroll anchoring would otherwise leave another video on screen.
  const keepInView = useRef<string | null>(null);
  function clearSearch() {
    // Only with a search, since clearing "?" or spaces leaves the videos as they are: the effect below would not run
    // to use the video and forget it, and the next search would jump to it.
    if (search) keepInView.current = current;
    setTyped("");
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
    <div className="flex h-[100dvh] flex-col">
      <header className="z-20 border-b border-rule bg-bg">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
            Meko
          </Link>
          <label className="relative ml-2 min-w-0 flex-1">
            <span className="sr-only">Search the videos</span>
            <SearchIcon />
            <input
              ref={searchBox}
              type="search"
              value={query}
              onChange={(event) => {
                // A new search starts from its first match, whatever an earlier Clear meant to keep on screen.
                keepInView.current = null;
                setTyped(event.target.value);
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
              maxLength={100}
              enterKeyHint="search"
              aria-keyshortcuts="/"
              placeholder="Search the videos"
              className="w-full rounded-full border border-rule bg-surface py-2 pl-10 pr-4 text-base text-fg outline-none placeholder:text-muted focus:border-fg sm:text-sm"
            />
          </label>
          <Link href="/" className="hidden rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-85 sm:block">
            Make a video
          </Link>
          <ThemeToggle />
        </div>
        {/* Always on the page, so a screen reader announces each new result as it is written in. */}
        <p role="status" className="sr-only">
          {search ? (visible.length > 0 ? `${visible.length} ${visible.length === 1 ? "video matches" : "videos match"} “${search}”` : `No video about “${search}” yet.`) : ""}
        </p>
        {search && visible.length > 0 ? (
          <p className="mx-auto flex w-full max-w-5xl items-center gap-2 border-t border-rule px-4 py-2 text-sm text-muted sm:px-6">
            <span className="min-w-0 truncate">
              {visible.length} {visible.length === 1 ? "video matches" : "videos match"} “{search}”
            </span>
            <span aria-hidden>·</span>
            <button type="button" onClick={clearSearch} className="shrink-0 text-fg underline decoration-rule underline-offset-4 hover:decoration-fg">
              Clear
            </button>
          </p>
        ) : null}
      </header>

      <main ref={scroller} className="flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        <h1 className="sr-only">Videos made by Meko</h1>
        {/* The dock, where the player waits unseen while no video is shown. It is laid out like a section's video box,
            so the player keeps its size. */}
        <div aria-hidden className="pointer-events-none invisible h-0">
          <div className="flex justify-center px-4 sm:px-6">
            <div ref={dock} className="aspect-video w-full max-w-4xl border border-transparent" />
          </div>
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
            <button type="button" onClick={clearSearch} className="text-sm text-muted underline decoration-rule underline-offset-4 hover:text-fg">
              Show all videos
            </button>
          </div>
        ) : null}
        {visible.map((item, index) => {
          const counts = social[item.slug];
          // Whether the player shows this video, on screen.
          const here = item.slug === live;
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
              className="flex h-full snap-start snap-always items-center justify-center px-4 py-5 sm:px-6"
            >
              <article className="flex w-full max-w-4xl flex-col gap-4">
                <div
                  ref={(element) => {
                    if (element) boxes.current.set(item.slug, element);
                    else boxes.current.delete(item.slug);
                  }}
                  className="relative aspect-video overflow-hidden rounded-xl border border-rule bg-black"
                >
                  {/* Every video but the one in the player shows its still. The first still is the largest thing on
                      screen until the player loads, so it loads first. */}
                  {here ? null : (
                    <Image src={`/examples/${item.slug}.jpg`} alt="" fill unoptimized loading={index === 0 ? "eager" : "lazy"} className="object-cover opacity-80" />
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 sm:flex-1">
                    <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{item.title}</h2>
                    <p className="mt-1.5 font-mono text-xs text-muted">
                      {duration(item.seconds)} · {item.sources} sources · {checkedLine(item)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Made on {madeOn(item.madeAt)} in {Math.round(item.ms / 1000)} s for ${item.costUsd.toFixed(2)} of Nemotron calls; every view after that is free.{" "}
                      {item.domains.length > 0 ? <span>Sources include {item.domains.join(", ")}.</span> : null}
                    </p>
                  </div>
                  {/* On a narrow phone the "Tap for sound" pill takes a line of its own and the other actions stay
                      together on the next, rather than one of them wrapping alone. */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                    <SoundButton on={soundOn} onClick={(event) => (soundOn ? turnOffSound() : turnOnSound(event))} />
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <ActionButton label={counts?.liked ? "Unlike" : "Like"} pressed={counts?.liked} onClick={() => void toggleLike(item.slug)} count={counts?.likes ?? 0}>
                        <HeartIcon filled={Boolean(counts?.liked)} />
                      </ActionButton>
                      <ActionButton label="Comments" onClick={() => openSheet(item.slug, "comments")} count={counts?.comments.length ?? 0}>
                        <CommentIcon />
                      </ActionButton>
                      <ActionButton label="Fact-check" onClick={() => openSheet(item.slug, "factcheck")} text="Fact-check">
                        <CheckIcon />
                      </ActionButton>
                      <ShareButton slug={item.slug} />
                    </div>
                  </div>
                </div>
              </article>
            </section>
          );
        })}
      </main>

      {/* The one player, in its holder in the video box of the section on screen. While that video's data loads, the
          player keeps the video before and hides behind the still. */}
      {holder && shownVideo
        ? createPortal(
            <div className="h-full w-full" style={live ? undefined : { visibility: "hidden" }} onClick={tapVideo}>
              <FeedPlayer key={playerKey} video={shownVideo} onPlayer={onPlayer} onFailed={setFailed} posterShown={reducedMotion && played !== live} />
            </div>,
            holder,
          )
        : null}

      {sheet && sheetItem ? (
        <Sheet title={sheet.kind === "comments" ? `Comments on “${sheetItem.title}”` : `Fact-check of “${sheetItem.title}”`} onClose={() => setSheet(null)}>
          {sheet.kind === "comments" ? (
            <Comments
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
// AudioContext then.
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
      poster={false}
      posterWhenPaused={posterShown}
      volumeControls={false}
      clickToPlay={false}
      sharedAudioTags={SHARED_AUDIO_TAGS}
      initialVolume={1}
      onError={fail}
    />
  );
});

// The sound button, first among a video's actions: a "Tap for sound" pill while sound is off, a speaker once it is on.
// It sits under the picture rather than on it, since every corner of a video holds something to read, like the source
// of what is being said, and outside the player, so tapping it never also pauses the video.
function SoundButton({ on, onClick }: { on: boolean; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  if (on) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Turn sound off"
        aria-keyshortcuts="M"
        title="Turn sound off (M)"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-rule text-fg transition-colors hover:bg-surface"
      >
        <SpeakerIcon />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts="M"
      title="Turn sound on (M)"
      className="flex h-10 items-center gap-1 rounded-full bg-fg pl-2.5 pr-3 text-[13px] font-medium text-bg transition-opacity hover:opacity-85 sm:gap-1.5 sm:pl-3 sm:pr-3.5 sm:text-sm"
    >
      <MutedIcon />
      Tap for sound
    </button>
  );
}

function ActionButton({
  label,
  onClick,
  count,
  text,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  count?: number;
  text?: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  // The name read aloud holds what the button shows, so voice control finds it by its number or word too.
  const name = [label, count !== undefined ? String(count) : null, text && !label.includes(text) ? text : null].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      aria-pressed={pressed}
      title={label}
      className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-rule px-3 text-sm text-fg transition-colors hover:bg-surface sm:px-3.5"
    >
      {children}
      {count !== undefined ? <span className="font-mono text-xs tabular-nums">{count}</span> : null}
      {text ? <span className="hidden sm:inline">{text}</span> : null}
    </button>
  );
}

function ShareButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/watch#${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  return (
    <ActionButton label="Copy a link to this video" onClick={() => void share()} text={copied ? "Copied" : undefined}>
      <LinkIcon />
    </ActionButton>
  );
}

// A panel over the feed: from the bottom on a phone, from the right on a wide screen. Its title takes the focus when it
// opens, so the arrow keys never scroll the feed behind it from the button that opened it. The title holds none of the
// panel's text, so a click on that text still lets the arrow keys scroll it. A viewer who opened the panel from the
// keyboard gets the focus back on that button when it closes; after a tap or click the focus stays on the page, so
// the space bar plays and pauses the video again.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible") ? document.activeElement : null;
    heading.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-end bg-black/40 sm:items-stretch" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex h-[75dvh] w-full flex-col rounded-t-2xl border border-rule bg-bg sm:h-full sm:w-[440px] sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4">
          <h2 ref={heading} tabIndex={-1} className="line-clamp-1 font-serif text-xl outline-none">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-surface">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

function Comments({ slug, viewer, comments, onAdded }: { slug: string; viewer: string | null; comments: FeedComment[]; onAdded: (comment: FeedComment) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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

  return (
    <div className="flex flex-col">
      <form onSubmit={(event) => void submit(event)} className="sticky top-0 z-10 flex flex-col gap-2 border-b border-rule bg-bg py-4">
        <label className="text-sm text-muted" htmlFor="comment">
          Commenting as <span className="font-medium text-fg">{viewer ? viewerName(viewer) : "…"}</span>, no account needed.
        </label>
        <textarea
          id="comment"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={COMMENT_CHARS}
          rows={3}
          placeholder="What did you think?"
          className="resize-none rounded-xl border border-rule bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-fg"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-muted">
            {text.length}/{COMMENT_CHARS}
          </span>
          <button
            type="submit"
            disabled={sending || text.trim().length === 0}
            className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-85 disabled:opacity-40"
          >
            {sending ? "Posting…" : "Post comment"}
          </button>
        </div>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
        <p className="text-xs text-muted">Comments are from viewers. Unlike the videos, they are not fact-checked.</p>
      </form>
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
    </div>
  );
}

// The fact-check behind a video in the feed, with its sources, following the video as it plays.
function FactCheckSheet({ video, player }: { video?: SavedVideo; player: PlayerRef | null }) {
  const [tab, setTab] = useState<"factcheck" | "sources">("factcheck");
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const spans = useMemo(() => (video ? sentenceSpans(video.storyboard, video.voice, video.report.checks) : []), [video]);
  useEffect(() => {
    if (!player || spans.length === 0) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => setActiveSentence(spans.findLast((span) => span.startFrame <= detail.frame)?.sentenceId ?? null);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [player, spans]);
  if (!video) return <p className="py-6 text-sm text-muted">Loading…</p>;
  return (
    <div className="flex flex-col">
      <div role="tablist" className="sticky top-0 z-10 flex gap-6 border-b border-rule bg-bg pt-3">
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
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium ${tab === id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
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
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden className={filled ? "text-bad" : ""}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16v11H9l-5 4V5Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}
function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}
function MutedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </svg>
  );
}
