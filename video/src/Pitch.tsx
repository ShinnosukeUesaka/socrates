import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import TL from './timeline.json';
import VOICE from './narration.json';
import WORDS from './words.json';
import { FALLACIES, FALLACY_IDS } from '../../src/shared/fallacies.js';
import { BrowserFrame, Chrome, Embers, FallacyTag, Glass, Glow, Grad, Grain, Label, Motes, P, Reveal, Ring, SocratesIcon, SourceCard, Ticker, Vignette, count, grot, lerp, mono, poster, useSpr } from './editorial';
import { A, ARTICLE, ArticlePage, Card, Cursor, E, MailPage, PAGE_W, VIEW_H, ViewportFx, impactAt, shakeAt, tagAt, type Flag, type Reply } from './product';
import { HEADLINES, NEWS } from './news';

// Two-minute launch film for Socrates, the critical thinking companion. The story beats follow the Ember pitch
// (codebees/video): one person first, the problem worldwide, what's missing, the product, why it's safe, the close.
// The look is a dark launch film. Timings come from src/timeline.json (built by scripts/timeline.mjs from the
// narration and its word timings). 30 fps.
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
const ease = Easing.inOut(Easing.cubic);

// ---------- Root ----------
export function Pitch() {
  const scene = (from: number, to: number, el: ReactNode, key?: string) => <Sequence key={key} from={F(from)} durationInFrames={F(to) - F(from)} premountFor={30}>{el}</Sequence>;
  return <AbsoluteFill style={{ background: P.bg }}>
    {scene(S.story, S.typing, <Hook/>)}
    {scene(S.typing, S.morning, <Repost/>)}
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
    <Grain opacity={0.035}/>
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
const ENTRANCE = (max: boolean) => (7 + (max ? 39 : 27) + 11) / FPS;
function sfxList(): Sfx[] {
  const list: Sfx[] = [];
  // Leo's night.
  list.push([0.2, 'heartbeat', 0.45], [1.5, 'heartbeat', 0.35], [M.headline - 0.3, 'ding', 0.35], [M.furious, 'thud', 0.5]);
  list.push([S.typing, 'whoosh', 0.4], [M.stamps[0], 'thud', 0.7], [M.stamps[1], 'thud', 0.7], [M.stamps[2], 'impact', 0.6], [M.stamps[2], 'click', 0.5]);
  list.push([S.morning, 'whoosh', 0.4], ...[0.5, 0.85, 1.2, 1.55, 1.9].map((t): Sfx => [S.morning + t, 'click', 0.25]), [M.nobody, 'boom', 0.45]);
  // The problem.
  list.push([S.cold, 'whoosh', 0.45], [M.title - 2, 'riser', 0.35], [M.title, 'impact', 0.7], [M.title, 'glitch', 0.25]);
  TL.beats.forEach((b) => { list.push([b.start, 'slam', 0.35], [b.start, 'glitch', 0.15]); });
  list.push([S.pivot, 'impact', 0.45], [M.checks[0], 'click', 0.5], [M.checks[1], 'click', 0.5], [M.checks[2] + 0.1, 'stinger', 0.7]);
  list.push([S.vision, 'whoosh', 0.4], [M.visionRight - 1.2, 'riser', 0.3]);
  list.push([S.intro + 0.1, 'whoosh', 0.45], [M.introName - 0.05, 'boom', 0.7], [M.introName, 'impact', 0.35]);
  // The demo: the extension's own alarm on every flag.
  list.push([S.demo, 'whoosh', 0.45], [D.click, 'click', 0.7], [D.gotIt, 'click', 0.7], [TL.chapters[3].start, 'whoosh', 0.45], [TL.chapters[4].start, 'whoosh', 0.45]);
  list.push([TL.chapters[4].start + 0.3, 'click', 0.6], [D.type1[0], 'typing', 0.4], [D.select, 'click', 0.5], [D.type2[0], 'typing', 0.35]);
  ([[D.flag1, false], [D.flag2, false], [D.flag3, true]] as [number, boolean][]).forEach(([at, max]) => {
    const impact = at + 0.24;
    list.push([at, 'whoosh', 0.3], [impact, 'stamp', 0.65], [impact, 'stinger', max ? 0.5 : 0.75], [at + ENTRANCE(max) - 0.02, 'zap', 0.4]);
    if (max) list.push([impact, 'boom', 0.7], [impact, 'glitch', 0.35]);
  });
  list.push([D.fixed, 'chime', 0.8]);
  // Science, privacy, impact, outro.
  list.push([S.science, 'whoosh', 0.4], ...Array.from({ length: 10 }, (_, i): Sfx => [S.science + 0.45 + i * 0.22, 'click', 0.2]), [M.quiet + 0.3, 'chime', 0.55]);
  list.push([S.privacy, 'whoosh', 0.4], [M.privacy[0], 'stamp', 0.4], [M.privacy[1], 'stamp', 0.35], [M.privacy[2], 'stamp', 0.35], [M.privacy[3], 'stamp', 0.4]);
  list.push([S.impact, 'whoosh', 0.4], ...M.who.map((t): Sfx => [t, 'thud', 0.45]), [M.twice, 'riser', 0.25]);
  list.push([S.outro, 'whoosh', 0.45], [M.outroName - 0.05, 'boom', 0.6]);
  return list;
}

function Soundtrack() {
  return <>
    {/* Music: "Interloper" and "Inspired" by Kevin MacLeod (incompetech.com), CC BY 4.0. Ducked under the narration. */}
    <Sequence durationInFrames={F(S.vision) + 20}>
      <Audio src={staticFile('music/interloper.mp3')} volume={(f) => (0.55 - 0.3 * duck(f)) * interpolate(f, [0, 30, F(S.vision) - 40, F(S.vision) + 20], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}/>
    </Sequence>
    <Sequence from={F(S.vision)}>
      <Audio src={staticFile('music/inspired.mp3')} volume={(f) => (0.5 - 0.28 * duck(f + F(S.vision))) * interpolate(f, [0, 45, F(S.end - S.vision) - 60, F(S.end - S.vision)], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}/>
    </Sequence>
    {(TL.vo as [string, number][]).map(([id, at]) => <Sequence key={id} from={F(at)}><Audio src={staticFile(`narration/${id}.mp3`)} volume={id === 'shout' ? 0.85 : 1}/></Sequence>)}
    {sfxList().map(([at, name, volume = 1], i) => <Sequence key={i} from={Math.max(0, F(at))}><Audio src={staticFile(`audio/${name}.wav`)} volume={volume}/></Sequence>)}
  </>;
}

const H: CSSProperties = { fontFamily: grot, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.95, color: P.white };

// ---------- 0. One person: Leo's 1 a.m. headline ----------
function AppIcon({ size = 64 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: size * 0.24, background: 'linear-gradient(135deg, #2B5BE0, #1636A8)', display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 900, fontSize: size * 0.5, color: '#fff', flex: 'none' }}>P</div>;
}

function Hook() {
  const frame = useCurrentFrame();
  const colon = Math.floor(frame / 15) % 2 ? 0.3 : 1;
  const note = F(M.headline - S.story) - 8, fury = F(M.furious - S.story);
  const n = useSpr(note, 16, 140);
  const heat = lerp(frame, [fury - 2, fury + 6], [0, 1]);
  const sh = shakeAt(frame, fury, 8, 'hook');
  return <AbsoluteFill>
    <Glow x={72} y={40} size={45} opacity={0.12 + 0.18 * heat}/>
    <Chrome left="Tuesday · 1:12 AM" right=""/>
    <div style={{ position: 'absolute', left: 120, top: 270 }}>
      <div style={{ fontFamily: grot, fontWeight: 300, fontSize: 300, letterSpacing: '-0.06em', color: P.white, lineHeight: 0.85 }}>1<span style={{ opacity: colon }}>:</span>12<span style={{ fontSize: 90, fontWeight: 400, letterSpacing: '-0.02em', color: P.grey }}> AM</span></div>
      <Reveal at={F(0.4)} style={{ marginTop: 40 }}><div style={{ ...H, fontSize: 64 }}>Leo.</div></Reveal>
      <Reveal at={F(1.4)} style={{ marginTop: 14 }}><Label size={22}>One more scroll</Label></Reveal>
    </div>
    <Glass style={{ left: 1040, top: 360, width: 760, padding: '26px 30px', opacity: Math.min(1, n * 1.4), transform: `translate(${sh.x}px, ${(1 - n) * -60 + sh.y}px) scale(${0.97 + 0.03 * n})`, border: `1px solid rgba(255,45,85,${0.1 + 0.6 * heat})`, boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${60 * heat}px rgba(255,45,85,${0.35 * heat})` }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <AppIcon/>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Label size={16} color={P.white}>The Daily Pulse</Label><Label size={16}>now</Label></div>
          <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 36, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.white, marginTop: 8 }}>Remote work is <span style={{ color: heat > 0.5 ? P.signal : P.white }}>killing</span> productivity. Every CEO knows it.</div>
        </div>
      </div>
    </Glass>
    <Vignette/>
  </AbsoluteFill>;
}

function Repost() {
  const frame = useCurrentFrame();
  const W = 1080, sc = W / PAGE_W;
  const local = (sec: number) => F(sec - S.typing);
  const enter = useSpr(0, 18, 120);
  const scroll = ease(lerp(frame, [F(0.4), local(M.stamps[0]) - 4], [0, 1])) * 0.55;
  const rp = local(M.stamps[2]);
  return <AbsoluteFill>
    <Glow x={30} y={50} size={55} opacity={0.12}/>
    <Chrome left="He doesn’t question a word" right=""/>
    <BrowserFrame url="dailypulse.example/opinion/remote-work" width={W} ext={false} style={{ left: 110, top: 190, transform: `translateY(${(1 - enter) * 60}px)`, opacity: Math.min(1, enter * 1.5) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: 1500, transformOrigin: '0 0', transform: `scale(${sc}) translateY(${-scroll * 240}px)` }}>
        <ArticlePage/>
        <Cursor keys={[[0, 900, 520], [rp - 14, 900, 520 + scroll * 240], [rp, 88, 198 + 240]]} clicks={[rp]}/>
      </div>
      {frame >= rp && <div style={{ position: 'absolute', left: '50%', bottom: 30, transform: `translateX(-50%) translateY(${lerp(frame, [rp, rp + 8], [40, 0])}px)`, opacity: lerp(frame, [rp, rp + 6], [0, 1]), background: '#16161A', color: '#fff', fontFamily: grot, fontWeight: 600, fontSize: 22, padding: '14px 24px', borderRadius: 12 }}>↻ Reposted to your feed</div>}
    </BrowserFrame>
    <div style={{ position: 'absolute', left: 1290, top: 260 }}>
      {['Read.', 'Believe.', 'Repost.'].map((w, i) => {
        const at = local(M.stamps[i]);
        const p = lerp(frame, [at, at + 6], [0, 1]);
        if (frame < at) return null;
        return <div key={w} style={{ ...H, fontSize: 138, marginBottom: 12, opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${1.08 - 0.08 * p})`, filter: `blur(${(1 - p) * 10}px)`, transformOrigin: '0 50%' }}>{i === 2 ? <Grad>{w}</Grad> : w}</div>;
      })}
    </div>
    <Vignette/>
  </AbsoluteFill>;
}

const CHIPS: [string, string][] = [['owen.k', 'Finally someone said it.'], ['jess_r', 'Sending this to my manager.'], ['dev_mike', 'Every CEO agrees. Case closed.'], ['ana.p', 'Knew it.'], ['tom_h', 'So true.']];

function Morning() {
  const frame = useCurrentFrame();
  const shared = F(M.shared - S.morning), nobody = F(M.nobody - S.morning);
  const n = count(frame, 6, 214, Math.max(20, shared + 6));
  const dim = lerp(frame, [nobody - 4, nobody + 8], [1, 0.25]);
  return <AbsoluteFill>
    <Glow x={25} y={45} size={50} opacity={0.14}/>
    <Chrome left="The next morning" right=""/>
    <div style={{ position: 'absolute', left: 120, top: 200, opacity: dim }}>
      <div style={{ ...H, fontSize: 340, letterSpacing: '-0.06em' }}>{n}</div>
      <Label size={26} style={{ marginTop: 8 }}>reposts of Leo’s link</Label>
    </div>
    {CHIPS.map(([h, t], i) => {
      const at = F(0.5 + i * 0.35);
      const p = useSpr(at, 16, 140);
      if (frame < at) return null;
      return <Glass key={h} style={{ left: [1080, 1240, 1020, 1300, 1140][i], top: [180, 300, 420, 540, 660][i] - frame * 0.15, padding: '18px 24px', borderRadius: 18, opacity: Math.min(1, p * 1.5) * dim, transform: `translateY(${(1 - p) * 30}px)` }}>
        <Label size={14}>@{h}</Label>
        <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 30, color: P.white, marginTop: 6, letterSpacing: '-0.01em' }}>{t}</div>
      </Glass>;
    })}
    <Reveal at={nobody} style={{ position: 'absolute', left: 120, top: 760, width: 1700 }}>
      <div style={{ ...H, fontSize: 104 }}>Nobody asked if the argument <Grad>held up.</Grad></div>
    </Reveal>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- 1. The problem, worldwide ----------
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
    <defs><radialGradient id="globe" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#1a1416"/><stop offset="1" stopColor="#070707"/></radialGradient></defs>
    <circle r={r} fill="url(#globe)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}/>
    {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.2}/>)}
    {PINS.map(([name, lat, lon], i) => {
      const q = project(lat, lon);
      if (q.z < 0.08 || i >= lit) return null;
      const pulse = (frame / 20 + i * 0.37) % 1;
      return <g key={name} transform={`translate(${q.x} ${q.y})`} opacity={Math.min(1, q.z * 3)}>
        <circle r={7 + pulse * 40} fill="none" stroke={P.signal} strokeWidth={2} opacity={1 - pulse}/>
        <circle r={6} fill={P.signal} style={{ filter: `drop-shadow(0 0 8px ${P.signal})` }}/>
        <text x={14} y={-10} fill={P.white} fontFamily={mono} fontSize={17} fontWeight={500} letterSpacing={3}>{name}</text>
      </g>;
    })}
  </svg>;
}

function Cold() {
  const frame = useCurrentFrame();
  const title = F(M.title - S.cold);
  const after = frame >= title;
  const rot = 95 - frame * 1.0;
  const lit = Math.floor(lerp(frame, [12, title - 10], [0, PINS.length + 1]));
  const zoom = after ? 1 : lerp(frame, [0, title], [1, 1.1]);
  const tp = useSpr(title, 18, 120);
  return <AbsoluteFill>
    <Glow x={50} y={55} size={55} opacity={0.12}/>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom})` }}>
      <Globe r={330} rot={rot} lit={lit} opacity={after ? 0.25 : lerp(frame, [0, 14], [0, 1])}/>
    </AbsoluteFill>
    {HEADLINES.map((h, i) => {
      const at = 14 + i * Math.max(5, Math.floor((title - 30) / HEADLINES.length));
      if (frame < at) return null;
      const p = lerp(frame, [at, at + 8], [0, 1]);
      return <Glass key={i} style={{ left: [80, 1240, 120, 1210, 70, 1270, 650][i % 7], top: [140, 180, 780, 730, 460, 460, 900][i % 7], width: 580, padding: '16px 22px', borderRadius: 16, opacity: (after ? 0.12 : 0.95) * p, transform: `translateY(${(1 - p) * 20 - (frame - at) * 0.12}px)`, filter: `blur(${(1 - p) * 8}px)` }}>
        <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 25, lineHeight: 1.15, color: P.white, letterSpacing: '-0.01em' }}>{h}</div>
      </Glass>;
    })}
    {!after && <Label size={17} style={{ position: 'absolute', left: 72, top: 54, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: P.signal, boxShadow: `0 0 10px ${P.signal}` }}/> What everyone is reading
    </Label>}
    {after && <AbsoluteFill style={{ justifyContent: 'center', padding: '0 120px', opacity: Math.min(1, tp * 1.4), transform: `scale(${1.04 - 0.04 * tp})`, filter: `blur(${(1 - Math.min(1, tp * 1.3)) * 16}px)` }}>
      <div style={{ ...H, fontSize: 220, letterSpacing: '-0.055em' }}>Who checks<br/>the <Grad>argument?</Grad></div>
      <Label size={20} style={{ marginTop: 46 }}>What the evidence says ↓</Label>
    </AbsoluteFill>}
    <Vignette strength={0.7}/>
  </AbsoluteFill>;
}

function NewsBeat({ id, index }: { id: string; index: number }) {
  const frame = useCurrentFrame();
  const b = NEWS[id];
  const beat = TL.beats[index];
  const statAt = Math.max(4, F(wordAt(id, STAT_WORD[id]) - beat.start) - 8);
  const n = b.to !== undefined ? count(frame, statAt - 2, b.to, 14) : null;
  const statText = n !== null ? `${b.prefix ?? ''}${n.toLocaleString('en-US')}${b.suffix ?? ''}` : b.stat;
  const sp = useSpr(statAt, 16, 130);
  return <AbsoluteFill style={{ transform: `scale(${1 + frame * 0.0002})` }}>
    <Glow x={72} y={42} size={45} opacity={0.18 * Math.min(1, sp)}/>
    <Chrome left={`The problem · ${String(index + 1).padStart(2, '0')} / ${String(TL.beats.length).padStart(2, '0')}`}/>
    <SourceCard outlet={b.outlet} date={b.date} headline={b.headline} at={2} width={800} style={{ left: 110, top: 230 }}/>
    <div style={{ position: 'absolute', left: 1010, top: 190, width: 830 }}>
      <Label size={20} color={P.signal} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: lerp(frame, [0, 8], [0, 1]) }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: P.signal, boxShadow: `0 0 12px ${P.signal}` }}/>{b.tag}
      </Label>
      <div style={{ ...H, fontSize: 290, letterSpacing: '-0.06em', marginTop: 18, opacity: frame >= statAt - 2 ? Math.min(1, sp * 1.4) : 0, transform: `scale(${1.06 - 0.06 * sp})`, transformOrigin: '0 60%', filter: `blur(${(1 - Math.min(1, sp * 1.3)) * 12}px)` }}><Grad>{statText}</Grad></div>
      <Reveal at={statAt + 6}><div style={{ fontFamily: grot, fontWeight: 600, fontSize: 42, lineHeight: 1.12, color: P.white, letterSpacing: '-0.02em' }}>{b.label}</div></Reveal>
      {b.sub && <Reveal at={statAt + 16} style={{ marginTop: 18 }}><div style={{ fontFamily: grot, fontWeight: 400, fontSize: 28, color: P.grey }}>{b.sub}</div></Reveal>}
    </div>
    <Label size={15} style={{ position: 'absolute', left: 1010, top: 930, width: 840, lineHeight: 1.5, opacity: lerp(frame, [12, 20], [0, 1]), color: P.dim }}>Source: {b.source}</Label>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- What's missing ----------
function Pivot() {
  const frame = useCurrentFrame();
  const rows: [string, boolean][] = [['Spam filters', true], ['Spell-check', true], ['Logic check', false]];
  const at = M.checks.map((t) => F(t - S.pivot));
  const bad = at[2] + 3;
  const sh = shakeAt(frame, bad, 14, 'pivot');
  return <AbsoluteFill style={{ justifyContent: 'center', padding: '0 140px', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
    <Glow x={30} y={70} size={50} opacity={0.18 * lerp(frame, [bad, bad + 8], [0, 1])}/>
    <Chrome left="What we have · what we don’t"/>
    {rows.map(([label, ok], i) => {
      const a = i === 2 ? bad : at[i];
      return <Reveal key={label} at={a} style={{ marginTop: i ? 18 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 46, ...H, fontSize: 160, color: ok ? P.white : P.signal }}>
          <span style={{ position: 'relative', opacity: ok ? 0.9 : 1 }}>{ok ? label : <Grad>{label}</Grad>}
            {!ok && <span style={{ position: 'absolute', left: -8, right: -8, top: '54%', height: 10, background: GRADIENT_BAR, transform: `scaleX(${lerp(frame, [a + 4, a + 12], [0, 1])})`, transformOrigin: '0 50%', boxShadow: `0 0 20px ${P.signal}` }}/>}
          </span>
          <span style={{ fontFamily: grot, fontWeight: 300, fontSize: 120, color: ok ? P.grey : P.signal }}>{ok ? '✓' : '✕'}</span>
        </div>
      </Reveal>;
    })}
    <Vignette/>
  </AbsoluteFill>;
}
const GRADIENT_BAR = `linear-gradient(90deg, ${P.signal}, ${P.orange})`;

// ---------- The vision ----------
function Pills({ labels, color, at, loop }: { labels: string[]; color: string; at: number; loop: boolean }) {
  const frame = useCurrentFrame();
  const p = useSpr(at, 16, 120);
  const r = 200, t = Math.max(0, frame - at);
  const cx = 360, cy = 300;
  return <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, p * 1.4), transform: `scale(${0.94 + 0.06 * p})` }}>
    <svg width={720} height={600} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {loop ? <>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={2}/>
        <circle cx={cx + Math.cos((t / 45) * Math.PI * 2 - Math.PI / 2) * r} cy={cy + Math.sin((t / 45) * Math.PI * 2 - Math.PI / 2) * r} r={9} fill={color} style={{ filter: `drop-shadow(0 0 10px ${color})` }}/>
      </> : <>
        <line x1={60} y1={cy} x2={660} y2={cy} stroke={color} strokeOpacity={0.35} strokeWidth={2}/>
        <circle cx={60 + ((t % 50) / 50) * 600} cy={cy} r={9} fill={color}/>
      </>}
    </svg>
    {labels.map((l, i) => {
      const a = -Math.PI / 2 + (i / labels.length) * Math.PI * 2;
      const x = loop ? cx + Math.cos(a) * r : 60 + (i / (labels.length - 1)) * 600;
      const y = loop ? cy + Math.sin(a) * r : cy;
      return <div key={l} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', background: '#0E0E10', border: `1.5px solid ${color}`, borderRadius: 40, padding: '12px 26px', fontFamily: grot, fontWeight: 700, fontSize: 32, color: P.white, whiteSpace: 'nowrap', boxShadow: loop ? `0 0 30px ${color}44` : 'none' }}>{l}</div>;
    })}
    {loop && <div style={{ position: 'absolute', left: cx - 60, top: cy - 60 }}><SocratesIcon size={120} glow={14 + 6 * Math.sin(t / 8)}/></div>}
  </div>;
}

function Vision() {
  const frame = useCurrentFrame();
  const right = F(M.visionRight - S.vision) - 6;
  return <AbsoluteFill>
    <Glow x={75} y={55} size={40} opacity={0.16 * lerp(frame, [right, right + 15], [0, 1])}/>
    <Chrome left="The idea"/>
    <Label size={20} style={{ position: 'absolute', left: 100, width: 720, top: 200, textAlign: 'center' }}>Without</Label>
    <div style={{ position: 'absolute', left: 100, top: 270, width: 720, height: 600 }}><Pills labels={['Read', 'Believe', 'Repost']} color={P.dim} at={6} loop={false}/></div>
    <Label size={18} style={{ position: 'absolute', left: 100, width: 720, top: 900, textAlign: 'center', color: P.dim, opacity: lerp(frame, [18, 28], [0, 1]) }}>The loudest argument wins</Label>
    <div style={{ position: 'absolute', left: 960, top: 230, bottom: 150, width: 1, background: P.line }}/>
    <Label size={20} color={P.white} style={{ position: 'absolute', left: 1100, width: 720, top: 200, textAlign: 'center', opacity: lerp(frame, [right - 6, right + 2], [0, 1]) }}><Grad>With Socrates</Grad></Label>
    <div style={{ position: 'absolute', left: 1100, top: 270, width: 720, height: 600 }}><Pills labels={['Read · Write', 'Question', 'Decide']} color={P.signal} at={right} loop/></div>
    <Label size={18} style={{ position: 'absolute', left: 1100, width: 720, top: 900, textAlign: 'center', opacity: lerp(frame, [right + 14, right + 24], [0, 1]) }}>The best argument wins</Label>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- Introducing Socrates ----------
/** The wordmark, with a band of light that sweeps across it once. */
function Wordmark({ size, at }: { size: number; at: number }) {
  const frame = useCurrentFrame();
  const p = lerp(frame, [at + 4, at + 34], [-30, 130]);
  return <span style={{ ...H, display: 'inline-block', fontSize: size, letterSpacing: '-0.06em', paddingRight: '0.04em', backgroundImage: `linear-gradient(100deg, ${P.white} ${p - 12}%, #FFE2C8 ${p}%, ${P.white} ${p + 12}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Socrates</span>;
}

function Intro() {
  const frame = useCurrentFrame();
  const name = F(M.introName - S.intro), sub = F(M.introSub - S.intro), line = F(M.introLine - S.intro);
  const ip = useSpr(4, 18, 90);
  const lit = lerp(frame, [name - 4, name + 4], [0, 1]);
  return <AbsoluteFill>
    <Glow x={30} y={50} size={42} opacity={0.08 + 0.3 * lit} color={P.orange}/>
    <Motes n={46} seed="intro" opacity={0.5 * lit}/>
    <div style={{ position: 'absolute', left: 390, top: 370, transform: `scale(${0.9 + 0.1 * ip})`, opacity: ip, filter: frame < name ? 'saturate(0.2) brightness(0.55)' : 'none' }}>
      <SocratesIcon size={340} glow={lit * (30 + 8 * Math.sin(frame / 7))}/>
    </div>
    <Ring at={name} x={560} y={540} k={9} color={P.orange}/>
    <Embers at={name} x={560} y={540} n={40} reach={320} k={1.4} seed="intro" life={50}/>
    <div style={{ position: 'absolute', left: 900, top: 330, width: 960 }}>
      <Reveal at={F(0.2)}><Label size={22}>Introducing</Label></Reveal>
      <Reveal at={name} style={{ marginTop: 18 }}><Wordmark size={210} at={name}/></Reveal>
      <Reveal at={sub} style={{ marginTop: 26 }}><div style={{ ...H, fontSize: 66, lineHeight: 1.04, letterSpacing: '-0.035em' }}><Grad>Critical thinking,<br/>built into your browser.</Grad></div></Reveal>
      <Reveal at={line} style={{ marginTop: 30 }}><div style={{ fontFamily: grot, fontWeight: 400, fontSize: 30, color: P.grey, lineHeight: 1.35, width: 820 }}>Flags weak arguments in what you read, and in what you write.</div></Reveal>
    </div>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- The product ----------
const CHAPTER_TEXT: Record<string, [string, string]> = {
  d1: ['Reads along', 'articles · skips the clutter'],
  d2: ['Tags the exact words', 'possible issues, not verdicts'],
  d3: ['Asks, doesn’t tell', 'one question per flag'],
  d4: ['Your inbox, too', 'pressure tactics, caught'],
  d5: ['And what you write', 'optional · off by default'],
};
type Cam = { cx: number; cy: number; s: number };
const CAM: Record<string, Cam> = {
  top: { cx: PAGE_W / 2, cy: VIEW_H / 2, s: 1 },
  dilemma: { cx: 580, cy: A.dilemmaY + 8, s: 1.6 },
  card: { cx: 560, cy: 610, s: 1.28 },
  mail: { cx: PAGE_W / 2, cy: VIEW_H / 2, s: 1 },
  urgency: { cx: 960, cy: E.urgencyY + 30, s: 1.5 },
  reply: { cx: 580, cy: A.replyY, s: 1.6 },
  replyWide: { cx: 640, cy: A.replyY - 30, s: 1.15 },
};

function camAt(frame: number, keys: [number, Cam][]) {
  let cam = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f, c] = keys[i], [pf, pc] = keys[i - 1];
    if (frame >= f) { cam = c; continue; }
    const k = ease(lerp(frame, [pf, f], [0, 1]));
    cam = { cx: pc.cx + (c.cx - pc.cx) * k, cy: pc.cy + (c.cy - pc.cy) * k, s: pc.s + (c.s - pc.s) * k };
    break;
  }
  return cam;
}

function Demo() {
  const frame = useCurrentFrame();
  const W = 1400;
  const local = (sec: number) => F(sec - S.demo);
  const [c1, , c3, c4, c5] = TL.chapters.map((c) => local(c.start));
  const f1: Flag = { id: 'false_dilemma', at: local(D.flag1) };
  const f2: Flag = { id: 'false_urgency', at: local(D.flag2) };
  const f3: Flag = { id: 'slippery_slope', at: local(D.flag3), max: true, clearAt: local(D.fixed) };
  const reply: Reply = { focus: c5 + 9, type1: [local(D.type1[0]), local(D.type1[1])], select: local(D.select), type2: [local(D.type2[0]), local(D.type2[1])], fixed: local(D.fixed) };
  const page = frame >= c5 ? 'reply' : frame >= c4 ? 'mail' : 'article';
  const since = frame - (page === 'reply' ? c5 : page === 'mail' ? c4 : c1);
  const swap = page === 'article' ? 1 : ease(lerp(since, [0, 12], [0, 1]));
  const cam = camAt(frame, [
    [0, CAM.top], [local(D.flag1) - 16, CAM.top], [local(D.flag1) - 2, CAM.dilemma],
    [local(D.click) - 10, CAM.dilemma], [local(D.click) + 6, CAM.card], [c4 - 1, CAM.card],
    [c4, CAM.mail], [local(D.flag2) - 14, CAM.mail], [local(D.flag2), CAM.urgency], [c5 - 1, CAM.urgency],
    [c5, CAM.reply], [impactAt(f3) - 1, CAM.reply], [impactAt(f3) + 5, CAM.replyWide], [local(D.select) - 10, CAM.replyWide], [local(D.select) + 4, CAM.reply],
  ]);
  const pageShake = shakeAt(frame, impactAt(f3), 9 * K_, 'max');
  const enter = useSpr(0, 18, 110);
  const current = [...TL.chapters].reverse().find((c) => frame >= local(c.start)) ?? TL.chapters[0];
  const punch = [f1, f2, f3].map((f) => {
    const t = frame - impactAt(f);
    return t >= 0 && t < 14 ? { x: Math.sin(t * 4.3) * (14 - t) * (f.max ? 2.4 : 1.1), glow: lerp(t, [0, 2, 12], [f.max ? 0.5 : 0.22, f.max ? 0.5 : 0.22, 0]) } : { x: 0, glow: 0 };
  });
  const sx = punch.reduce((a, p) => a + p.x, 0), glow = Math.max(...punch.map((p) => p.glow));
  const cardEl = <div style={{ position: 'absolute', left: 0, top: 44 }}>{frame >= local(D.click) + 3 && frame < local(D.gotIt) + 2 && <Card at={local(D.click) + 3} hot={frame >= local(D.ask)} label="The author’s reasoning" quote={ARTICLE.dilemma} chip="Logical fallacy" title="Possible false dilemma" why="The author may be presenting two outcomes as the only ones. Hybrid setups, or changes made gradually, aren’t considered." question="Are these really the only two outcomes, or has the author left some out?"/>}</div>;
  const tagX = A.lineX + 50, tagY = A.dilemmaY - 22;
  return <AbsoluteFill>
    <Glow x={38} y={52} size={55} opacity={0.14 + glow}/>
    <AbsoluteFill style={{ transform: `translateX(${sx}px)` }}>
      <Chrome left="The product" right="How it works"/>
      <BrowserFrame url={page === 'mail' ? 'mail.example/inbox' : 'dailypulse.example/opinion/remote-work'} width={W} style={{ left: 56, top: 150, transform: `translateY(${(1 - enter) * 60}px)`, opacity: Math.min(1, enter * 1.5) }}>
        <div style={{ position: 'absolute', inset: 0, opacity: swap, transform: `translateX(${(1 - swap) * 140}px)`, filter: `blur(${(1 - swap) * 10}px)` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: 1500, transformOrigin: '0 0', transform: `translate(${W / 2 - cam.cx * cam.s + pageShake.x}px, ${(W * 9) / 32 - cam.cy * cam.s + pageShake.y}px) scale(${cam.s}) rotate(${pageShake.r}deg)` }}>
            {page === 'mail' ? <>
              <MailPage flag2={f2}/>
              <Cursor keys={[[c4 + 6, 1200, 640], [f2.at - 4, 760, 520], [impactAt(f2) + 6, 760, 520], [impactAt(f2) + 26, 1180, 690]]}/>
            </> : <>
              <ArticlePage flag1={f1} flag3={page === 'reply' ? f3 : undefined} reply={page === 'reply' ? reply : undefined} card={cardEl} notes={{ at: local(D.read) - 6, until: f1.at - 6 }}/>
              {page === 'article' ? <Cursor keys={[[F(0.6), 1150, 620], [local(D.click) - 16, 1150, 620], [local(D.click), tagX, tagY], [local(D.gotIt) - 14, tagX, tagY], [local(D.gotIt), 500, 852], [c4, 500, 852]]} clicks={[local(D.click), local(D.gotIt)]}/>
                : <Cursor keys={[[c5, 900, 1160], [reply.focus, 420, 1100], [reply.type1[0] + 6, 420, 1100], [reply.type1[0] + 22, 930, 1190], [reply.select - 10, 930, 1190], [reply.select, 236, 1094], [reply.select + 14, 236, 1094], [reply.select + 30, 930, 1190]]} clicks={[reply.focus, reply.select]}/>}
            </>}
          </div>
          <ViewportFx flags={page === 'mail' ? [f2] : page === 'reply' ? [f3] : [f1]}/>
        </div>
      </BrowserFrame>
      <Label size={14} style={{ position: 'absolute', left: 60, top: 1000, color: P.dim, letterSpacing: '0.1em' }}>Recreation of the extension’s overlay, built from its own styles and effects code · card text is an example of model output</Label>
      <div style={{ position: 'absolute', left: 1500, top: 160, width: 370 }}>
        {TL.chapters.map((c, i) => {
          const at = local(c.start);
          if (c.id !== current.id) return null;
          const [title, sub] = CHAPTER_TEXT[c.id];
          return <div key={c.id}>
            <Reveal at={at}><div style={{ ...H, fontSize: 130, letterSpacing: '-0.06em', color: P.dim }}>{String(i + 1).padStart(2, '0')}</div></Reveal>
            <Reveal at={at + 4} style={{ marginTop: 26 }}><div style={{ ...H, fontSize: 48, lineHeight: 1.02, letterSpacing: '-0.035em' }}>{title}</div></Reveal>
            <Reveal at={at + 9} style={{ marginTop: 18 }}><Label size={17}>{sub}</Label></Reveal>
          </div>;
        })}
        <div style={{ position: 'absolute', top: 760, display: 'flex', gap: 8 }}>
          {TL.chapters.map((c) => <span key={c.id} style={{ width: 52, height: 3, borderRadius: 2, background: c.id === current.id ? GRADIENT_BAR : P.dim }}/>)}
        </div>
      </div>
    </AbsoluteFill>
    <Vignette strength={0.5}/>
  </AbsoluteFill>;
}
const K_ = 1.25;

// ---------- Every way an argument can slip ----------
function Science() {
  const frame = useCurrentFrame();
  const quiet = F(M.quiet - S.science);
  const names = (FALLACY_IDS as string[]).map((id) => (FALLACIES as Record<string, { name: string }>)[id].name);
  const step = Math.max(1.5, (quiet - 20) / names.length);
  const dim = lerp(frame, [quiet, quiet + 10], [1, 0.1]);
  const ok = useSpr(quiet + 6, 16, 130);
  return <AbsoluteFill>
    <Glow x={50} y={50} size={60} opacity={0.12}/>
    <Chrome left={`${names.length} ways an argument can slip`} right="Fallacies · biases · pressure tactics"/>
    <div style={{ position: 'absolute', left: 80, right: 80, top: 130, bottom: 60, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: '34px 26px', opacity: dim }}>
      {names.map((n, i) => {
        const at = 10 + Math.round(i * step);
        return <div key={n} style={{ position: 'relative', width: n.length * 19.5 + 78, height: 46 }}>
          <FallacyTag name={n} k={2.25} enter={frame - at} glowPhase={frame + i * 9} style={{ left: 0, top: 0 }}/>
        </div>;
      })}
    </div>
    {frame >= quiet && <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Glass style={{ position: 'relative', padding: '44px 56px', width: 1240, opacity: ok, transform: `scale(${0.94 + 0.06 * ok})`, filter: `blur(${(1 - Math.min(1, ok * 1.2)) * 10}px)` }}>
        <Label size={18}>Sound reasoning</Label>
        <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 52, lineHeight: 1.12, letterSpacing: '-0.025em', color: P.white, marginTop: 14 }}>“The trial followed 1,600 staff for two years, and the authors spell out what it can’t tell us.”</div>
        <div style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 18px', border: `1.5px solid ${P.green}`, borderRadius: 999, color: P.green, fontFamily: mono, fontWeight: 700, fontSize: 18, letterSpacing: '0.14em', boxShadow: `0 0 30px ${P.green}33` }}>✓ NO FLAG · NO NOISE</div>
      </Glass>
    </AbsoluteFill>}
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- Privacy ----------
function XRay() {
  const frame = useCurrentFrame();
  const at = M.privacy.map((t) => F(t - S.privacy));
  const lines = (n: number, w = 90) => Array.from({ length: n }, (_, i) => <div key={i} style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.12)', width: `${w - ((i * 23) % 30)}%`, marginTop: i ? 13 : 0 }}/>);
  const box = (x: number, y: number, w: number, h: number, on: boolean, children: ReactNode) => <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 12, background: on ? 'rgba(255,45,85,0.07)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${on ? P.signal : 'rgba(255,255,255,0.08)'}`, boxShadow: on ? `0 0 30px rgba(255,45,85,0.25)` : 'none', padding: 18, opacity: on ? 1 : 0.55 }}>{children}</div>;
  const tag = (x: number, y: number, text: string, a: number, read: boolean) => frame >= a && <div style={{ position: 'absolute', left: x, top: y, padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${read ? P.signal : P.dim}`, background: '#0B0B0D', color: read ? P.white : P.grey, fontFamily: mono, fontWeight: 700, fontSize: 15, letterSpacing: '0.12em', opacity: lerp(frame, [a, a + 6], [0, 1]), transform: `translateY(${lerp(frame, [a, a + 8], [10, 0])}px)`, zIndex: 5, boxShadow: read ? `0 0 20px rgba(255,45,85,0.35)` : 'none' }}>{text}</div>;
  return <div style={{ position: 'absolute', inset: 0, background: '#0D0D0F' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 46, borderBottom: '1px solid rgba(255,255,255,0.06)' }}/>
    {box(36, 70, 640, 250, frame >= at[0], lines(7))}
    {tag(56, 52, 'ARTICLE · READ', at[0], true)}
    {box(36, 344, 640, 120, frame >= at[1], lines(3, 70))}
    {tag(56, 326, 'EMAIL · READ', at[1], true)}
    {box(36, 488, 640, 90, frame >= at[2], <div style={{ fontFamily: grot, fontSize: 20, color: P.white }}>Is one startup really enough evidence?</div>)}
    {tag(56, 470, 'YOUR REPLY · IF YOU TURN IT ON', at[2], true)}
    {box(706, 70, 300, 200, false, <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontFamily: mono, fontSize: 13, letterSpacing: '0.14em', color: P.dim }}>AD</div>)}
    {tag(726, 52, 'SKIPPED', at[3], false)}
    {box(706, 294, 300, 150, false, <><div style={{ fontFamily: grot, fontWeight: 700, fontSize: 16, color: P.grey }}>Sign in</div><div style={{ marginTop: 12, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', color: P.grey, padding: '4px 10px', letterSpacing: 4 }}>••••••••</div></>)}
    {tag(726, 276, 'PASSWORDS · NEVER', at[3] + 4, false)}
    {box(706, 468, 300, 110, false, lines(3, 80))}
    {tag(726, 450, 'COMMENTS · SKIPPED', at[3] + 8, false)}
  </div>;
}

function Privacy() {
  const frame = useCurrentFrame();
  const W = 1040;
  const enter = useSpr(0, 18, 110);
  const at = M.privacy.map((t) => F(t - S.privacy));
  const bullets: [string, number][] = [['The article, email or reply you’re on', at[0]], ['Never passwords, forms or ads', at[2] + 8], ['Questions, never verdicts', at[3]]];
  return <AbsoluteFill>
    <Glow x={70} y={55} size={45} opacity={0.12}/>
    <Chrome left="Private by design" right="Only what’s in front of you"/>
    <div style={{ position: 'absolute', left: 90, top: 190, width: 700 }}>
      <Reveal at={4}><div style={{ ...H, fontSize: 96 }}>It reads what’s in front of you.</div></Reveal>
      <Reveal at={F(0.4 + 3.9)} style={{ marginTop: 12 }}><div style={{ ...H, fontSize: 96 }}><Grad>Nothing else.</Grad></div></Reveal>
      <div style={{ marginTop: 56 }}>
        {bullets.map(([t, a], i) => <Reveal key={t} at={a} style={{ borderTop: `1px solid ${P.line}`, padding: '20px 0', display: 'flex', gap: 22, alignItems: 'baseline' }}>
          <Label size={16} color={P.signal}>{String(i + 1).padStart(2, '0')}</Label>
          <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 32, color: P.white, letterSpacing: '-0.02em' }}>{t}</div>
        </Reveal>)}
      </div>
      <Label size={15} style={{ marginTop: 26, color: P.dim, opacity: lerp(frame, [at[3] + 12, at[3] + 22], [0, 1]) }}>Your API key stays in the extension · Claude or GPT</Label>
    </div>
    <BrowserFrame url="What Socrates reads" width={W} ext={false} style={{ left: 820, top: 220, transform: `translateX(${(1 - enter) * 120}px)`, opacity: Math.min(1, enter * 1.5) }}>
      <XRay/>
    </BrowserFrame>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- Who it's for ----------
function Impact() {
  const frame = useCurrentFrame();
  const at = M.who.map((t) => F(t - S.impact));
  const twice = F(M.twice - S.impact);
  const out = ease(lerp(frame, [twice - 6, twice + 4], [0, 1]));
  return <AbsoluteFill>
    <Glow x={50} y={60} size={55} opacity={0.1 + 0.12 * lerp(frame, [twice, twice + 12], [0, 1])}/>
    <Chrome left="Who it’s for" right="Anywhere you read and write"/>
    <div style={{ position: 'absolute', left: 120, top: 220, opacity: 1 - out, transform: `translateY(${-50 * out}px)`, filter: `blur(${out * 12}px)` }}>
      {['For students.', 'For families.', 'For anyone with an inbox.'].map((t, i) => <Reveal key={t} at={at[i]} style={{ marginTop: i ? 10 : 0 }}><div style={{ ...H, fontSize: 130 }}>{t}</div></Reveal>)}
    </div>
    <Reveal at={twice + 2} style={{ position: 'absolute', left: 120, top: 380, width: 1700 }}><div style={{ ...H, fontSize: 118, lineHeight: 1.0 }}>Every headline becomes<br/><Grad>a chance to think twice.</Grad></div></Reveal>
    <Label size={15} style={{ position: 'absolute', left: 120, bottom: 80, color: P.dim, opacity: lerp(frame, [twice + 14, twice + 24], [0, 1]) }}>Chrome extension · works with Claude or GPT · offline pattern checks without a key</Label>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- Outro ----------
function Outro() {
  const frame = useCurrentFrame();
  const len = F(S.end - S.outro);
  const name = F(M.outroName - S.outro), line = F(M.outroLine - S.outro);
  const ip = useSpr(4, 18, 90);
  return <AbsoluteFill style={{ alignItems: 'center' }}>
    <Glow x={50} y={36} size={40} opacity={0.3} color={P.orange}/>
    <Motes n={50} seed="outro" opacity={0.45}/>
    <div style={{ position: 'absolute', top: 190, transform: `scale(${0.9 + 0.1 * ip})`, opacity: ip }}><SocratesIcon size={220} glow={26 + 8 * Math.sin(frame / 7)}/></div>
    <Reveal at={name} style={{ position: 'absolute', top: 450, width: '100%', textAlign: 'center' }}><Wordmark size={190} at={name}/></Reveal>
    <Reveal at={line} style={{ position: 'absolute', top: 660, width: '100%', textAlign: 'center' }}><div style={{ ...H, fontSize: 58, letterSpacing: '-0.03em' }}><Grad>Critical thinking, built into your browser.</Grad></div></Reveal>
    <Label size={14} style={{ position: 'absolute', bottom: 70, width: '100%', textAlign: 'center', color: P.dim, opacity: lerp(frame, [line + 10, line + 20], [0, 1]) }}>Music: “Interloper”, “Inspired” by Kevin MacLeod (incompetech.com) · CC BY 4.0 · Voice: ElevenLabs</Label>
    <AbsoluteFill style={{ background: '#000', opacity: lerp(frame, [len - 16, len], [0, 1]) }}/>
  </AbsoluteFill>;
}

export { tagAt, poster };
