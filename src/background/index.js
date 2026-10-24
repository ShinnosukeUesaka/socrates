import { detectHeuristic } from "../shared/heuristics.js";
import { activeModel, loadSettings, MODEL_NAMES, providerFor, usesAI } from "../shared/settings.js";
import { analyzeWithClaude, createClient } from "./claude.js";
import { analyzeWithOpenAI, createOpenAIClient } from "./openai.js";

const PROVIDERS = {
  anthropic: { label: "Claude", createClient, analyze: analyzeWithClaude },
  openai: { label: "OpenAI", createClient: createOpenAIClient, analyze: analyzeWithOpenAI },
};

const CACHE_LIMIT = 300;
// Per-passage results, keyed by engine + passage text, so retyping elsewhere in
// a long draft doesn't re-send paragraphs that haven't changed.
const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

function heuristicResults(passages) {
  return passages.flatMap((p) => detectHeuristic(p.text).map((f) => ({ ...f, passageId: p.id })));
}

async function analyze(passages) {
  const settings = await loadSettings();
  if (!usesAI(settings)) {
    return { engine: "patterns", fallacies: heuristicResults(passages) };
  }

  const provider = PROVIDERS[providerFor(settings.apiKey)];
  const model = activeModel(settings);
  const engineKey = `${model}|${settings.effort}`;
  const fallacies = [];
  const missing = [];
  for (const p of passages) {
    const hit = cacheGet(`${engineKey}\u0000${p.text}`);
    if (hit) fallacies.push(...hit.map((f) => ({ ...f, passageId: p.id })));
    else missing.push(p);
  }
  if (missing.length) {
    try {
      const client = provider.createClient(settings);
      const found = await provider.analyze({ client, model, effort: settings.effort, passages: missing });
      for (const p of missing) {
        const mine = found.filter((f) => f.passageId === p.id);
        cacheSet(`${engineKey}\u0000${p.text}`, mine);
        fallacies.push(...mine);
      }
    } catch (error) {
      // Keep the user covered while the model is unavailable.
      console.warn(`[Socrates] ${provider.label} analysis failed, using patterns:`, error);
      return {
        engine: "patterns",
        provider: provider.label,
        fallacies: heuristicResults(passages),
        warning: error.message || String(error),
        errorCode: error.code ?? "unknown",
      };
    }
  }
  return { engine: "ai", model, modelName: MODEL_NAMES[model] ?? model, fallacies };
}

const SAMPLE = "We've already invested €20,000 in our startup, so we have to keep going or all that money will have been wasted.";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "ctp:analyze") {
    analyze(msg.passages ?? []).then(sendResponse, (e) => sendResponse({ error: String(e?.message ?? e) }));
    return true;
  }
  if (msg?.type === "ctp:test") {
    analyze([{ id: "p0", text: SAMPLE }]).then(
      (r) => sendResponse({ ...r, sample: SAMPLE }),
      (e) => sendResponse({ error: String(e?.message ?? e) }),
    );
    return true;
  }
  return false;
});
