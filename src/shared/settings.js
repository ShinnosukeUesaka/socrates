export const DEFAULT_SETTINGS = {
  enabled: true,
  apiKey: "",
  // "auto" uses Claude when an API key is set and falls back to patterns.
  engine: "auto",
  model: "claude-opus-5-5",
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

export async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function usesClaude(settings) {
  return settings.engine === "claude" || (settings.engine === "auto" && Boolean(settings.apiKey));
}
