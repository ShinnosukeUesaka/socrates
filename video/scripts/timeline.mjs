// Builds the pitch timeline (in seconds) from the narration (src/narration.json), its word timings (src/words.json)
// and the event times of the real extension recordings (public/footage/*.json, from scripts/record-demo.mjs).
// Writes src/timeline.json, which src/Pitch.tsx reads for scenes, voice, sound effects and footage cuts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p, fallback) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : fallback);
const round = (x) => Math.round(x * 100) / 100;

export function buildTimeline() {
  const N = read('src/narration.json', {});
  const W = read('src/words.json', {});
  const EM = read('public/footage/email.json', null);
  const AR = read('public/footage/article.json', null);
  const d = (id) => N[id]?.duration ?? 0;
  const vo = [];
  const at = {};
  const say = (id, t) => { if (N[id]) { vo.push([id, round(t)]); at[id] = t; } return t + d(id); };
  // Time of the first spoken word equal to (else starting with) `prefix`, relative to the line start.
  const word = (id, prefix) => {
    const list = (W[id]?.words ?? []).map(([text, start]) => [text.toLowerCase().replace(/[^a-z0-9%:$]/g, ''), start]);
    const w = list.find(([text]) => text === prefix) ?? list.find(([text]) => text.startsWith(prefix));
    if (!w) throw new Error(`No word "${prefix}" in ${id}`);
    return w[1];
  };
  const S = {}, M = {};
  let t = 0, e;

  // Monday morning: Dan's pitch.
  S.meeting = 0; e = say('open', 0.4);
  e = say('dan', e + 0.35);
  M.either = round(at.dan + word('dan', 'either'));
  M.finished = round(at.dan + word('dan', 'finished'));
  S.collapse = e + 0.5;
  e = say('collapse', S.collapse + 0.6);
  M.nobody = round(at.collapse + word('collapse', 'nobody'));
  M.later = round(at.collapse + word('collapse', 'year') - 0.1);
  M.gone = round(at.collapse + word('collapse', 'gone'));
  t = e + 0.7;

  // Language, not logic; the stat; what's missing.
  S.problem = t; t += 2.6;
  if (N.stat) { S.stat = t; e = say('stat', t + 0.3); M.statWord = round(at.stat + word('stat', N.stat.word ?? 'only')); t = e + 0.7; }
  S.pivot = t; e = say('pivot', t + 0.3);
  M.checks = ['spell', 'grammar', 'nothing'].map((w) => round(at.pivot + word('pivot', w)));
  M.tagline = round(e + 0.3); t = M.tagline + 1.7;

  // Introducing Socrates, and what it looks at.
  S.intro = t; e = say('intro', t + 0.5);
  M.introName = round(at.intro + word('intro', 'socrates'));
  M.introSub = round(at.intro + word('intro', 'critical'));
  M.introLine = round(at.intro + word('intro', 'flags'));
  t = e + 0.3;
  S.structure = t; e = say('structure', t + 0.3); M.structure = round(at.structure + word('structure', 'structure')); t = e + 1.6;

  // The real extension. Each clip is [from, to, rate, zoom] in footage seconds; cues start a narration line at a
  // footage moment.
  const chapters = [];
  const cut = (id, clips, cues) => {
    const start = t;
    let used = 0;
    const out = clips.map(([from, to, rate, zoom]) => {
      const len = (to - from) / rate;
      const c = { from: round(from), to: round(to), rate, zoom, at: round(start + used), len: round(len) };
      used += len;
      return c;
    });
    const inClip = (src) => {
      const c = out.find((k) => src >= k.from && src <= k.to) ?? out[out.length - 1];
      return round(c.at + (Math.min(Math.max(src, c.from), c.to) - c.from) / c.rate);
    };
    for (const [line, src, offset = 0] of cues) say(line, inClip(src) + offset);
    t = start + used;
    chapters.push({ id, start: round(start), len: round(used), clips: out });
    return inClip;
  };
  if (EM) {
    S.email = t;
    const inEmail = cut('email', [
      [EM.stamp1 - 1.2, EM.allTags + 0.3, 1.15, 'email'],
      [EM.allTags + 0.3, EM.cardClosed - 0.2, 0.85, 'card'],
      [EM.replyFocus - 0.3, EM.typed1 + 0.6, 1.6, 'reply'],
      [EM.stamp2 - 0.7, EM.select, 1.0, 'reply'],
      [EM.select, EM.rethought - 0.15, 1.8, 'reply'],
      [EM.rethought - 0.15, EM.rethought + 2.0, 1.0, 'reply'],
    ], [['d2', EM.stamp1, 0.1], ['d3', EM.card, -0.4], ['d5a', EM.replyFocus], ['d5b', EM.stamp2, 0.2]]);
    M.emailStamp = inEmail(EM.stamp1); M.emailCard = inEmail(EM.card); M.replyStamp = inEmail(EM.stamp2); M.rethought = inEmail(EM.rethought);
  }
  if (AR) {
    S.article = t;
    const inArticle = cut('article', [
      [0.6, 2.6, 1.0, 'page'],
      [AR.stamp1 - 0.6, AR.scrolled1 - 2.0, 1.0, 'page'],
      [AR.scrolled1 - 2.0, AR.scrolled2 + 1.8, 1.45, 'page'],
      [AR.card - 0.8, AR.card + 3.6, 1.0, 'acard'],
    ], [['d1', 0.6, 0.3], ['science', AR.scrolled1 - 1.5]]);
    M.articleStamp = inArticle(AR.stamp1); M.articleCard = inArticle(AR.card);
  }

  S.privacy = t; e = say('privacy', t + 0.4);
  M.privacy = ['article', 'email', 'reply', 'never'].map((w) => round(at.privacy + word('privacy', w)));
  t = e + 0.6;
  S.impact = t; e = say('impact', t + 0.3);
  M.impact = ['better', 'decisions', 'logic'].map((w) => round(at.impact + word('impact', w)));
  t = e + 0.9;
  S.outro = t; e = say('outro', t + 0.5);
  M.outroName = round(at.outro + word('outro', 'socrates'));
  M.outroLine = round(at.outro + word('outro', 'critical'));
  t = e + 1.8;
  S.end = t;

  const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : round(v)]));
  return { scenes: r(S), marks: r(M), chapters, vo, footage: { email: EM, article: AR } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tl = buildTimeline();
  writeFileSync(join(ROOT, 'src', 'timeline.json'), JSON.stringify(tl, null, 2) + '\n');
  console.log(`Timeline: ${tl.scenes.end}s`, tl.scenes);
}
