import Image from "next/image";
import type { ExampleMeta } from "@/lib/example";

const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Finished videos made by Meko, each with a frame from it, its length and how its fact-check went. They play at once,
// without the demo code.
export function Gallery({ examples, onWatch, disabled }: { examples: ExampleMeta[]; onWatch: (slug: string) => void; disabled: boolean }) {
  return (
    <section id="examples" className="mt-20 scroll-mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-3">
        <h2 className="font-serif text-2xl sm:text-3xl">Finished videos</h2>
        <p className="text-sm text-muted">Made by Meko. They play without a code.</p>
      </div>
      <ul className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {examples.map((example) => (
          <li key={example.slug}>
            <button type="button" onClick={() => onWatch(example.slug)} disabled={disabled} className="group w-full text-left disabled:opacity-60">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-rule bg-surface">
                <Image
                  src={`/examples/${example.slug}.jpg`}
                  alt=""
                  width={640}
                  height={360}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">{duration(example.seconds)}</span>
              </div>
              <h3 className="mt-3 font-serif text-lg leading-snug group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                {example.topic}
              </h3>
              <p className="mt-1 font-mono text-xs text-muted">
                {example.sources} sources · {example.supported} of {example.sentences} sentences supported
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
