# Socrates launch video

A two-minute launch film for **Socrates**, the critical thinking companion for Chrome, made with [Remotion](https://www.remotion.dev). Socrates flags weak arguments in what you read (articles, emails) and in what you write.

The story follows the Ember pitch video in `codebees/video`:

1. One person: it's 1 a.m. and Leo reposts a one-sided article.
2. The problem worldwide: real headlines and two sourced stats.
3. What's missing.
4. The product.
5. Privacy.
6. Who it's for.
7. The close.

It looks like a dark launch film: near-black frames, tight white type, and one accent colour taken from the Socrates icon.

Output: `out/socrates-pitch.mp4` (1920 × 1080, 30 fps, about 2:07).

## Run it

```bash
cd video
npm install
npm run studio    # preview in the browser
npm run render    # writes out/socrates-pitch.mp4 (rendered, then loudness-normalised)
```

Both commands rebuild the timeline and the sound effects first. They don't need an API key, because the narration is already checked in under `public/narration/`.

## How it fits together

| Step | File | What it does |
|---|---|---|
| Narration | `scripts/make-narration.mjs` | Generates every voice line with ElevenLabs **Eleven v4**. `[bracketed]` audio tags such as `[whispers]`, `[gravely]`, `[ominous]`, `[intensely]`, `[shouting]` and `[long pause]` steer the delivery. George narrates and Harry shouts the fallacy name. Lines whose text hasn't changed are skipped, and you can pass ids to regenerate only those lines: `node scripts/make-narration.mjs intro outro`. |
| Word timings | `scripts/align.mjs` | Runs ElevenLabs speech-to-text (Scribe) over each line and saves word timings to `src/words.json`, so text, stamps and camera moves land on the spoken word. |
| Timeline | `scripts/timeline.mjs` | Builds `src/timeline.json` (scene starts, word marks and the scripted demo beats) from the narration lengths and word timings. |
| Sound | `scripts/make-sounds.mjs`, `npm run master` | Synthesises every sound effect. The `stinger` and `chime` sounds copy the extension's own Web Audio alarm and chime from `src/content/effects.js`. After rendering, `npm run master` normalises the mix to -16 LUFS with a -1.5 dB true-peak ceiling. |
| Pictures | `src/Pitch.tsx`, `src/product.tsx`, `src/editorial.tsx` | Builds the scenes. `product.tsx` recreates Socrates on a sample article, an inbox and a comment box. It uses the extension's overlay styles (`src/content/styles.js`), its stamp, fly and tag choreography (`effects.js`), its card layout (`overlay.js`) and its live catalogue (`src/shared/fallacies.js`). |

To regenerate the voice after you edit a line, run this (it reads the key from the environment):

```bash
ELEVENLABS_API_KEY=... node scripts/make-narration.mjs && ELEVENLABS_API_KEY=... node scripts/align.mjs
```

The demo is a recreation, not a screen recording, and the video says so on screen. The explanation and question in the card are example text of the kind the model writes. The article ("The Daily Pulse"), the inbox and the people in them are made up.

## Sources (headline montage and stats)

- 70%: Vosoughi, Roy & Aral, "The spread of true and false news online", *Science* 359 (2018). Reported by BBC News, "Fake news 'travels faster', study finds" (9 Mar 2018).
- #1 risk: World Economic Forum, *Global Risks Report* 2024 and 2025, two-year outlook. Reported by The Guardian, "AI-driven misinformation 'biggest short-term threat to global economy'" (10 Jan 2024). The 2026 report moved it to #2, so the narration names the years.
- Montage headlines:
  - AP, 10 Jan 2024
  - The Atlantic, 8 Mar 2018
  - NPR, 23 Nov 2016
  - The Wall Street Journal, 21 Nov 2016
  - The Guardian, 12 Apr 2016
  - 404 Media, 10 Feb 2025
  - Phys.org, 13 Jan 2025

## Credits

- Music: "Interloper" and "Inspired" by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0.
- Voice: ElevenLabs (premade voices George and Harry).
- Fonts: Inter Tight, JetBrains Mono and Anton, all from Google Fonts.
