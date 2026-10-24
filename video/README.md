# Ember pitch video

A two-minute pitch for Ember, the critical thinking partner, made with [Remotion](https://www.remotion.dev).
It uses the same structure and look as the Ember pitch video in `codebees/video`: a specific story first, the problem worldwide, what we believe, the title card, the product, then the close. The terracotta is swapped for the extension's signal red.

Output: `out/ctp-pitch.mp4` (1920 × 1080, 30 fps, about 2:06).

## Run it

```bash
cd video
npm install
npm run studio    # preview in the browser
npm run render    # writes out/ctp-pitch.mp4
```

Both commands rebuild the timeline and the sound effects first. They don't need an API key, because the narration is already checked in under `public/narration/`.

## How it fits together

| Step | File | What it does |
|---|---|---|
| Narration | `scripts/make-narration.mjs` | Generates every voice line with ElevenLabs **Eleven v4**. `[bracketed]` audio tags such as `[whispers]`, `[gravely]`, `[shouting]` and `[long pause]` steer the delivery. George narrates and Harry shouts the fallacy name. Lines whose text hasn't changed are skipped, and you can pass ids to regenerate only those lines: `node scripts/make-narration.mjs intro outro`. |
| Word timings | `scripts/align.mjs` | Runs ElevenLabs speech-to-text (Scribe) over each line and saves word timings to `src/words.json`, so stamps and text land on the spoken word. |
| Timeline | `scripts/timeline.mjs` | Builds `src/timeline.json` (scene starts, word marks and the scripted demo beats) from the narration lengths and word timings. |
| Sound | `scripts/make-sounds.mjs` | Synthesises every sound effect. The `stinger` and `chime` sounds copy the extension's own Web Audio alarm and chime from `src/content/effects.js`. |
| Pictures | `src/Pitch.tsx`, `src/product.tsx`, `src/editorial.tsx` | Builds the scenes. `product.tsx` recreates the extension on a sample discussion page, using the overlay styles (`src/content/styles.js`), the entrance choreography (`effects.js`) and the fallacy catalogue (`src/shared/fallacies.js`). |

To regenerate the voice after you edit a line, run this (it reads the key from the environment):

```bash
ELEVENLABS_API_KEY=... node scripts/make-narration.mjs && ELEVENLABS_API_KEY=... node scripts/align.mjs
```

The demo is a recreation, not a screen recording, and the video says so on screen. The explanation shown in the card is example text written in the style of Claude's output.

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
- Fonts: Inter Tight, Instrument Serif, JetBrains Mono and Anton, all from Google Fonts.
