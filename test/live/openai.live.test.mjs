// Real OpenAI API smoke test (costs a fraction of a cent). Skipped without a key.
//   OPENAI_API_KEY=sk-... npm run test:live

import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeWithOpenAI, createOpenAIClient } from "../../src/background/openai.js";

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.SOCRATES_OPENAI_MODEL || "gpt-5.5";

test(`real ${model} call flags and locates possible reasoning errors`, { skip: !apiKey && "OPENAI_API_KEY not set", timeout: 120_000 }, async () => {
  const passages = [
    { id: "p0", text: "Everyone is stupid." },
    { id: "p1", text: "We've already invested €20,000 in our startup, so we have to keep going or all that money will have been wasted." },
    { id: "p2", text: "Thanks for sending the slides over. I'll review them tonight and reply tomorrow morning." },
  ];
  const started = Date.now();
  const found = await analyzeWithOpenAI({ client: createOpenAIClient({ apiKey }), model, effort: "low", passages });
  console.log(`  ${Date.now() - started} ms`, JSON.stringify(found, null, 2));

  assert.ok(found.some((f) => f.passageId === "p0"), "sweeping claim flagged");
  assert.ok(found.some((f) => f.passageId === "p1" && f.type === "sunk_cost"), "sunk cost flagged");
  assert.equal(found.filter((f) => f.passageId === "p2").length, 0, "neutral passage left alone");
  for (const f of found) {
    const text = passages.find((p) => p.id === f.passageId).text;
    assert.equal(text.slice(f.start, f.end), f.quote, "quote located verbatim");
    assert.ok(f.explanation && f.question.endsWith("?"));
  }
});
