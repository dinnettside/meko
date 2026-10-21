"use client";

import type { PlayerRef } from "@remotion/player";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { checkedLine } from "@/lib/example";
import type { FeedItem } from "@/lib/example";
import { viewerName } from "@/lib/names";
import type { FeedComment, VideoSocial } from "@/lib/social";
import { sceneSites } from "@/remotion/sites";
import { FactCheckReport } from "./FactCheckReport";
import { loadSavedVideo } from "./saved-video";
import type { SavedVideo } from "./saved-video";
import { sentenceSpans } from "./sentence-timing";
import { ThemeToggle } from "./ThemeToggle";

// The feed: videos made by Meko, one per screen, played as they scroll into view, with likes and comments without an
// account, the fact-check behind each one, and a search through all of them.

// The player and the whole video, with its scenes, drawings and maps, load only when a video is shown, so the page
// itself opens fast on a phone.
const StoryboardPlayer = dynamic(() => import("./StoryboardPlayer").then((module) => module.StoryboardPlayer), {
  ssr: false,
  loading: () => <div className="aspect-video w-full bg-black" />,
});

const VIEWER_KEY = "meko-viewer";
const COMMENT_CHARS = 280;

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
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => words.every((word) => item.searchText.includes(word)));
  }, [items, query]);
  const [activeSlug, setActiveSlug] = useState<string | null>(items[0]?.slug ?? null);
  const active = Math.max(0, visible.findIndex((item) => item.slug === activeSlug));
  const [videos, setVideos] = useState<Record<string, SavedVideo>>({});
  const [social, setSocial] = useState<Record<string, VideoSocial>>({});
  // The open panel, with the player of its video, taken when the panel opens.
  const [sheet, setSheet] = useState<{ slug: string; kind: "comments" | "factcheck"; player: PlayerRef | null } | null>(null);
  // Sound needs a tap first. After the first video is started by hand, the next ones play as they come into view.
  const [started, setStarted] = useState(false);
  const scroller = useRef<HTMLElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const players = useRef(new Map<string, PlayerRef>());
  // How to take each player's listeners off again, by slug.
  const unlisten = useRef(new Map<string, () => void>());

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

  // The active video and its neighbours are loaded, so scrolling never waits.
  const nearby = useMemo(() => visible.slice(Math.max(0, active - 1), active + 2).map((item) => item.slug), [visible, active]);
  useEffect(() => {
    for (const slug of nearby) {
      if (videos[slug]) continue;
      void loadSavedVideo(slug)
        .then((video) => setVideos((current) => ({ ...current, [slug]: video })))
        .catch(() => {});
    }
  }, [nearby, videos]);

  // A link with #slug opens at that video, which then becomes the active one as it comes into view. This effect must
  // stay above the next one, which writes the active video into the address: effects run in order, so the link is read
  // before it is replaced.
  useEffect(() => {
    const wanted = decodeURIComponent(window.location.hash.slice(1));
    if (wanted && sections.current.has(wanted)) sections.current.get(wanted)?.scrollIntoView();
  }, []);

  // Only the active video plays; the others pause. The address follows the active video.
  useEffect(() => {
    players.current.forEach((player, slug) => {
      if (slug !== activeSlug) player.pause();
      else if (started) player.play();
    });
    if (activeSlug && window.location.hash !== `#${activeSlug}`) window.history.replaceState(null, "", `#${activeSlug}`);
  }, [activeSlug, started, videos]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const item = visible[Math.min(visible.length - 1, Math.max(0, index))];
      if (item) sections.current.get(item.slug)?.scrollIntoView({ behavior: "smooth" });
    },
    [visible],
  );

  // Arrow keys and j/k move between videos, unless the viewer is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        scrollToIndex(active + 1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        scrollToIndex(active - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scrollToIndex]);

  // A video's player is handed up once it has loaded, and handed back (null) when it goes. Its listeners come off with
  // it, and when the list of videos shown changes, since they read that list.
  const registerPlayer = useCallback(
    (slug: string, player: PlayerRef | null) => {
      unlisten.current.get(slug)?.();
      unlisten.current.delete(slug);
      players.current.delete(slug);
      if (!player) return;
      players.current.set(slug, player);
      const onPlay = () => setStarted(true);
      // At the end, the next video comes up, like turning a page.
      const onEnded = () => {
        const index = visible.findIndex((item) => item.slug === slug);
        if (index >= 0 && index < visible.length - 1) scrollToIndex(index + 1);
      };
      player.addEventListener("play", onPlay);
      player.addEventListener("ended", onEnded);
      unlisten.current.set(slug, () => {
        player.removeEventListener("play", onPlay);
        player.removeEventListener("ended", onEnded);
      });
    },
    [visible, scrollToIndex],
  );

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

  const sheetItem = sheet ? items.find((item) => item.slug === sheet.slug) : undefined;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="z-20 border-b border-rule bg-bg">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
            Meko
          </Link>
          <label className="relative ml-2 flex-1">
            <span className="sr-only">Search the videos</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                scroller.current?.scrollTo({ top: 0 });
              }}
              placeholder="Search the videos"
              className="w-full rounded-full border border-rule bg-surface px-4 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-fg"
            />
          </label>
          <Link href="/" className="hidden rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-85 sm:block">
            Make a video
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main ref={scroller} className="flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        <h1 className="sr-only">Videos made by Meko</h1>
        {visible.length === 0 ? (
          <p className="mx-auto max-w-md px-6 py-24 text-center text-muted">No video matches “{query}”. Try another word, or make a video about it.</p>
        ) : null}
        {visible.map((item, index) => {
          const video = videos[item.slug];
          const near = Math.abs(index - active) <= 1;
          const counts = social[item.slug];
          return (
            <section
              key={item.slug}
              data-slug={item.slug}
              ref={(element) => {
                if (element) sections.current.set(item.slug, element);
                else sections.current.delete(item.slug);
              }}
              className="flex h-full snap-start snap-always items-center justify-center px-4 py-5 sm:px-6"
            >
              <article className="flex w-full max-w-4xl flex-col gap-4">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-rule bg-black">
                  {near && video ? (
                    <FeedPlayer slug={item.slug} video={video} onPlayer={registerPlayer} />
                  ) : (
                    <Image src={`/examples/${item.slug}.jpg`} alt="" fill unoptimized className="object-cover opacity-80" />
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 sm:flex-1">
                    <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{item.title}</h2>
                    <p className="mt-1.5 font-mono text-xs text-muted">
                      {duration(item.seconds)} · {item.sources} sources · {checkedLine(item)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Made once in {Math.round(item.ms / 1000)} s for ${item.costUsd.toFixed(2)}; every view after that is free.{" "}
                      {item.domains.length > 0 ? <span>Sources include {item.domains.join(", ")}.</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <ActionButton label={counts?.liked ? "Unlike" : "Like"} pressed={counts?.liked} onClick={() => void toggleLike(item.slug)} count={counts?.likes ?? 0}>
                      <HeartIcon filled={Boolean(counts?.liked)} />
                    </ActionButton>
                    <ActionButton label="Comments" onClick={() => setSheet({ slug: item.slug, kind: "comments", player: null })} count={counts?.comments.length ?? 0}>
                      <CommentIcon />
                    </ActionButton>
                    <ActionButton
                      label="Fact-check"
                      onClick={() => setSheet({ slug: item.slug, kind: "factcheck", player: players.current.get(item.slug) ?? null })}
                      text="Fact-check"
                    >
                      <CheckIcon />
                    </ActionButton>
                    <ShareButton slug={item.slug} />
                  </div>
                </div>
              </article>
            </section>
          );
        })}
      </main>

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
            <FactCheckSheet video={videos[sheet.slug]} player={sheet.player} />
          )}
        </Sheet>
      ) : null}
    </div>
  );
}

// One video in the feed. It hands its player up, so the feed can play the one on screen and pause the rest, and the
// fact-check can play it from a sentence. The player loads after this mounts (see StoryboardPlayer above), so a callback
// ref hands it up when it arrives; an effect here would run too early and hand up nothing.
function FeedPlayer({ slug, video, onPlayer }: { slug: string; video: SavedVideo; onPlayer: (slug: string, player: PlayerRef | null) => void }) {
  const playerRef = useCallback((player: PlayerRef | null) => onPlayer(slug, player), [slug, onPlayer]);
  const sites = useMemo(() => sceneSites(video.storyboard, video.facts), [video]);
  return <StoryboardPlayer storyboard={video.storyboard} voice={video.voice} sites={sites} checks={video.report} playerRef={playerRef} />;
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
      className="flex h-10 items-center gap-1.5 rounded-full border border-rule px-3.5 text-sm text-fg transition-colors hover:bg-surface"
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

// A panel over the feed: from the bottom on a phone, from the right on a wide screen.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
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
          <h2 className="line-clamp-1 font-serif text-xl">{title}</h2>
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
