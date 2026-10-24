export const DEFAULT_SETTINGS = {
  enabled: true,
  // An OpenAI or Anthropic key; the provider is worked out from its prefix.
  apiKey: "",
  // "auto" uses the AI model when an API key is set and falls back to patterns.
  engine: "auto",
  model: "claude-opus-5-5",
  openaiModel: "gpt-5.5",
  effort: "low",
  intensity: "dramatic", // subtle | dramatic | maximum
  sound: true,
  checkPastes: false,
  mutedTypes: [],
  blockedSites: [],
  debounceMs: 1400,
  // Not exposed in the UI; lets tests (or a proxy) point at another endpoint.
  apiBaseUrl: "",
};

export const MODEL_NAMES = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "gpt-5.5": "GPT-5.5",
  "gpt-5.4-mini": "GPT-5.4 mini",
  "gpt-6.1-sol": "GPT-6.1 Sol",
};

export async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

// "anthropic" for sk-ant-… keys, "openai" for other sk-… keys, else null.
export function providerFor(apiKey) {
  const key = (apiKey ?? "").trim();
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

export function usesAI(settings) {
  return settings.engine !== "patterns" && providerFor(settings.apiKey) !== null;
}

export function activeModel(settings) {
  return providerFor(settings.apiKey) === "openai" ? settings.openaiModel : settings.model;
}
