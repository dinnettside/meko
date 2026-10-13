# Meko

Meko turns a topic into a short, fact-checked, animated explainer video.

You type a topic, an audience and a length, for example "The French Revolution, high school, 90 seconds". An agent researches the topic on the web, writes a narration script where every claim is backed by a source, fact-checks its own script and directs each scene. The video plays right away in the browser, with the source list next to it.

Meko is built for the Nebius x NVIDIA Global AI Hackathon. The agent runs on NVIDIA Nemotron models served by Nebius Token Factory.

Meko is a work in progress.

## Setup

You need Node.js 22.18 or newer and npm.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is gitignored, so your keys stay on your machine. Not every variable is used yet.

   | Name | What it is |
   | --- | --- |
   | `NEBIUS_API_KEY` | API key for Nebius Token Factory |
   | `NEBIUS_MODEL` | The Nemotron model ID to use on Token Factory |
   | `TAVILY_API_KEY` | API key for Tavily web search. Without it, Meko uses Tavily's free keyless mode, which has a low hourly limit and is only meant for development |
   | `ELEVENLABS_API_KEY` | API key for ElevenLabs text-to-speech |
   | `ELEVENLABS_VOICE_ID` | The ElevenLabs voice to use |

3. Start the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on http://localhost:3000 |
| `npm run build` | Builds the app for production |
| `npm run start` | Serves the production build |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Generates route types and runs the TypeScript compiler |
| `npm run check-models` | Tests the NVIDIA models on Token Factory and writes `docs/model-check.md`. Makes paid API calls, capped at 1 USD |

## License

Meko's own code is MIT licensed, see [LICENSE](LICENSE).

Meko uses [Remotion](https://www.remotion.dev) to play the videos. Remotion is not MIT licensed. It has its own license, which is free for individuals, non-profits and companies with up to 3 employees. Larger companies need a paid company license. See the [Remotion license](https://www.remotion.dev/docs/license).
