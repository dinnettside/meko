# Submission notes

Drafts for the Devpost submission: the elevator pitch, the project story, the testing instructions, the gallery, the
YouTube text and the script for the demo video. Numbers come from `docs/eval.md`.

## Elevator pitch

Meko turns a topic into a short animated explainer video in under a minute. It fact-checks every sentence against the
exact words of its sources and shows them, so you can check it too.

_(185 characters; Devpost allows 200.)_

## Project story

### Inspiration

Explainer videos are how many people learn something new, but you can rarely check them. You cannot see where a claim
comes from, and AI-made videos make that worse: they sound sure of everything. We wanted explainer videos you can
check, made in about a minute.

### What it does

You type a topic, an audience and a length, like "The French Revolution, high school, 90 seconds". Meko researches the
topic on the web, writes a short narration where every sentence cites facts quoted from their sources, fact-checks
every claim against those quotes, and directs each scene as an animated map, chart, timeline or diagram. The video
plays right away in the browser, with a voice-over and captions. Next to it is the fact-check: every sentence marked
supported, rewritten or removed, with the source words behind it and links to the sources. The sentence being spoken is
marked as the video plays.

A feed of videos made by Meko lets anyone scroll through them, open the fact-check of each, and like or comment without
an account. Finished videos are saved, so the same request plays again at once, for free.

### How we built it

- **An agent in five steps.** Next.js API routes for research, script, fact-check, direction and voice; the browser
  calls them in order and shows each step's progress.
- **NVIDIA Nemotron on Nebius Token Factory, three models, each with its own job.** Nemotron 3 Ultra checks the
  topic, plans the searches, writes the script, fact-checks it, plans the video and checks every place on a map.
  Nemotron 3 Super, at about a third of Ultra's price, directs each scene. Nemotron 3.5 Lightning, at about 6 % of
  Ultra's price, pulls facts with quotes out of each source page, many calls at once. All calls use strict JSON
  schemas, with thinking off, through the OpenAI SDK.
- **Tavily** runs 3 to 6 searches per video in parallel with advanced depth, preferring encyclopedias, museums and
  public bodies and leaving out homework and essay sites, and a second round fills gaps the model finds.
- **Checks in code at every step.** A fact counts only if its quote is found word for word in the source. Every number,
  date, label and place on screen must come from the narration or the facts. A second, separate call checks where every
  place on a map is. Words on screen must keep the narration's hedges.
- **Video in the browser.** The director writes a storyboard as JSON, and Remotion plays it. Everything is drawn in
  code: maps from Natural Earth, three visual themes, more than 30 animated diagrams (a volcano, the heart, a neural
  network, a wing), a kit of pictures for any topic, 266 icons and soft sound effects. ElevenLabs reads the narration,
  and its word timings drive the captions and the animation.
- **Safe to share.** Before any search, Ultra turns down requests for harmful instructions, sexual content, attacks on
  people, private persons and text that is not a topic, with a plain message. On the hosted demo, a demo code and
  limits on new videos per day keep the API credits safe.
- **Vercel and Vercel Blob** host the app, the library of finished videos and the feed's likes and comments.
- **The template library.** The animated templates in `remotion/filmmotor` come from my own film engine, which I made
  during the submission period. I started it on September 29, 2026, for a history film in Norwegian, and on October 14
  I added general templates for Meko. On October 18 I brought it into Meko and adapted it: English text and number
  formats, Meko's three looks and text measured on Meko's fonts, without the engine's player, camera, subtitles, audio
  and maps. The engine draws each template as an animated picture in code. The director picks a template for a scene
  and fills it with words and numbers from the narration, and `lib/templates.ts` checks them against the sources.

### Challenges we ran into

- **Models invent.** Ultra copied quotes that were not in the source and took years from its own memory. Now a fact
  without a word-for-word quote is thrown away, and a timeline may only use years its facts state.
- **Fact-checks miss links and hedges.** "After the city fell, its population crashed" passed, although the source only
  gives the population "by" that year. "The plague helped end feudalism" passed against a source that says it "might
  have". The code now spells out every link as its own claim, runs two checks side by side and keeps the stricter one,
  and the prompt treats certainty as a claim. Before the last of these changes, the planted-error test below caught 43
  of 44 errors. The miss was a hedge. Now it catches all 44.
- **Language models are bad at geometry.** Asked to draw diagrams, the model stacked labels in one column. Now it only
  says what is in a picture, and the code lays it out.
- **Confident place errors.** The director put the medieval port of Caffa in Georgia, more than once in the same video.
  A separate call that only asks where each place is catches it.

### Accomplishments that we're proud of

- Everything on screen can be traced to a source: every number, date, label, place and quote.
- The fact-check passes a test with answers known in advance. We planted one error in each of 44 sentences: a wrong
  number, date, order, cause, hedge, person or place. The fact-check caught all 44. It left all 14 correct control
  sentences as they were.
- The feed holds up against its sources. We read 30 claims from the feed against the source pages themselves. 25 are
  supported, 5 go a step beyond their source (2 of them are fixed since), and none is false. 74 of the 82 quotes behind
  them were found word for word on the pages. The other 8 could not be checked, because the pages block automated
  access or load their text with JavaScript.
- A 90-second video takes under a minute and about 6.5 cents of Nemotron calls (see `docs/eval.md`), and watching
  it again costs nothing.
- Videos do not look alike: the look, the opening and the kind of picture for each scene follow the topic.

### What we learned

- Small, strict checks in code do more than long prompts. The model is good at words; the code is good at rules.
- Three models work better than one: Lightning for many small calls, Super to direct the scenes, Ultra where
  reasoning matters. Moving the scenes from Ultra to Super cut the cost of a video by more than half, with pictures as
  good.
- Showing the fact-check builds more trust than hiding the rewrites: "4 sentences rewritten to match the sources" is a
  feature.
- Clear errors get caught. What gets through is overstatement: a word like "first" that goes a step beyond the source.
  Because every sentence is shown next to its source words, a viewer can see that step.

### What's next for Meko

MP4 export, more languages, historical borders on maps, a public feed of every video with moderation, and a classroom
mode where a teacher picks the sources.

### Built with

Next.js, TypeScript, Tailwind CSS, Remotion, NVIDIA Nemotron 3 Ultra, NVIDIA Nemotron 3 Super, NVIDIA Nemotron 3.5
Lightning, Nebius Token Factory, Tavily, ElevenLabs, Vercel, Vercel Blob, zod, d3-geo, Natural Earth.

## For the Best Use of Tavily prize

Tavily is the ground truth of every Meko video. Nemotron plans 3 to 6 searches, and Meko runs them in parallel with
`search_depth: "advanced"` and `chunks_per_source: 3`, so each page comes back as the three passages that best match the
query. `include_domains` in "prefer" mode steers the searches toward 30 encyclopedias, museums and public bodies, and
`exclude_domains` leaves out 40 homework, essay and social sites. Meko ranks the results by trust and score and reads the
best new page from each search. Nemotron 3.5 Lightning pulls facts out of those passages, each with its exact words, and
the server keeps a fact only if Tavily's text really contains those words. The fact-check then holds every sentence of
the narration to those quotes, and the viewer can read them next to the video. When the model finds a gap, a second
round of Tavily searches fills it.

## Testing instructions

Devpost has no field for testing instructions, so they go in a text file uploaded under **Upload a File** in
Additional info, which only judges and organizers see. The file says what is below, with the demo code typed in by
hand. Never put the code in the repository.

1. Open https://meko-kappa.vercel.app.
2. Choose **Watch** to scroll through videos Meko made. Open **Fact-check** under a video to see each sentence with the
   source words behind it, and click a sentence to play the video from there. The feed and the fact-checks need no
   code.
3. To make a video, go back to the start page, type a topic, pick an audience and a length, type the demo code in the
   **Demo code** field next to **Make video**, and choose **Make video**. It takes about a minute. A topic someone
   already made, with the same audience and length, plays at once from the library, so a topic that is not in the feed
   shows the agent at work.
4. Meko turns down requests for harmful instructions, sexual content, attacks on people, private persons and text that
   is not a topic. It makes at most 30 new videos from one address in ten minutes and 150 a day in all, and videos
   already made always play. If a service has run out of credits, the app says so in plain words, and the feed and the
   fact-checks keep working.

## Gallery

Five screenshots of the live site, taken with headless Chrome on Oct 21, 2026, 1800 x 1200 PNG. Upload them in this
order with these captions; Devpost allows 140 characters per caption. The project's thumbnail is `gallery-2.png`.

1. `docs/images/gallery-1.png`: The start page. Type a topic, pick an audience and a length, and choose Make video.
2. `docs/images/gallery-2.png`: The feed. In the Black Death video, a map marks Strasbourg and Mainz as the voice names
   them, with the year and sources on screen.
3. `docs/images/gallery-3.png`: Fact-check: the source says the plague "might have" ended feudalism, so Meko revised the
   sentence to "may have helped end feudalism".
4. `docs/images/gallery-4.png`: A drawn scene from the volcano video. Every picture in a Meko video is drawn in code.
5. `docs/images/gallery-5.png`: The feed on a phone. One video per screen, with likes, comments, the fact-check and a
   link to share.

## YouTube

Upload as **Public**. The repository link works once the repository is public on Oct 29.

Video link: _(paste the YouTube link here after the upload, and in Devpost's video field)_

**Title** (91 characters; YouTube allows 100):

Meko: fact-checked explainer videos in under a minute | Nebius x NVIDIA Global AI Hackathon

**Description:**

```text
Meko turns a topic into a short animated explainer video in under a minute, and shows the source words behind every sentence.

You type a topic, an audience and a length. An agent researches the topic on the web, writes a narration where every sentence cites its sources, and fact-checks every claim against the exact words of those sources. Then it directs each scene as a map, chart, timeline or diagram. The video plays in the browser with a voice-over, and the fact-check sits next to it.

Try it: https://meko-kappa.vercel.app
Code (MIT license): https://github.com/dinnettside/meko

What it uses:
- NVIDIA Nemotron 3 Ultra, Nemotron 3 Super and Nemotron 3.5 Lightning, served by Nebius Token Factory
- Tavily for web search
- ElevenLabs for the voice-over
- Remotion, Next.js and Vercel

Made for the Nebius x NVIDIA Global AI Hackathon, track Best Apps and Agents. There is no music. Every picture and sound in the videos is made in code. The narrator's voice is made with ElevenLabs too. The rocket video was made on a copy of Meko running on a laptop, with the same code and models, and the wait is shown at 2x speed.

0:00 Making a video
0:14 The agent at work (2x speed)
0:30 The video plays
0:48 The fact-check and the feed
1:16 What it cost
```

The chapter times match the finished demo (1:40). YouTube needs the first at 0:00 and each at least 10 seconds long.

## Demo video script (under 3 minutes)

The finished demo is 1:40 at 1920 x 1080, with an ElevenLabs voice (Matilda) reading a version of this script. It was
cut from screen recordings of the live site and, for making the rocket video, of a copy of Meko running on a laptop with
the same code and models. That video took 37 s and $0.043, all 7 sentences supported, and its wait is shown at 2x speed.
In the finished demo, the demo code field and the note under the form are covered, and the typing of the code is cut out.
The pauses between the voice lines are about a second, and while the rocket video plays, each scene the voice names is
on screen.
The script and checklist below are for a new recording.

Make the video live with the topic "How do rockets reach space?", for high school, in about 60 seconds. Tested on
Oct 20, 2026: all 9 sentences supported, a diagram of the forces on the rocket, and the animated launch with its stages
falling away on the way to orbit, in about 45 seconds for about 5 cents. Do not make this topic on the site before
recording: once it is made, the same request plays at once from the library. That can be a shot of its own at the end.

| Time | Picture | Voice |
| --- | --- | --- |
| 0:00 | The start page | "AI can make a video about anything. But can you trust what it says?" |
| 0:10 | Type the topic, choose Make video | "Meko makes short explainer videos you can check. I ask how rockets reach space, for high school, in about a minute." |
| 0:20 | The progress steps | "An agent built on NVIDIA Nemotron, on Nebius Token Factory, checks the topic and plans searches, and Tavily runs them. Nemotron pulls out facts, each with the exact words from its source, writes the script and fact-checks every claim." |
| 0:45 | The video plays | "About a minute later the video plays. Every picture is drawn in code: the forces on the rocket, the stages burning out, the path into orbit, and captions that follow the voice." |
| 1:15 | The fact-check report, click a sentence | "Next to it, every sentence with the source words behind it. Click one and the video jumps there." |
| 1:35 | The feed, open the Black Death fact-check | "In the feed, here is the Black Death. Four sentences were rewritten, because the sources only say the plague might have ended feudalism. Meko says what its sources say, no more." |
| 2:00 | Like, comment, search | "Anyone can watch, like and comment, without an account." |
| 2:15 | Ask for the rocket video again | "Ask for the same video again and it plays at once from the library, for free. Making it took about 5 cents of Nemotron calls: Ultra for the reasoning, Super for directing the scenes, Lightning for the many small calls." |
| 2:40 | The start page | "Meko. Explainer videos you can check. The code is open source under the MIT license." |

## Recording checklist

**Browser**

- Chrome in a new private window (Cmd+Shift+N), with one tab and no extensions in the toolbar.
- The window at 1920 x 1080, zoom at 100 % (Cmd+0). If the screen is smaller than that, use 1440 x 810, the same
  shape. On a Retina screen the recording is still sharp at 1080p.
- Bookmarks bar hidden (Cmd+Shift+B). Notifications off: turn on Do Not Disturb, and quit Messages, Mail and chat apps.
- Pick light or dark mode before you start, and keep it for the whole video. The switch is in the header.
- The **Demo code** field shows the code as dots, so it can be typed on camera. Do not show it anywhere else.
- Keep the video's own voice-over low or muted while you speak.

**Address for each clip**

| Time | Address | What to do |
| --- | --- | --- |
| 0:00 | https://meko-kappa.vercel.app | The start page, nothing typed |
| 0:10 | The same page | Type "How do rockets reach space?", pick high school students and 60 seconds, type the demo code, choose **Make video** |
| 0:20 | The same page | The progress steps |
| 0:45 | The same page | The video plays |
| 1:15 | The same page | The fact-check next to the video; click a sentence |
| 1:35 | https://meko-kappa.vercel.app/watch#black-death | Open **Fact-check** and click a sentence |
| 2:00 | The same page | Like the video, post a comment, search for "heart". The comment stays on the site |
| 2:15 | https://meko-kappa.vercel.app | The same topic, audience and length again: it plays at once from the library |
| 2:40 | https://meko-kappa.vercel.app | The start page |

**Rules**

- Do not make "How do rockets reach space?" on the site before recording. Once it is made, it plays at once from the
  library, and the shots from 0:10 to 1:15 are lost. A retake needs a new topic for the same reason. Each new video
  uses 6 to 24 Tavily credits.
- At most 2:50. The rules say under 3 minutes.
- No music. The app's own sounds are made in code.
- Upload to YouTube as **Public**, not Unlisted or Private, with the title and description from the YouTube section.
  Then paste the link there and in Devpost's video field.
