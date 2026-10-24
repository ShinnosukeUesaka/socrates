import { detectHeuristic } from "../shared/heuristics.js";
import { activeModel, loadSettings, MODEL_NAMES, providerFor, usesAI } from "../shared/settings.js";
import { analyzeWithClaude, createClient } from "./claude.js";
import { analyzeWithOpenAI, createOpenAIClient } from "./openai.js";

const PROVIDERS = {
  anthropic: { label: "Claude", createClient, analyze: analyzeWithClaude },
  openai: { label: "OpenAI", createClient: createOpenAIClient, analyze: analyzeWithOpenAI },
};

const CACHE_LIMIT = 500;
// Long articles are split into requests of about this many characters, sent
// in parallel, so the first flags don't wait on one huge call.
const CHUNK_CHARS = 5000;
// Per-passage results, keyed by engine + passage text, so retyping elsewhere in
// a long draft doesn't re-send paragraphs that haven't changed.
const cache = new Map();
const inflight = new Map();
// Counters for tests and debugging (read from the service worker console).
globalThis.socratesStats = { analyses: 0, modelCalls: 0, passages: 0, inFlight: 0 };

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

function chunk(passages) {
  const chunks = [];
  let cur = [];
  let size = 0;
  for (const p of passages) {
    if (cur.length && size + p.text.length > CHUNK_CHARS) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += p.text.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// mode: "read" for text the user is reading, "write" for their own writing.
async function analyze(passages, mode = "write") {
  const settings = await loadSettings();
  socratesStats.analyses++;
  socratesStats.passages += passages.length;
  if (!usesAI(settings)) {
    return { engine: "patterns", fallacies: heuristicResults(passages) };
  }

  const provider = PROVIDERS[providerFor(settings.apiKey)];
  const model = activeModel(settings);
  const engineKey = `${mode}|${model}|${settings.effort}`;
  const fallacies = [];
  const missing = [];
  const waiting = [];
  for (const p of passages) {
    const key = `${engineKey}\u0000${p.text}`;
    const hit = cacheGet(key);
    if (hit) fallacies.push(...hit.map((f) => ({ ...f, passageId: p.id })));
    else if (inflight.has(key)) waiting.push(inflight.get(key).then((found) => found.map((f) => ({ ...f, passageId: p.id }))));
    else missing.push(p);
  }
  if (missing.length || waiting.length) {
    try {
      const client = provider.createClient(settings);
      const batch = Promise.all(
        chunk(missing).map((part) => {
          socratesStats.modelCalls++;
          socratesStats.inFlight++;
          return provider
            .analyze({ client, model, effort: settings.effort, passages: part, mode })
            .finally(() => socratesStats.inFlight--);
        }),
      ).then((results) => results.flat());
      // Overlapping checks (the user keeps typing) share requests for the
      // same passage instead of paying for it twice.
      for (const p of missing) {
        const key = `${engineKey}\u0000${p.text}`;
        const mine = batch.then((found) => found.filter((f) => f.passageId === p.id));
        inflight.set(key, mine);
        mine.then((found) => cacheSet(key, found), () => {}).finally(() => inflight.delete(key));
      }
      const found = await batch;
      for (const p of missing) fallacies.push(...found.filter((f) => f.passageId === p.id));
      for (const w of await Promise.all(waiting)) fallacies.push(...w);
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
    analyze(msg.passages ?? [], msg.mode).then(sendResponse, (e) => sendResponse({ error: String(e?.message ?? e) }));
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "socrates-check-selection", title: "Ask Socrates about this", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "socrates-check-selection" || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "ctp:checkSelection" }, { frameId: info.frameId ?? 0 }).catch(() => {});
});
