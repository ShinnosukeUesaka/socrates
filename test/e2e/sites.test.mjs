// Google Docs and Gmail, using local stand-ins served at their real URLs so the
// extension's site-specific code paths run exactly as they would there.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { launchWithExtension, overlayState, setSettings, sleep, startMockApi, TEST_SETTINGS, waitFor } from "./helpers.mjs";

const DOCS_URL = "https://docs.google.com/document/d/test-doc/edit";
const GMAIL_URL = "https://mail.google.com/mail/u/0/#inbox";

let browser;
let api;
let page;

before(async () => {
  api = await startMockApi();
  browser = await launchWithExtension();
  const docs = await readFile(new URL("./fixtures/gdocs.html", import.meta.url), "utf8");
  const gmail = await readFile(new URL("./fixtures/gmail.html", import.meta.url), "utf8");
  await browser.context.route("https://docs.google.com/document/**", (route) => route.fulfill({ contentType: "text/html", body: docs }));
  await browser.context.route("https://mail.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: gmail }));
});

after(async () => {
  await browser?.context.close();
  api?.close();
});

beforeEach(async () => {
  await setSettings(browser.worker, TEST_SETTINGS);
  api.requests.length = 0;
  for (const p of browser.context.pages()) await p.close();
  page = await browser.context.newPage();
});

const tagNamed = (label) => async () => (await overlayState(page)).tags.find((t) => t.label === label && !t.pending);

describe("Google Docs", () => {
  beforeEach(async () => {
    await page.goto(DOCS_URL);
    await sleep(700); // content script attaches on its first poll
  });

  test("switches on Docs' annotated text layer with our own marker", async () => {
    assert.equal(await page.evaluate(() => window._docs_annotate_canvas_by_ext), "socrates-reasoning-companion");
    assert.ok(await page.evaluate(() => document.querySelectorAll("rect[aria-label]").length) >= 2);
  });

  test("flags what you type, pinned to the text on the canvas; existing text is left alone", async () => {
    await page.click(".page");
    await page.keyboard.type("Honestly? Everyone is stupid.");
    await waitFor(tagNamed("Possible hasty generalisation"), { message: "sweeping generalisation tag", timeout: 8000 });
    await sleep(500);
    const s = await overlayState(page);
    assert.deepEqual(
      s.tags.map((t) => t.label),
      ["Possible hasty generalisation"],
      "pre-existing 'Everyone knows… prove me wrong' must not be flagged",
    );
    const expected = await page.evaluate(() => {
      const rect = [...document.querySelectorAll("rect[aria-label]")].find((r) => r.getAttribute("aria-label").includes("Everyone is stupid"));
      const box = rect.getBoundingClientRect();
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = rect.getAttribute("data-font-css");
      const label = rect.getAttribute("aria-label");
      const i = label.indexOf("Everyone is stupid.");
      return { left: box.left + ctx.measureText(label.slice(0, i)).width, width: ctx.measureText("Everyone is stupid.").width, top: box.top };
    });
    const hl = s.hls[0];
    assert.ok(Math.abs(hl.left + 1 - expected.left) < 2, `left ${hl.left} vs ${expected.left}`);
    assert.ok(Math.abs(hl.width - 2 - expected.width) < 3, `width ${hl.width} vs ${expected.width}`);
    assert.ok(Math.abs(hl.top - expected.top) < 2, `top ${hl.top} vs ${expected.top}`);
  });

  test("flags follow the document when the editor scrolls", async () => {
    await page.click(".page");
    await page.keyboard.type("Everyone is stupid.");
    await waitFor(tagNamed("Possible hasty generalisation"), { message: "tag", timeout: 8000 });
    await sleep(600);
    const before = (await overlayState(page)).hls[0];
    await page.evaluate(() => document.querySelector(".kix-appview-editor").scrollBy(0, 50));
    await waitFor(async () => {
      const hl = (await overlayState(page)).hls[0];
      return hl && Math.abs(before.top - hl.top - 50) < 1.5;
    }, { message: "highlight moved with editor scroll" });
  });

  test("the model sees only the newly typed paragraph", async () => {
    await setSettings(browser.worker, { apiKey: "sk-test-openai", apiBaseUrl: api.url });
    await sleep(100);
    await page.click(".page");
    await page.keyboard.type("We've already invested so much, so we have to keep going.");
    await waitFor(tagNamed("Possible sunk-cost reasoning"), { message: "sunk cost tag", timeout: 8000 });
    const sent = api.requests.map((r) => r.content).join("\n");
    assert.match(sent, /we have to keep going/);
    assert.doesNotMatch(sent, /Meeting notes|old system is perfect/);
  });
});

describe("Gmail", () => {
  beforeEach(async () => {
    await page.goto(GMAIL_URL);
    await sleep(200);
  });

  async function typeInBody(text) {
    await page.click(".Am");
    await page.$eval("#first", (el) => {
      const range = document.createRange();
      range.setStart(el, 0);
      range.collapse(true);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    await page.keyboard.type(text);
  }

  test("flags the reply you type, not the quoted message or signature", async () => {
    await typeInBody("We've already invested €20,000 in our startup, so we have to keep going or all that money will have been wasted.");
    await waitFor(tagNamed("Possible sunk-cost reasoning"), { message: "sunk cost tag", timeout: 8000 });
    await sleep(500);
    const s = await overlayState(page);
    assert.deepEqual(s.tags.map((t) => t.label), ["Possible sunk-cost reasoning"]);
    const body = await page.$eval(".Am", (el) => el.getBoundingClientRect().toJSON());
    assert.ok(s.hls.every((h) => h.top >= body.top && h.bottom <= body.bottom + 2), "highlights inside the message body");

    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    assert.match(card, /Your reasoning/);
    assert.match(card, /Possible sunk-cost reasoning/);
    assert.match(card, /Cognitive bias/);
    assert.match(card, /Socrates asks/);
    assert.match(card, /would you still choose this\?/);
  });

  test("with a model, the quoted message and signature are never sent", async () => {
    await setSettings(browser.worker, { apiKey: "sk-test-openai", apiBaseUrl: api.url });
    await sleep(100);
    await typeInBody("You're either with us or against us on this.");
    await waitFor(tagNamed("Possible false dilemma"), { message: "false dilemma tag", timeout: 8000 });
    const sent = api.requests.map((r) => r.content).join("\n");
    assert.match(sent, /either with us or against us/);
    assert.doesNotMatch(sent, /Bob wrote|our plan is perfect|Sent with love/);
  });
});
