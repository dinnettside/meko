# Feedback on Nebius Token Factory and NVIDIA Nemotron

Things that were confusing, slow or broken while building Meko, written down as they happened.

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
- Norwegian bokmål is weak in all four models. Lightning garbles words ("avsaettes", "brødreaktighet"), Nano mixes in Danish and English ("omvæltninger", "clergy"), and Ultra calls Louis XVI "Henrikke 16.".
