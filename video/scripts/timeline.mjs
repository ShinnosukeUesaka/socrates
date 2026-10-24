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

  // A specific example first: Leo's late-night comeback, and the morning after.
  S.story = 0; e = say('leo1', 0.5); S.typing = Math.max(5.4, e + 0.4);
  e = say('leo2', S.typing + 0.6);
  M.stamps = ['type', 'post', 'win'].map((w) => round(at.leo2 + word('leo2', w)));
  S.morning = Math.max(S.typing + 5.8, e + 0.6);
  e = say('leo3', S.morning + 0.3);
  M.logic = round(at.leo3 + word('leo3', 'all'));
  M.point = round(at.leo3 + word('leo3', 'not'));
  t = Math.max(S.morning + 6, e + 0.7);

  // The general picture: the globe, then the title lands with a boom.
  S.cold = t; e = say('cold1', t + 0.4); M.title = e + 0.35; t = M.title + 2.2;

  // Stat montage.
  S.news = t;
  for (const id of NEWS) {
    const start = t;
    e = say(id, start + 0.25);
    t = Math.max(start + 2.6, e + 0.6);
    beats.push({ id, start: round(start), len: round(t - start) });
  }

  // Spell-check, grammar-check... logic-check? Then the vision and the title card.
  S.pivot = t; e = say('pivot', t + 0.3);
  M.checks = [['spell', 'spell'], ['grammar', 'grammar'], ['logic', 'nothing']].map(([, w]) => round(at.pivot + word('pivot', w)));
  t = e + 0.8;
  S.vision = t; e = say('vision', t + 0.4); M.visionRight = round(at.vision + word('vision', 'before')); t = e + 0.6;
  S.intro = t; e = say('intro', t + 0.7); M.introName = round(at.intro + word('intro', 'ember')); M.introSub = round(at.intro + word('intro', 'chrome')); t = e + 0.6;

  // The product, scripted on a simulated discussion page. All demo times are absolute seconds.
  S.demo = t;
  const ch = [];
  // 01: ignores what you read, watches what you type.
  let c = t; say('d1', c + 0.3);
  const demo = { ignore: round(at.d1 + word('d1', 'ignores')), watch: round(at.d1 + word('d1', 'watches')) };
  demo.focus = round(demo.watch + 0.5);
  ch.push({ id: 'd1', start: round(c) }); t = c + Math.max(4.8, d('d1') + 0.9);
  // 02: Leo's first sentence gets tagged in place.
  c = t; say('d2', c + 0.2);
  demo.type1 = [round(c + 0.05), round(c + 1.5)];
  demo.flag1 = round(at.d2 + word('d2', 'tagged') - 0.24); // stamp impact lands on "tagged"
  ch.push({ id: 'd2', start: round(c) }); t = Math.max(c + d('d2') + 0.6, demo.flag1 + 1.5 + 0.6);
  // 03: the second sentence, at maximum intensity, then "Subtle, it is not."
  c = t;
  demo.type2 = [round(c + 0.05), round(c + 1.55)];
  demo.flag2 = round(c + 1.85);
  say('shout', demo.flag2 + 0.3); // "Slippery slope!" lands just after the stamp hits
  e = say('d3', demo.flag2 + 1.85);
  ch.push({ id: 'd3', start: round(c) }); t = e + 0.4;
  // 04: open the tag, read Claude's question, fix the sentence.
  c = t; e = say('d4', c + 0.2);
  demo.click = round(at.d4 + word('d4', 'click') + 0.15);
  demo.why = round(at.d4 + word('d4', 'explains'));
  demo.ask = round(at.d4 + word('d4', 'asks'));
  demo.gotIt = round(at.d4 + word('d4', 'stronger') + 0.45);
  demo.select = round(demo.gotIt + 0.35);
  demo.type3 = [round(demo.select + 0.35), round(demo.select + 1.65)];
  demo.fixed = round(Math.max(demo.type3[1] + 0.3, at.d4 + word('d4', 'clears') - 0.1));
  ch.push({ id: 'd4', start: round(c) }); t = Math.max(e + 0.8, demo.fixed + 1.4);

  S.science = t; e = say('science', t + 0.4);
  M.quiet = round(at.science + word('science', 'stays'));
  t = Math.max(t + 5, e + 0.8);
  S.privacy = t; e = say('privacy', t + 0.5);
  M.privacy = ['no', 'pasted', 'nothing'].map((w, i) => round(at.privacy + (i === 0 ? word('privacy', 'passwords') : word('privacy', w))));
  t = e + 0.7;
  S.impact = t; e = say('impact', t + 0.4);
  M.who = ['students', 'work', 'anyone'].map((w) => round(at.impact + word('impact', w)));
  M.twice = round(at.impact + word('impact', 'every'));
  t = e + 0.7;
  S.outro = t; e = say('outro', t + 0.6);
  M.outroLines = ['catch', 'keep'].map((w) => round(at.outro + word('outro', w)));
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
