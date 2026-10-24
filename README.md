# Ember: critical thinking partner

A Chrome extension that watches what you type, catches logical fallacies, and makes a scene about it. The offending text gets a highlight and a tag pinned to the spot, a "SLIPPERY SLOPE!" stamp slams down, the field shakes, the screen flashes red, embers fly, and an alarm sting plays. Click a tag to see why the reasoning doesn't hold and a question to help you fix it. Fix the sentence and you get a green "✓ Fixed".

## Install

```bash
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick the `dist/` folder.

Open the extension's **Settings** and paste an Anthropic API key to use Claude (default `claude-opus-5-5`, low effort). Without a key, Ember runs offline pattern checks that only catch stock phrasings like "everyone knows…" or "next thing you know…".

## What it reads

Only text you write:

- It reads text from trusted keyboard/input events in text boxes, textareas and rich-text editors. Page content outside those fields is never read.
- Text that was already in a field when you focused it, text a page script inserts, quoted replies (`blockquote`, Gmail quotes) and pasted text are skipped. You can turn on pasted text in Settings.
- Password, payment, one-time-code and similar fields are always skipped.
- With Claude on, the passages you wrote go to the Anthropic API with your key. Nothing else is sent. Paragraphs that haven't changed are cached and never re-sent.

## Controls

- **Popup:** on/off, drama level (Subtle / Dramatic / Maximum), sound, and a counter of your most frequent fallacies.
- **Settings:** API key, engine, model, effort, how long to wait after you stop typing, sites to skip, and which fallacy types to flag.
- If your OS asks for reduced motion, Ember drops to Subtle.

## Tests

```bash
npm test             # build + unit tests + headless Chromium E2E with the extension loaded
npm run test:live    # real API calls (needs ANTHROPIC_API_KEY)
```

The E2E suite types into a real page and checks the following:

- Page text, script-generated input, password and card fields, pre-filled drafts and pastes are never analyzed.
- Highlights line up with the exact text span in textareas, inputs and contenteditable editors.
- The stamp, embers, flash and shake all fire.
- Fixes, dismiss, mute, scroll, on/off, blocked sites, Claude request shape, caching and the fallback when the key is bad all behave.

## Limits

- It's a browser extension, so it only sees what you type in Chrome, not other apps.
- Google Docs draws text on a canvas, so it can't be highlighted there.
- The offline patterns are a fallback, not a substitute for Claude.

## Layout

```
src/background/   service worker: Claude call (structured output), cache, pattern fallback
src/content/      field tracking, text→rect geometry, overlay, effects
src/shared/       fallacy catalog, text utilities, offline patterns, settings
src/popup, src/options
test/unit, test/e2e, test/live
```
