import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AnalysisError, analyzeWithClaude, buildRequest, buildUserMessage, parseResponse, RESULT_SCHEMA } from "../../src/background/claude.js";
import { FALLACY_IDS } from "../../src/shared/fallacies.js";

const passages = [
  { id: "p0", text: "If we let students redo one test, next thing you know nobody studies." },
  { id: "p1", text: "Thanks for the update <3 & see you soon." },
];

function textResponse(obj, extra = {}) {
  return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }], ...extra };
}

function fakeClient(respond) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return respond(params);
        },
      },
    },
  };
}

test("request uses the chosen model, effort, fallbacks and a strict JSON schema", () => {
  const req = buildRequest({ model: "claude-opus-5-5", effort: "low", passages });
  assert.equal(req.model, "claude-opus-5-5");
  assert.equal(req.fallbacks, "default");
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(req.output_config.effort, "low");
  assert.equal(req.output_config.format.type, "json_schema");
  assert.equal(req.output_config.format.schema, RESULT_SCHEMA);
  assert.deepEqual(RESULT_SCHEMA.properties.fallacies.items.properties.type.enum, FALLACY_IDS);
  assert.equal(req.thinking, undefined, "Opus 5.5 rejects disabled thinking; leave it adaptive");
  assert.equal(req.messages.length, 1);
});

test("user message contains only the passages, escaped and tagged with ids", () => {
  const msg = buildUserMessage(passages);
  assert.match(msg, /<passage id="p0">\nIf we let students/);
  assert.match(msg, /&lt;3 &amp; see you soon/);
  assert.equal((msg.match(/<passage /g) || []).length, 2);
});

test("parseResponse maps quotes onto passages and drops hallucinated ones", () => {
  const out = parseResponse(
    textResponse({
      fallacies: [
        { passage_id: "p0", type: "slippery_slope", quote: "next thing you know nobody studies", explanation: "e", question: "q", confidence: "high" },
        { passage_id: "p0", type: "straw_man", quote: "this text is not in the passage", explanation: "e", question: "q", confidence: "medium" },
        { passage_id: "p9", type: "ad_hominem", quote: "Thanks", explanation: "e", question: "q", confidence: "high" },
      ],
    }),
    passages,
  );
  assert.equal(out.length, 1);
  const [f] = out;
  assert.equal(f.passageId, "p0");
  assert.equal(passages[0].text.slice(f.start, f.end), "next thing you know nobody studies");
});

test("parseResponse surfaces refusals, truncation and bad JSON as AnalysisError", () => {
  assert.throws(() => parseResponse({ stop_reason: "refusal", content: [] }, passages), (e) => e instanceof AnalysisError && e.code === "refusal");
  assert.throws(() => parseResponse({ stop_reason: "max_tokens", content: [] }, passages), (e) => e.code === "truncated");
  assert.throws(
    () => parseResponse({ stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] }, passages),
    (e) => e.code === "bad-output",
  );
});

test("parseResponse ignores thinking blocks", () => {
  const out = parseResponse(
    {
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify({ fallacies: [] }) }],
    },
    passages,
  );
  assert.deepEqual(out, []);
});

test("analyzeWithClaude calls the beta endpoint once and returns located results", async () => {
  const client = fakeClient(() =>
    textResponse({
      fallacies: [{ passage_id: "p0", type: "slippery_slope", quote: "next thing you know", explanation: "e", question: "q", confidence: "high" }],
    }),
  );
  const out = await analyzeWithClaude({ client, model: "claude-haiku-5-5", effort: "medium", passages });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].model, "claude-haiku-5-5");
  assert.equal(out[0].type, "slippery_slope");
});

test("analyzeWithClaude skips the API when there is nothing to analyze", async () => {
  const client = fakeClient(() => assert.fail("should not be called"));
  assert.deepEqual(await analyzeWithClaude({ client, model: "m", effort: "low", passages: [] }), []);
});

test("analyzeWithClaude maps SDK errors to friendly codes", async () => {
  const headers = new Headers();
  const cases = [
    [new Anthropic.AuthenticationError(401, { error: {} }, "bad key", headers), "auth"],
    [new Anthropic.RateLimitError(429, { error: {} }, "slow down", headers), "rate-limit"],
    [new Anthropic.APIConnectionError({ message: "offline" }), "network"],
  ];
  for (const [error, code] of cases) {
    const client = fakeClient(() => {
      throw error;
    });
    await assert.rejects(analyzeWithClaude({ client, model: "m", effort: "low", passages }), (e) => e.code === code);
  }
});
