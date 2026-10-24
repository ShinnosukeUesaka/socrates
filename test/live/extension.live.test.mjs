// Full path with the real API: page -> content script -> service worker ->
// api.anthropic.com -> flag on the page. Skipped without a key.

import assert from "node:assert/strict";
import { test } from "node:test";
import { launchWithExtension, overlayState, setSettings, sleep, startPageServer, TEST_SETTINGS, waitFor } from "../e2e/helpers.mjs";

const apiKey = process.env.ANTHROPIC_API_KEY;

test("extension flags a fallacy using the real Claude API", { skip: !apiKey && "ANTHROPIC_API_KEY not set", timeout: 120_000 }, async () => {
  const site = await startPageServer();
  const browser = await launchWithExtension();
  try {
    await setSettings(browser.worker, { ...TEST_SETTINGS, apiKey, sound: false });
    const page = await browser.context.newPage();
    await page.goto(site.url);
    await sleep(200);
    await page.click("#ta");
    // No stock phrase the offline patterns know, so only Claude can catch it.
    await page.keyboard.type("My opponent has been divorced twice, so his tax plan obviously can't be trusted.");
    const tag = await waitFor(async () => (await overlayState(page)).tags.find((t) => !t.pending), { timeout: 60_000, message: "Claude flag" });
    console.log("  flagged as:", tag.label);
    assert.equal(tag.label, "Ad Hominem");
    await sleep(600);
    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    console.log("  card:", card);
    assert.match(card, /confidence · Claude/);
  } finally {
    await browser.context.close();
    site.close();
  }
});
