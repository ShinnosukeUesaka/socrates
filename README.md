# Socrates

Better thinking starts with awareness. Socrates is an AI reasoning companion for Chrome: Grammarly for your thinking.

It has two features:

1. **Reasoning flagger.** As you write, Socrates highlights the exact wording that may contain a reasoning error and explains the potential issue. It looks for three kinds:
   - logical fallacies, such as false dilemmas, circular reasoning or hasty generalisations
   - cognitive biases, such as sunk-cost reasoning, confirmation bias or anchoring
   - unsupported assumptions, such as unjustified certainty, sweeping generalisations or hidden premises

   Findings are framed as possibilities ("Possible sunk-cost reasoning"), not verdicts.
2. **Socratic questioning.** Socrates doesn't correct you. Each flag comes with one question tied to that specific issue, for example "Are these really the only two options available to you?"

The flow is write, flag, question, reflect. There's no profile, dashboard or score.

Flags arrive with some drama, which you can turn down. A "SLIPPERY SLOPE?" stamp slams onto the text, the screen flashes, the field shakes, sparks fly, and a tag stays pinned to the wording. Rewrite the sentence and you get a green "✓ Rethought".

## Where it works

- Any text box, textarea or rich-text editor in Chrome, including Gmail compose.
- **Google Docs.** Docs draws text on a canvas. Socrates switches on Docs' accessible text layer ("annotated canvas") so it can read what you typed and place highlights on the exact words.

## Install

```bash
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `dist/`. After you rebuild, click the reload icon on the extension's card and reload any open tabs.

Open **Settings** and paste an API key. Socrates works out the provider from the key:

- `sk-…`: OpenAI (default model GPT-5.5, low reasoning effort)
- `sk-ant-…`: Anthropic (default Claude Opus 5.5, low effort, with server-side refusal fallback)

Without a key, Socrates falls back to offline pattern checks that only catch stock phrasings.

`npm start` serves a playground page at http://127.0.0.1:4173 for trying it out.

## What it reads

Only text you write:

- It only reads text that comes from trusted keyboard/input events. Page content is never read.
- It skips text that was already in a field or document, text the site inserts, quoted replies and signatures (`blockquote`, `.gmail_quote`), and pasted text. You can turn on pasted text in Settings.
- Password, payment and one-time-code fields are always skipped.
- With a key set, the passages you wrote go to that provider. Nothing else is sent. Paragraphs that haven't changed are cached and not re-sent.

## Tests

```bash
npm test             # build + unit tests + headless Chromium E2E with the extension loaded
npm run test:live    # real API calls (needs OPENAI_API_KEY and/or ANTHROPIC_API_KEY)
```

The E2E suite types into real pages and covers:

- Privacy: page text, script input, password/card fields, pre-filled drafts and pastes are never analyzed.
- Placement: highlights land on the exact span in textareas, inputs, contenteditable editors, Google Docs' canvas and Gmail compose.
- Effects: the full entrance plays.
- Behavior: fix, dismiss, mute, scroll, on/off and blocked sites all work.
- Providers: OpenAI and Anthropic request shapes, caching, and the fallback when a key is bad.

Google Docs and Gmail run as local stand-ins served at their real URLs.

## Layout

```
src/background/   service worker: prompt + schema, OpenAI and Claude clients, cache, pattern fallback
src/content/      field tracking, Google Docs adapter, text→rect geometry, overlay, effects
src/shared/       issue catalog, text utilities, offline patterns, settings
src/popup, src/options, playground/
test/unit, test/e2e, test/live
```
