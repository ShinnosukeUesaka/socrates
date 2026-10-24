// Builds the pitch timeline (in seconds) from the narration durations (src/narration.json) and word timings
// (src/words.json). Writes src/timeline.json, which src/Pitch.tsx reads for scenes, voice, sound effects and
// the scripted product demo, so pictures, voice and sound stay in sync.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p, fallback) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : fallback);

/** Stat beats in the headline montage, in order. Each id is a narration line; the pictures live in src/Pitch.tsx. */
export const NEWS = ['mit', 'wef'];

const round = (x) => Math.round(x * 100) / 100;

export function buildTimeline() {
  const N = read('src/narration.json', {});
  const W = read('src/words.json', {});
  const d = (id) => N[id]?.duration ?? 2;
  const vo = [];
  const at = {};
  const say = (id, t) => { if (N[id]) { vo.push([id, round(t)]); at[id] = t; } return t + d(id); };
  // Time of the first spoken word equal to (else starting with) `prefix`, case-insensitive, relative to the line start.
  const word = (id, prefix) => {
    const list = (W[id]?.words ?? []).map(([text, start]) => [text.toLowerCase().replace(/[^a-z0-9%:]/g, ''), start]);
    const w = list.find(([text]) => text === prefix) ?? list.find(([text]) => text.startsWith(prefix));
    if (!w) throw new Error(`No word "${prefix}" in ${id}`);
    return w[1];
  };
  const S = {}, M = {}, beats = [];
  let t = 0, e;

  // A specific example first: Leo's 1 a.m. headline, the repost, the morning after.
  S.story = 0; e = say('leo1', 0.4);
  M.headline = round(at.leo1 + word('leo1', 'headline'));
  M.furious = round(at.leo1 + word('leo1', 'furious'));
  S.typing = Math.max(5.2, e + 0.3);
  e = say('leo2', S.typing + 0.3);
  M.stamps = ['read', 'believe', 'repost'].map((w) => round(at.leo2 + word('leo2', w)));
  S.morning = Math.max(S.typing + 6, e + 0.6);
  e = say('leo3', S.morning + 0.3);
  M.shared = round(at.leo3 + word('leo3', 'shared'));
  M.nobody = round(at.leo3 + word('leo3', 'nobody'));
  t = e + 0.7;

  // The general picture: the globe, then the title lands.
  S.cold = t; e = say('cold1', t + 0.3); M.title = e + 0.3; t = M.title + 2.0;

  // Stat montage.
  S.news = t;
  for (const id of NEWS) {
    const start = t;
    e = say(id, start + 0.25);
    t = Math.max(start + 2.6, e + 0.6);
    beats.push({ id, start: round(start), len: round(t - start) });
  }

  // Spam filters, spell-check... logic? Then the vision and the title card.
  S.pivot = t; e = say('pivot', t + 0.3);
  M.checks = ['spam', 'spell', 'nothing'].map((w) => round(at.pivot + word('pivot', w)));
  t = e + 0.8;
  S.vision = t; e = say('vision', t + 0.3); M.visionRight = round(at.vision + word('vision', 'whether')); t = e + 0.6;
  S.intro = t; e = say('intro', t + 0.6);
  M.introName = round(at.intro + word('intro', 'socrates'));
  M.introSub = round(at.intro + word('intro', 'critical'));
  M.introLine = round(at.intro + word('intro', 'flags'));
  t = e + 0.5;

  // The product, scripted on a sample article, an inbox, and a comment box. All demo times are absolute seconds.
  S.demo = t;
  const ch = [];
  const demo = {};
  const ENTRANCE = 1.52; // stamp → impact → hold → fly → tag, at "dramatic" intensity (effects.js)
  // 01: it reads along with the article.
  let c = t; say('d1', c + 0.3);
  demo.read = round(at.d1 + word('d1', 'reads'));
  ch.push({ id: 'd1', start: round(c) }); t = c + Math.max(3.6, d('d1') + 0.9);
  // 02: a false dilemma in the article gets tagged.
  c = t; say('d2', c + 0.2);
  demo.flag1 = round(at.d2 + word('d2', 'tagged') - 0.24);
  ch.push({ id: 'd2', start: round(c) }); t = Math.max(c + d('d2') + 0.5, demo.flag1 + ENTRANCE + 0.5);
  // 03: click the tag; Socrates asks instead of telling.
  c = t; e = say('d3', c + 0.2);
  demo.click = round(at.d3 + word('d3', 'click') + 0.15);
  demo.ask = round(at.d3 + word('d3', 'asks'));
  demo.gotIt = round(e + 0.4);
  ch.push({ id: 'd3', start: round(c) }); t = demo.gotIt + 0.4;
  // 04: the inbox, and a pressure tactic.
  c = t; e = say('d4', c + 0.4);
  demo.flag2 = round(at.d4 + word('d4', 'caught') - 0.24);
  ch.push({ id: 'd4', start: round(c) }); t = Math.max(e + 0.5, demo.flag2 + ENTRANCE + 0.5);
  // 05: back on the article, Leo's own reply, at maximum intensity; then he rethinks it.
  c = t; e = say('d5a', c + 0.2);
  demo.type1 = [round(c + 0.6), round(c + 2.0)];
  demo.flag3 = round(Math.max(e + 0.1, demo.type1[1] + 0.35));
  say('shout', demo.flag3 + 0.3);
  e = say('d5b', demo.flag3 + 1.85);
  demo.select = round(at.d5b + word('d5b', 'rethink') - 0.1);
  demo.type2 = [round(demo.select + 0.3), round(demo.select + 1.4)];
  demo.fixed = round(Math.max(demo.type2[1] + 0.3, at.d5b + word('d5b', 'clears') - 0.1));
  ch.push({ id: 'd5', start: round(c) }); t = Math.max(e + 0.6, demo.fixed + 1.3);

  S.science = t; e = say('science', t + 0.4);
  M.quiet = round(at.science + word('science', 'stays'));
  t = Math.max(t + 5, e + 0.8);
  S.privacy = t; e = say('privacy', t + 0.4);
  M.privacy = ['article', 'email', 'reply', 'never'].map((w) => round(at.privacy + word('privacy', w)));
  t = e + 0.7;
  S.impact = t; e = say('impact', t + 0.4);
  M.who = ['students', 'families', 'anyone'].map((w) => round(at.impact + word('impact', w)));
  M.twice = round(at.impact + word('impact', 'every'));
  t = e + 0.7;
  S.outro = t; e = say('outro', t + 0.6);
  M.outroName = round(at.outro + word('outro', 'socrates'));
  M.outroLine = round(at.outro + word('outro', 'critical'));
  t = e + 2.2;
  S.end = t;

  const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : round(v)]));
  return { scenes: r(S), marks: r(M), beats, chapters: ch, demo, vo };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tl = buildTimeline();
  writeFileSync(join(ROOT, 'src', 'timeline.json'), JSON.stringify(tl, null, 2) + '\n');
  console.log(`Timeline: ${tl.scenes.end}s`, tl.scenes);
}
