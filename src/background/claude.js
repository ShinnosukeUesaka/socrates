import Anthropic from "@anthropic-ai/sdk";
import { AnalysisError, buildUserMessage, mapFindings, RESULT_SCHEMA, SYSTEM_PROMPT } from "./prompt.js";

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
  return mapFindings(text, passages);
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
