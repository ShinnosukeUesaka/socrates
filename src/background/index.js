import { detectHeuristic } from "../shared/heuristics.js";
import { loadSettings, usesClaude } from "../shared/settings.js";
import { analyzeWithClaude, createClient } from "./claude.js";

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
  if (!usesClaude(settings) || !settings.apiKey) {
    return { engine: "patterns", fallacies: heuristicResults(passages) };
  }

  const engineKey = `${settings.model}|${settings.effort}`;
  const fallacies = [];
  const missing = [];
  for (const p of passages) {
    const hit = cacheGet(`${engineKey}\u0000${p.text}`);
    if (hit) fallacies.push(...hit.map((f) => ({ ...f, passageId: p.id })));
    else missing.push(p);
  }
  if (missing.length) {
    try {
      const client = createClient(settings);
      const found = await analyzeWithClaude({ client, model: settings.model, effort: settings.effort, passages: missing });
      for (const p of missing) {
        const mine = found.filter((f) => f.passageId === p.id);
        cacheSet(`${engineKey}\u0000${p.text}`, mine);
        fallacies.push(...mine);
      }
    } catch (error) {
      // Keep the user covered while Claude is unavailable.
      console.warn("[CTP] Claude analysis failed, using patterns:", error);
      return {
        engine: "patterns",
        fallacies: heuristicResults(passages),
        warning: error.message || String(error),
        errorCode: error.code ?? "unknown",
      };
    }
  }
  return { engine: "claude", model: settings.model, fallacies };
}

async function recordFlag(type) {
  const { stats = { total: 0, byType: {} } } = await chrome.storage.local.get("stats");
  stats.total += 1;
  stats.byType[type] = (stats.byType[type] ?? 0) + 1;
  await chrome.storage.local.set({ stats });
}

const SAMPLE = "If we let students redo one test, next thing you know nobody will ever study again.";

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
  if (msg?.type === "ctp:flagged") {
    recordFlag(msg.fallacyType).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
