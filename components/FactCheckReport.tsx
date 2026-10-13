"use client";

import { useEffect, useRef } from "react";
import type { FactCheckReport as Report, ResearchFact, SentenceCheck } from "@/lib/pipeline";
import type { Source } from "@/lib/storyboard";

const STATUS = {
  supported: { label: "Supported", className: "text-teal" },
  revised: { label: "Revised", className: "text-signal" },
  removed: { label: "Removed", className: "text-alert" },
};

type Props = {
  report: Report;
  facts: ResearchFact[];
  sources: Source[]; // every source research read
  numbered: Source[]; // the sources listed next to the video, in that order
  activeSentenceId: string | null; // the sentence being spoken right now
  onSelect: (sentenceId: string) => void; // jump the video to this sentence
};

// Every sentence of the narration with its fact-check result and the quotes and sources behind it.
// The sentence being spoken is marked, and clicking a sentence plays the video from there.
export function FactCheckReport({ report, facts, sources, numbered, activeSentenceId, onSelect }: Props) {
  const panel = useRef<HTMLOListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const factById = new Map(facts.map((fact) => [fact.id, fact]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const numberOf = new Map(numbered.map((source, index) => [source.id, index + 1]));

  // Keep the spoken sentence in view inside the panel, without scrolling the page.
  useEffect(() => {
    const row = activeSentenceId ? rows.current.get(activeSentenceId) : undefined;
    const list = panel.current;
    if (!row || !list) return;
    const above = row.offsetTop < list.scrollTop;
    const below = row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight;
    if (above || below) list.scrollTo({ top: row.offsetTop - 16, behavior: "smooth" });
  }, [activeSentenceId]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col break-words">
      <h2 className="font-display text-2xl font-bold">Fact-check</h2>
      <p className="mt-1 text-sm text-dim">
        Each sentence was checked against the exact words in its sources.{" "}
        <span className="text-teal">{report.supported} supported</span>,{" "}
        <span className="text-signal">{report.revised} revised</span>,{" "}
        <span className="text-alert">{report.removed} removed</span>.
      </p>
      <ol ref={panel} className="relative mt-4 flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-2">
        {report.checks.map((check) => (
          <li
            key={check.sentenceId}
            ref={(element) => {
              if (element) rows.current.set(check.sentenceId, element);
            }}
            className={`border-l-4 py-1 pl-4 transition-colors ${
              check.sentenceId === activeSentenceId ? "border-signal" : "border-line"
            }`}
          >
            <SentenceRow
              check={check}
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
  factById,
  sourceById,
  numberOf,
  onSelect,
}: {
  check: SentenceCheck;
  factById: Map<string, ResearchFact>;
  sourceById: Map<string, Source>;
  numberOf: Map<string, number>;
  onSelect: (sentenceId: string) => void;
}) {
  const status = STATUS[check.status];
  const cited = check.factIds.flatMap((id) => factById.get(id) ?? []);
  const sourceIds = [...new Set(cited.map((fact) => fact.sourceId))];
  return (
    <>
      <p className={`text-xs font-semibold ${status.className}`}>{status.label}</p>
      {check.status === "removed" ? (
        <p className="text-dim line-through">{check.original}</p>
      ) : (
        <button type="button" onClick={() => onSelect(check.sentenceId)} className="text-left hover:underline">
          {check.status === "revised" ? check.revised : check.original}
        </button>
      )}
      {check.status === "revised" ? <p className="mt-1 text-sm text-dim line-through">{check.original}</p> : null}
      {check.reason ? <p className="mt-1 text-sm text-dim">{check.reason}</p> : null}
      <details className="mt-1 text-sm text-dim">
        <summary className="cursor-pointer">
          Sources{" "}
          {sourceIds.map((id) => {
            const source = sourceById.get(id);
            const number = numberOf.get(id);
            return source ? (
              <a
                key={id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-1 underline decoration-line underline-offset-2 hover:decoration-signal"
              >
                {number ? `[${number}]` : source.title}
              </a>
            ) : null;
          })}
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {cited.map((fact) => (
            <li key={fact.id}>
              “{fact.quote}” <span className="text-dim/70">({sourceById.get(fact.sourceId)?.title ?? "source"})</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
