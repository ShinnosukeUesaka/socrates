import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  getSettings,
  launchWithExtension,
  overlayState,
  PREFILLED,
  setSettings,
  sleep,
  startMockApi,
  startPageServer,
  STATIC_FALLACY,
  TEST_SETTINGS,
  waitFor,
} from "./helpers.mjs";

const SHOTS = process.env.EMBER_SCREENSHOTS || "test-results";

let browser;
let site;
let api;
let page;

before(async () => {
  await mkdir(SHOTS, { recursive: true });
  site = await startPageServer();
  api = await startMockApi();
  browser = await launchWithExtension();
});

after(async () => {
  await browser?.context.close();
  site?.close();
  api?.close();
});

beforeEach(async () => {
  await setSettings(browser.worker, TEST_SETTINGS);
  api.requests.length = 0;
  for (const p of browser.context.pages()) await p.close();
  page = await browser.context.newPage();
  await page.goto(site.url);
  await sleep(150); // let the content script attach
});

// Clicks the field and puts the caret at the end. (The End key would scroll
// the whole page on macOS.)
async function typeInto(selector, text) {
  await page.click(selector);
  await page.$eval(selector, (el) => {
    if ("value" in el) {
      el.setSelectionRange(el.value.length, el.value.length);
    } else {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
  });
  await page.keyboard.type(text);
}

const tagNamed = (label) => async () => (await overlayState(page)).tags.find((t) => t.label === label && !t.pending);

// Records the peak number of each effect element while waiting for `done`.
async function watchEffects(done, timeout = 6000) {
  const peak = { stamps: 0, embers: 0, vignettes: 0, banners: 0, fieldAnimated: false, stampText: null };
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const s = await overlayState(page);
    peak.stamps = Math.max(peak.stamps, s.stamps);
    peak.embers = Math.max(peak.embers, s.embers);
    peak.vignettes = Math.max(peak.vignettes, s.vignettes);
    peak.banners = Math.max(peak.banners, s.banners);
    peak.stampText ??= s.stampText;
    peak.fieldAnimated ||= await page.evaluate(() => document.querySelector("#ta").getAnimations().length > 0);
    if (await done(s)) return peak;
    await sleep(30);
  }
  throw new Error(`effects never completed: ${JSON.stringify(peak)}`);
}

describe("reading only what the user writes", () => {
  test("page content is never analyzed", async () => {
    await sleep(1200);
    const s = await overlayState(page);
    assert.equal(s.tags.length, 0);
    assert.equal(s.mounted, false, "overlay should not even mount without user typing");
  });

  test("script-generated input is ignored", async () => {
    await page.evaluate((text) => {
      const ta = document.querySelector("#ta");
      ta.focus();
      ta.value = text;
      ta.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }, STATIC_FALLACY);
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0);
  });

  test("password and payment fields are ignored", async () => {
    await typeInto("#pw", "Everyone knows this password is great, prove me wrong.");
    await typeInto("#card", "Everyone knows this card is great, prove me wrong.");
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0);
  });

  test("pre-filled text is skipped; only newly typed sentences are checked", async () => {
    await typeInto("#prefilled", " The weather is lovely today.");
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0, "prefilled fallacy must not be flagged");

    await typeInto("#prefilled", " You're either with us or against us.");
    await waitFor(tagNamed("Possible false dilemma"), { message: "false dilemma tag" });
    await sleep(400);
    const s = await overlayState(page);
    assert.deepEqual(s.tags.map((t) => t.label), ["Possible false dilemma"]);
  });

  test("pasted text is skipped unless enabled", async () => {
    await browser.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.url });
    await page.evaluate(() => navigator.clipboard.writeText("Everyone knows it works."));
    await page.click("#ta");
    await page.keyboard.press("ControlOrMeta+V");
    await waitFor(() => page.$eval("#ta", (t) => t.value.includes("Everyone knows")), { message: "paste landed" });
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0);

    await setSettings(browser.worker, { checkPastes: true });
    await page.evaluate(() => navigator.clipboard.writeText("You're either with us or against us."));
    await sleep(100);
    await page.keyboard.type(" ");
    await page.keyboard.press("ControlOrMeta+V");
    await waitFor(tagNamed("Possible false dilemma"), { message: "false dilemma after enabling pastes" });
    const s = await overlayState(page);
    assert.equal(s.tags.length, 1, "the earlier, unchecked paste stays unflagged");
  });
});

describe("flagging", () => {
  test("textarea: tag is pinned to the exact span, with the full dramatic entrance", async () => {
    const first = "I like this plan a lot. ";
    const fallacy = "If we allow remote work, next thing you know nobody will come to the office.";
    await typeInto("#ta", first + fallacy);

    const peak = await watchEffects(async (s) => s.tags.some((t) => t.label === "Possible unjustified prediction" && !t.pending));
    assert.ok(peak.stamps >= 1, "stamp slammed down");
    assert.match(peak.stampText, /Possible unjustified prediction\?/i);
    assert.ok(peak.embers >= 10, "embers burst");
    assert.ok(peak.vignettes >= 1, "screen flashed");
    assert.ok(peak.fieldAnimated, "field shook");

    await sleep(700); // let the tag's pop-in animation settle before measuring
    const s = await overlayState(page);
    const expected = await page.evaluate(
      ({ before, span }) => {
        const ta = document.querySelector("#ta");
        const cs = getComputedStyle(ta);
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const r = ta.getBoundingClientRect();
        const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft) + ctx.measureText(before).width;
        return { left, width: ctx.measureText(span).width, top: r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) };
      },
      { before: first, span: fallacy },
    );
    const hl = s.hls[0];
    assert.equal(s.hls.length, 1, "one line, one highlight");
    assert.ok(Math.abs(hl.left + 1 - expected.left) < 3, `highlight starts at the fallacy (${hl.left} vs ${expected.left})`);
    assert.ok(Math.abs(hl.width - 2 - expected.width) < 4, `highlight covers the fallacy (${hl.width} vs ${expected.width})`);
    assert.ok(hl.top >= expected.top - 2 && hl.top < expected.top + 26, "highlight on the first line");
    const tag = s.tags[0];
    assert.ok(Math.abs(tag.rect.left - hl.left) < 3, "tag starts where the fallacy starts");
    assert.ok(tag.rect.bottom <= hl.top && hl.top - tag.rect.bottom < 10, "tag sits just above the text");
  });

  test("contenteditable: highlight matches the DOM range of the fallacy", async () => {
    const fallacy = "Everyone knows tabs are better than spaces.";
    await typeInto("#ce", `Here is my take. ${fallacy}`);
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "unsupported claim tag", timeout: 7000 });
    const expected = await page.evaluate((needle) => {
      const ce = document.querySelector("#ce");
      const walker = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.data.indexOf(needle);
        if (i >= 0) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + needle.length);
          const b = range.getBoundingClientRect();
          return { left: b.left, top: b.top, width: b.width };
        }
      }
      return null;
    }, fallacy);
    assert.ok(expected, "fallacy text present in the editor");
    const hl = (await overlayState(page)).hls[0];
    assert.ok(Math.abs(hl.left + 1 - expected.left) < 2, `left ${hl.left} vs ${expected.left}`);
    assert.ok(Math.abs(hl.top - expected.top) < 2, `top ${hl.top} vs ${expected.top}`);
    assert.ok(Math.abs(hl.width - 2 - expected.width) < 3, `width ${hl.width} vs ${expected.width}`);
  });

  test("finishing a sentence triggers a check right away", async () => {
    await setSettings(browser.worker, { debounceMs: 5000 });
    await sleep(100);
    await typeInto("#ta", "Everyone knows it works.");
    const start = Date.now();
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag after sentence end", timeout: 4000 });
    assert.ok(Date.now() - start < 3500, "didn't wait for the 5s pause");
  });

  test("steady typing still gets checked without a pause", async () => {
    await setSettings(browser.worker, { debounceMs: 5000 });
    await sleep(100);
    await typeInto("#ta", "Everyone knows it works");
    // Keep typing slowly, never pausing long enough for the debounce.
    const typing = (async () => {
      for (const ch of " and that is that and so on and so forth") {
        await page.keyboard.type(ch);
        await sleep(150);
      }
    })();
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag while still typing", timeout: 5000 });
    await typing;
  });

  test("single-line input gets flagged inside its box", async () => {
    await typeInto("#single", "Everyone knows cats are better than dogs.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "bandwagon tag" });
    const box = await page.$eval("#single", (el) => el.getBoundingClientRect().toJSON());
    const hl = (await overlayState(page)).hls[0];
    assert.ok(hl.left >= box.left && hl.right <= box.right + 2 && hl.top >= box.top && hl.bottom <= box.bottom + 2, "highlight inside the input");
  });

  test("flags follow the text when the page scrolls", async () => {
    await typeInto("#ta", "Everyone knows this is the best approach.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag" });
    await sleep(700); // let the tag's pop-in animation settle before measuring
    const { tags: [tag], hls: [hl] } = await overlayState(page);
    await page.evaluate(() => window.scrollBy(0, 60));
    await waitFor(async () => {
      const s = await overlayState(page);
      return s.hls[0] && Math.abs(hl.top - s.hls[0].top - 60) < 1.5 && Math.abs(tag.rect.top - s.tags[0].rect.top - 60) < 1.5;
    }, { message: "flag moved with scroll" });

    // Once the text is scrolled off-screen the flag hides instead of floating.
    await page.evaluate(() => window.scrollBy(0, 400));
    await waitFor(async () => (await overlayState(page)).tags.length === 0, { message: "flag hidden off-screen" });
  });

  test("fixing the fallacy removes the flag with a celebration", async () => {
    const fallacy = "Everyone knows it works.";
    await typeInto("#ta", `We should ship this today. ${fallacy}`);
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag" });
    for (let i = 0; i < fallacy.length; i++) await page.keyboard.press("Backspace");
    await page.keyboard.type("The tests pass.");
    await waitFor(async () => (await overlayState(page)).fixed > 0, { message: "fixed celebration" });
    await waitFor(async () => (await overlayState(page)).tags.length === 0, { message: "tag removed" });
  });

  test("clearing the field (message sent) removes flags silently", async () => {
    await typeInto("#ta", "Everyone knows it works.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag" });
    await page.evaluate(() => {
      document.querySelector("#ta").value = "";
    });
    await waitFor(async () => (await overlayState(page)).tags.length === 0, { message: "tag removed after clear" });
    assert.equal((await overlayState(page)).fixed, 0, "no fake celebration");
  });

  test("tag opens an explanation card; Got it dismisses for good", async () => {
    await typeInto("#ta", "My grandpa smoked every day and he lived to 95.");
    await waitFor(tagNamed("Possible unrepresentative evidence"), { message: "tag" });
    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    assert.match(card, /Possible unrepresentative evidence/);
    assert.match(card, /Socrates asks/);
    assert.match(card, /My grandpa smoked/);
    await page.screenshot({ path: `${SHOTS}/card.png` });
    await page.locator("ctp-overlay .ctp-card button[data-action=dismiss]").click();
    await waitFor(async () => (await overlayState(page)).tags.length === 0, { message: "dismissed" });
    await typeInto("#ta", " Anyway, see you.");
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0, "dismissed flag stays gone");
  });

  test("muting a fallacy type from the card", async () => {
    await typeInto("#ta", "Everyone knows it works.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag" });
    await page.locator("ctp-overlay .ctp-tag").click();
    await page.locator("ctp-overlay .ctp-card button[data-action=mute]").click();
    await waitFor(async () => (await overlayState(page)).tags.length === 0, { message: "muted" });
    const { mutedTypes } = await getSettings(browser.worker, ["mutedTypes"]);
    assert.deepEqual(mutedTypes, ["unsupported_claim"]);
  });

  test("several fallacies get separate, non-overlapping tags", async () => {
    await typeInto("#ta", "Everyone knows it works. You're either with us or against us. We've already spent two years on this, we can't quit now.");
    await waitFor(async () => (await overlayState(page)).tags.filter((t) => !t.pending).length === 3, { message: "three tags", timeout: 9000 });
    const tags = (await overlayState(page)).tags;
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i].rect;
        const b = tags[j].rect;
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        assert.ok(!overlap, `${tags[i].label} overlaps ${tags[j].label}`);
      }
    }
  });

  test("maximum drama adds the cinematic banner; subtle skips the stamp", async () => {
    await setSettings(browser.worker, { intensity: "maximum" });
    await sleep(100);
    await typeInto("#ta", "Everyone knows it works.");
    let peak = await watchEffects(async (s) => s.tags.some((t) => !t.pending));
    assert.ok(peak.banners >= 1 && peak.stamps >= 1);

    await page.screenshot({ path: `${SHOTS}/final.png` });
    await setSettings(browser.worker, { intensity: "subtle" });
    await sleep(100);
    await typeInto("#ta", " You're either with us or against us.");
    peak = await watchEffects(async (s) => s.tags.filter((t) => !t.pending).length === 2);
    assert.equal(peak.stamps, 0);
  });

  test("turning Socrates off clears flags and stops checking", async () => {
    await typeInto("#ta", "Everyone knows it works.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "tag" });
    await setSettings(browser.worker, { enabled: false });
    await waitFor(async () => (await overlayState(page)).tags.length === 0, { message: "cleared" });
    await typeInto("#ta", " Prove me wrong.");
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0);
  });

  test("blocked sites are left alone", async () => {
    await setSettings(browser.worker, { blockedSites: ["127.0.0.1"] });
    await sleep(100);
    await typeInto("#ta", "Everyone knows it works.");
    await sleep(1200);
    assert.equal((await overlayState(page)).tags.length, 0);
  });
});

describe("Claude engine (mock API)", () => {
  beforeEach(async () => {
    await setSettings(browser.worker, { apiKey: "sk-ant-test-key", apiBaseUrl: api.url });
  });

  test("sends only the user's typed text, with the right request shape", async () => {
    await typeInto("#pw", "hunter2 everyone knows");
    await typeInto("#prefilled", " Short.");
    await typeInto("#ta", "I disagree with the proposal. If we allow this, next thing you know everyone quits.");
    await waitFor(tagNamed("Possible unjustified prediction"), { message: "claude tag" });

    assert.ok(api.requests.length >= 1);
    const req = api.requests.at(-1);
    assert.equal(req.url, "/v1/messages");
    assert.equal(req.apiKey, "sk-ant-test-key");
    assert.equal(req.headers["anthropic-dangerous-direct-browser-access"], "true");
    assert.match(req.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
    assert.equal(req.body.model, "claude-opus-5-5");
    assert.equal(req.body.fallbacks, "default");
    assert.equal(req.body.output_config.effort, "low");
    assert.equal(req.body.output_config.format.type, "json_schema");

    const sent = api.requests.map((r) => r.content).join("\n");
    assert.match(sent, /next thing you know everyone quits/);
    assert.doesNotMatch(sent, /moon landing/, "static page text never sent");
    assert.doesNotMatch(sent, /hunter2/, "password never sent");
    assert.doesNotMatch(sent, new RegExp(PREFILLED.slice(0, 30)), "pre-filled text never sent");

    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    assert.match(card, /Mock anthropic explanation for unjustified_prediction/);
    assert.match(card, /Clear case · checked by Claude Opus 5\.5/);
  });

  test("unchanged paragraphs are cached and not re-sent", async () => {
    await typeInto("#ta", "Everyone knows it works.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "first tag" });
    const before = api.requests.length;
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("You're either with us or against us.");
    await waitFor(tagNamed("Possible false dilemma"), { message: "second tag" });
    const later = api.requests.slice(before).map((r) => r.content).join("\n");
    assert.match(later, /either with us/);
    assert.doesNotMatch(later, /Everyone knows it works/, "first paragraph served from cache");
    assert.equal((await overlayState(page)).tags.length, 2);
  });

  test("falls back to offline patterns and tells the user when the key is rejected", async () => {
    await setSettings(browser.worker, { apiKey: "sk-ant-bad-key" });
    await sleep(100);
    // A sentence no earlier test used, so it can't come from the result cache.
    await typeInto("#ta", "Millions of fans can't be wrong about this band.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "fallback tag" });
    assert.equal(api.requests.at(-1).apiKey, "sk-ant-bad-key");
    const s = await overlayState(page);
    assert.match(s.status, /Claude unavailable/);
  });
});

describe("OpenAI engine (mock API)", () => {
  test("an OpenAI key routes analysis to the Responses API with a strict schema", async () => {
    await setSettings(browser.worker, { apiKey: "sk-proj-test-openai", apiBaseUrl: api.url });
    await sleep(100);
    await typeInto("#ta", "I like it. We've already spent two years on this, we can't quit now.");
    await waitFor(tagNamed("Possible sunk-cost reasoning"), { message: "openai tag" });

    const req = api.requests.at(-1);
    assert.equal(req.url, "/v1/responses");
    assert.equal(req.apiKey, "sk-proj-test-openai");
    assert.equal(req.body.model, "gpt-5.5");
    assert.deepEqual(req.body.reasoning, { effort: "low" });
    assert.equal(req.body.text.format.type, "json_schema");
    assert.equal(req.body.text.format.strict, true);
    assert.match(req.body.instructions, /Socrates/);
    assert.match(req.content, /we can't quit now/);
    assert.doesNotMatch(req.content, /moon landing/);

    await sleep(600);
    await page.locator("ctp-overlay .ctp-tag").click();
    const card = (await overlayState(page)).card;
    assert.match(card, /Mock openai explanation for sunk_cost/);
    assert.match(card, /checked by GPT-5\.5/);
  });

  test("a rejected OpenAI key falls back to patterns with a notice", async () => {
    await setSettings(browser.worker, { apiKey: "sk-bad-openai", apiBaseUrl: api.url });
    await sleep(100);
    await typeInto("#ta", "Millions of voters can't be wrong about this.");
    await waitFor(tagNamed("Possible unsupported factual claim"), { message: "fallback tag" });
    assert.match((await overlayState(page)).status, /OpenAI unavailable/);
  });
});

describe("extension pages", () => {
  test("popup reflects and changes settings", async () => {
    const popup = await browser.context.newPage();
    await popup.goto(`chrome-extension://${browser.extensionId}/popup.html`);
    await popup.waitForFunction(() => document.querySelector("#engine").textContent !== "…");
    assert.equal(await popup.textContent("#engine"), "Offline patterns");
    assert.equal(await popup.$eval("#intensity button[data-value=dramatic]", (b) => b.getAttribute("aria-pressed")), "true");
    await popup.click("#intensity button[data-value=maximum]");
    await popup.click("#sound + span");
    await sleep(200);
    const s = await getSettings(browser.worker, ["intensity", "sound"]);
    assert.deepEqual(s, { intensity: "maximum", sound: false });
    await popup.screenshot({ path: `${SHOTS}/popup.png` });
  });

  test("options page saves settings and runs a test analysis", async () => {
    const options = await browser.context.newPage();
    await options.goto(`chrome-extension://${browser.extensionId}/options.html`);
    await options.selectOption("#model", "claude-haiku-5-5");
    await options.locator("#types input[value=straw_man]").uncheck();
    await options.click("#test");
    await options.waitForFunction(() => /Sunk-cost reasoning/.test(document.querySelector("#testResult").textContent));
    const s = await getSettings(browser.worker, ["model", "mutedTypes"]);
    assert.equal(s.model, "claude-haiku-5-5");
    assert.deepEqual(s.mutedTypes, ["straw_man"]);
    await options.screenshot({ path: `${SHOTS}/options.png`, fullPage: true });
  });
});
