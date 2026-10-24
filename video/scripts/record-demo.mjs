// Records the real Socrates extension for the demo chapters: the built extension (../dist) in headless Chromium,
// analysing with the real model (reads ANTHROPIC_API_KEY from the environment, never from code).
//   node scripts/record-demo.mjs email     → public/footage/email.mp4   (Dan's email, the card, then a reply)
//   node scripts/record-demo.mjs article   → public/footage/article.mp4 (The Daily Certainty, the playground's fake news site)
// Each run also writes public/footage/<name>.json: event times (seconds into the clip) and cursor keyframes, which
// scripts/timeline.mjs and src/Pitch.tsx use to cut the footage and draw the cursor (headless screencasts have none).
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startPlayground } from '../../scripts/playground.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(ROOT, '..');
const OUT = path.join(ROOT, 'public', 'footage');
const which = process.argv[2] ?? 'email';
const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error('Set ANTHROPIC_API_KEY to record the real extension.');
await mkdir(OUT, { recursive: true });

// A private copy of the build, so a rebuild elsewhere can't change it mid-recording.
const ext = await mkdtemp(path.join(tmpdir(), 'socrates-ext-'));
await cp(path.join(REPO, 'dist'), ext, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'socrates-rec-'));
const VIEW = { width: 1280, height: 720 }, DPR = 1.5;
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: VIEW, deviceScaleFactor: DPR,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker');
const setSettings = (patch) => worker.evaluate((p) => chrome.storage.local.set(p), patch);
await setSettings({ enabled: true, apiKey: key, engine: 'auto', intensity: 'dramatic', sound: false, checkEmails: true, checkArticles: true, checkDocs: false, checkWriting: true, checkPastes: false, mutedTypes: [], blockedSites: [], debounceMs: 800 });

// Pages at realistic addresses.
const playground = await startPlayground(4188);
await context.route('https://dailycertainty.example/**', async (r) => {
  const u = new URL(r.request().url());
  const res = await fetch(`http://127.0.0.1:4188${u.pathname}`);
  await r.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'text/html', body: Buffer.from(await res.arrayBuffer()) });
});
const inbox = await readFile(path.join(ROOT, 'footage', 'inbox.html'), 'utf8');
await context.route('https://mail.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: inbox }));

const page = await context.newPage();
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data: Buffer.from(data, 'base64') });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

const events = {};
const cursor = []; // [t, x, y, click] in CSS px of the 1280 × 720 viewport
let t0 = null;
const now = () => Date.now() / 1000 - (t0 ?? Date.now() / 1000);
const mark = (name) => { events[name] ??= Math.round(now() * 100) / 100; console.log(`${name}: ${events[name]}s`); };
let mouse = { x: 1100, y: 640 };
async function moveTo(x, y, steps = 24) {
  const from = { ...mouse };
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    mouse = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
    await page.mouse.move(mouse.x, mouse.y);
    cursor.push([Math.round(now() * 100) / 100, Math.round(mouse.x), Math.round(mouse.y), 0]);
    await page.waitForTimeout(16);
  }
}
async function click() {
  cursor.push([Math.round(now() * 100) / 100, Math.round(mouse.x), Math.round(mouse.y), 1]);
  await page.mouse.down(); await page.mouse.up();
}
const state = () => page.evaluate(() => {
  const root = document.querySelector('ctp-overlay')?.shadowRoot;
  if (!root) return { tags: [], stamps: 0, card: false, fixed: 0, nav: null };
  return {
    tags: [...root.querySelectorAll('.ctp-tag:not(.ctp-tag--leave)')].filter((t) => t.style.display !== 'none' && !t.hasAttribute('data-pending')).map((t) => { const b = t.getBoundingClientRect(); return { label: t.textContent.trim(), x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top }; }),
    stamps: root.querySelectorAll('.ctp-stamp').length,
    card: Boolean(root.querySelector('.ctp-card')),
    fixed: root.querySelectorAll('.ctp-fixed').length,
    nav: root.querySelector('.ctp-nav')?.textContent ?? null,
  };
});
async function waitFor(fn, timeout = 60000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) { const v = await fn(); if (v) return v; await page.waitForTimeout(100); }
  throw new Error(`Timed out: ${label}`);
}
// Logs when stamps and tags appear, in the background.
let watching = true;
const seen = { stamps: 0 };
(async () => {
  let n = 0, prevStamps = 0;
  while (watching) {
    const s = await state().catch(() => null);
    if (s) {
      if (s.stamps > 0 && prevStamps === 0) { n++; mark(`stamp${n}`); }
      prevStamps = s.stamps;
      seen.stamps = n;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
})();

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: VIEW.width * DPR, maxHeight: VIEW.height * DPR, everyNthFrame: 1 });
t0 = Date.now() / 1000;

if (which === 'article') {
  await page.goto('https://dailycertainty.example/news/remote-work.html');
  mark('loaded');
  await page.mouse.move(mouse.x, mouse.y);
  const first = await waitFor(async () => (await state()).tags.length > 0 && (await state()), 90000, 'first article flag');
  mark('firstTag');
  await page.waitForTimeout(2500);
  // Read down the article: each flag stamps as it comes into view.
  for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(260); }
  mark('scrolled1');
  await page.waitForTimeout(2600);
  for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(260); }
  mark('scrolled2');
  await page.waitForTimeout(2600);
  // Open the card on a visible tag.
  const s = await state();
  const tag = s.tags.find((t) => t.y > 120 && t.y < 600) ?? s.tags[0];
  console.log('card on', tag?.label, JSON.stringify(s.tags.map((t) => t.label)));
  if (tag) {
    await moveTo(tag.x, tag.y);
    await click();
    await waitFor(async () => (await state()).card, 5000, 'card');
    mark('card');
    await page.waitForTimeout(4500);
  }
  events.tags = (await state()).tags.map((t) => t.label);
  events.nav = (await state()).nav;
} else {
  await page.goto('https://mail.google.com/mail/u/0/#inbox/FMfcgzKestrelAtlas');
  mark('loaded');
  await page.mouse.move(mouse.x, mouse.y);
  await waitFor(async () => (await state()).tags.length > 0, 90000, 'first email flag');
  mark('firstTag');
  // Let every flag make its entrance.
  let last = 0, stable = 0;
  await waitFor(async () => { const n = (await state()).tags.length; stable = n === last ? stable + 1 : 0; last = n; return stable > 30; }, 60000, 'all email flags');
  mark('allTags');
  const s = await state();
  events.tags = s.tags.map((t) => t.label);
  console.log('email tags', JSON.stringify(events.tags));
  const pick = s.tags.find((t) => /dilemma/i.test(t.label)) ?? s.tags[0];
  await moveTo(pick.x, pick.y);
  await click();
  await waitFor(async () => (await state()).card, 5000, 'card');
  mark('card');
  events.cardLabel = pick.label;
  await page.waitForTimeout(5500);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5).catch(() => {});
  await waitFor(async () => !(await state()).card, 5000, 'card closed').catch(() => {});
  mark('cardClosed');
  // Your own reply, at maximum intensity.
  await setSettings({ intensity: 'maximum' });
  const box = await page.locator('.Am').boundingBox();
  await moveTo(box.x + 60, box.y + box.height / 2);
  await click();
  mark('replyFocus');
  await page.waitForTimeout(400);
  mark('typing1');
  const FLAWED = "We've put too much into Atlas to stop now, so let's sign.";
  await page.keyboard.type(`Thanks Dan. ${FLAWED}`, { delay: 38 });
  mark('typed1');
  const before = seen.stamps;
  await waitFor(async () => seen.stamps > before, 60000, 'reply flag');
  mark('replyFlag');
  await page.waitForTimeout(3500);
  events.replyTags = (await state()).tags.map((t) => t.label);
  // Rethink it: delete the flawed sentence and ask a better question.
  mark('select');
  for (let i = 0; i < FLAWED.length; i++) await page.keyboard.press('Backspace', { delay: 12 });
  mark('typing2');
  await page.keyboard.type('Before we sign, what results would show Atlas is working?', { delay: 38 });
  mark('typed2');
  await waitFor(async () => (await state()).fixed > 0, 60000, 'rethought').then(() => mark('rethought')).catch((e) => console.log(String(e)));
  await page.waitForTimeout(2500);
}
mark('end');
watching = false;
await cdp.send('Page.stopScreencast');
await page.waitForTimeout(300);

// Frames → constant 30 fps video. Each frame is held until the next one arrives.
const dir = await mkdtemp(path.join(tmpdir(), 'socrates-frames-'));
const start = frames[0].t;
const shift = start - t0; // screencast clock vs. event clock (both seconds since the epoch)
let list = '';
await Promise.all(frames.map((f, i) => writeFile(path.join(dir, `f${String(i).padStart(5, '0')}.jpg`), f.data)));
frames.forEach((f, i) => {
  const next = frames[i + 1]?.t ?? f.t + 0.5;
  list += `file '${path.join(dir, `f${String(i).padStart(5, '0')}.jpg`)}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
});
list += `file '${path.join(dir, `f${String(frames.length - 1).padStart(5, '0')}.jpg`)}'\n`;
await writeFile(path.join(dir, 'list.txt'), list);
const mp4 = path.join(OUT, `${which}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', mp4]);
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim());
// Express every time relative to the first video frame.
const rel = (t) => Math.round((t - shift) * 100) / 100;
const out = { duration, viewport: VIEW, ...Object.fromEntries(Object.entries(events).map(([k, v]) => [k, typeof v === 'number' ? rel(v) : v])), cursor: cursor.map(([t, x, y, c]) => [rel(t), x, y, c]) };
await writeFile(path.join(OUT, `${which}.json`), JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${mp4} (${duration.toFixed(1)} s, ${frames.length} frames)`);
await rm(dir, { recursive: true, force: true });
await context.close();
playground.close();
