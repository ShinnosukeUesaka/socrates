// Real API smoke test (costs a fraction of a cent). Skipped without a key.
//   ANTHROPIC_API_KEY=sk-ant-... npm run test:live

import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeWithClaude, createClient } from "../../src/background/claude.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.EMBER_MODEL || "claude-opus-5-5";

test(`real ${model} call finds and locates a fallacy`, { skip: !apiKey && "ANTHROPIC_API_KEY not set", timeout: 120_000 }, async () => {
  const passages = [
    {
      id: "p0",
      text: "We can't let employees work from home on Fridays. If we allow that, next thing you know nobody will come into the office at all and the company will collapse.",
    },
    { id: "p1", text: "Thanks for sending the slides over. I'll review them tonight and reply tomorrow morning." },
  ];
  const started = Date.now();
  const found = await analyzeWithClaude({ client: createClient({ apiKey }), model, effort: "low", passages });
  console.log(`  ${Date.now() - started} ms`, JSON.stringify(found, null, 2));

  const p0 = found.filter((f) => f.passageId === "p0");
  assert.ok(p0.length > 0, "the extreme prediction in p0 is flagged");
  for (const f of found) {
    const text = passages.find((p) => p.id === f.passageId).text;
    assert.equal(text.slice(f.start, f.end), f.quote, "quote located verbatim");
    assert.ok(f.explanation && f.question);
  }
  assert.equal(found.filter((f) => f.passageId === "p1").length, 0, "neutral passage left alone");
});
