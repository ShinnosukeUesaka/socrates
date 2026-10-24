// Reading mode: news articles, opened emails, Google Docs, "check this page"
// and "ask about this selection". Pages are served at realistic URLs.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  launchWithExtension,
  messageActiveTab,
  overlayState,
  setSettings,
  sleep,
  startMockApi,
  startPageServer,
  STATIC_FALLACY,
  TEST_SETTINGS,
  waitFor,
} from "./helpers.mjs";

const ARTICLE_URL = "https://news.example.com/2026/10/24/bike-lanes";
const INBOX_URL = "https://mail.google.com/mail/u/0/#inbox/FMfcgz";
const DOCS_URL = "https://docs.google.com/document/d/shared-doc/edit";
const READING = { checkWriting: false, checkEmails: true, checkArticles: true, checkDocs: true };

let browser;
let api;
let site;
let page;

before(async () => {
  api = await startMockApi();
  site = await startPageServer();
  browser = await launchWithExtension();
  const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
  const [article, inbox, docs] = await Promise.all([fixture("article.html"), fixture("gmail-inbox.html"), fixture("gdocs.html")]);
  await browser.context.route("https://news.example.com/**", (r) => r.fulfill({ contentType: "text/html", body: article }));
  await browser.context.route("https://mail.google.com/**", (r) => r.fulfill({ contentType: "text/html", body: inbox }));
  await browser.context.route("https://docs.google.com/document/**", (r) => r.fulfill({ contentType: "text/html", body: docs }));
});

after(async () => {
  await browser?.context.close();
  api?.close();
  site?.close();
});

beforeEach(async () => {
  await setSettings(browser.worker, { ...TEST_SETTINGS, ...READING });
  api.requests.length = 0;
  for (const p of browser.context.pages()) await p.close();
  page = await browser.context.newPage();
});

const labels = async () => (await overlayState(page)).tags.filter((t) => !t.pending).map((t) => t.label).sort();
const hasTag = (label) => async () => (await labels()).includes(label);

describe("news articles", () => {
  test("flags the article's reasoning, stamping each issue as it scrolls into view", async () => {
    await page.goto(ARTICLE_URL);
    await waitFor(hasTag("Possible unjustified prediction"), { message: "slippery slope tag in article", timeout: 8000 });

    // The bandwagon claim is below the fold: found, but not shown yet.
    let s = await overlayState(page);
    assert.equal(s.pending, 1, "below-the-fold flag waits for the reader");
    assert.match(s.nav, /2 questions on this page/);

    await page.locator("ctp-overlay .ctp-nav").click();
    let stamped = false;
    await waitFor(async () => {
      s = await overlayState(page);
      stamped ||= s.stamps > 0;
      return s.tags.some((t) => t.label === "Possible unsupported factual claim" && !t.pending);
    }, { message: "bandwagon flag after scrolling", timeout: 8000 });
    assert.ok(stamped, "stamp played when the flag came into view");
    assert.ok(await page.evaluate(() => scrollY > 200), "navigator scrolled down to the next flag");
    assert.deepEqual(await labels(), ["Possible unjustified prediction", "Possible unsupported factual claim"], "nav, caption and related links are not analyzed");
  });

  test("with a model, only the article body is sent, using the reading prompt", async () => {
    await setSettings(browser.worker, { apiKey: "sk-test-openai", apiBaseUrl: api.url });
    await page.goto(ARTICLE_URL);
    await waitFor(hasTag("Possible unjustified prediction"), { message: "tag", timeout: 8000 });
    const req = api.requests.at(-1);
    assert.match(req.body.instructions, /embedded in a reading tool/);
    const sent = api.requests.map((r) => r.content).join("\n");
    assert.match(sent, /next thing you know cars will be banned/);
    assert.match(sent, /Millions of cyclists/);
    assert.doesNotMatch(sent, /newsletter|busiest corner|best pizza|By A\. Reporter/);

    await page.locator("ctp-overlay .ctp-tag:not([data-pending])").first().click();
    const card = (await overlayState(page)).card;
    assert.match(card, /Mock openai explanation/);
    assert.match(card, /checked by GPT-5\.5/);
  });

  test("pages that aren't articles are left alone until asked", async () => {
    await page.goto(site.url);
    await sleep(2500);
    assert.equal((await overlayState(page)).tags.length, 0);

    await page.bringToFront();
    await messageActiveTab(browser.worker, { type: "ctp:checkPage" });
    await waitFor(hasTag("Possible unsupported factual claim"), { message: "check-page bandwagon", timeout: 8000 });
    await waitFor(hasTag("Possible unjustified prediction"), { message: "check-page slippery slope", timeout: 8000 });
  });

  test("Ask Socrates about a selection checks just that text", async () => {
    await page.goto(site.url);
    await page.evaluate((needle) => {
      const p = document.querySelector("#static");
      const node = p.firstChild;
      const i = node.data.indexOf(needle);
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + needle.length);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }, STATIC_FALLACY);
    await page.bringToFront();
    await messageActiveTab(browser.worker, { type: "ctp:checkSelection" });
    await waitFor(hasTag("Possible unsupported factual claim"), { message: "selection flag", timeout: 8000 });
    await sleep(500);
    assert.ok(!(await labels()).includes("Possible unjustified prediction"), "text outside the selection isn't flagged");
    assert.match((await overlayState(page)).status ?? "", /question/);
  });

  test("turning off news & articles stops it", async () => {
    await setSettings(browser.worker, { checkArticles: false });
    await page.goto(ARTICLE_URL);
    await sleep(3000);
    assert.equal((await overlayState(page)).tags.length, 0);
  });
});

describe("emails you open", () => {
  test("flags reasoning in a received email, but not the quoted thread", async () => {
    await page.goto(INBOX_URL);
    await waitFor(hasTag("Possible unsupported factual claim"), { message: "unsupported claim tag", timeout: 8000 });
    await sleep(500);
    assert.deepEqual(await labels(), ["Possible unsupported factual claim"]);
    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    assert.match(card, /Unsupported assumption/);
    assert.match(card, /Possible unsupported factual claim/);
  });

  test("emails are skipped when that source is off", async () => {
    await setSettings(browser.worker, { checkEmails: false });
    await page.goto(INBOX_URL);
    await sleep(3000);
    assert.equal((await overlayState(page)).tags.length, 0);
  });
});

describe("Google Docs (reading)", () => {
  test("a Doc you open is checked in full, including text already there", async () => {
    await page.goto(DOCS_URL);
    await waitFor(hasTag("Possible unsupported factual claim"), { message: "existing doc text flagged", timeout: 9000 });
  });
});
