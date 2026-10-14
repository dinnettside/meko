# Meko

Meko turns a topic into a short, fact-checked, animated explainer video in under a minute.

You type a topic, an audience and a length, for example "The French Revolution, high school, 90 seconds". An agent researches the topic on the web, writes a narration where every sentence cites its sources, fact-checks that narration against the exact words of those sources, and directs each scene as an animated map, timeline, chart, quote, list or chain of causes. The video plays right away in the browser, with a voice-over, the sources and a sentence-by-sentence fact-check report next to it.

The point: explainer videos people can trust, made in under a minute.

Meko is built for the Nebius x NVIDIA Global AI Hackathon (track: Best Apps and Agents). Every video is made by NVIDIA Nemotron, served by Nebius Token Factory.

## Why you can trust a Meko video

The language model writes and checks everything, but plain code checks the model at every step:

- **Every fact has a quote.** When Meko reads a source, the model must copy the exact words that state each fact. The server looks for that quote in the source text and throws the fact away if it is not there, so the model cannot invent facts.
- **Every sentence cites facts.** The script must name the facts behind each sentence. Unknown fact IDs send the script back for another try.
- **Every claim is checked.** The fact-check splits each sentence into its separate claims (people, numbers, dates, places, causes) and judges each one only against the quotes of the cited facts. Links count as claims too: two true facts joined by a false "after" or "because" make a false sentence, so the code spells out each link for the model to judge. Two checks run side by side and the stricter verdict counts. A sentence with an unsupported claim is rewritten or removed, and the code makes sure it can never be marked as supported.
- **The narration is not touched again.** The director only chooses what is shown on screen. The voice reads the fact-checked text word for word.
- **What is on screen is checked too.** Numbers on screen must appear in the narration or the cited facts, and labels must use their words; a one-word answer like "Yes" or "No" on a scoreboard must be one of them too. A number the sources give as a range ("25 to 50 million") is shown as the whole range, with the uncertain part drawn as an outline. Each bar on a chart needs a sentence in the scene that gives that number for that thing. Each event on a timeline names the fact that states its year (and its date, for events in the same year), and the code checks that they are in it; a period drawn under the events must be one a fact states, like "ruled from 1451 to 1481". A quote must be a whole sentence copied word for word from a source, never a shortened one. Each city on a map comes with its coordinates and the country it lies in, and the code checks that the point is inside that country's borders and asks the model a second time where the city is. A country cannot carry the name of a region it is not in, and an arrow labeled "eastward" must point east, which it may only say when the narration does. A video that is not about places, and a scene about space, gets no map. Dots that show a number as part of a whole need the narration to say exactly that, a chart cannot compare dates or one amount in two units, and a number in a name (Apollo 11) is never shown as an amount.
- **You can see all of it.** Every scene names the sites its facts come from in a corner of the video, and the video ends with credits that list every source and the result of the fact-check. When a scene quotes a source, a marker sweeps over the source's words while the claim is spoken, and a stamp says it was checked against the source. Next to the video, the fact-check report lists every sentence as supported, revised or removed, with the reason, the quotes and links to the sources. The sentence being spoken is marked as the video plays, and clicking a sentence plays the video from there.

## How it works

The browser calls five API routes in order and shows live progress for each:

1. **Research** (`/api/research`). Nemotron plans 3 to 6 web searches. [Tavily](https://tavily.com) runs them in parallel, preferring encyclopedias, museums and public bodies and leaving out homework-help, essay and Q&A sites. Meko picks the best new page for each search, and Nemotron extracts up to 6 facts from each page, with quotes, all at once. If the model finds an important gap, there is one more round of searches.
2. **Script** (`/api/script`). Nemotron writes the narration, split into short scenes, with the fact IDs behind every sentence, and the question the video answers, which opens the video on the title card. The length follows the voice's measured pace of about 15 characters per second.
3. **Fact-check** (`/api/factcheck`). Nemotron checks every claim in every sentence against the quotes, twice at the same time, and the stricter verdict counts. Sentences are kept, revised or removed.
4. **Direct** (`/api/direct`). One Nemotron call ranks the kinds of picture that fit each scene, and the code picks a varied order from them, using only kinds the facts have data for: no timeline without years, no chart without numbers, and no maps in a video that names no countries or regions. Then every scene is directed in its own small call, all in parallel. A scene becomes a map, a timeline (with periods like a dynasty drawn as bands), a big number, a bar chart, a quote, a chain of causes, a row of cards for things of one kind (types, goods, people), a scoreboard that compares two sides point by point, an old name struck out and replaced by the new one, or a few lines of text that land word by word.
5. **Voice** (`/api/voice`). [ElevenLabs](https://elevenlabs.io) reads each scene, with the text before and after for a natural flow. Its word timings set the length of each scene, drive captions that light up word by word, and time the pictures: a country lights up, a city appears or an arrow draws as the voice names it. A scene that names a year shows it in the corner. When two maps follow each other, the camera flies from one to the next, and a video with maps that would end on plain text ends on a map of every place it showed instead.

The result is a storyboard (plain JSON, see `lib/storyboard.ts`) that [Remotion](https://www.remotion.dev) plays in the browser. All visuals are drawn in code: no stock footage, images or music.

A 90-second video takes about 35 seconds to make and costs about $0.09 in Token Factory calls. On 10 test topics, every video finished and 91% of the sentences were supported as written (see `docs/eval.md`).

## How Meko uses Nemotron and Token Factory

- **Model.** `nvidia/Nemotron-3-Ultra-550b-a55b` on Nebius Token Factory, called with the `openai` SDK through Token Factory's OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`). We picked it with `scripts/check-models.ts`, which tested the four Nemotron models on Token Factory for strict JSON, tool calling, speed and price. Ultra was the only one that got every storyboard right. See `docs/model-check.md`.
- **Thinking off.** Every call sends `chat_template_kwargs: { enable_thinking: false }`. In our tests, thinking made calls 2 to 10 times slower and never gave better results for these tasks, not even for the fact-check (see `FEEDBACK.md`).
- **Strict structured output.** Every call uses `response_format: { type: "json_schema", strict: true }` with a schema built from zod. Token Factory enforces list limits like `maxItems` from the schema (we tested it), which Meko uses to stop runaway lists. The reply is validated again with zod.
- **Checks and retries.** If a reply breaks a rule that a schema cannot express (an unknown fact ID, a number that is not in the sources, a city in the wrong country), the problems go back to the model, at most twice. If a scene's direction still breaks a rule after that, its broken parts are dropped instead of failing the whole video. If any other step fails, the app explains why and can try again from that step.
- **Speed.** Fact extraction and scene direction run as many small calls in parallel. Every call has a timeout and a token cap, and every step stops retrying in time to stay within its route's time limit.
- **Cost tracking.** Every call logs tokens, latency and cost, and the app shows the cost of each video.

What was confusing, slow or broken along the way is written down in `FEEDBACK.md`.

## Setup

You need Node.js 22.18 or newer and npm.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is gitignored, so your keys stay on your machine.

   | Name | What it is |
   | --- | --- |
   | `NEBIUS_API_KEY` | API key for Nebius Token Factory |
   | `NEBIUS_MODEL` | The model ID, `nvidia/Nemotron-3-Ultra-550b-a55b` |
   | `TAVILY_API_KEY` | API key for Tavily web search. Without it, Meko uses Tavily's free keyless mode, which has a low hourly limit and is only meant for development |
   | `ELEVENLABS_API_KEY` | API key for ElevenLabs text-to-speech. Without it, videos play silently with captions |
   | `ELEVENLABS_VOICE_ID` | The ElevenLabs voice. Meko uses the default voice George, `JBFqnCBsd6RMkjVDRZzb` |
   | `DEMO_CODE` | Needed on Vercel: making a video asks for this code, so strangers cannot spend your API credits. Without it, the deployed app makes no new videos. Use a long random code. Leave it empty locally |

3. Start the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

   To see finished videos without any API keys, pick one of the examples under the form, or open http://localhost:3000/?example=black-death.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on http://localhost:3000 |
| `npm run build` | Builds the app for production |
| `npm run start` | Serves the production build |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Generates route types and runs the TypeScript compiler |
| `npm run eval -- 2` | Makes videos for the first 2 of 10 test topics and writes `docs/eval.md`. Leave out the number to run all 10. Needs the app running and makes paid API calls |
| `npm run make-example -- black-death` | Remakes one example video in `public/examples` (the slugs are in `lib/example.ts`). Needs the app running and makes paid API calls |
| `npm run check-models` | Tests the NVIDIA models on Token Factory and writes `docs/model-check.md`. Makes paid API calls, capped at 1 USD |

## Deploy

Meko runs on [Vercel](https://vercel.com) with no extra configuration:

1. In Vercel, choose Add New, then Project, and import the GitHub repository.
2. Add the environment variables from the table above, including `DEMO_CODE`. The example video plays for everyone; making a new video asks for the code. A long random code is what stops people from guessing it, and a rate-limit rule on `/api/*` in the Vercel Firewall adds more protection. If you add or change a variable later, deploy again, since Vercel only applies it to new deployments.
3. Deploy. Every push to `main` deploys again.

Each API route sets its own `maxDuration`, at most 180 seconds, which is within Vercel's 300-second limit on every plan.

## Project structure

| Folder | What is in it |
| --- | --- |
| `app/` | The page and the five API routes |
| `components/` | The topic form, the player and the fact-check report |
| `lib/` | One file per pipeline step, the Token Factory, Tavily and ElevenLabs clients, the storyboard contract and the theme |
| `lib/prompts/` | One file per prompt |
| `remotion/` | The video: scenes for titles, text, maps and timelines, and the captions |
| `scripts/` | The model check, the eval and the example maker |
| `docs/` | The model check and eval reports |

All colors, fonts, sizes and timings are in `lib/theme.ts`.

## Known limitations

- Maps use today's borders, from Natural Earth via world-atlas. Historical borders are out of scope, so a map about the Roman Empire shows modern countries. Crimea is drawn as part of Ukraine, following the borders the UN recognizes. Antarctica is left off the maps.
- Maps show countries and cities, not streets, so a story that happens inside one city (like the fall of the Berlin Wall) gets simple maps.
- Topics without places, like how vaccines work, get no maps and more plain text scenes.
- Meko trusts its sources. It checks that the narration matches what the sources say, not whether the sources are right. The source list is there so you can judge them.
- Norwegian output is not supported yet. The models we tested write weak Norwegian.
- Videos play in the browser. There is no MP4 export yet.

## Credits and license

Meko's own code is MIT licensed, see [LICENSE](LICENSE).

- [Remotion](https://www.remotion.dev) plays the videos. Remotion is not MIT licensed. It has its own license, which is free for individuals, non-profits and companies with up to 3 employees. Larger companies need a paid company license. See the [Remotion license](https://www.remotion.dev/docs/license).
- Country shapes come from [Natural Earth](https://www.naturalearthdata.com) (public domain) through [world-atlas](https://github.com/topojson/world-atlas) (ISC).
- Country codes come from the [DataHub country-codes dataset](https://github.com/datasets/country-codes) (Public Domain Dedication and License).
- Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Archivo](https://fonts.google.com/specimen/Archivo), both under the SIL Open Font License.
- Web search by [Tavily](https://tavily.com) and voice by [ElevenLabs](https://elevenlabs.io).
