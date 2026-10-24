import OpenAI from "openai";
import { AnalysisError, buildUserMessage, mapFindings, RESULT_SCHEMA, systemPrompt } from "./prompt.js";

export function createOpenAIClient({ apiKey, apiBaseUrl }) {
  return new OpenAI({
    apiKey,
    baseURL: apiBaseUrl ? `${apiBaseUrl}/v1` : undefined,
    // The key never leaves the extension's service worker; pages can't reach it.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: 90_000,
  });
}

export function buildOpenAIRequest({ model, effort, passages, mode = "write" }) {
  return {
    model,
    instructions: systemPrompt(mode),
    input: buildUserMessage(passages),
    reasoning: { effort },
    text: { format: { type: "json_schema", name: "reasoning_issues", schema: RESULT_SCHEMA, strict: true } },
  };
}

export function parseOpenAIResponse(response, passages) {
  const refused = response.output?.some((item) => item.type === "message" && item.content?.some((c) => c.type === "refusal"));
  if (refused) throw new AnalysisError("refusal", "The model declined to analyze this text.");
  if (response.status === "incomplete") {
    throw new AnalysisError("truncated", "The analysis was cut off before it finished.");
  }
  return mapFindings(response.output_text ?? "", passages);
}

export async function analyzeWithOpenAI({ client, model, effort, passages, mode }) {
  if (!passages.length) return [];
  let response;
  try {
    response = await client.responses.create(buildOpenAIRequest({ model, effort, passages, mode }));
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) throw new AnalysisError("auth", "Your OpenAI API key was rejected.");
    if (error instanceof OpenAI.PermissionDeniedError) throw new AnalysisError("auth", "This API key can't use that model.");
    if (error instanceof OpenAI.NotFoundError) throw new AnalysisError("model", `Model "${model}" wasn't found.`);
    if (error instanceof OpenAI.RateLimitError) throw new AnalysisError("rate-limit", "Rate limited by the OpenAI API.");
    if (error instanceof OpenAI.BadRequestError) throw new AnalysisError("bad-request", error.message);
    if (error instanceof OpenAI.APIConnectionError) throw new AnalysisError("network", "Couldn't reach the OpenAI API.");
    if (error instanceof OpenAI.APIError) throw new AnalysisError("api", `OpenAI API error ${error.status}.`);
    throw error;
  }
  return parseOpenAIResponse(response, passages);
}
