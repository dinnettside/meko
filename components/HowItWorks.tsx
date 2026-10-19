// How Meko keeps a video honest, in three steps, and what it is made with.
const STEPS = [
  {
    title: "Every fact has a quote",
    text: "Meko reads sources on the web and copies the exact words that state each fact. The code checks that those words are really there.",
  },
  {
    title: "Every claim is checked",
    text: "Each sentence of the script is split into its claims and checked against those words, twice. A claim that does not hold is rewritten or removed.",
  },
  {
    title: "You can see it all",
    text: "Next to the video are the sources, the verdict and the quotes for every sentence. The sentence being spoken is marked as the video plays.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mt-20 scroll-mt-8 border-t border-rule pt-10">
      <h2 className="font-serif text-2xl sm:text-3xl">How Meko keeps it honest</h2>
      <ol className="mt-8 grid gap-10 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="font-serif text-5xl leading-none text-muted">{index + 1}</span>
            <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-muted">
        Made with NVIDIA Nemotron 3 Ultra and Nemotron 3.5 Lightning on Nebius Token Factory, which research, write, check and direct each video,
        Tavily for web search and ElevenLabs for the voice. Maps, diagrams and icons are drawn in code, with no stock footage
        or music.
      </p>
    </section>
  );
}
