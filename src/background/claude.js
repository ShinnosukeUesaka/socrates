import Anthropic from "@anthropic-ai/sdk";
import { FALLACY_IDS } from "../shared/fallacies.js";
import { locateQuote } from "../shared/text.js";

export const SYSTEM_PROMPT = `You are the analysis engine of Critical Thinking Partner, a browser extension the user installed to get feedback on the reasoning in their own writing (messages, comments, posts, emails) while they type. You'll receive one or more passages the user wrote, each wrapped in a <passage id="..."> tag.

Find logical fallacies: places where the user's argument draws a conclusion from support that doesn't establish it, in a way a careful reasoning teacher would point out. Most passages contain none, and an empty list is the normal answer. Don't flag opinions or preferences stated as such, jokes or obvious hyperbole, questions asked in good faith, claims that are merely unsourced or possibly false, sentences that are visibly unfinished, or views the user is quoting or describing rather than asserting.

For each fallacy you find:
- passage_id: the id of the passage it's in.
- type: the closest category from the allowed list.
- quote: the shortest contiguous span, copied character-for-character from the passage, that carries the faulty reasoning (usually a clause or one sentence). It is used to place a marker on the text, so it must match the passage exactly.
- explanation: one or two sentences, addressed to the user as "you", on why this specific reasoning doesn't hold.
- question: one Socratic question that would help the user strengthen the argument.
- confidence: "high" for a textbook case, "medium" when it's likely but depends on context.

Write the explanation and question in the language of the passage.`;

export const RESULT_SCHEMA = {
  type: "object",
  properties: {
    fallacies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          passage_id: { type: "string" },
          type: { type: "string", enum: FALLACY_IDS },
          quote: { type: "string" },
          explanation: { type: "string" },
          question: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium"] },
        },
        required: ["passage_id", "type", "quote", "explanation", "question", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["fallacies"],
  additionalProperties: false,
};

export class AnalysisError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function createClient({ apiKey, apiBaseUrl }) {
  return new Anthropic({
    apiKey,
    baseURL: apiBaseUrl || undefined,
    // The key never leaves the extension's service worker; pages can't reach it.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: 90_000,
  });
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildUserMessage(passages) {
  return passages.map((p) => `<passage id="${p.id}">\n${escapeXml(p.text)}\n</passage>`).join("\n\n");
}

export function buildRequest({ model, effort, passages }) {
  return {
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: {
      effort,
      format: { type: "json_schema", schema: RESULT_SCHEMA },
    },
    messages: [{ role: "user", content: buildUserMessage(passages) }],
  };
}

// Maps Claude's quotes back onto the passages. Quotes that can't be found are
// dropped: a marker in the wrong place is worse than no marker.
export function parseResponse(response, passages) {
  if (response.stop_reason === "refusal") {
    throw new AnalysisError("refusal", "Claude declined to analyze this text.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AnalysisError("truncated", "The analysis was cut off before it finished.");
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AnalysisError("bad-output", "Claude returned output that wasn't valid JSON.");
  }
  const byId = new Map(passages.map((p) => [p.id, p]));
  const out = [];
  for (const f of data.fallacies ?? []) {
    const passage = byId.get(f.passage_id);
    if (!passage || !FALLACY_IDS.includes(f.type)) continue;
    const loc = locateQuote(passage.text, f.quote);
    if (!loc) continue;
    out.push({
      passageId: passage.id,
      type: f.type,
      start: loc.start,
      end: loc.end,
      quote: passage.text.slice(loc.start, loc.end),
      explanation: f.explanation,
      question: f.question,
      confidence: f.confidence,
    });
  }
  return out;
}

export async function analyzeWithClaude({ client, model, effort, passages }) {
  if (!passages.length) return [];
  let response;
  try {
    response = await client.beta.messages.create(buildRequest({ model, effort, passages }));
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AnalysisError("auth", "Your Anthropic API key was rejected.");
    if (error instanceof Anthropic.PermissionDeniedError) throw new AnalysisError("auth", "This API key can't use that model.");
    if (error instanceof Anthropic.NotFoundError) throw new AnalysisError("model", `Model "${model}" wasn't found.`);
    if (error instanceof Anthropic.RateLimitError) throw new AnalysisError("rate-limit", "Rate limited by the Anthropic API.");
    if (error instanceof Anthropic.BadRequestError) throw new AnalysisError("bad-request", error.message);
    if (error instanceof Anthropic.APIConnectionError) throw new AnalysisError("network", "Couldn't reach the Anthropic API.");
    if (error instanceof Anthropic.APIError) throw new AnalysisError("api", `Anthropic API error ${error.status}.`);
    throw error;
  }
  return parseResponse(response, passages);
}
