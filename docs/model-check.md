# Model check

Run on 2026-10-13 18:33 UTC against Nebius Token Factory with the openai SDK 7.32.0.
92 model calls, total cost $0.0732.

Sampling is temperature 1 and top_p 0.95, as NVIDIA recommends for Nemotron 3.
Every call has a 90 s timeout and a max_tokens cap.

## Recommendation

Written by Claude after the run. Each test ran only 3 times, so treat the numbers as signals, not proof.

- **Use `nvidia/Nemotron-3-Ultra-550b-a55b` with thinking off.** It is the only model that passed every test: 6/6 facts, 6/6 storyboards and 3/3 tool calls. With thinking off, a storyboard takes about 3 s and a facts call about 1.4 s.
- Ultra is the most expensive model ($1 per 1M input tokens and $3 per 1M output tokens), but every call in this test still cost under one cent.
- The cheaper choice is `nvidia/nemotron-3-super-120b-a12b`, at about a third of the price. It passed 3 of 6 storyboards. Every failure was "Europe" used as a country code. A retry with the error message, or a stricter schema, would probably fix that.
- Nano failed all 6 storyboards. With thinking on, Lightning ran out of tokens on every storyboard.
- Thinking on was never better than thinking off here, and it made calls 2 to 10 times slower. Start with thinking off, and turn it on only where a test shows it helps, for example in fact-checking.
- Strict `json_schema` was accepted by all four models, including the scene union and the optional fields, and no output broke the schema. The contract does not need to change.
- Norwegian is weak in all four models. Super reads best. The others have misspellings or Danish words, and Ultra calls Louis XVI "Henrikke 16.". Keep Norwegian as a stretch goal.

## Models

| Model | Context | $ per 1M in | $ per 1M out | Supported features |
| --- | --- | --- | --- | --- |
| nvidia/Nemotron-3_5-Lightning | 1,048,576 | $0.06 | $0.24 | tools, reasoning |
| nvidia/nemotron-3-super-120b-a12b | 262,144 | $0.30 | $0.90 | tools, reasoning |
| nvidia/Nemotron-3-Ultra-550b-a55b | 1,048,576 | $1.00 | $3.00 | tools, reasoning |
| nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B | 262,144 | $0.06 | $0.24 | tools, reasoning |

## Thinking

- **nvidia/Nemotron-3_5-Lightning**: Thinks by default. `{"chat_template_kwargs":{"enable_thinking":false}}` turns it off.
- **nvidia/nemotron-3-super-120b-a12b**: Thinks by default. `{"chat_template_kwargs":{"enable_thinking":false}}` turns it off.
- **nvidia/Nemotron-3-Ultra-550b-a55b**: Thinks by default. `{"chat_template_kwargs":{"enable_thinking":false}}` turns it off.
- **nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B**: Thinks by default. `{"chat_template_kwargs":{"enable_thinking":false}}` turns it off.

## Results

Facts and storyboard show passed tries out of 3 and the median time per call.
Latency is one streamed call that writes a 120-word narration.

| Model | Mode | Facts JSON | Storyboard JSON | First token | Total | Tokens/s | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| nvidia/Nemotron-3_5-Lightning | thinking on | 3/3, 5.3 s | 0/3, 27.4 s | 0.3 s | 7.1 s | 295 | $0.0005 |
| nvidia/Nemotron-3_5-Lightning | thinking off | 3/3, 1.1 s | 2/3, 2.8 s | 0.3 s | 0.7 s | 232 | $0.0000 |
| nvidia/nemotron-3-super-120b-a12b | thinking on | 3/3, 3.4 s | 1/3, 11.8 s | 0.5 s | 10.5 s | 183 | $0.0017 |
| nvidia/nemotron-3-super-120b-a12b | thinking off | 3/3, 1.6 s | 2/3, 2.8 s | 0.5 s | 2.2 s | 96 | $0.0002 |
| nvidia/Nemotron-3-Ultra-550b-a55b | thinking on | 3/3, 2.7 s | 3/3, 7.1 s | 1.0 s | 8.3 s | 273 | $0.0060 |
| nvidia/Nemotron-3-Ultra-550b-a55b | thinking off | 3/3, 1.4 s | 3/3, 3.2 s | 0.5 s | 1.2 s | 244 | $0.0006 |
| nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B | thinking on | 3/3, 3.1 s | 0/3, 20.3 s | 0.2 s | 16.2 s | 125 | $0.0005 |
| nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B | thinking off | 3/3, 2.3 s | 0/3, 5.2 s | 0.2 s | 0.9 s | 185 | $0.0000 |

## Tool calling

Passed tries out of 3. The model must call search_web with valid arguments, then use the made-up result in its answer.

- **nvidia/Nemotron-3_5-Lightning** (thinking on): 3/3
- **nvidia/nemotron-3-super-120b-a12b** (thinking on): 3/3
- **nvidia/Nemotron-3-Ultra-550b-a55b** (thinking on): 3/3
- **nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B** (thinking on): 3/3

## Details

### nvidia/Nemotron-3_5-Lightning

- facts (thinking on), json_schema (strict): No problems.
- storyboard (thinking on), json_schema (strict): Try 1: hit max_tokens before the answer was done Try 2: hit max_tokens before the answer was done Try 3: hit max_tokens before the answer was done
- facts (thinking off), json_schema (strict): No problems.
- storyboard (thinking off), json_schema (strict): Try 1: scene kinds are "title, text, map, timeline", expected "title, text, map"
- tools (thinking on): No problems.

### nvidia/nemotron-3-super-120b-a12b

- facts (thinking on), json_schema (strict): No problems.
- storyboard (thinking on), json_schema (strict): Try 1: Scene map1: "Europe" is not a 3-letter country code Try 2: Scene map1: "Europe" is not a 3-letter country code
- facts (thinking off), json_schema (strict): No problems.
- storyboard (thinking off), json_schema (strict): Try 1: Scene scene3: "Europe" is not a 3-letter country code
- tools (thinking on): No problems.

### nvidia/Nemotron-3-Ultra-550b-a55b

- facts (thinking on), json_schema (strict): No problems.
- storyboard (thinking on), json_schema (strict): No problems.
- facts (thinking off), json_schema (strict): No problems.
- storyboard (thinking off), json_schema (strict): No problems.
- tools (thinking on): No problems.

### nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B

- facts (thinking on), json_schema (strict): No problems.
- storyboard (thinking on), json_schema (strict): Try 1: Scene map: "ground" is not a 3-letter country code; Scene map: "overlay" is not a 3-letter country code; Scene map: "Paris" is not a 3-letter country code; Scene map: "France" is not a 3-letter country code Try 2: Scene map: "map_frame" is not a 3-letter country code; Scene map: "1789" is not a 3-letter country code; Scene map: "1792" is not a 3-letter country code Try 3: Scene map: "europe_map" is not a 3-letter country code; Scene map: "Paris" is not a 3-letter country code; Scene map: "France" is not a 3-letter country code
- facts (thinking off), json_schema (strict): No problems.
- storyboard (thinking off), json_schema (strict): Try 1: Scene m1: "2024,2.5" is not a 3-letter country code; Scene m1: "130803,484540" is not a 3-letter country code; Scene m1: "967710,178710" is not a 3-letter country code; Scene m1: "2024,2.5" is not a 3-letter country code; Scene m1: "130803,484540" is not a 3-letter country code; Scene m1: "130803,484540" is not a 3-letter country code; Scene m1: "967710,178710" is not a 3-letter country code Try 2: Scene map-scene: "1789" is not a 3-letter country code; Scene map-scene: "1792" is not a 3-letter country code; Scene map-scene: "1792" is not a 3-letter country code; Scene map-scene: "1795" is not a 3-letter country code Try 3: Scene map1: "1920,1080" is not a 3-letter country code; Scene map1: "f4" is not a 3-letter country code; Scene map1: "f5" is not a 3-letter country code; Scene map1: "f5" is not a 3-letter country code; Scene map1: "f6" is not a 3-letter country code
- tools (thinking on): No problems.

## Norwegian samples

Not scored. Read them and judge the quality.

### nvidia/Nemotron-3_5-Lightning

> Den franske revolusjonen var en radikal politisk og sosial oppstand i Frankrike fra 1789 til 1799, som førte til at monarkiet avsaettes og en republikk ble grunnlagt. Bevegelsenivret seg for idealene frihet, likhet og brødreaktighet, og kjennetegnes av ikoniske hendelser som stormingen av Bastillen den 14. juli 1789.

### nvidia/nemotron-3-super-120b-a12b

> Den franske revolusjonen (1789‑1799) var en periode med store politiske og sosiale omveltninger i Frankrike, der folket konfronterte monarkiet og aristokratiet for å skape et samfunn basert på frihet, likhet og broderskap. Revolusjonen førte til avskaffelsen av absolutt kongemakt, innføring av menneskerettigheter og endelig oppstånden av Napoleon Bonaparte som keiser. Den har hatt stadig innvirkning på moderne demokratiske idealer verden over.

### nvidia/Nemotron-3-Ultra-550b-a55b

> Den franske revolusjonen (1789–1799) var en radikal omveltning der folket reises seg mot kongemakten og det feudal systemet for å kreire frihet, likhet og broderskap. Den førte til Henrikke 16. avsetting, Terror-herredømmet under Robespierre, og til slutt Napoleons maktsovertakelse. Revolusjonen la grunnlaget for moderne demokratier ved å avskaffe aristokratiske privilegie og innføre menneskerettighetene som grunnlov.

### nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B

> Den franske revolusjonen (1789‑1799) var en periode med kraftige politiske omvæltninger i Frankrike, der folket opprørt mot denabsolute monarkiet og de sociale urettighetene som adel og clergy monopoliserte. Revolutionen førte til avskaffelsen av feodalordener, erklæringen av frihet, likhet og broderskap, og etableringen av det første republikanske regimet, men ble også præget av voldelige perioder som Terrormånedene under Robespierre. Resultatene spredte idéer om nasjonal suverenitet og demokratisk styring, som senere inspirerte andre frihetsbevægelser i Europa.

