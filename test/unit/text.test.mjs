import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPassages, locateQuote, newSentenceKeys, normalize, sentenceKey, splitSentences } from "../../src/shared/text.js";

test("splitSentences returns trimmed spans with correct offsets", () => {
  const text = "  First one.  Second one?\nThird line without stop";
  const s = splitSentences(text);
  assert.deepEqual(
    s.map((x) => x.text),
    ["First one.", "Second one?", "Third line without stop"],
  );
  for (const x of s) assert.equal(text.slice(x.start, x.end), x.text);
});

test("splitSentences ignores punctuation-only fragments", () => {
  assert.deepEqual(splitSentences("... !!! ?").length, 0);
});

test("normalize folds case, curly quotes and whitespace", () => {
  assert.equal(normalize("  It’s   “Fine”\n\tOK…"), "it's \"fine\" ok...");
});

test("locateQuote finds exact matches and prefers the one nearest the hint", () => {
  const text = "Everyone knows it. Later: everyone knows it.";
  assert.deepEqual(locateQuote(text, "everyone knows it", { hint: 30 }), { start: 26, end: 43 });
  assert.deepEqual(locateQuote(text, "Everyone knows it"), { start: 0, end: 17 });
});

test("locateQuote tolerates curly quotes, case and whitespace differences", () => {
  const text = "Honestly, you’re  an IDIOT so\nyour plan fails.";
  const loc = locateQuote(text, "you're an idiot so your plan fails");
  assert.ok(loc);
  assert.equal(text.slice(loc.start, loc.end), "you’re  an IDIOT so\nyour plan fails");
});

test("locateQuote handles an elided middle", () => {
  const text = "If we allow this one exception, then soon after that, nobody will follow any rules.";
  const loc = locateQuote(text, "If we allow this one exception … nobody will follow any rules");
  assert.equal(text.slice(loc.start, loc.end), "If we allow this one exception, then soon after that, nobody will follow any rules");
});

test("locateQuote strips wrapping quotes and respects `within`", () => {
  const text = "Prove me wrong. Seriously, prove me wrong.";
  assert.deepEqual(locateQuote(text, '"prove me wrong"', { within: [16, text.length] }), { start: 27, end: 41 });
  assert.equal(locateQuote(text, "something else"), null);
  assert.equal(locateQuote(text, "   "), null);
});

test("buildPassages skips baseline sentences and keeps offsets", () => {
  const text = "Quoted from the email. I think you're wrong. Everyone knows that.\n\nNew paragraph here now.";
  const baseline = new Set([sentenceKey("Quoted from the email.")]);
  const passages = buildPassages(text, baseline);
  assert.deepEqual(
    passages.map((p) => p.text),
    ["I think you're wrong. Everyone knows that.", "New paragraph here now."],
  );
  for (const p of passages) assert.equal(text.slice(p.start, p.end), p.text);
});

test("buildPassages drops passages that are too short to judge", () => {
  assert.deepEqual(buildPassages("Hi there."), []);
});

test("buildPassages splits passages around non-authored sentences", () => {
  const text = "Mine one is here. Theirs sits here. Mine two is here.";
  const passages = buildPassages(text, new Set([sentenceKey("Theirs sits here.")]));
  assert.deepEqual(passages.map((p) => p.text), ["Mine one is here.", "Mine two is here."]);
});

test("buildPassages caps passage length", () => {
  const sentence = "This sentence is padding to make a very long paragraph indeed. ";
  const passages = buildPassages(sentence.repeat(60));
  assert.ok(passages.length > 1);
  for (const p of passages) assert.ok(p.text.length <= 1200);
});

test("newSentenceKeys reports only sentences that were added", () => {
  assert.deepEqual(newSentenceKeys("One two three.", "One two three. Four five six."), [sentenceKey("Four five six.")]);
});
