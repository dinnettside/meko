# Meko

Meko turns a topic into a short, fact-checked, animated explainer video in about half a minute.

You type a topic, an audience and a length, for example "The French Revolution, high school, 90 seconds". An agent researches the topic on the web, writes a narration where every sentence cites its sources, fact-checks that narration against the exact words of those sources, and directs each scene as maps, timelines and text. The video plays right away in the browser, with a voice-over, the sources and a sentence-by-sentence fact-check report next to it.

The point: explainer videos people can trust, made in under a minute.

Meko is built for the Nebius x NVIDIA Global AI Hackathon (track: Best Apps and Agents). Every video is made by NVIDIA Nemotron, served by Nebius Token Factory.

## Why you can trust a Meko video

The language model writes and checks everything, but plain code checks the model at every step:

- **Every fact has a quote.** When Meko reads a source, the model must copy the exact words that state each fact. The server looks for that quote in the source text and throws the fact away if it is not there, so the model cannot invent facts.
- **Every sentence cites facts.** The script must name the facts behind each sentence. Unknown fact IDs send the script back for another try.
- **Every claim is checked.** The fact-check splits each sentence into its separate claims (people, numbers, dates, places, causes) and judges each one only against the quotes of the cited facts. A sentence with an unsupported claim is rewritten or removed, and the code makes sure it can never be marked as supported.
- **The narration is not touched again.** The director only chooses what is shown on screen. The voice reads the fact-checked text word for word.
- **What is on screen is checked too.** Numbers on screen must appear in the narration or the cited facts. Each event on a timeline names the fact that states its year, and the code checks that the year is in it. Each city on a map comes with its coordinates and the country it lies in, and the code checks that the point is inside that country's borders.
- **You can see all of it.** Next to the video, the fact-check report lists every sentence as supported, revised or removed, with the reason, the quotes and links to the sources. The sentence being spoken is marked as the video plays, and clicking a sentence plays the video from there.

## How it works

The browser calls five API routes in order and shows live progress for each:

1. **Research** (`/api/research`). Nemotron plans 3 to 6 web searches. [Tavily](https://tavily.com) runs them in parallel, Meko picks the best new page for each search, and Nemotron extracts up to 6 facts from each page, with quotes, all at once. If the model finds an important gap, there is one more round of searches.
2. **Script** (`/api/script`). Nemotron writes the narration, split into short scenes, with the fact IDs behind every sentence. The length follows the voice's measured pace of about 2.3 words per second.
3. **Fact-check** (`/api/factcheck`). Nemotron checks every claim in every sentence against the quotes. Sentences are kept, revised or removed.
4. **Direct** (`/api/direct`). Every scene is directed in its own small Nemotron call, all in parallel. A scene becomes a map, a timeline or a few lines of text.
5. **Voice** (`/api/voice`). [ElevenLabs](https://elevenlabs.io) reads each scene, with the text before and after for a natural flow. Its word timings set the length of each scene and drive captions that light up word by word.

The result is a storyboard (plain JSON, see `lib/storyboard.ts`) that [Remotion](https://www.remotion.dev) plays in the browser. All visuals are drawn in code: no stock footage, images or music.

A 90-second video takes about 30 seconds to make and costs about $0.05 in Token Factory calls (see `docs/eval.md`).

## How Meko uses Nemotron and Token Factory

- **Model.** `nvidia/Nemotron-3-Ultra-550b-a55b` on Nebius Token Factory, called with the `openai` SDK through Token Factory's OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`). We picked it with `scripts/check-models.ts`, which tested the four Nemotron models on Token Factory for strict JSON, tool calling, speed and price. Ultra was the only one that got every storyboard right. See `docs/model-check.md`.
- **Thinking off.** Every call sends `chat_template_kwargs: { enable_thinking: false }`. In our tests, thinking made calls 2 to 10 times slower and never gave better results for these tasks.
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

3. Start the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

   To see a finished video without any API keys, click "Watch an example" or open http://localhost:3000/?example.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on http://localhost:3000 |
| `npm run build` | Builds the app for production |
| `npm run start` | Serves the production build |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Generates route types and runs the TypeScript compiler |
| `npm run eval -- 2` | Makes videos for the first 2 of 10 test topics and writes `docs/eval.md`. Leave out the number to run all 10. Needs the app running and makes paid API calls |
| `npm run make-example` | Remakes the example video in `public/examples`. Needs the app running and makes paid API calls |
| `npm run check-models` | Tests the NVIDIA models on Token Factory and writes `docs/model-check.md`. Makes paid API calls, capped at 1 USD |

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

- Maps use today's borders, from Natural Earth via world-atlas. Historical borders are out of scope, so a map about the Roman Empire shows modern countries.
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
