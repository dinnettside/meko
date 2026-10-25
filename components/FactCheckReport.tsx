"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { FactCheckReport as Report, ResearchFact, SentenceCheck } from "@/lib/pipeline";
import type { Source } from "@/lib/storyboard";

const STATUS = {
  supported: { label: "Supported", className: "text-ok" },
  revised: { label: "Revised", className: "text-warn" },
  removed: { label: "Removed", className: "text-bad" },
};

type Props = {
  report: Report;
  facts: ResearchFact[];
  sources: Source[]; // every source research read
  numbered: Source[]; // the sources listed next to the video, in that order
  activeSentenceId: string | null; // the sentence being spoken right now
  onSelect: (sentenceId: string) => void; // jump the video to this sentence
  scroller?: RefObject<HTMLElement | null>; // the panel that scrolls the list, when the list does not scroll on its own
};

// Every sentence of the narration with its fact-check result, read like a transcript with footnotes: the numbers point
// to the sources, and the quotes behind each sentence open under it. The sentence being spoken is marked with the
// highlighter, and clicking a sentence plays the video from there.
export function FactCheckReport({ report, facts, sources, numbered, activeSentenceId, onSelect, scroller }: Props) {
  const panel = useRef<HTMLOListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const factById = new Map(facts.map((fact) => [fact.id, fact]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const numberOf = new Map(numbered.map((source, index) => [source.id, index + 1]));

  // Keep the spoken sentence in view inside the list, or the panel that scrolls it, without scrolling the page. What
  // the panel keeps at its top, like tabs, is its scroll padding.
  useEffect(() => {
    const row = activeSentenceId ? rows.current.get(activeSentenceId) : undefined;
    const box = scroller?.current ?? panel.current;
    if (!row || !box) return;
    const view = box.getBoundingClientRect();
    const top = view.top + (parseFloat(getComputedStyle(box).scrollPaddingTop) || 0);
    const at = row.getBoundingClientRect();
    if (at.top < top || at.bottom > view.bottom) box.scrollTo({ top: box.scrollTop + at.top - top - 16, behavior: "smooth" });
  }, [activeSentenceId, scroller]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col break-words">
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Each sentence was checked against the exact words in its sources:{" "}
        <span className="text-ok">{report.supported} supported</span>, <span className="text-warn">{report.revised} revised</span>,{" "}
        <span className="text-bad">{report.removed} removed</span>. Click a sentence to hear it.
      </p>
      <ol ref={panel} className={`relative mt-4 flex flex-col ${scroller ? "" : "max-h-[68vh] overflow-y-auto pr-2"}`}>
        {report.checks.map((check) => (
          <li
            key={check.sentenceId}
            ref={(element) => {
              if (element) rows.current.set(check.sentenceId, element);
            }}
            className="border-b border-rule py-4 last:border-b-0"
          >
            <SentenceRow
              check={check}
              active={check.sentenceId === activeSentenceId}
              factById={factById}
              sourceById={sourceById}
              numberOf={numberOf}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function SentenceRow({
  check,
  active,
  factById,
  sourceById,
  numberOf,
  onSelect,
}: {
  check: SentenceCheck;
  active: boolean;
  factById: Map<string, ResearchFact>;
  sourceById: Map<string, Source>;
  numberOf: Map<string, number>;
  onSelect: (sentenceId: string) => void;
}) {
  const status = STATUS[check.status];
  const cited = check.factIds.flatMap((id) => factById.get(id) ?? []);
  const sourceIds = [...new Set(cited.map((fact) => fact.sourceId))];
  const text = check.status === "revised" ? check.revised : check.original;
  return (
    <>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${status.className}`}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {status.label}
      </p>
      {check.status === "removed" ? (
        <p className="mt-1 font-serif text-lg leading-snug text-muted line-through">{check.original}</p>
      ) : (
        <p className="mt-1 font-serif text-lg leading-snug">
          {/* A span, not a button, so the footnote numbers follow the last word on its line; a button always breaks as a
              block. The highlighter is dark text on yellow, in both modes. */}
          <span
            role="button"
            tabIndex={0}
            onClick={() => onSelect(check.sentenceId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(check.sentenceId);
              }
            }}
            className={`cursor-pointer box-decoration-clone rounded-sm px-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg ${
              active ? "bg-mark text-[#111111]" : "hover:bg-surface"
            }`}
          >
            {text}
          </span>
          {/* Footnotes with a comma between them, so 5 and 1 never read as 51. */}
          {sourceIds
            .flatMap((id) => {
              const source = sourceById.get(id);
              return source ? [{ id, source, number: numberOf.get(id) }] : [];
            })
            .map(({ id, source, number }, index) => (
              <span key={id} className="align-super font-mono text-xs text-muted">
                {index === 0 ? <span className="ml-0.5" /> : ","}
                <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className="hover:text-fg">
                  {number ?? "↗"}
                </a>
              </span>
            ))}
        </p>
      )}
      {check.status === "revised" ? <p className="mt-1 text-sm text-muted line-through">{check.original}</p> : null}
      {check.reason ? <p className="mt-1 text-sm text-muted">{check.reason}</p> : null}
      {cited.length > 0 ? (
        <details className="mt-2 text-sm text-muted">
          <summary className="-my-3 cursor-pointer select-none py-3 hover:text-fg">Show the source words</summary>
          <ul className="mt-2 flex flex-col gap-2 border-l-2 border-rule pl-3">
            {cited.map((fact) => (
              <li key={fact.id} className="font-serif text-base italic leading-snug">
                “{fact.quote}” <span className="font-sans text-xs not-italic text-muted">{sourceById.get(fact.sourceId)?.title ?? "source"}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
