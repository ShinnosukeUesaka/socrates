# Socrates

Better thinking starts with awareness. Socrates is a reasoning companion for Chrome. It reads along with you and flags possible reasoning errors in the news, emails and documents you read, and optionally in what you write.

It does two things:

1. **Flags possible reasoning errors.** It highlights the exact wording and pins a tag to it. Every finding is labelled "Possible …", because it might not be one.
2. **Asks a Socratic question.** Each flag comes with one question tied to that specific issue, for example "Are these really the only two options available?" Socrates doesn't correct the text or tell you what to think.

## What it looks for

- **Logical fallacies** (six core ones): ad hominem, straw man, false dilemma, hasty generalisation, false cause, circular reasoning.
- **Cognitive biases** (not necessarily fallacies): sunk-cost reasoning, confirmation bias, overconfidence, anchoring, survivorship bias.
- **Unsupported assumptions:** unsupported factual claims, unrepresentative evidence, unexamined alternative explanations, unjustified predictions, missing decision criteria.

## When it checks (and when it calls the model)

| Source | When it's read | When the model is called |
|---|---|---|
| News/blog articles | The main article body is found on load (checked every 1.5s, for pages that load late). Nav, captions, ads, related links and comments are skipped. Pages that aren't articles are ignored. | 0.9s after the article is found, or after its text changes. Up to 20,000 characters, split into ~5,000-character requests sent in parallel. |
| Gmail | Each email body you open (quoted earlier messages skipped). | 0.9s after it appears. |
| Google Docs | The rendered pages of any Doc you open, through Docs' accessible text layer. | 0.9s after the text changes, finishing a sentence triggers it within 0.15s, and steady typing gets a check at least every 3s. |
| What you write (off by default) | Only text you type into fields. | Within 0.15s of finishing a sentence, otherwise 0.8s after you pause, at most 3s apart while you type. |
| On demand | The popup's **Check this page now**, or select text → right-click → **Ask Socrates about this**. | Immediately. |

Results are cached per paragraph, so unchanged text is never sent twice. Requests already in flight are shared. Without an API key nothing is sent anywhere; offline patterns catch stock phrasings only.

Flags make a dramatic entrance (stamp, flash, shake, sparks, sound) the first time they scroll into view. A pill shows how many questions the page has and jumps to the next one. Drama level and sound are in the popup.

## Install

```bash
npm install
npm run build
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `dist/`. After a rebuild, click **Update** on that page and reload open tabs.

Paste an API key in Settings. `sk-…` uses OpenAI (GPT-5.5 by default) and `sk-ant-…` uses Anthropic (Claude Opus 5.5).

## Try it

```bash
npm start
```

This serves http://127.0.0.1:4173:

- `/` is a page to type into.
- `/news/` is **The Daily Certainty**, a fictional tabloid whose four articles are packed with bad reasoning.

With GPT-5.5, each article gets 15–19 flags from a single model call.

## Tests

```bash
npm test             # build + unit + headless-Chromium E2E (40 tests) with the extension loaded
npm run test:live    # real model calls: The Daily Certainty, a Guardian opinion piece, a BBC report
```

E2E covers:

- Reading mode: articles, Gmail, Google Docs, selections, "check this page", and scroll-in entrances.
- Writing mode: privacy rules, exact highlight placement in textareas, inputs, contenteditable, Docs' canvas and Gmail compose.
- Check cadence.
- OpenAI and Anthropic request shapes, caching and fallback.

Google Docs and Gmail run as stand-ins served at their real URLs.

## Layout

```
src/background/   prompts (reading + writing), schema, OpenAI and Claude clients, cache, pattern fallback
src/content/      reading-source discovery, field tracking, Google Docs adapter, geometry, overlay, effects
src/shared/       issue catalog, text utilities, offline patterns, settings
playground/       typing playground and The Daily Certainty fake news site
test/unit, test/e2e, test/live
```
