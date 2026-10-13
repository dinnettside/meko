# Feedback on Nebius Token Factory and NVIDIA Nemotron

Things that were confusing, slow or broken while building Meko, written down as they happened.

## Token Factory docs

- The code examples on the [structured output page](https://docs.tokenfactory.nebius.com/ai-models-inference/json) do not run as written. The Python example is missing commas in `response_format` and after it. The cURL example sends `"response format"` (with a space) instead of `response_format`, and is also missing a comma.
- The same page is inconsistent about the shape of `json_schema`. The Python and cURL examples pass the bare schema, while the "valid JSON schema" example wraps it as `{ name, schema, strict }` like the OpenAI API. It is not clear which one the server expects.
- The structured output page does not say which JSON Schema features are supported, for example unions (`anyOf`), optional fields, `minLength` or string patterns. We have to find out by testing.
- The function calling page does not say which models support tool calling. Its only example model is `meta-llama/Meta-Llama-3.1-8B-Instruct-fast`.
- The API reference for `GET /v1/models` has no description for the `verbose` query parameter. The response has `supported_features`, but the docs do not list its possible values.
- NVIDIA documents `chat_template_kwargs: { enable_thinking: false }` to turn off reasoning in Nemotron 3, but the Token Factory docs do not say whether this is passed through.
