# Feedback on Nebius Token Factory and NVIDIA Nemotron

Things that were confusing, slow or broken while building Meko, written down as they happened.

## Summary

What would help builders most, in order:

1. **Prompt caching for shared prompt starts.** Most of a Meko video's cost (78 % in one measured run) is the director's per-scene calls, which all begin with the same long text: the menu of picture kinds and the JSON schema. Caching that start would cut both cost and latency a lot. We found no way to use prompt caching on Token Factory.
2. **Complete docs for structured output.** The examples on the structured output page do not run, the page disagrees with itself about the shape of `json_schema`, and it does not list which JSON Schema features work. Strict `json_schema` even enforces `minItems` and `maxItems`, which is very useful and not documented.
3. **Accurate model features in `/v1/models`.** `supported_features` lists only `tools` and `reasoning` for the Nemotron 3 models, yet strict `json_schema` works on all of them, and `verbose` has no description.
4. **Docs for the thinking switch.** Say that `chat_template_kwargs: { enable_thinking: false }` is passed through, and warn that with thinking on, JSON tasks can run to `max_tokens` (Lightning hit our 6,000-token cap three times in a row).
5. **For the Nemotron team.** Ultra with thinking off treats a hedge as wording ("might have ended" became "helped end"), misses false links between true facts, repeats confident place errors (the port of Caffa put in Georgia), writes fewer words than asked, and invents names outside a list it was given. Each was fixable with a check in code or a second call; the details and examples are below.

What worked well: strict `json_schema` made replies parse reliably (only answers cut off at `max_tokens` did not); with thinking off, Ultra was fast enough for a pipeline that makes a video in under a minute; the OpenAI-compatible API worked with the `openai` SDK unchanged; and Lightning, at about 6 % of Ultra's price, is a very good fit for many small extraction calls.

## What we used

Token Factory's OpenAI-compatible chat completions API and its models list, called from a Next.js app on Vercel, with three NVIDIA models: Nemotron 3 Ultra for reasoning (topic check, search plan, script, fact-check, video plan, place checks), Nemotron 3 Super for directing each scene, and Nemotron 3.5 Lightning for pulling facts out of source pages. Every call uses a strict JSON schema with thinking off. We did not use AI Cloud.

## Onboarding: zero to hello world

- With a key in hand, the first call needed nothing new: the `openai` npm SDK with `baseURL` set to `https://api.tokenfactory.nebius.com/v1/`. Our first script, which compared the four Nemotron 3 models on strict JSON, tool calling, speed and price (92 calls for $0.07), ran about 40 minutes after we started the project.
- The time went into the docs, not the API: examples that do not run, two shapes for `json_schema`, no list of supported schema features, nothing on the thinking switch, and `supported_features` that leaves out JSON. Each one took a test to answer (details below).
- The model IDs are spelled three ways: `nvidia/Nemotron-3-Ultra-550b-a55b`, `nvidia/nemotron-3-super-120b-a12b` and `nvidia/Nemotron-3_5-Lightning`. That makes them easy to get wrong, so we copy them from `/v1/models` instead of typing them.

## Would we build with them again?

Yes, for an app like Meko, for three reasons:

- Strict JSON schemas hold, list lengths included, so a video can take more than 20 model calls with a check in code after each one.
- Three sizes of one model family behind one API let each call go where it fits. Moving the scene calls from Ultra to Super and the extraction to Lightning cut the cost of a video from about $0.15 to about $0.065, with the same checks passed.
- With thinking off, Ultra answers in a few seconds, fast enough to make a video while the viewer waits.

What would make it an easy yes: prompt caching for shared prompt starts (most of our cost), complete docs for structured output, and a models list that names the features each model really has.

## Token Factory docs

- The code examples on the [structured output page](https://docs.tokenfactory.nebius.com/ai-models-inference/json) do not run as written. The Python example is missing commas in `response_format` and after it. The cURL example sends `"response format"` (with a space) instead of `response_format`, and is also missing a comma.
- The same page is inconsistent about the shape of `json_schema`. The Python and cURL examples pass the bare schema, while the "valid JSON schema" example wraps it as `{ name, schema, strict }` like the OpenAI API. Only the chat completion API reference makes it clear that `name` and `schema` are required.
- The structured output page does not say which JSON Schema features are supported, for example unions (`anyOf`), optional fields, `minLength` or string patterns. We have to find out by testing.
- The function calling page does not say which models support tool calling. Its only example model is `meta-llama/Meta-Llama-3.1-8B-Instruct-fast`.
- The API reference for `GET /v1/models` has no description for the `verbose` query parameter. The response has `supported_features`, but the docs do not list its possible values.
- NVIDIA documents `chat_template_kwargs: { enable_thinking: false }` to turn off reasoning in Nemotron 3, but the Token Factory docs do not say whether this is passed through. Our test showed that it is, for all four Nemotron 3 models.
- The structured output page says to look for a "JSON mode" tag to find models that support structured output. For all four Nemotron 3 models, `supported_features` from the models API only lists `tools` and `reasoning`, yet strict `json_schema` worked on all of them.

- Strict `json_schema` enforces `minItems` and `maxItems`. We tested it: asked for 12 items with `maxItems: 3`, the model returned exactly 3. That is very useful, but nothing in the docs says so.

## Nemotron models

From our model check on Oct 13, 2026 (see `docs/model-check.md`):

- With thinking on, Nemotron 3.5 Lightning hit our 6000-token cap on all 3 storyboard tries (about 27 s each) and never finished the JSON. With thinking off, it answered in about 3 s.
- Nemotron 3 Nano 30B put years, fact IDs and coordinates into the country code fields of the map scene in all 6 storyboard tries.
- In the app (Oct 13), Nemotron 3 Ultra with thinking off once filled a short list until it hit max_tokens (500 tokens in 2 s), even with strict `json_schema`. Adding `maxItems` to the schema fixed it.
- Ultra did not always keep a fixed list of scene IDs. Asked to return one entry per given scene, it added an extra title scene in front, and two retries with the error message did not fix it. A schema with one required key per scene fixed it for good.
- Ultra with thinking off tends to write fewer words than asked. Asked for about 195 words, it often wrote 120 to 160, so our word-count check sends it back for another try. A video can come out much shorter than requested without that check.
- Ultra sometimes gets coordinates wrong for well-known places, and in a way that looks consistent: it put Balkh (Afghanistan, about 36.8 N) at 24.9 N and named Pakistan as its country, which matches the wrong point. It also mixed up the city of Karakorum (Mongolia) with the Karakoram mountains. Asking a second time in a separate call, with the sentence the place appears in, and comparing the two answers catches these.
- Ultra used map markers (meant for cities) for countries and regions ("India", "Central Asia", "Tarim Basin") even when told not to.
- Norwegian bokmål is weak in all four models. Lightning garbles words ("avsaettes", "brødreaktighet"), Nano mixes in Danish and English ("omvæltninger", "clergy"), and Ultra calls Louis XVI "Henrikke 16.".

From building the director and the fact-check (Oct 14):

- In the fact-check, Ultra sometimes marked a sentence "supported" while its own reason said a claim was not: "The causal link 'when' is not supported by the provided quotes." A code check that rejects that contradiction fixed it.
- Ultra missed false links between true facts. "After Constantinople fell in 1453, its population crashed from 500,000 to 40,000" passed, although the quote says the population was 40,000 "by 1453". It wrote the "after" link only for the last part of the sentence. Thinking on did not catch it either and made the call about 6 times slower (25 s instead of 4 s). Spelling out each link as a claim in the input, and running two checks side by side and keeping the stricter verdict, caught it in 3 of 3 runs.
- After a retry message, Ultra with thinking off once kept writing until max_tokens (10,000 tokens in 41 s), even with strict `json_schema`. We now start over from the first prompt when an answer is cut off.
- Ultra planned timelines and charts for scenes whose facts had no years or numbers, and then took years from its own knowledge (for example 100 BC for Zhang Qian, which no fact gave). Listing the years and amounts the facts contain, and only allowing those kinds where the data exists, fixed most of it.
- On maps, Ultra labeled countries with regions they are not in (China as "Central Asia"), colored all of Russia to point at one port in Crimea, and drew arrows against their own label ("grapes eastward" from China to Iran). Code checks catch these now.

From running 10 topics through the pipeline (Oct 14):

- Ultra planned map scenes for how the immune system works and for the Moon landing, although the prompt says maps are for places on Earth. Asked to list the places each scene names, it listed places on the Moon. A code check for country, region, sea and city names now decides which scenes can be maps.
- Ultra put map markers on institutions ("Senate", "Magistrates") at Rome's coordinates. Asking a second time whether each name is a place at all catches it.
- Ultra used the "total" of a number scene to show two unrelated numbers as a share: 70,000 marchers "out of" a later crowd of 320,000, and "4 out of 5 million" for "4 to 5 million". It also charted days of the month as amounts, and one amount in two units (130 tonnes against 143 tons) as if they were two things.
- When the script missed its length, Ultra often missed again after the retry message, three times in a row, which failed 2 of 10 videos. Saying how many words to cut or add, and keeping the closest script after the last try, fixed it.
- Most source quotes Ultra copies are parts of sentences, not whole ones, so a quote scene from them often failed. We now only plan a quote where a whole sentence exists.

From adding drawings and a kit of pictures for any topic (Oct 18):

- Ultra is weak at geometry. Asked to draw a diagram from shapes on a 0 to 100 grid, it stacked every label in one column, crammed the drawing into a corner and once gave every coordinate as a fraction from 0 to 1. Letting it name only what is in a picture and which part a label belongs to, and doing the layout in code, fixed it.
- Ultra often gives icon names that are not in the list it was given ("data", "signal", "pipe", "hole"), even with the list in the prompt and a retry message naming the problem; it then tends to invent another. A free-text field with an allowed list does not hold it, and a 266-name enum in every icon field would make the schema very large. We map common invented names to real icons in code instead.
- Even when the menu offered a drawing made for exactly the topic, like a neural network diagram for a video about neural networks, the plan sometimes picked a general picture. The code now puts such a drawing in when its narrow checks pass.
- Sending the description of every kind of picture to each scene's call cost about 7,000 input tokens a call. Sending only the kinds the scene may use cut it to about 4,500 without hurting the results.
- Nemotron 3.5 Lightning is a good fit for fast, simple calls. Pulling facts with quotes out of source pages with Lightning kept about 90 % as many facts as Ultra at about a sixth of the cost. When Lightning also planned the searches, it planned fewer and read fewer sources (29 facts against Ultra's 50 on one topic), so Ultra keeps that call.
- Most of a video's cost is the per-scene direction calls (78 % in one run of four videos), because each sends the menu of picture kinds and the JSON schema. Prompt caching on Token Factory for the shared start of these prompts would cut that a lot; we did not find a way to use it.

From making the videos for the feed (Oct 19):

- Ultra's fact-check treated a dropped hedge as a small change in wording. "The labor shortage helped end feudalism" passed against a quote that says the Black Death "might have brought an end to feudalism". One line in the prompt ("Certainty is a claim too") fixed it: the sentence now comes back as "may have helped end feudalism". The same thing happened on screen, where a takeaway card said "End of feudalism", so the code now checks that the words on screen keep the narration's hedges ("may", "might", "up to").
- In the director, Ultra put the medieval port of Caffa in Georgia in several calls of the same video, and colored Georgia under a label "Caffa". A separate call that only asks where each place is, with the sentence it appears in, answered Crimea, Ukraine. The second opinion is cheap (about $0.001 a video) and catches errors the first call repeats with confidence.
- Ultra labeled maps with places the narration does not name, like Chang'an, Lisbon and the Cape of Good Hope, even when the prompt says to name only places the narration or facts name. They are often true, but the viewer cannot check them, so the code drops them, and a map left with nothing the scene names gets another kind of picture.
- Nemotron 3.5 Lightning shortened the title "How Volcanoes Erupt: From Deep Earth to Explosive Power" to the heading "Volcanoes Deep Earth". Short, fluent rewrites are where Lightning is weakest in our use; the code now takes the heading from the title itself.
- Lightning was not reliable as a topic check. Asked to sort requests into "fits" or a reason to refuse, it let a private person and two attempts to read out its prompt through, and called a request to cook drugs "weapons". Ultra sorted 24 of our 25 test requests right, in about 0.5 s and for $0.0004 a check, so Ultra does the check, next to the search plan, where it adds no time.
- Nemotron 3 Super is a good fit for directing scenes. Re-directing ten saved videos with Super for the per-scene calls (Ultra kept the plan and the checks) cost $0.037 a video against $0.120 with Ultra, took about as long, broke our rules a little less often, and left the same 11 % of scenes as plain text. It also chose more varied pictures (a document, a calendar page, a pyramid), while Ultra drew more precise maps.

