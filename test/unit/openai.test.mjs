import OpenAI from "openai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeWithOpenAI, buildOpenAIRequest, parseOpenAIResponse } from "../../src/background/openai.js";
import { READ_PROMPT, RESULT_SCHEMA, WRITE_PROMPT } from "../../src/background/prompt.js";
import { activeModel, DEFAULT_SETTINGS, providerFor, usesAI } from "../../src/shared/settings.js";

const passages = [
  { id: "p0", text: "We've already invested €20,000, so we have to keep going." },
  { id: "p1", text: "See you at noon tomorrow." },
];

function response(obj, extra = {}) {
  return {
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(obj) }] }],
    output_text: JSON.stringify(obj),
    ...extra,
  };
}

test("providerFor tells OpenAI and Anthropic keys apart", () => {
  assert.equal(providerFor("sk-ant-api03-abc"), "anthropic");
  assert.equal(providerFor("sk-proj-abc"), "openai");
  assert.equal(providerFor("sk-abc"), "openai");
  assert.equal(providerFor("  sk-ant-x  "), "anthropic");
  assert.equal(providerFor(""), null);
  assert.equal(providerFor("hello"), null);
});

test("usesAI and activeModel follow the key and engine", () => {
  const s = { ...DEFAULT_SETTINGS };
  assert.equal(usesAI(s), false);
  assert.equal(usesAI({ ...s, apiKey: "sk-proj-x" }), true);
  assert.equal(usesAI({ ...s, apiKey: "sk-proj-x", engine: "patterns" }), false);
  assert.equal(activeModel({ ...s, apiKey: "sk-proj-x" }), "gpt-5.5");
  assert.equal(activeModel({ ...s, apiKey: "sk-ant-x" }), "claude-opus-5-5");
});

test("request uses the Responses API with a strict JSON schema and reasoning effort", () => {
  const req = buildOpenAIRequest({ model: "gpt-5.5", effort: "low", passages });
  assert.equal(req.model, "gpt-5.5");
  assert.equal(req.instructions, WRITE_PROMPT);
  assert.equal(buildOpenAIRequest({ model: "gpt-5.5", effort: "low", passages, mode: "read" }).instructions, READ_PROMPT);
  assert.deepEqual(req.reasoning, { effort: "low" });
  assert.deepEqual(req.text.format, { type: "json_schema", name: "reasoning_issues", schema: RESULT_SCHEMA, strict: true });
  assert.match(req.input, /<passage id="p0">/);
  assert.match(req.input, /<passage id="p1">/);
});

test("strict mode requirements hold for the shared schema", () => {
  const check = (schema) => {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
      Object.values(schema.properties).forEach(check);
    }
    if (schema.type === "array") check(schema.items);
  };
  check(RESULT_SCHEMA);
});

test("parseOpenAIResponse locates quotes and drops unknown passages", () => {
  const out = parseOpenAIResponse(
    response({
      fallacies: [
        { passage_id: "p0", type: "sunk_cost", quote: "we have to keep going", explanation: "e", question: "q", confidence: "high" },
        { passage_id: "p7", type: "sunk_cost", quote: "noon", explanation: "e", question: "q", confidence: "high" },
      ],
    }),
    passages,
  );
  assert.equal(out.length, 1);
  assert.equal(passages[0].text.slice(out[0].start, out[0].end), "we have to keep going");
});

test("parseOpenAIResponse surfaces refusals and truncation", () => {
  const refusal = { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }], output_text: "" };
  assert.throws(() => parseOpenAIResponse(refusal, passages), (e) => e.code === "refusal");
  assert.throws(() => parseOpenAIResponse(response({ fallacies: [] }, { status: "incomplete" }), passages), (e) => e.code === "truncated");
  assert.throws(() => parseOpenAIResponse({ status: "completed", output: [], output_text: "nope" }, passages), (e) => e.code === "bad-output");
});

test("analyzeWithOpenAI maps SDK errors to friendly codes", async () => {
  const headers = new Headers();
  const cases = [
    [new OpenAI.AuthenticationError(401, { error: {} }, "bad key", headers), "auth"],
    [new OpenAI.RateLimitError(429, { error: {} }, "slow down", headers), "rate-limit"],
    [new OpenAI.APIConnectionError({ message: "offline" }), "network"],
  ];
  for (const [error, code] of cases) {
    const client = {
      responses: {
        create: async () => {
          throw error;
        },
      },
    };
    await assert.rejects(analyzeWithOpenAI({ client, model: "gpt-5.5", effort: "low", passages }), (e) => e.code === code);
  }
});

test("analyzeWithOpenAI skips the API when there is nothing to analyze", async () => {
  const client = { responses: { create: async () => assert.fail("should not be called") } };
  assert.deepEqual(await analyzeWithOpenAI({ client, model: "gpt-5.5", effort: "low", passages: [] }), []);
});
