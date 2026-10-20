# Eval

Run on 2026-10-19 00:15 UTC: 10 topics, high school audience, 90 seconds each.

- Finished: 10 of 10
- Sentences supported as written: 97% (revised 3%, removed 0%)
- Average time per video: 42.2 s
- Average Token Factory cost per video: $0.1458
- Average narration length: 972 characters
- Scenes shown as plain text: 11%

| Topic | Supported | Revised | Removed | Facts (dropped) | Scenes | Video | Time | Steps (s) | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The French Revolution | 12/12 | 0 | 0 | 46 (8) | 1 title, 1 list, 1 illustration, 1 steps, 2 text, 1 map, 3 template | 78 s | 52.5 s | 17.6 / 7.2 / 3.3 / 24.2 | $0.1784 |
| The voyages of Christopher Columbus | 9/9 | 0 | 0 | 43 (8) | 1 title, 2 template, 2 illustration, 3 map | 81 s | 47.7 s | 17.1 / 7.7 / 3.3 / 19.4 | $0.1758 |
| The partition of India in 1947 | 11/11 | 0 | 0 | 32 (4) | 1 title, 4 template, 2 text, 3 map, 1 list | 76 s | 36.1 s | 11.5 / 2.8 / 4.1 / 17.6 | $0.1842 |
| How the Panama Canal was built | 10/10 | 0 | 0 | 49 (3) | 1 title, 1 map, 4 template, 1 steps, 2 text | 72 s | 45.6 s | 21.5 / 2.1 / 3.5 / 18.3 | $0.1717 |
| How the human eye sees | 15/15 | 0 | 0 | 50 (2) | 1 title, 3 template, 1 drawing, 2 text, 1 illustration, 1 quote | 78 s | 50.8 s | 16.0 / 9.3 / 5.1 / 20.2 | $0.1663 |
| How photosynthesis works | 14/14 | 0 | 0 | 35 (0) | 1 title, 4 template, 1 illustration, 1 drawing, 2 list | 76 s | 33.5 s | 9.5 / 6.7 / 3.8 / 13.4 | $0.1069 |
| Why we have seasons | 19/19 | 0 | 0 | 27 (7) | 1 title, 2 stat, 2 illustration, 4 template | 77 s | 36.3 s | 10.0 / 7.4 / 4.6 / 14.3 | $0.1093 |
| How batteries store energy | 9/12 | 3 | 0 | 32 (3) | 1 title, 2 illustration, 5 template, 1 drawing, 1 list | 73 s | 31.7 s | 9.5 / 4.4 / 3.6 / 14.1 | $0.0788 |
| How hurricanes form | 10/10 | 0 | 0 | 43 (8) | 1 title, 2 template, 1 drawing, 2 text, 1 illustration, 1 quote, 1 stat, 1 list | 66 s | 45.3 s | 18.0 / 6.7 / 3.4 / 17.1 | $0.1421 |
| How the internet sends data | 9/10 | 1 | 0 | 49 (4) | 1 title, 2 quote, 2 illustration, 2 template, 1 drawing, 1 list | 73 s | 43.1 s | 14.6 / 5.7 / 3.4 / 19.4 | $0.1446 |

Steps are research / script / fact-check / direct, measured on the server. The voice-over was skipped, so video lengths are estimated from the narration.
Supported means the fact-check found every claim of the sentence in the quotes of its cited facts.

## Update, 2026-10-20: Nemotron 3 Super directs the scenes

The director's calls for each scene now use `nvidia/nemotron-3-super-120b-a12b` instead of Ultra; the plan, the critique and the check of places stay on Ultra. We ran only the director again with Super on the ten saved runs above (same facts and narration, no new searches):

- Director cost per video: $0.037 with Super, against $0.120 with Ultra in the run above (the director was 82 % of the cost there).
- Time of the director step: 19.9 s on average, against 17.8 s.
- Scenes shown as plain text: 9 of 84 (11 %), as before.
- The other steps cost $0.026 per video in the run above, and the new topic check adds $0.0004, so a video now costs about $0.065 in Token Factory calls.


## Trust test, 2026-10-20: planted errors and a hand-check against the source pages

The table above counts the fact-check's own verdicts. These two checks test the fact-check against answers known in
advance, so they do not rest on the model's word.

### Planted errors

We wrote 44 sentences that each contain one known error, built from real facts in nine of the saved runs above, and
14 faithful sentences as controls. Each sentence cites the fact it was built from. All 58 went through
`factCheck` in `lib/factcheck.ts`, the same code the app runs (two Ultra checks side by side, with links and hedges
spelled out as claims). A planted error counts as caught when its sentence came back revised or removed.

| Error | Example: planted, then the fact-check's version | Caught |
| --- | --- | --- |
| Number | "lift ships 36 meters" became "lift ships 26 meters" | 7 of 7 |
| Date | "invented the Daniell cell in 1863" became "in 1836" | 6 of 6 |
| Order | "first a tropical storm at 35 knots, and then a tropical depression at 20 knots" was put back in order | 6 of 6 |
| Cause | "Because Vasco da Gama reached India in 1498, Cabral discovered Brazil" lost its "because" | 6 of 6 |
| Hedge | "Exactly 1 million people died" became "Approximately 1 million" | 7 of 7 |
| Person | "hired by President Taft" became "by President Roosevelt" | 6 of 6 |
| Place | "Columbus died in Seville" became "in Valladolid" | 6 of 6 |
| **All errors** | 38 revised, 6 removed | **44 of 44** |
| Controls | kept as written | 14 of 14 (no false alarms) |

- We read all 38 revised sentences: each was put back to what its source says.
- Before commit `a171309`, which spells out a source's hedge as a claim of its own, the same test caught 43 of 44. The
  miss was a hedge: "Variations in Earth's axial tilt cause long-term climatic change" passed, although its source
  says they likely do.
- The run cost $0.075 in Token Factory calls.
- Limits: the errors are single, clear changes in short sentences, written for this test rather than taken from real
  mistakes. With 6 or 7 sentences of each type, a perfect score shows only that the catch rate per type is likely above
  54 to 59 %, and above 92 % for all 44 together (95 % confidence). The hand-check below shows the kind of error that
  gets through.

The sentences, the facts behind them and every verdict are in `docs/trust-test/planted-errors.json`.

### Hand-check of 30 feed claims against the source pages

From each of the ten feed videos we took the three sentences with the most checkable detail (numbers, names and
places), 30 sentences backed by 82 quotes on 41 pages, and read each against the source page itself rather than the
quote Meko saved. Where a site blocked automated access we used an archived copy, the PDF or the Europe PMC API.

- Quotes: 74 of 82 were found word for word on their page or its archived copy, and none differed from it. The other 8
  could not be checked: 4 are on Khan Academy pages that load their text with JavaScript and 4 on Britannica pages that
  block automated access.
- Sentences: 25 of 30 are supported by their pages, 5 partly and none is contradicted.

| Video | Sentence | What the source says | Now |
| --- | --- | --- | --- |
| The Black Death | "It entered Europe in 1347 when Mongols catapulted infected corpses into Caffa during a siege." | It was "reportedly" first introduced this way | Fixed: "It reportedly entered Europe" |
| Volcanoes | "The 1991 Pinatubo eruption shot over 250 megatons of gas into the upper air in one day." | It "is thought to have" injected the gas | Fixed: "is thought to have shot" |
| The Black Death | "... and launched the first public health responses." | "leading to early forms of quarantine and disease control" | As made: "first" says more than "early forms" |
| The Berlin Wall | "A single border guard's decision opened the Berlin Wall on November 9, 1989." | He opened "the largest checkpoint of the Berlin Wall" and was the senior Stasi officer on duty | As made: one checkpoint, and not a border guard |
| The heart | "Your heart pumps blood in a continuous loop through chambers." | The quotes trace blood through the chambers and the lungs but do not say "continuous loop"; the page could not be checked | As made |

Two more sentences are true on their pages but say more than the quote Meko saved: the earthquake video's opener
("suddenly snap and slip", which the page describes but the quote does not) and the Apollo 11 splashdown date (July 24
is in the sentence before the quote).

What this shows: the fact-check catches clear errors of every type we planted, and the quotes are real. What gets
through is overstatement: a word like "first" or "a single guard opened the Wall" that goes a step beyond the source.
Meko shows every sentence next to its source words, so a viewer can see that step. All 30 verdicts, with links to the
pages, are in `docs/trust-test/hand-check.md`.
