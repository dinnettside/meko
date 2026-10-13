# Phase 0 plan

Approved by Trym on Oct 13, 2026. When Phase 0 is done, delete this file and the line in CLAUDE.md that points to it.

## Notes for Claude

- Talk to Trym in Norwegian bokmål: short, direct, no emojis. Code, UI text and docs stay in English.
- Never show, log, commit or ask for API key values. Trym pastes keys into `.env.local` himself. Check that a key exists by name only: `cut -d= -f1 .env.local`.
- If Turbopack gives a lockfile error (for example "multiple lockfiles" or a wrong workspace root), switch to webpack right away. Trym decided this after the error hit an earlier project. In Next 16 that means `next dev --webpack` and `next build --webpack`, plus Tailwind through `@tailwindcss/postcss` and a `postcss.config.mjs` instead of `@tailwindcss/turbopack` and the `turbopack.rules` block in `next.config.ts`. So far there is no error: build and dev both ran clean on Turbopack on Oct 13, and there are no stray lockfiles in `~` or `~/Projects`.
- Known warnings, leave them alone unless Trym asks:
  - `npm audit` reports 5 high-severity issues, all in the ESLint chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). They are dev-only and never shipped. Do not run `npm audit fix --force`, because it would downgrade `eslint-config-next` to 14.
  - npm marks `eslint@9.39.5` as deprecated. The template pins `^9`.

## Decisions

- Name: Meko. Folder `~/Projects/meko`, npm.
- LICENSE: MIT, "Copyright (c) 2026 Trym Hägglöf".
- GitHub: private repo `dinnettside/meko` (gh is logged in as `dinnettside`). It is made public in Phase 4, which is on the checklist in CLAUDE.md.
- Budget: Trym approved up to 1 USD for the check-models run.
- Token Factory credit: not confirmed yet. Ask Trym before the first paid call.
- Norwegian sample: yes, include it in the report.

## Steps

1. [x] Scaffold: `npx create-next-app@16.4.0 meko --ts --eslint --tailwind --app --no-src-dir --turbopack --no-react-compiler --no-cache-components --import-alias "@/*" --agents-md --no-agent-feedback --use-npm`. Lint, `tsc --noEmit` and build pass, and the dev server loads the page.
2. [x] Move CLAUDE.md in from Downloads: set the project name, import `@AGENTS.md`, add "Make the repo public" to Phase 4. Create `.env.local` with an empty `NEBIUS_API_KEY=` (gitignored).
3. [x] Repo files:
   - MIT `LICENSE`.
   - A README stub in English: what Meko does, setup, commands, and a note that Remotion has its own license, which is free for individuals.
   - `.env.example` with names only (`NEBIUS_API_KEY`, `NEBIUS_MODEL`, `TAVILY_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`), replacing the template's `MY_HOST` example.
   - An empty `FEEDBACK.md`.
4. [x] `.gitignore`: the template ignores `.env*`, which also hides `.env.example`. Add `!.env.example`. Then create the private GitHub repo and push.
5. [x] Remotion Player: `npm i --save-exact remotion@4.0.535 @remotion/player@4.0.535`. All Remotion packages must be on exactly the same version. Add one neutral test composition in `remotion/` (text fading in over 3 seconds) and a client component with `<Player>`, and replace the default home page with it. No styling yet, because Trym picks a design direction first.
6. [x] Add a `typecheck` script. Run typecheck, lint and build, then commit. Start the dev server so Trym can check http://localhost:3000: the player shows, and play, pause and seeking work.
7. [ ] `npm i openai@7.32.0 zod@4.6.7`. Write `scripts/check-models.ts` (spec below) and an `npm run check-models` script (`node --env-file-if-exists=.env.local scripts/check-models.ts`). Run typecheck, lint and build, then commit. Run the check only when the key is in `.env.local` and the credit is confirmed.
   - Oct 13: script written and committed. Typecheck, lint and build pass, and a full run against a local mock server worked. The key is in `.env.local`. Not run yet: waiting for Trym to confirm the Token Factory credit.
   - The npm script also has `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`, because package.json has no `"type"` field. `tsconfig.json` has `allowImportingTsExtensions` for the `.ts` imports.
   - The Token Factory API reference also documents `reasoning_effort` (`none` to `max`). The script tries it as a second way to turn thinking off.
8. [ ] Trym picks the model. Add `NEBIUS_MODEL` to `.env.local`, tick Phase 0 in CLAUDE.md, set "Current phase" to 1, delete this file and its pointer, then commit.

## check-models.ts spec

The script uses the same `openai` SDK and base URL as the app (`https://api.tokenfactory.nebius.com/v1/`), so it also checks that SDK v7 works with Token Factory. Node 25 runs `.ts` files directly. That means `import type` for types, `.ts` extensions in relative imports, and no enums.

1. **List models:** call `GET /v1/models?verbose=true` and keep ids that contain `nvidia/` or "nemotron".
   - Keep active text models only, and skip embedding, guard and vision models. At most 8.
   - Print context length and price.
   - The docs name `nvidia/Nemotron-3_5-Lightning` and `nvidia/nemotron-3-super-120b-a12b`. Llama-3.1-Nemotron-Ultra-253B and Nemotron-3-Nano-Omni were removed on Aug 31, 2026.
2. **Facts JSON, 3 tries per model:** extract atomic facts from a short source text.
   - Request: `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`, with the schema built from zod (`z.toJSONSchema`).
   - Pass: the output parses, passes zod and has no thinking text in `content`.
   - If `json_schema` is rejected, fall back to `json_object` plus zod, and say so in the report.
3. **Storyboard JSON, 3 tries per model:** Trym added this test because it is the most complex JSON the app will make.
   - Task: a mini storyboard with exactly 3 scenes (`title`, `text` and `map`) that follows the contract in CLAUDE.md, built from a few given facts and sources.
   - Put the zod schema for the contract in `lib/storyboard.ts`, so `/api/direct` can reuse it in Phase 1.
   - Pass: valid against zod, scene kinds in that order, every `factIds` entry exists in the given facts, country codes are 3 capital letters, `fps`/`width`/`height` match the contract, and every duration is above 0.
   - If the strict schema is rejected or ignored (because of the scene union or the optional fields), report it and propose contract changes to Trym. Do not change the contract without his OK.
4. **Tool calling, 3 tries:** give the model one tool, `search_web({ query })`.
   - Pass: the model makes a valid call with valid arguments.
   - Then send a made-up search result back. The model must use it in its follow-up answer.
5. **Thinking on and off:** NVIDIA documents `chat_template_kwargs: { enable_thinking: false }` for Nemotron 3, but Token Factory does not mention it. Where the switch works, run the JSON tests and the latency test in both modes. Thinking can make calls much slower, and every API route has to finish within Vercel's time limit.
6. **Latency:** time to first token (streaming), total time, tokens per second, and tokens and cost per call.
7. **Norwegian sample:** one short bokmål text per model, 2–3 sentences explaining a topic. Print it in the report for Trym to judge. It is not scored.
8. **Report:** a table in the terminal and a copy in `docs/model-check.md`. Give a short recommendation, and Trym picks.

Limits:

- One call at a time.
- A 90-second timeout and a `max_tokens` cap on every call.
- At most one retry on a 429, after waiting for `Retry-After`.
- Stop if the running cost passes 1 USD.

Write anything confusing, slow or broken about Token Factory or Nemotron into `FEEDBACK.md`.

Docs:

- Token Factory: [structured output](https://docs.tokenfactory.nebius.com/ai-models-inference/json.md), [function calling](https://docs.tokenfactory.nebius.com/ai-models-inference/function-calling.md), [list models](https://docs.tokenfactory.nebius.com/api-reference/models/list-models.md), [Aug 2026 deprecations](https://docs.tokenfactory.nebius.com/august-2026-deprecation-notice.md)
- [Nemotron 3 Super model card](https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b.md)
