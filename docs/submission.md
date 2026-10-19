# Submission notes

Drafts for the Devpost submission: the project story, the testing instructions and the script for the demo video.
Numbers come from `docs/eval.md`.

## Project story

### Inspiration

Explainer videos are how many people learn something new, but you can rarely check them. You cannot see where a claim
comes from, and AI-made videos make that worse: they sound sure of everything. We wanted explainer videos you can
check, made in about a minute.

### What it does

You type a topic, an audience and a length, like "The French Revolution, high school, 90 seconds". Meko researches the
topic on the web, writes a short narration where every sentence cites facts quoted from their sources, fact-checks
every claim against those quotes, and directs each scene as an animated map, chart, timeline or diagram. The video
plays right away in the browser, with a voice-over and captions. Next to it is the fact-check: every sentence marked
supported, rewritten or removed, with the source words behind it and links to the sources. The sentence being spoken is
marked as the video plays.

A feed of videos made by Meko lets anyone scroll through them, open the fact-check of each, and like or comment without
an account. Finished videos are saved, so the same request plays again at once, for free.

### How we built it

- **An agent in five steps.** Next.js API routes for research, script, fact-check, direction and voice; the browser
  calls them in order and shows each step's progress.
- **NVIDIA Nemotron on Nebius Token Factory.** Nemotron 3 Ultra plans the searches, writes the script, fact-checks it
  and directs every scene. Nemotron 3.5 Lightning, at about 6 % of Ultra's price, pulls facts with quotes out of each
  source page, many calls at once. All calls use strict JSON schemas, with thinking off, through the OpenAI SDK.
- **Tavily** runs 3 to 6 searches per video in parallel with advanced depth, preferring encyclopedias, museums and
  public bodies and leaving out homework and essay sites, and a second round fills gaps the model finds.
- **Checks in code at every step.** A fact counts only if its quote is found word for word in the source. Every number,
  date, label and place on screen must come from the narration or the facts. A second, separate call checks where every
  place on a map is. Words on screen must keep the narration's hedges.
- **Video in the browser.** The director writes a storyboard as JSON, and Remotion plays it. Everything is drawn in
  code: maps from Natural Earth, three visual themes, more than 30 animated diagrams (a volcano, the heart, a neural
  network, a wing), a kit of pictures for any topic, 266 icons and soft sound effects. ElevenLabs reads the narration,
  and its word timings drive the captions and the animation.
- **Vercel and Vercel Blob** host the app and the library of finished videos.

### Challenges we ran into

- **Models invent.** Ultra copied quotes that were not in the source and took years from its own memory. Now a fact
  without a word-for-word quote is thrown away, and a timeline may only use years its facts state.
- **Fact-checks miss links and hedges.** "After the city fell, its population crashed" passed, although the source only
  gives the population "by" that year. "The plague helped end feudalism" passed against a source that says it "might
  have". The code now spells out every link as its own claim, runs two checks side by side and keeps the stricter one,
  and the prompt treats certainty as a claim.
- **Language models are bad at geometry.** Asked to draw diagrams, the model stacked labels in one column. Now it only
  says what is in a picture, and the code lays it out.
- **Confident place errors.** The director put the medieval port of Caffa in Georgia, more than once in the same video.
  A separate call that only asks where each place is catches it.

### Accomplishments that we're proud of

- Everything on screen can be traced to a source: every number, date, label, place and quote.
- A video takes about a minute and costs cents to make (see `docs/eval.md`), and watching it again costs nothing.
- Videos do not look alike: the look, the opening and the kind of picture for each scene follow the topic.

### What we learned

- Small, strict checks in code do more than long prompts. The model is good at words; the code is good at rules.
- Two models work better than one: Lightning for many small calls, Ultra where reasoning matters.
- Showing the fact-check builds more trust than hiding the rewrites: "4 sentences rewritten to match the sources" is a
  feature.

### What's next for Meko

MP4 export, more languages, historical borders on maps, a public feed of every video with moderation, and a classroom
mode where a teacher picks the sources.

### Built with

Next.js, TypeScript, Tailwind CSS, Remotion, NVIDIA Nemotron 3 Ultra, NVIDIA Nemotron 3.5 Lightning, Nebius Token
Factory, Tavily, ElevenLabs, Vercel, Vercel Blob, zod, d3-geo, Natural Earth.

## Testing instructions

1. Open https://meko-kappa.vercel.app.
2. Choose **Watch** to scroll through videos Meko made. Open **Fact-check** under a video to see each sentence with the
   source words behind it, and click a sentence to play the video from there.
3. To make a video, go back to the start page, type a topic, pick an audience and a length, and choose **Make video**.
   Enter the demo code when asked: _(put the code here in Devpost's testing instructions, never in the repository)_.
   It takes about a minute. A topic someone already made, with the same audience and length, plays at once from the
   library.

## Demo video script (under 3 minutes)

| Time | Picture | Voice |
| --- | --- | --- |
| 0:00 | The start page | "AI can make a video about anything. But can you trust what it says?" |
| 0:10 | Type a topic, choose Make video | "Meko makes short explainer videos you can check. I ask for how airplanes fly, for high school, in about a minute." |
| 0:20 | The progress steps | "An agent built on NVIDIA Nemotron, on Nebius Token Factory, plans searches and Tavily runs them. Nemotron pulls out facts, each with the exact words from its source, writes the script and fact-checks every claim." |
| 0:45 | The video plays | "About a minute later the video plays. Every picture is drawn in code: the wing, the forces, the captions that follow the voice." |
| 1:15 | The fact-check report, click a sentence | "Next to it, every sentence with the source words behind it. Click one and the video jumps there." |
| 1:35 | The feed, open the Black Death fact-check | "In the feed, here is the Black Death. Four sentences were rewritten, because the sources only say the plague might have ended feudalism. Meko says what its sources say, no more." |
| 2:00 | Like, comment, search | "Anyone can watch, like and comment, without an account." |
| 2:15 | README section on checks, or a slide | "Under the hood: Nemotron 3 Ultra for reasoning, Lightning for the many small calls, and checks in code for every number, place and label on screen." |
| 2:40 | The start page | "Meko. Explainer videos you can check. The code is open source under the MIT license." |
