import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import TL from './timeline.json';
import VOICE from './narration.json';
import WORDS from './words.json';
import { FALLACIES, FALLACY_IDS } from '../../src/shared/fallacies.js';
import { BrowserFrame, Clipping, Embers, FallacyTag, Grain, Leo, Masthead, Mono, P, PaperBits, Reveal, Ring, Ticker, WarnIcon, count, grot, lerp, mono, poster, serif, typed, useSpr } from './editorial';
import { ForumPage, PAGE_H, PAGE_W, SENTENCE_1, SENTENCE_2, impactAt, tagAt, type DemoScript, type Flag } from './product';
import { HEADLINES, NEWS } from './news';

// Two-minute pitch for Ember, the critical thinking partner. Same structure and look as the Ember pitch video
// (codebees/video): a specific story, the global problem, the belief, the product, why it is safe, the close.
// Timings come from src/timeline.json (built by scripts/timeline.mjs from the narration and its word timings). 30 fps.
const FPS = 30;
const F = (s: number) => Math.round(s * FPS);
const S = TL.scenes, M = TL.marks, D = TL.demo;
export const PITCH_TOTAL = F(S.end);

const vdur = (id: string) => (VOICE as Record<string, { duration: number }>)[id]?.duration ?? 0;
const voAt = (id: string) => (TL.vo as [string, number][]).find(([v]) => v === id)?.[1] ?? 0;
/** Absolute time (s) of the first spoken word in line `id` that starts with `prefix`. */
const wordAt = (id: string, prefix: string) => {
  const w = ((WORDS as unknown as Record<string, { words: [string, number, number][] }>)[id]?.words ?? []).find(([t]) => t.toLowerCase().startsWith(prefix));
  return voAt(id) + (w?.[1] ?? 0);
};
const STAT_WORD: Record<string, string> = { mit: '70', wef: 'number' };

// ---------- Root ----------
export function Pitch() {
  const scene = (from: number, to: number, el: ReactNode, key?: string) => <Sequence key={key} from={F(from)} durationInFrames={F(to) - F(from)} premountFor={30}>{el}</Sequence>;
  return <AbsoluteFill style={{ background: P.night }}>
    {scene(S.story, S.typing, <LeoNight/>)}
    {scene(S.typing, S.morning, <LeoTypes/>)}
    {scene(S.morning, S.cold, <Morning/>)}
    {scene(S.cold, S.news, <Cold/>)}
    {TL.beats.map((b, i) => scene(b.start, b.start + b.len, <NewsBeat id={b.id} index={i}/>, b.id))}
    <Sequence from={F(S.news)} durationInFrames={F(S.pivot) - F(S.news)}><Ticker items={HEADLINES}/></Sequence>
    {scene(S.pivot, S.vision, <Pivot/>)}
    {scene(S.vision, S.intro, <Vision/>)}
    {scene(S.intro, S.demo, <Intro/>)}
    {scene(S.demo, S.science, <Demo/>)}
    {scene(S.science, S.privacy, <Science/>)}
    {scene(S.privacy, S.impact, <Privacy/>)}
    {scene(S.impact, S.outro, <Impact/>)}
    {scene(S.outro, S.end, <Outro/>)}
    <Grain opacity={0.07}/>
    <Soundtrack/>
  </AbsoluteFill>;
}

// ---------- Sound ----------
function duck(frame: number) {
  let v = 0;
  for (const [id, at] of TL.vo as [string, number][]) {
    const a = F(at), b = F(at + vdur(id));
    v = Math.max(v, interpolate(frame, [a - 6, a, b, b + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }
  return v;
}

type Sfx = [sec: number, name: string, volume?: number];
const FLAGS = { f1: D.flag1, f2: D.flag2 };
function sfxList(): Sfx[] {
  const list: Sfx[] = [];
  // Leo's night.
  list.push([0.3, 'heartbeat', 0.5], [1.4, 'heartbeat', 0.4], [S.typing - 1.2, 'thud', 0.4]);
  list.push([S.typing, 'whoosh', 0.5], [S.typing + 0.5, 'typing', 0.45], [S.typing + 2.6, 'typing', 0.35], ...M.stamps.map((t): Sfx => [t, 'stamp', 0.8]), [M.stamps[1], 'click', 0.7]);
  list.push([S.morning, 'slam', 0.6], ...[0.6, 0.9, 1.15, 1.45, 1.7].map((t): Sfx => [S.morning + t, 'pop', 0.4]), [M.logic, 'nope', 0.6]);
  // The problem.
  list.push([S.cold, 'glitch', 0.6], [S.cold + 0.05, 'whoosh', 0.5], [M.title - 2, 'riser', 0.35], [M.title, 'impact', 0.75], [M.title, 'glitch', 0.5]);
  TL.beats.forEach((b) => { list.push([b.start, 'slam', 0.45], [b.start, 'glitch', 0.22]); });
  list.push([S.pivot, 'impact', 0.6], [M.checks[0], 'ding', 0.35], [M.checks[1], 'ding', 0.35], [M.checks[2] + 0.1, 'stinger', 0.75]);
  list.push([S.vision, 'whoosh', 0.5], [M.visionRight, 'sparkle', 0.5]);
  list.push([S.intro + 0.1, 'whoosh', 0.5], [M.introName - 0.05, 'boom', 0.7], [M.introName, 'sparkle', 0.5]);
  // The demo: typing, then the extension's own alarm on every flag.
  list.push([S.demo, 'whoosh', 0.5], [D.focus, 'click', 0.7]);
  list.push([D.type1[0], 'typing', 0.45], [D.type2[0], 'typing', 0.45], [D.type3[0], 'typing', 0.4]);
  for (const [k, at] of Object.entries(FLAGS)) {
    const impact = at + 0.24;
    // At maximum the stinger sits lower so the shouted fallacy name cuts through.
    list.push([at, 'whoosh', 0.35], [impact, 'stamp', 0.7], [impact, 'stinger', k === 'f2' ? 0.5 : 0.8], [tagSec(at, k === 'f2') - 0.02, 'zap', 0.45]);
    if (k === 'f2') list.push([impact, 'boom', 0.7], [impact, 'glitch', 0.4]);
  }
  list.push([D.click, 'click', 0.7], [D.click + 0.1, 'pop', 0.4], [D.gotIt, 'click', 0.7], [D.select, 'click', 0.5], [D.fixed, 'chime', 0.8], [D.fixed, 'sparkle', 0.35]);
  // Science, privacy, impact, outro.
  list.push([S.science, 'whoosh', 0.5], ...Array.from({ length: 9 }, (_, i): Sfx => [S.science + 0.5 + i * 0.26, 'pop', 0.3]), [M.quiet + 0.3, 'chime', 0.6]);
  list.push([S.privacy, 'whoosh', 0.5], ...M.privacy.map((t): Sfx => [t, 'stamp', 0.5]));
  list.push([S.impact, 'whoosh', 0.5], ...M.who.map((t): Sfx => [t, 'slam', 0.3]), [M.twice, 'whoosh', 0.4]);
  list.push([S.outro, 'whoosh', 0.5], [S.outro + 0.5, 'boom', 0.6], [S.outro + 0.6, 'sparkle', 0.6]);
  return list;
}
const tagSec = (at: number, max: boolean) => at + (7 + (max ? 39 : 27) + 11) / FPS;

function Soundtrack() {
  return <>
    {/* Music: "Interloper" and "Inspired" by Kevin MacLeod (incompetech.com), CC BY 4.0. Ducked under the narration. */}
    <Sequence durationInFrames={F(S.vision) + 20}>
      <Audio src={staticFile('music/interloper.mp3')} volume={(f) => (0.55 - 0.3 * duck(f)) * interpolate(f, [0, 30, F(S.vision) - 40, F(S.vision) + 20], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}/>
    </Sequence>
    <Sequence from={F(S.vision)}>
      <Audio src={staticFile('music/inspired.mp3')} volume={(f) => (0.5 - 0.28 * duck(f + F(S.vision))) * interpolate(f, [0, 45, F(S.end - S.vision) - 60, F(S.end - S.vision)], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}/>
    </Sequence>
    {(TL.vo as [string, number][]).map(([id, at]) => <Sequence key={id} from={F(at)}><Audio src={staticFile(`narration/${id}.mp3`)} volume={id === 'shout' ? 0.9 : 1}/></Sequence>)}
    {sfxList().map(([at, name, volume = 1], i) => <Sequence key={i} from={Math.max(0, F(at))}><Audio src={staticFile(`audio/${name}.wav`)} volume={volume}/></Sequence>)}
  </>;
}

// ---------- 0. A specific example: Leo's late-night comeback ----------
function CommentCard({ handle, color, time, text, style, children }: { handle: string; color: string; time: string; text: string; style?: CSSProperties; children?: ReactNode }) {
  return <div style={{ position: 'absolute', background: P.paper, color: P.ink, padding: '28px 34px', boxShadow: '0 30px 60px rgba(0,0,0,0.35)', display: 'flex', gap: 20, ...style }}>
    <div style={{ width: 58, height: 58, borderRadius: 29, background: color, color: P.white, display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 800, fontSize: 28, flex: 'none' }}>{handle[0].toUpperCase()}</div>
    <div>
      <Mono size={20} color={P.grey}>@{handle} · {time}</Mono>
      <div style={{ fontFamily: serif, fontSize: 50, lineHeight: 1.05, marginTop: 10 }}>{text}</div>
      {children}
    </div>
  </div>;
}

function LeoNight() {
  const frame = useCurrentFrame();
  const leo = useSpr(4, 13, 120), card = useSpr(12, 13, 150);
  const colon = Math.floor(frame / 15) % 2 ? 0.25 : 1;
  const wrong = F(voAt('leo1') + 4.62);
  return <AbsoluteFill style={{ background: P.night }}>
    <AbsoluteFill style={{ background: `radial-gradient(circle at 72% 42%, ${P.slabDeep}44, transparent 45%)` }}/>
    <Mono size={22} color={P.white} style={{ position: 'absolute', left: 64, top: 52, opacity: 0.8 }}>A comment thread</Mono>
    <div style={{ position: 'absolute', left: 110, top: 250 }}>
      <div style={{ fontFamily: grot, fontWeight: 900, fontSize: 250, letterSpacing: '-0.06em', color: P.white, lineHeight: 0.9 }}>1<span style={{ opacity: colon }}>:</span>{frame < 30 ? '11' : '12'}<span style={{ fontSize: 110, letterSpacing: '-0.03em' }}> AM</span></div>
      <Reveal at={16} style={{ marginTop: 22 }}><Mono size={30} color={P.signal}>“Is remote work here to stay?” · 38 replies</Mono></Reveal>
    </div>
    <CommentCard handle="dana_k" color="#5BA581" time="2m" text="Studies suggest remote work can boost productivity. Worth a real try?" style={{ left: 1040, top: 210, width: 780, transform: `rotate(${2.5 - 4 * (1 - card)}deg) translateY(${(1 - card) * 80}px)`, opacity: card }}>
      {frame >= wrong && <div style={{ position: 'absolute', left: -16, top: -14, right: -16, bottom: -14, border: `5px solid ${P.signal}`, borderRadius: '48% 52% 46% 54%', transform: `rotate(-2deg) scale(${lerp(frame, [wrong, wrong + 6], [1.15, 1])})`, opacity: lerp(frame, [wrong, wrong + 4], [0, 1]) }}/>}
    </CommentCard>
    <div style={{ position: 'absolute', left: 1210, bottom: -30, transform: `translateY(${(1 - leo) * 400}px)` }}><Leo face={frame >= wrong ? 'angry' : 'neutral'} size={420}/></div>
  </AbsoluteFill>;
}

function LeoTypes() {
  const frame = useCurrentFrame();
  const W = 1240, sc = W / PAGE_W;
  const local = (sec: number) => F(sec - S.typing);
  const enter = useSpr(0, 16, 130);
  const tStart = F(0.7), tMid = local(M.stamps[0]) - 14, tEnd = local(M.stamps[0]) - 4;
  const s: DemoScript = {
    focus: F(0.4),
    type1: [tStart, tMid - 4],
    type2: [tMid, tEnd],
    postAt: local(M.stamps[1]),
    cursor: [[0, 900, 700], [F(0.4), 520, 520], [tEnd, 520, 520], [local(M.stamps[1]) - 6, 1300, 610], [local(M.stamps[1]) + 20, 1300, 610]],
    clickAt: [F(0.4), local(M.stamps[1])],
  };
  return <AbsoluteFill style={{ background: P.slab }}>
    <Masthead left="LEO REPLIES" right="1:14 AM"/>
    <BrowserFrame url="thecommons.example/work/remote-work" width={W} ext={false} style={{ left: 64, top: 150, transform: `translateY(${(1 - enter) * 100}px)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: PAGE_H, transform: `scale(${sc})`, transformOrigin: '0 0' }}><ForumPage s={s} ext={false}/></div>
    </BrowserFrame>
    <div style={{ position: 'absolute', left: 1360, top: 170 }}>
      {['TYPE.', 'POST.', 'WIN.'].map((w, i) => {
        const at = local(M.stamps[i]);
        if (frame < at) return null;
        return <div key={w} style={{ fontFamily: grot, fontWeight: 900, fontSize: 150, letterSpacing: '-0.06em', color: i === 2 ? P.white : P.ink, lineHeight: 0.95, transform: `scale(${lerp(frame, [at, at + 5], [2.2, 1])}) rotate(${[-4, 3, -2][i]}deg)`, transformOrigin: '0 50%' }}>{w}</div>;
      })}
    </div>
    <div style={{ position: 'absolute', left: 1560, bottom: -30 }}><Leo face={frame >= local(M.stamps[2]) ? 'smug' : 'angry'} size={320}/></div>
  </AbsoluteFill>;
}

const REPLIES: [string, string, string][] = [
  ['maya_r', '#6D8BC9', 'Attack the argument, not the person.'],
  ['sam_t', '#A46BB0', '“Nobody will work at all”? Slippery slope much.'],
  ['dana_k', '#5BA581', 'My CV isn’t the point. The study is.'],
  ['jo_writes', '#C9A13B', 'Ad hominem. Textbook.'],
  ['priya_dev', '#3E8FB0', 'So… any actual evidence?'],
];

function Morning() {
  const frame = useCurrentFrame();
  const shake = frame < 14 ? Math.sin(frame * 3) * (14 - frame) * 1.6 : 0;
  const n = count(frame, 10, 214, 50);
  return <AbsoluteFill style={{ background: P.ivory, transform: `translateX(${shake}px)` }}>
    <Masthead left="THE NEXT MORNING" right={`${n} REPLIES`}/>
    <CommentCard handle="leo_m" color="#E0703A" time="8h" text={`${SENTENCE_1} ${SENTENCE_2}`} style={{ left: 90, top: 150, width: 820, transform: 'rotate(-1.5deg)' }}>
      <Mono size={20} color={P.slabDeep} style={{ marginTop: 16 }}>💬 {n} replies</Mono>
    </CommentCard>
    {REPLIES.map(([h, c, t], i) => {
      const at = F([0.6, 0.9, 1.15, 1.45, 1.7][i]);
      if (frame < at) return null;
      const p = lerp(frame, [at, at + 5], [0, 1]);
      return <div key={h} style={{ position: 'absolute', left: [470, 560, 440, 600, 500][i], top: [520, 625, 730, 835, 930][i] - 20, width: 480, background: P.white, borderLeft: `6px solid ${P.signal}`, padding: '12px 18px', boxShadow: '0 14px 30px rgba(0,0,0,0.18)', transform: `scale(${0.6 + 0.4 * p}) rotate(${[-2, 1.5, -1, 2, -1.5][i]}deg)`, opacity: p }}>
        <Mono size={15} color={P.grey}>@{h}</Mono>
        <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 25, color: P.ink, letterSpacing: '-0.01em', marginTop: 3 }}>{t}</div>
      </div>;
    })}
    <div style={{ position: 'absolute', left: 90, bottom: -30 }}><Leo face="panic" size={360}/></div>
    <div style={{ position: 'absolute', left: 1080, top: 330, width: 780 }}>
      <Reveal at={F(M.point - S.morning)}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 104, letterSpacing: '-0.05em', color: P.ink, lineHeight: 0.95 }}>Not one reply about his point.</div></Reveal>
      <Reveal at={F(M.logic - S.morning)} style={{ marginTop: 16 }}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 104, letterSpacing: '-0.05em', color: P.slab, lineHeight: 0.95 }}>All about his logic.</div></Reveal>
    </div>
  </AbsoluteFill>;
}

// ---------- 1. Cold open: the globe lights up, then the question lands ----------
const PINS: [string, number, number][] = [['USA', 39, -98], ['MEXICO', 23, -102], ['BRAZIL', -10, -52], ['UK', 54, -2], ['GERMANY', 51, 10], ['NIGERIA', 9, 8], ['TURKEY', 39, 35], ['INDIA', 21, 78], ['S. KOREA', 37.5, 127], ['JAPAN', 36, 138], ['AUSTRALIA', -25, 134]];

function Globe({ r, rot, lit, opacity = 1 }: { r: number; rot: number; lit: number; opacity?: number }) {
  const frame = useCurrentFrame();
  const tilt = (22 * Math.PI) / 180;
  const project = (lat: number, lon: number) => {
    const p = (lat * Math.PI) / 180, l = ((lon + rot) * Math.PI) / 180;
    return { x: r * Math.cos(p) * Math.sin(l), y: -r * (Math.cos(tilt) * Math.sin(p) - Math.sin(tilt) * Math.cos(p) * Math.cos(l)), z: Math.sin(tilt) * Math.sin(p) + Math.cos(tilt) * Math.cos(p) * Math.cos(l) };
  };
  const line = (pts: { x: number; y: number; z: number }[]) => pts.reduce((d, q, i) => d + (q.z > 0 ? `${i && pts[i - 1].z > 0 ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}` : ''), '');
  const paths: string[] = [];
  for (let lat = -60; lat <= 75; lat += 15) paths.push(line(Array.from({ length: 91 }, (_, k) => project(lat, -180 + k * 4))));
  for (let lon = -180; lon < 180; lon += 20) paths.push(line(Array.from({ length: 61 }, (_, k) => project(-90 + k * 3, lon))));
  return <svg width={r * 2 + 400} height={r * 2 + 200} viewBox={`${-r - 200} ${-r - 100} ${r * 2 + 400} ${r * 2 + 200}`} style={{ overflow: 'visible', opacity }}>
    <circle r={r} fill="#1a1213" stroke={P.slab} strokeWidth={2} strokeOpacity={0.6}/>
    {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={P.slab} strokeOpacity={0.3} strokeWidth={1.4}/>)}
    {PINS.map(([name, lat, lon], i) => {
      const q = project(lat, lon);
      if (q.z < 0.08 || i >= lit) return null;
      const pulse = (frame / 20 + i * 0.37) % 1;
      return <g key={name} transform={`translate(${q.x} ${q.y})`} opacity={Math.min(1, q.z * 3)}>
        <circle r={8 + pulse * 46} fill="none" stroke={P.signal} strokeWidth={2.5} opacity={1 - pulse}/>
        <circle r={8} fill={P.signal}/>
        <text x={16} y={-12} fill={P.white} fontFamily={mono} fontSize={20} fontWeight={700} letterSpacing={2}>{name}</text>
      </g>;
    })}
  </svg>;
}

function Cold() {
  const frame = useCurrentFrame();
  const title = F(M.title - S.cold);
  const after = frame >= title;
  const rot = 95 - frame * 1.15;
  const lit = Math.floor(lerp(frame, [12, title - 10], [0, PINS.length + 1]));
  const shake = after && frame < title + 10 ? Math.sin(frame * 5.3) * (title + 10 - frame) * 2.2 : 0;
  const zoom = after ? 1 : lerp(frame, [0, title], [1, 1.12]);
  return <AbsoluteFill style={{ background: P.night, transform: `translateX(${shake}px)` }}>
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, ${P.slabDeep}33, transparent 60%)` }}/>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom})` }}>
      <Globe r={330} rot={rot} lit={lit} opacity={after ? 0.22 : lerp(frame, [0, 12], [0, 1])}/>
    </AbsoluteFill>
    {/* Headlines pile up around the globe and stay, then sit dimmed behind the title. */}
    {HEADLINES.map((h, i) => {
      const at = 14 + i * Math.max(5, Math.floor((title - 30) / HEADLINES.length));
      if (frame < at) return null;
      const p = lerp(frame, [at, at + 6], [0, 1]);
      return <div key={i} style={{ position: 'absolute', left: [70, 1230, 110, 1200, 60, 1260, 640][i % 7], top: [130, 170, 770, 720, 450, 450, 900][i % 7], width: 600, background: P.paper, color: P.ink, padding: '14px 20px', fontFamily: serif, fontSize: 32, lineHeight: 1.05, transform: `rotate(${[-3, 2, 2, -2, 1, -1, 3][i % 7]}deg) scale(${1.25 - 0.25 * p}) translateY(${(frame - at) * -0.15}px)`, opacity: (after ? 0.14 : 0.94) * p, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>{h}</div>;
    })}
    {!after && <Mono size={22} color={P.white} style={{ position: 'absolute', left: 64, top: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: P.signal, opacity: Math.floor(frame / 10) % 2 ? 0.25 : 1 }}/> Arguing online · worldwide
    </Mono>}
    {after && <AbsoluteFill style={{ justifyContent: 'center', padding: '0 110px' }}>
      <div style={{ fontFamily: grot, fontWeight: 900, fontSize: 210, lineHeight: 0.9, letterSpacing: '-0.05em', color: P.white, transform: `scale(${lerp(frame, [title, title + 5], [1.18, 1])})`, transformOrigin: '0 50%' }}>
        Who checks<br/><span style={{ color: P.signal }}>your</span> reasoning?
      </div>
      <Mono size={24} color={P.grey} style={{ marginTop: 40, opacity: lerp(frame, [title + 8, title + 16], [0, 1]) }}>What the evidence says ↓</Mono>
    </AbsoluteFill>}
    <AbsoluteFill style={{ background: P.white, opacity: lerp(frame, [title, title + 1, title + 6], [0, 0.85, 0]) }}/>
    <AbsoluteFill style={{ background: P.white, opacity: lerp(frame, [0, 1, 4], [0.7, 0.7, 0]) }}/>
  </AbsoluteFill>;
}

// ---------- 2. The evidence ----------
function NewsBeat({ id, index }: { id: string; index: number }) {
  const frame = useCurrentFrame();
  const b = NEWS[id];
  const beat = TL.beats[index];
  const statAt = Math.max(4, F(wordAt(id, STAT_WORD[id]) - beat.start) - 8);
  const n = b.to !== undefined ? count(frame, statAt - 2, b.to, 14) : null;
  const statText = n !== null ? `${b.prefix ?? ''}${n.toLocaleString('en-US')}${b.suffix ?? ''}` : b.stat;
  const push = 1 + frame * 0.00025;
  return <AbsoluteFill style={{ background: P.night }}>
    <AbsoluteFill style={{ background: `radial-gradient(circle at ${index % 2 ? 30 : 70}% 40%, ${P.slabDeep}40, transparent 55%)` }}/>
    <Masthead left="01 — THE PROBLEM IS GLOBAL" right={`${String(index + 1).padStart(2, '0')} / ${String(TL.beats.length).padStart(2, '0')}`} color={P.white}/>
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Clipping outlet={b.outlet} date={b.date} headline={b.headline} at={2} rot={index % 2 ? 1.6 : -2} width={820} style={{ left: 100, top: 190 }}/>
      <div style={{ position: 'absolute', left: 1010, top: 175, width: 830 }}>
        <Mono size={26} color={P.signal} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: lerp(frame, [0, 6], [0, 1]) }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, background: P.signal, boxShadow: `0 0 0 ${6 + (frame % 20)}px ${P.signal}${Math.round(lerp(frame % 20, [0, 20], [90, 0])).toString(16).padStart(2, '0')}` }}/>{b.tag}
        </Mono>
        <div style={{ fontFamily: grot, fontWeight: 900, fontSize: b.stat.length > 4 ? 230 : 280, lineHeight: 0.95, letterSpacing: '-0.05em', color: P.signal, marginTop: 14, transform: `scale(${lerp(frame, [statAt, statAt + 5], [1.25, 1])})`, transformOrigin: '0 60%', opacity: frame >= statAt - 2 ? 1 : 0 }}>{statText}</div>
        <Reveal at={statAt + 6}><div style={{ fontFamily: grot, fontWeight: 700, fontSize: 44, lineHeight: 1.12, color: P.white, letterSpacing: '-0.02em' }}>{b.label}</div></Reveal>
        {b.sub && <Reveal at={statAt + 18} style={{ marginTop: 18 }}><div style={{ fontFamily: grot, fontWeight: 500, fontSize: 30, color: '#CFC7BA' }}>{b.sub}</div></Reveal>}
      </div>
      <Mono size={18} color={P.grey} style={{ position: 'absolute', left: 1010, top: 912, width: 840, opacity: lerp(frame, [12, 20], [0, 1]) }}>Source: {b.source}</Mono>
    </AbsoluteFill>
    <AbsoluteFill style={{ background: P.white, opacity: lerp(frame, [0, 1, 4], [0.45, 0.45, 0]) }}/>
  </AbsoluteFill>;
}

// ---------- The turn: spell-check, grammar-check... logic-check? ----------
function Pivot() {
  const frame = useCurrentFrame();
  const rows: [string, boolean][] = [['Spell-check', true], ['Grammar-check', true], ['Logic-check', false]];
  const at = M.checks.map((t) => F(t - S.pivot));
  const bad = at[2] + 3;
  const shake = frame >= bad && frame < bad + 12 ? Math.sin(frame * 5.1) * (bad + 12 - frame) * 2 : 0;
  return <AbsoluteFill style={{ background: P.night, justifyContent: 'center', padding: '0 140px', transform: `translateX(${shake}px)` }}>
    <Mono size={22} color={P.grey} style={{ position: 'absolute', left: 140, top: 120, opacity: lerp(frame, [0, 10], [0, 1]) }}>What we have · what we don’t</Mono>
    {rows.map(([label, ok], i) => {
      const a = i === 2 ? bad : at[i];
      return <Reveal key={label} at={a} style={{ marginTop: i ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 50, fontFamily: grot, fontWeight: 900, fontSize: 168, letterSpacing: '-0.05em', lineHeight: 1, color: ok ? P.white : P.signal }}>
          <span style={{ position: 'relative' }}>{label}
            {!ok && <span style={{ position: 'absolute', left: -10, right: -10, top: '52%', height: 16, background: P.signal, transform: `scaleX(${lerp(frame, [a + 4, a + 12], [0, 1])})`, transformOrigin: '0 50%' }}/>}
          </span>
          <span style={{ fontSize: 140, color: ok ? P.green : P.signal, transform: `scale(${lerp(frame, [a + 2, a + 7], [1.8, 1])})` }}>{ok ? '✓' : '✗'}</span>
        </div>
      </Reveal>;
    })}
    <AbsoluteFill style={{ background: P.white, opacity: lerp(frame, [0, 1, 6], [0.8, 0.8, 0]) }}/>
    <AbsoluteFill style={{ opacity: lerp(frame, [bad, bad + 2, bad + 24], [0, 1, 0]), boxShadow: 'inset 0 0 220px 60px rgba(255,0,48,0.7)' }}/>
  </AbsoluteFill>;
}

// ---------- The vision: the same keyboard, two ways of using it ----------
function Loop({ x, y, color, labels, grow, at }: { x: number; y: number; color: string; labels: string[]; grow: boolean; at: number }) {
  const frame = useCurrentFrame();
  const p = useSpr(at, 14, 140);
  const r = 190, t = Math.max(0, frame - at);
  const dot = (t / 40) * Math.PI * 2 - Math.PI / 2;
  const brain = grow ? 0.7 + 0.5 * Math.min(1, t / 90) : 1.1 - 0.5 * Math.min(1, t / 90);
  return <div style={{ position: 'absolute', left: x - r - 120, top: y - r - 120, width: (r + 120) * 2, height: (r + 120) * 2, opacity: Math.min(1, p * 1.4), transform: `scale(${0.85 + 0.15 * p})` }}>
    <svg width={(r + 120) * 2} height={(r + 120) * 2} style={{ position: 'absolute', inset: 0 }}>
      {grow ? <circle cx={r + 120} cy={r + 120} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray="14 12"/>
        : <path d={`M${120} ${r + 120} L${2 * r + 120} ${r + 120}`} stroke={color} strokeWidth={6} strokeDasharray="14 12"/>}
      {grow && <circle cx={r + 120 + Math.cos(dot) * r} cy={r + 120 + Math.sin(dot) * r} r={16} fill={color}/>}
      {!grow && <circle cx={120 + ((t % 45) / 45) * 2 * r} cy={r + 120} r={16} fill={color}/>}
    </svg>
    {labels.map((l, i) => {
      const a = -Math.PI / 2 + (i / labels.length) * Math.PI * 2;
      const lx = grow ? r + 120 + Math.cos(a) * r : 120 + (i / (labels.length - 1)) * 2 * r;
      const ly = grow ? r + 120 + Math.sin(a) * r : r + 120;
      return <div key={l} style={{ position: 'absolute', left: lx, top: ly, transform: 'translate(-50%, -50%)', background: P.ivory, border: `4px solid ${color}`, borderRadius: 40, padding: '12px 26px', fontFamily: grot, fontWeight: 800, fontSize: 36, color: P.ink, whiteSpace: 'nowrap' }}>{l}</div>;
    })}
    <div style={{ position: 'absolute', left: r + 120, top: grow ? r + 120 : r + 260, transform: `translate(-50%, -50%) scale(${brain})`, fontSize: 120, filter: grow ? 'none' : 'grayscale(0.7)' }}>🧠</div>
  </div>;
}

function Vision() {
  const frame = useCurrentFrame();
  const right = F(M.visionRight - S.vision) - 6;
  return <AbsoluteFill style={{ background: P.ivory }}>
    <Masthead left="THE VISION" right="SAME KEYBOARD · TWO WAYS TO USE IT"/>
    <div style={{ position: 'absolute', left: 120, top: 150, width: 700, textAlign: 'center' }}><Mono size={24} color={P.grey}>The internet catches it</Mono></div>
    <Loop x={470} y={560} color={P.grey} labels={['Type', 'Post', 'Regret']} grow={false} at={8}/>
    <Mono size={20} color={P.grey} style={{ position: 'absolute', left: 120, width: 700, top: 930, textAlign: 'center', opacity: lerp(frame, [20, 30], [0, 1]) }}>Posted · screenshotted · forever</Mono>
    <div style={{ position: 'absolute', left: 960, top: 190, bottom: 120, width: 2, background: P.ink, opacity: 0.2 }}/>
    <div style={{ position: 'absolute', left: 1100, top: 150, width: 700, textAlign: 'center', opacity: lerp(frame, [right - 6, right], [0, 1]) }}><Mono size={24} color={P.slabDeep}>You catch it first</Mono></div>
    <Loop x={1450} y={560} color={P.slab} labels={['Type', 'Flag', 'Rethink']} grow at={right}/>
    <Mono size={20} color={P.grey} style={{ position: 'absolute', left: 1100, width: 700, top: 930, textAlign: 'center', opacity: lerp(frame, [right + 12, right + 22], [0, 1]) }}>Flagged before you hit post</Mono>
  </AbsoluteFill>;
}

// ---------- 3. Introducing Ember (the title slide) ----------
function TitleChrome() {
  return <>
    <div style={{ position: 'absolute', left: 56, top: 44, fontFamily: grot, fontWeight: 800, fontSize: 34, letterSpacing: '-0.05em', color: P.ink }}>OCTOBER 2026</div>
    <div style={{ position: 'absolute', right: 56, top: 46, fontFamily: grot, fontWeight: 500, fontSize: 30, letterSpacing: '-0.02em', color: P.ink }}>Chrome extension · Powered by Claude</div>
  </>;
}

function Intro() {
  const frame = useCurrentFrame();
  const t = Easing.inOut(Easing.cubic)(lerp(frame, [0, 24], [0, 1]));
  const r = 1250 - (1250 - 300) * t;
  const cx = 960 - (960 - 500) * t, cy = 540 + (590 - 540) * t;
  const wake = F(M.introName - S.intro);
  const hop = frame >= wake ? Math.sin(Math.min(1, (frame - wake) / 10) * Math.PI) * -40 : 0;
  const glow = frame >= wake ? 30 + 14 * Math.sin((frame - wake) / 6) : 0;
  return <AbsoluteFill style={{ background: P.slab }}>
    <TitleChrome/>
    <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: P.ink, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: r - 150, top: r - 165 + hop, opacity: lerp(frame, [14, 24], [0, 1]), filter: frame < wake ? 'grayscale(1) brightness(0.45)' : 'none' }}>
        <WarnIcon size={300} glow={glow}/>
      </div>
      <Embers at={wake} x={r} y={r} n={50} reach={260} k={1.6} seed="intro"/>
    </div>
    <Ring at={wake} x={500} y={590} k={6}/>
    <PaperBits at={wake} x={500} y={500} count={30}/>
    <div style={{ position: 'absolute', left: 950, top: 360 }}>
      <Reveal at={F(0.7)}><div style={{ fontFamily: grot, fontWeight: 800, fontSize: 100, letterSpacing: '-0.05em', color: P.ink, lineHeight: 1 }}>INTRODUCING</div></Reveal>
      <Reveal at={wake}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 268, letterSpacing: '-0.065em', color: P.ink, lineHeight: 0.86, marginLeft: -8 }}>EMBER</div></Reveal>
      <Reveal at={wake + 12} style={{ marginTop: 22 }}><div style={{ fontFamily: grot, fontWeight: 800, fontSize: 46, color: P.white, letterSpacing: '-0.03em' }}>Your critical thinking partner.</div></Reveal>
      <Reveal at={F(M.introSub - S.intro)} style={{ marginTop: 18 }}><div style={{ fontFamily: grot, fontWeight: 500, fontSize: 32, color: P.ink, width: 820, lineHeight: 1.25 }}>A Chrome extension that reads only what <b>you</b> write, and flags fallacies right where they happen.</div></Reveal>
    </div>
  </AbsoluteFill>;
}

// ---------- 4. The product: a scripted demo of the extension's overlay ----------
const CHAPTER_TEXT: Record<string, [string, string]> = {
  d1: ['Only your words', 'reads what you type · ignores what you read'],
  d2: ['Tagged in place', 'right on the words that did it'],
  d3: ['Subtle? Never.', 'stamp · shake · alarm'],
  d4: ['Ask, don’t tell', 'Claude explains · you fix it'],
};
type Cam = { cx: number; cy: number; s: number };
const CAM: Record<string, Cam> = {
  page: { cx: PAGE_W / 2, cy: PAGE_H / 2, s: 1 },
  composer: { cx: 560, cy: 470, s: 1.7 },
  card: { cx: 440, cy: 255, s: 1.6 },
};

function Demo() {
  const frame = useCurrentFrame();
  const W = 1400;
  const local = (sec: number) => F(sec - S.demo);
  const f1: Flag = { id: 'ad_hominem', at: local(D.flag1), clearAt: local(D.fixed) };
  const f2: Flag = { id: 'slippery_slope', at: local(D.flag2), max: true };
  const tagX = 262, tagY = 410;
  const script: DemoScript = {
    ignore: local(D.ignore), watch: local(D.watch), focus: local(D.focus),
    type1: [local(D.type1[0]), local(D.type1[1])], type2: [local(D.type2[0]), local(D.type2[1])],
    flags: [f1, f2],
    card: { at: local(D.click) + 3, until: local(D.gotIt) + 2, hot: (f) => (f >= local(D.ask) ? 'ask' : f >= local(D.why) ? 'why' : null) },
    select: local(D.select), type3: [local(D.type3[0]), local(D.type3[1])], fixed: local(D.fixed),
    cursor: [
      [F(0.3), 1180, 700], [local(D.focus), 520, 520], [local(D.type1[0]) + 4, 520, 520], [local(D.type1[0]) + 20, 940, 690],
      [local(D.click) - 14, 940, 690], [local(D.click), tagX, tagY], [local(D.gotIt) - 14, tagX, tagY], [local(D.gotIt), 512, 366],
      [local(D.select) - 8, 512, 366], [local(D.select), 214, 448], [local(D.select) + 10, 214, 448], [local(D.select) + 26, 860, 640],
    ],
    clickAt: [local(D.focus), local(D.click), local(D.gotIt), local(D.select)],
  };
  // Camera: ease between framings at scripted moments.
  const keys: [number, Cam][] = [
    [0, CAM.page], [local(D.focus) - 6, CAM.page], [local(D.type1[0]), CAM.composer],
    [impactAt(f2) - 2, CAM.composer], [impactAt(f2) + 6, CAM.page],
    [local(D.click) - 16, CAM.page], [local(D.click) - 2, CAM.card],
    [local(D.gotIt) + 4, CAM.card], [local(D.select) + 6, CAM.composer],
  ];
  let cam = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f, c] = keys[i], [pf, pc] = keys[i - 1];
    if (frame >= f) { cam = c; continue; }
    const k = Easing.inOut(Easing.cubic)(lerp(frame, [pf, f], [0, 1]));
    cam = { cx: pc.cx + (c.cx - pc.cx) * k, cy: pc.cy + (c.cy - pc.cy) * k, s: pc.s + (c.s - pc.s) * k };
    break;
  }
  const enter = useSpr(0, 16, 120);
  const current = [...TL.chapters].reverse().find((c) => frame >= local(c.start)) ?? TL.chapters[0];
  // Video-level punch on each impact: the frame shakes and flashes.
  const punch = [f1, f2].map((f) => {
    const t = frame - impactAt(f);
    return t >= 0 && t < 14 ? { x: Math.sin(t * 4.3) * (14 - t) * (f.max ? 2.6 : 1.3), flash: lerp(t, [0, 1, 7], [f.max ? 0.55 : 0.25, f.max ? 0.55 : 0.25, 0]) } : { x: 0, flash: 0 };
  });
  const sx = punch[0].x + punch[1].x, flash = Math.max(punch[0].flash, punch[1].flash);
  const max = frame >= impactAt(f2) && frame < impactAt(f2) + 60;
  return <AbsoluteFill style={{ background: P.slab }}>
    <AbsoluteFill style={{ transform: `translateX(${sx}px)` }}>
      <Masthead left="02 — THE PRODUCT" right="HOW IT WORKS"/>
      <BrowserFrame url="thecommons.example/work/remote-work" width={W} style={{ left: 56, top: 132, transform: `translateY(${(1 - enter) * 120}px)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: PAGE_H, transformOrigin: '0 0', transform: `translate(${W / 2 - cam.cx * cam.s}px, ${(W * 9) / 32 - cam.cy * cam.s}px) scale(${cam.s})` }}>
          <ForumPage s={script}/>
        </div>
      </BrowserFrame>
      <Mono size={15} color={P.ink} style={{ position: 'absolute', left: 60, top: 1012, opacity: 0.75 }}>Recreation of the extension’s overlay, drawn from its own styles and effects code. Explanation text written by Claude in the real extension.</Mono>
      <div style={{ position: 'absolute', left: 1500, top: 150, width: 370 }}>
        {TL.chapters.map((c, i) => {
          const at = local(c.start);
          if (c.id !== current.id) return null;
          const [title, sub] = CHAPTER_TEXT[c.id];
          return <div key={c.id}>
            <Reveal at={at}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 150, letterSpacing: '-0.06em', color: P.ink, lineHeight: 0.9 }}>{String(i + 1).padStart(2, '0')}</div></Reveal>
            <Reveal at={at + 4} style={{ marginTop: 24 }}><div style={{ fontFamily: grot, fontWeight: 800, fontSize: 50, letterSpacing: '-0.035em', color: P.ink, lineHeight: 1.02 }}>{title}</div></Reveal>
            {sub && <Reveal at={at + 9} style={{ marginTop: 18 }}><Mono size={22} color={P.ink}>{sub}</Mono></Reveal>}
            {c.id === 'd3' && <Intensity at={local(voAt('d3') + 2.3)}/>}
          </div>;
        })}
        <div style={{ position: 'absolute', top: 760, display: 'flex', gap: 10 }}>
          {TL.chapters.map((c) => <span key={c.id} style={{ width: 52, height: 6, background: P.ink, opacity: c.id === current.id ? 1 : 0.25 }}/>)}
        </div>
      </div>
    </AbsoluteFill>
    {max && <AbsoluteFill style={{ pointerEvents: 'none', boxShadow: `inset 0 0 200px 50px rgba(120,0,20,${lerp(frame - impactAt(f2), [0, 4, 50, 60], [0, 0.8, 0.5, 0])})` }}/>}
    <AbsoluteFill style={{ background: P.white, opacity: flash, pointerEvents: 'none' }}/>
  </AbsoluteFill>;
}

/** The intensity setting (settings.js: subtle | dramatic | maximum), shown while the narration says "every flag lands with drama". */
function Intensity({ at }: { at: number }) {
  const frame = useCurrentFrame();
  return <div style={{ marginTop: 40 }}>
    <Mono size={18} color={P.ink} style={{ opacity: lerp(frame, [at, at + 8], [0, 0.8]) }}>Intensity setting</Mono>
    {['Subtle', 'Dramatic', 'Maximum'].map((l, i) => {
      const a = at + 4 + i * 5;
      const on = i === 2;
      return <div key={l} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, opacity: lerp(frame, [a, a + 6], [0, 1]), transform: `translateX(${lerp(frame, [a, a + 8], [30, 0])}px)` }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, border: `4px solid ${P.ink}`, background: on ? P.ink : 'transparent' }}/>
        <span style={{ fontFamily: on ? poster : grot, fontWeight: on ? 400 : 700, fontSize: on ? 44 : 34, color: on ? P.white : P.ink, letterSpacing: on ? '0.06em' : '-0.02em', textTransform: on ? 'uppercase' : 'none', textShadow: on ? `-2px 0 ${P.cyan}, 2px 0 ${P.ink}` : 'none' }}>{l}</span>
      </div>;
    })}
  </div>;
}

// ---------- 5. Every fallacy in the catalogue ----------
function Science() {
  const frame = useCurrentFrame();
  const quiet = F(M.quiet - S.science);
  const names = FALLACY_IDS.map((id: string) => (FALLACIES as Record<string, { name: string }>)[id].name);
  const step = Math.max(2, Math.floor((quiet - 24) / names.length));
  const dim = lerp(frame, [quiet, quiet + 10], [1, 0.12]);
  const ok = useSpr(quiet + 6, 13, 160);
  return <AbsoluteFill style={{ background: P.ivory }}>
    <Masthead left={`03 — ${names.length} FALLACIES`} right="JUDGED LIVE BY CLAUDE"/>
    <div style={{ position: 'absolute', left: 90, right: 90, top: 140, bottom: 50, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: '40px 30px', opacity: dim }}>
      {names.map((n: string, i: number) => {
        const at = 12 + i * step;
        return <div key={n} style={{ position: 'relative', width: n.length * 25 + 100, height: 60, transform: `rotate(${((i * 37) % 7) - 3}deg)` }}>
          <FallacyTag name={n} k={2.9} enter={frame - at} glowPhase={frame + i * 9} style={{ left: 0, top: 0 }}/>
        </div>;
      })}
    </div>
    {frame >= quiet && <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: P.white, padding: '40px 56px', borderRadius: 24, boxShadow: '0 30px 70px rgba(20,20,19,0.25)', width: 1260, transform: `scale(${0.85 + 0.15 * ok})`, opacity: ok }}>
        <Mono size={20} color={P.grey}>Sound reasoning</Mono>
        <div style={{ fontFamily: serif, fontSize: 60, lineHeight: 1.08, color: P.ink, marginTop: 12 }}>“That study covered call-centre staff, so let’s run a three-month trial and measure our own output.”</div>
        <div style={{ marginTop: 26, display: 'inline-block', padding: '8px 18px', border: `4px solid ${P.green}`, borderRadius: 8, background: 'rgba(3, 26, 14, 0.92)', color: P.green, fontFamily: poster, fontSize: 34, letterSpacing: '0.08em', boxShadow: '0 0 24px rgba(31,209,122,0.55)' }}>✓ NO FALLACY · NO FLAG</div>
      </div>
    </AbsoluteFill>}
  </AbsoluteFill>;
}

// ---------- 6. Privacy: it reads only what you write ----------
function XRay() {
  const frame = useCurrentFrame();
  const at = M.privacy.map((t) => F(t - S.privacy));
  const block = (x: number, y: number, w: number, h: number, lines = 3, dark = false) => <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 12, background: dark ? '#2a2725' : '#E9E4D8', padding: 18 }}>
    {Array.from({ length: lines }, (_, i) => <div key={i} style={{ height: 12, borderRadius: 6, background: dark ? '#3a3633' : '#D3CCBE', width: `${90 - ((i * 23) % 35)}%`, marginTop: i ? 14 : 0 }}/>)}
  </div>;
  const label = (x: number, y: number, text: string, a: number, color: string) => frame >= a && <div style={{ position: 'absolute', left: x, top: y, padding: '6px 12px', border: `3px solid ${color}`, borderRadius: 6, color, background: 'rgba(14,13,12,0.92)', fontFamily: poster, fontSize: 24, letterSpacing: '0.08em', transform: `rotate(-4deg) scale(${lerp(frame, [a, a + 5], [1.8, 1])})`, opacity: lerp(frame, [a, a + 3], [0, 1]), whiteSpace: 'nowrap', zIndex: 5 }}>{text}</div>;
  const read = frame >= at[2];
  return <div style={{ position: 'absolute', inset: 0, background: '#F5F1E8' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 52, background: '#fff', borderBottom: '1px solid #E6E1D6' }}/>
    {block(40, 80, 640, 150, 4)}
    {block(40, 250, 640, 110, 3)}
    {label(500, 92, 'NOT READ', 14, P.grey)}
    {label(500, 262, 'NOT READ', 20, P.grey)}
    {/* Sign-in box with a password field */}
    <div style={{ position: 'absolute', left: 720, top: 80, width: 340, height: 220, borderRadius: 12, background: '#fff', border: '1px solid #E6E1D6', padding: 22 }}>
      <div style={{ fontFamily: grot, fontWeight: 800, fontSize: 18, color: '#1f1e1b' }}>Sign in</div>
      <div style={{ marginTop: 14, height: 42, borderRadius: 8, border: '2px solid #DDD6C8', fontFamily: grot, fontSize: 18, color: '#9a958b', padding: '8px 12px' }}>leo@example.com</div>
      <div style={{ marginTop: 12, height: 42, borderRadius: 8, border: `2px solid ${frame >= at[0] ? P.grey : '#DDD6C8'}`, fontFamily: grot, fontSize: 22, color: '#3a3833', padding: '6px 12px', letterSpacing: 4 }}>••••••••</div>
    </div>
    {label(820, 240, 'PASSWORD · SKIPPED', at[0], P.yellow)}
    {/* The reply box: a pasted quote and the user's own words */}
    <div style={{ position: 'absolute', left: 40, top: 390, width: 1020, height: 220, borderRadius: 14, background: '#fff', border: `3px solid ${read ? P.signal : '#DDD6C8'}`, padding: '18px 22px', boxShadow: read ? `0 0 ${24 + 8 * Math.sin(frame / 5)}px rgba(255,45,85,0.45)` : 'none' }}>
      <div style={{ borderLeft: '4px solid #CFC7BA', paddingLeft: 14, fontFamily: grot, fontSize: 20, color: '#8a857c', fontStyle: 'italic' }}>“Remote work can boost productivity.” — pasted from the article</div>
      <div style={{ marginTop: 20, fontFamily: grot, fontWeight: 500, fontSize: 26, color: '#1f1e1b' }}>
        <span style={{ background: read ? 'rgba(255,45,85,0.14)' : 'transparent', borderRadius: 4 }}>{typed('That only covers one company, so I’m not convinced yet.', frame, 0, at[2])}</span>
      </div>
    </div>
    {label(640, 372, 'PASTED · SKIPPED', at[1], P.yellow)}
    {label(60, 556, '✍ TYPED BY YOU · READ', at[2], P.signal)}
  </div>;
}

function Privacy() {
  const frame = useCurrentFrame();
  const W = 1130;
  const enter = useSpr(0, 16, 120);
  const at = M.privacy.map((t) => F(t - S.privacy));
  const bullets = ['🔒 No passwords or card fields', '📋 No pasted text, unless you opt in', '✍️ Only words you type yourself'];
  return <AbsoluteFill style={{ background: P.slab }}>
    <Masthead left="04 — PRIVATE BY DESIGN" right="ONLY WHAT YOU WRITE"/>
    <div style={{ position: 'absolute', left: 64, top: 150, width: 640 }}>
      <Reveal at={4}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 104, lineHeight: 0.92, letterSpacing: '-0.055em', color: P.ink }}>It reads your words.</div></Reveal>
      <Reveal at={F(0.5 + 1.66)}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 104, lineHeight: 0.92, letterSpacing: '-0.055em', color: P.white }}>Never your feed.</div></Reveal>
      <div style={{ marginTop: 50 }}>
        {bullets.map((t, i) => <Reveal key={t} at={at[i]} style={{ borderTop: `2px solid ${P.ink}`, padding: '18px 0' }}>
          <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 34, color: P.ink, letterSpacing: '-0.02em' }}>{t}</div>
        </Reveal>)}
      </div>
      <Mono size={18} color={P.ink} style={{ marginTop: 26, opacity: lerp(frame, [at[2] + 12, at[2] + 22], [0, 1]) }}>Your Claude API key stays in the extension · block any site · mute any fallacy</Mono>
    </div>
    <BrowserFrame url="What Ember can see" width={W} style={{ left: 740, top: 190, transform: `translateX(${(1 - enter) * 200}px)` }}>
      <XRay/>
    </BrowserFrame>
  </AbsoluteFill>;
}

// ---------- 7. Who it's for ----------
const WHO: [string, string][] = [['Students', 'Essays, discussion boards, group projects'], ['Work', 'Emails, docs, team threads'], ['Everyone online', 'Comments, posts, replies']];

function Impact() {
  const frame = useCurrentFrame();
  const at = M.who.map((t) => F(t - S.impact));
  const p = [useSpr(at[0], 14, 160), useSpr(at[1], 14, 160), useSpr(at[2], 14, 160)];
  const twice = F(M.twice - S.impact);
  return <AbsoluteFill style={{ background: P.night }}>
    <Masthead left="05 — WHO IT’S FOR" right="ANYWHERE YOU TYPE" color={P.white}/>
    <Reveal at={4} style={{ position: 'absolute', left: 64, top: 140 }}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 84, letterSpacing: '-0.05em', color: P.white, lineHeight: 1 }}>Everyone argues in writing now.<br/><span style={{ color: P.signal }}>Now everyone gets a partner.</span></div></Reveal>
    <div style={{ position: 'absolute', left: 64, right: 64, top: 450, display: 'flex', gap: 24 }}>
      {WHO.map(([k, v], i) => <div key={k} style={{ flex: 1, background: i === 2 ? P.slab : '#221E1D', border: `2px solid ${P.slab}`, padding: '34px 34px 40px', minHeight: 260, opacity: Math.min(1, p[i] * 1.5), transform: `translateY(${(1 - p[i]) * 60}px)` }}>
        <Mono size={20} color={i === 2 ? P.ink : P.signal}>For</Mono>
        <div style={{ fontFamily: grot, fontWeight: 900, fontSize: 68, letterSpacing: '-0.05em', color: i === 2 ? P.ink : P.white, marginTop: 8, whiteSpace: 'nowrap' }}>{k}</div>
        <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 30, color: i === 2 ? P.ink : '#CFC7BA', marginTop: 6 }}>{v}</div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: 64, right: 64, top: 800, borderTop: `2px solid ${P.grey}`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', opacity: lerp(frame, [twice - 4, twice + 8], [0, 1]) }}>
      <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 50, color: P.white }}>Impact: every message becomes a chance to think twice.</div>
      <Mono size={18} color={P.grey} style={{ alignSelf: 'center', textAlign: 'right' }}>Claude when you add a key<br/>built-in pattern checks when you don’t</Mono>
    </div>
  </AbsoluteFill>;
}

// ---------- Outro ----------
function Outro() {
  const frame = useCurrentFrame();
  const len = F(S.end - S.outro);
  const pop = useSpr(F(0.5), 10, 150);
  const [l1, l2] = M.outroLines.map((t) => F(t - S.outro));
  return <AbsoluteFill style={{ background: P.slab }}>
    <TitleChrome/>
    <div style={{ position: 'absolute', left: 200, top: 290, width: 600, height: 600, borderRadius: 300, background: P.ink, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 300 - 150, top: 130, transform: `scale(${0.6 + 0.4 * pop})` }}><WarnIcon size={300} glow={26 + 10 * Math.sin(frame / 6)}/></div>
      <Embers at={F(0.6)} x={300} y={300} n={40} reach={240} k={1.6} seed="outro"/>
    </div>
    <PaperBits at={F(0.6)} x={500} y={520} count={50} spread={1.2}/>
    <div style={{ position: 'absolute', left: 900, top: 340 }}>
      <Reveal at={F(0.5)}><div style={{ fontFamily: grot, fontWeight: 900, fontSize: 268, letterSpacing: '-0.065em', color: P.ink, lineHeight: 0.86, marginLeft: -8 }}>EMBER</div></Reveal>
      <Reveal at={l1} style={{ marginTop: 26 }}><div style={{ fontFamily: grot, fontWeight: 800, fontSize: 60, letterSpacing: '-0.035em', color: P.ink }}>Catch the fallacy.</div></Reveal>
      <Reveal at={l2}><div style={{ fontFamily: grot, fontWeight: 800, fontSize: 60, letterSpacing: '-0.035em', color: P.white }}>Keep the argument.</div></Reveal>
      <Reveal at={l2 + 14} style={{ marginTop: 34 }}><Mono size={22} color={P.ink}>Your critical thinking partner · Chrome extension<br/>Built with Claude</Mono></Reveal>
      <Mono size={14} color={P.ink} style={{ marginTop: 24, opacity: 0.7 }}>Music: “Interloper”, “Inspired” by Kevin MacLeod (incompetech.com) · CC BY 4.0 · Voice: ElevenLabs</Mono>
    </div>
    <AbsoluteFill style={{ background: P.night, opacity: lerp(frame, [len - 14, len], [0, 1]) }}/>
  </AbsoluteFill>;
}

export { SENTENCE_1, tagAt };
