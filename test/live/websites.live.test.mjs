// Reading mode on real pages with a real model. Needs OPENAI_API_KEY (or set
// SOCRATES_LIVE_KEY to an Anthropic key). Costs a few cents per run.
//   npm run test:live
//
// SOCRATES_SHOTS=<dir> saves a screenshot of each page.

import assert from "node:assert/strict";
import { test } from "node:test";
import { startPlayground } from "../../scripts/playground.mjs";
import { launchWithExtension, overlayState, setSettings, sleep, TEST_SETTINGS, waitFor } from "../e2e/helpers.mjs";

const apiKey = process.env.SOCRATES_LIVE_KEY || process.env.OPENAI_API_KEY;
const shots = process.env.SOCRATES_SHOTS;
const READING = { ...TEST_SETTINGS, checkWriting: false, checkEmails: true, checkArticles: true, checkDocs: true, sound: false, apiKey };

const REAL_PAGES = [
  "https://www.theguardian.com/commentisfree/2026/oct/24/donald-trump-world-three-summit-vladimir-putin-xi-jinping",
  "https://www.bbc.com/news/articles/c39wz740e0nyo",
];

const stats = (worker) => worker.evaluate(() => globalThis.socratesStats);

async function settle(page, worker, before) {
  // Wait until this page has been analyzed and no model calls are in flight.
  await waitFor(async () => (await stats(worker)).analyses > before, { timeout: 30_000, message: "analysis started" });
  await waitFor(async () => (await worker.evaluate(() => globalThis.socratesStats)).inFlight === 0, { timeout: 120_000, interval: 500, message: "model calls finished" });
  await sleep(1500);
}

async function revealAll(page) {
  // Scroll through the page so every flag gets its entrance.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await sleep(700);
  }
  await sleep(1500);
}

test("The Daily Certainty (fake news) lights up with questions", { skip: !apiKey && "no API key", timeout: 240_000 }, async () => {
  const server = await startPlayground(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchWithExtension();
  try {
    await setSettings(browser.worker, READING);
    for (const slug of ["remote-work", "crypto", "bike-lanes", "superfood"]) {
      const page = await browser.context.newPage();
      const before = (await stats(browser.worker)).analyses;
      await page.goto(`${base}/news/${slug}.html`);
      await settle(page, browser.worker, before);
      await revealAll(page);
      const s = await overlayState(page);
      const labels = s.all;
      console.log(`  ${slug}: ${labels.length} flags →`, labels.join(", "));
      assert.ok(labels.length >= 4, `${slug}: expected several flags, got ${labels.length}`);
      assert.match(s.nav ?? "", /questions? on this page/);
      if (shots) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(800);
        await page.screenshot({ path: `${shots}/daily-certainty-${slug}.png` });
      }
      await page.close();
    }
    const totals = await stats(browser.worker);
    console.log("  model calls:", totals.modelCalls, "passages:", totals.passages);
  } finally {
    await browser.context.close();
    server.close();
  }
});

for (const url of REAL_PAGES) {
  test(`real site: ${new URL(url).hostname}`, { skip: !apiKey && "no API key", timeout: 180_000 }, async () => {
    const browser = await launchWithExtension();
    try {
      await setSettings(browser.worker, READING);
      const page = await browser.context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page, browser.worker, 0);
      const totals = await stats(browser.worker);
      assert.ok(totals.passages >= 3, `article text was found and sent (${totals.passages} passages)`);
      await revealAll(page);
      const s = await overlayState(page);
      console.log(`  ${new URL(url).hostname}: ${totals.passages} passages, ${totals.modelCalls} model calls, flags:`, s.all.join(", ") || "(none)");
      if (shots) await page.screenshot({ path: `${shots}/${new URL(url).hostname}.png` });
    } finally {
      await browser.context.close();
    }
  });
}
