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

