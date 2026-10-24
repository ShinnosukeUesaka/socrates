// Full path with the real API: page -> content script -> service worker ->
// api.anthropic.com -> flag on the page. Skipped without a key.

import assert from "node:assert/strict";
import { test } from "node:test";
import { launchWithExtension, overlayState, setSettings, sleep, startPageServer, TEST_SETTINGS, waitFor } from "../e2e/helpers.mjs";

const PROVIDERS = [
  ["Claude", process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY", /checked by Claude Opus 5\.5/],
  ["OpenAI", process.env.OPENAI_API_KEY, "OPENAI_API_KEY", /checked by GPT-5\.5/],
];

for (const [name, apiKey, envName, checkedBy] of PROVIDERS) {
test(`extension flags a fallacy using the real ${name} API`, { skip: !apiKey && `${envName} not set`, timeout: 120_000 }, async () => {
  const site = await startPageServer();
  const browser = await launchWithExtension();
  try {
    await setSettings(browser.worker, { ...TEST_SETTINGS, apiKey, sound: false });
    const page = await browser.context.newPage();
    await page.goto(site.url);
    await sleep(200);
    await page.click("#ta");
    // No stock phrase the offline patterns know, so only the model can catch it.
    await page.keyboard.type("My opponent has been divorced twice, so his tax plan obviously can't be trusted.");
    const tag = await waitFor(async () => (await overlayState(page)).tags.find((t) => !t.pending), { timeout: 60_000, message: "Claude flag" });
    console.log("  flagged as:", tag.label);
    assert.equal(tag.label, "Ad hominem");
    await sleep(600);
    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    console.log("  card:", card);
    assert.match(card, checkedBy);
    assert.match(card, /Socrates asks/);
  } finally {
    await browser.context.close();
    site.close();
  }
});
}
