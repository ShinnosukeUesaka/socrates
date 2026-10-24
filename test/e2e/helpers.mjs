// Shared E2E plumbing: a local page to type into, a mock Anthropic API, and a
// Chromium instance with the built extension loaded.

import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { detectHeuristic } from "../../src/shared/heuristics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.resolve(here, "../../dist");

export const STATIC_FALLACY = "Everyone knows the moon landing was staged, prove me wrong.";
export const PREFILLED = "Everyone knows that this prefilled sentence is not mine.";

export const PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Ember test page</title>
<style>
  body { font-family: Georgia, serif; margin: 40px; background: #faf7f2; color: #222; }
  textarea, input, [contenteditable] { display: block; margin: 0 0 26px; font: 16px/1.5 Helvetica, Arial, sans-serif; }
  textarea { width: 760px; height: 110px; padding: 10px 12px; border: 1px solid #bbb; border-radius: 8px; }
  input { width: 760px; padding: 8px 12px; border: 1px solid #bbb; border-radius: 6px; }
  [contenteditable] { width: 760px; min-height: 60px; padding: 10px 12px; border: 1px solid #bbb; border-radius: 8px; background: #fff; }
  .spacer { height: 1800px; }
</style>
</head>
<body>
  <h1>Discussion</h1>
  <p id="static">${STATIC_FALLACY} If we allow this, next thing you know everyone quits.</p>
  <label>Reply <textarea id="ta"></textarea></label>
  <label>Title <input id="single" type="text"></label>
  <label>Password <input id="pw" type="password"></label>
  <label>Card number <input id="card" type="text" autocomplete="cc-number"></label>
  <div id="ce" contenteditable="true"></div>
  <label>Draft <textarea id="prefilled">${PREFILLED}</textarea></label>
  <div class="spacer"></div>
</body>
</html>`;

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

export async function startPageServer() {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE_HTML);
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

function unescapeXml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// Pretends to be the Messages API. It "detects" fallacies with the offline
// patterns so responses are deterministic, and records every request.
export async function startMockApi() {
  const requests = [];
  const server = createServer(async (req, res) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    // SDK 1.x sends the key as a bearer token; older versions use x-api-key.
    const apiKey = req.headers["x-api-key"] ?? req.headers.authorization?.replace(/^Bearer /, "");
    requests.push({ url: req.url, headers: req.headers, apiKey, body });
    if (apiKey === "bad-key") {
      res.writeHead(401, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      return;
    }
    const content = body.messages?.[0]?.content ?? "";
    const fallacies = [];
    for (const m of content.matchAll(/<passage id="(p\d+)">\n([\s\S]*?)\n<\/passage>/g)) {
      for (const f of detectHeuristic(unescapeXml(m[2]))) {
        fallacies.push({
          passage_id: m[1],
          type: f.type,
          quote: f.quote,
          explanation: `Mock Claude explanation for ${f.type}.`,
          question: "Mock Socratic question?",
          confidence: "high",
        });
      }
    }
    res.writeHead(200, { ...cors, "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: `msg_mock_${requests.length}`,
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: JSON.stringify({ fallacies }) }],
        stop_reason: "end_turn",
        stop_details: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    );
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}`, requests, close: () => server.close() };
}

export async function launchWithExtension() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "ember-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1100, height: 800 },
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  return { context, worker, extensionId };
}

export const TEST_SETTINGS = {
  enabled: true,
  apiKey: "",
  engine: "auto",
  intensity: "dramatic",
  sound: true,
  checkPastes: false,
  mutedTypes: [],
  blockedSites: [],
  debounceMs: 300,
  apiBaseUrl: "",
  stats: { total: 0, byType: {} },
};

export async function setSettings(worker, patch) {
  await worker.evaluate((p) => chrome.storage.local.set(p), patch);
}

export async function getSettings(worker, keys) {
  return worker.evaluate((k) => chrome.storage.local.get(k), keys);
}

// Snapshot of everything Ember has drawn on the page.
export function overlayState(page) {
  return page.evaluate(() => {
    const root = document.querySelector("ctp-overlay")?.shadowRoot;
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    };
    if (!root) return { mounted: false, tags: [], hls: [], stamps: 0, embers: 0, vignettes: 0, fixed: 0, banners: 0, card: null, status: null };
    return {
      mounted: true,
      tags: [...root.querySelectorAll(".ctp-tag:not(.ctp-tag--leave)")]
        .filter((t) => t.style.display !== "none")
        .map((t) => ({ label: t.textContent.trim(), pending: t.hasAttribute("data-pending"), rect: box(t) })),
      hls: [...root.querySelectorAll(".ctp-hl")].map(box),
      stamps: root.querySelectorAll(".ctp-stamp").length,
      stampText: root.querySelector(".ctp-stamp")?.textContent ?? null,
      embers: root.querySelectorAll(".ctp-ember").length,
      vignettes: root.querySelectorAll(".ctp-vignette").length,
      banners: root.querySelectorAll(".ctp-banner").length,
      fixed: root.querySelectorAll(".ctp-fixed").length,
      card: root.querySelector(".ctp-card")?.textContent ?? null,
      status: root.querySelector(".ctp-status")?.textContent ?? null,
    };
  });
}

export async function waitFor(fn, { timeout = 6000, interval = 50, message = "condition" } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timed out waiting for ${message}`);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
