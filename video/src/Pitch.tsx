import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import TL from './timeline.json';
import VOICE from './narration.json';
import WORDS from './words.json';
import { BrowserFrame, Chrome, Embers, FallacyTag, Glass, Glow, Grad, Grain, Label, Motes, P, Reveal, Ring, SocratesIcon, SourceCard, Vignette, count, grot, lerp, mono, poster, useSpr } from './editorial';
import { STAT } from './news';

// Launch film for Socrates, the critical thinking companion. The story beats follow the Ember pitch (codebees/video):
// one person first, what it cost, what's missing, the product (recorded live), why it's safe, the close.
// Timings come from src/timeline.json (built by scripts/timeline.mjs from the narration, its word timings and the
// recordings' event times). 30 fps.
const FPS = 30;
const F = (s: number) => Math.round(s * FPS);
const S = TL.scenes as unknown as Record<string, number>, M = TL.marks as unknown as Record<string, number & number[]>;
export const PITCH_TOTAL = F(S.end);

const vdur = (id: string) => (VOICE as Record<string, { duration: number }>)[id]?.duration ?? 0;
const voAt = (id: string) => (TL.vo as [string, number][]).find(([v]) => v === id)?.[1] ?? 0;
const words = (id: string) => ((WORDS as unknown as Record<string, { words: [string, number, number][] }>)[id]?.words ?? []);
const ease = Easing.inOut(Easing.cubic);
const H: CSSProperties = { fontFamily: grot, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.95, color: P.white };

// ---------- Root ----------
export function Pitch() {
  const scene = (from: number | undefined, to: number | undefined, el: ReactNode, key?: string) => from === undefined || to === undefined ? null : <Sequence key={key} from={F(from)} durationInFrames={F(to) - F(from)} premountFor={30}>{el}</Sequence>;
  return <AbsoluteFill style={{ background: P.bg }}>
    {scene(S.meeting, S.collapse, <Meeting/>)}
    {scene(S.collapse, S.problem, <Collapse/>)}
    {scene(S.problem, S.stat ?? S.pivot, <Problem/>)}
    {scene(S.stat, S.pivot, <Stat/>)}
    {scene(S.pivot, S.intro, <Pivot/>)}
    {scene(S.intro, S.structure, <Intro/>)}
    {scene(S.structure, S.email, <Structure/>)}
    {scene(S.email, S.article, <Demo id="email"/>)}
    {scene(S.article, S.privacy, <Demo id="article"/>)}
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
function sfxList(): Sfx[] {
  const list: Sfx[] = [];
  list.push([0.2, 'heartbeat', 0.4], [M.finished + 0.45, 'stamp', 0.6]);
  list.push([S.collapse, 'whoosh', 0.4], [M.nobody, 'thud', 0.5], [M.later, 'riser', 0.25], [M.gone, 'impact', 0.7]);
  list.push([S.problem, 'whoosh', 0.4], [S.problem + 0.9, 'thud', 0.6]);
  if (S.stat !== undefined) list.push([S.stat, 'slam', 0.35], [M.statWord, 'thud', 0.5]);
  list.push([M.checks[0], 'click', 0.5], [M.checks[1], 'click', 0.5], [M.checks[2] + 0.1, 'stinger', 0.65], [M.tagline, 'boom', 0.7], [M.tagline, 'impact', 0.4]);
  list.push([S.intro + 0.1, 'whoosh', 0.45], [M.introName - 0.05, 'boom', 0.6]);
  list.push([S.structure, 'whoosh', 0.35], [M.structure, 'zap', 0.45], [M.structure + 0.5, 'stamp', 0.4]);
  // The extension's own alarm isn't in the recording, so it's added here: one stinger per entrance, staggered
  // 650 ms apart like the content script does (STAGGER_MS).
  list.push([S.email, 'whoosh', 0.45]);
  for (let i = 0; i < 4; i++) list.push([M.emailStamp + i * 0.65 / 1.15 + 0.24, i ? 'stamp' : 'stinger', i ? 0.4 : 0.7]);
  list.push([M.emailCard - 0.15, 'click', 0.7], [M.replyStamp + 0.24, 'stinger', 0.55], [M.replyStamp + 0.24, 'boom', 0.65], [M.replyStamp + 0.24, 'glitch', 0.3], [M.rethought, 'chime', 0.8]);
  list.push([S.article, 'whoosh', 0.45], [M.articleStamp + 0.24, 'stinger', 0.6], [M.articleCard - 0.15, 'click', 0.7]);
  list.push([S.privacy, 'whoosh', 0.4], ...M.privacy.map((t): Sfx => [t, 'stamp', 0.35]));
  list.push([S.impact, 'whoosh', 0.4], ...M.impact.map((t, i): Sfx => [t, i === 2 ? 'boom' : 'thud', i === 2 ? 0.6 : 0.45]));
  list.push([S.outro, 'whoosh', 0.45], [M.outroName - 0.05, 'boom', 0.6]);
  return list;
}

function Soundtrack() {
  const turn = S.intro;
  return <>
    {/* Music: "Interloper" and "Inspired" by Kevin MacLeod (incompetech.com), CC BY 4.0. Ducked under the narration. */}
    <Sequence durationInFrames={F(turn) + 20}>
      <Audio src={staticFile('music/interloper.mp3')} volume={(f) => (0.55 - 0.3 * duck(f)) * interpolate(f, [0, 30, F(turn) - 40, F(turn) + 20], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}/>
    </Sequence>
    <Sequence from={F(turn)}>
      <Audio src={staticFile('music/inspired.mp3')} volume={(f) => (0.5 - 0.28 * duck(f + F(turn))) * interpolate(f, [0, 45, F(S.end - turn) - 60, F(S.end - turn)], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}/>
    </Sequence>
    {(TL.vo as [string, number][]).map(([id, at]) => <Sequence key={id} from={F(at)}><Audio src={staticFile(`narration/${id}.mp3`)} volume={1}/></Sequence>)}
    {sfxList().map(([at, name, volume = 1], i) => <Sequence key={i} from={Math.max(0, F(at))}><Audio src={staticFile(`audio/${name}.wav`)} volume={volume}/></Sequence>)}
  </>;
}

// ---------- 1. Monday, 9:02: Dan's pitch ----------
const DAN_TEXT = "Trust me, I've done this for twenty years. Either we go all in on Atlas, or we're finished.";

function Meeting() {
  const frame = useCurrentFrame();
  const card = useSpr(6, 18, 120);
  const at = voAt('dan');
  const ws = words('dan');
  const display = DAN_TEXT.split(' ');
  const speaking = frame >= F(at) && frame < F(at + vdur('dan'));
  const ok = F(M.finished - S.meeting) + 14;
  const okP = useSpr(ok, 14, 160);
  return <AbsoluteFill>
    <Glow x={30} y={40} size={50} opacity={0.12}/>
    <Chrome left="Monday · 9:02 AM · Strategy review" right=""/>
    <div style={{ position: 'absolute', left: 140, top: 210, display: 'flex', alignItems: 'center', gap: 22, opacity: Math.min(1, card * 1.4), transform: `translateY(${(1 - card) * 20}px)` }}>
      <div style={{ width: 84, height: 84, borderRadius: 42, background: 'linear-gradient(135deg, #14806e, #0b5a4d)', display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 700, fontSize: 32, color: '#fff', boxShadow: speaking ? `0 0 0 ${4 + 3 * Math.sin(frame / 3)}px rgba(255,255,255,0.15)` : 'none' }}>DM</div>
      <div>
        <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 40, color: P.white, letterSpacing: '-0.02em' }}>Dan Mercer</div>
        <Label size={17}>VP Strategy · Kestrel</Label>
      </div>
      {speaking && <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginLeft: 18 }}>{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 5, height: 10 + 16 * Math.abs(Math.sin(frame / 3 + i * 1.3)), borderRadius: 3, background: P.white, opacity: 0.8 }}/>)}</div>}
    </div>
    <Reveal at={F(1.5)} style={{ position: 'absolute', left: 140, top: 330 }}><Label size={22}>He wins every meeting</Label></Reveal>
    <div style={{ position: 'absolute', left: 140, top: 430, width: 1640, fontFamily: grot, fontWeight: 700, fontSize: 82, lineHeight: 1.08, letterSpacing: '-0.035em' }}>
      {display.map((w, i) => {
        const t = ws[i] ? at + ws[i][1] : at + (i / display.length) * vdur('dan');
        const on = lerp(frame, [F(t) - 3, F(t) + 3], [0, 1]);
        const accent = /^(Either|or)$/.test(w);
        return <span key={i} style={{ opacity: frame < F(at) - 2 ? 0 : 0.14 + 0.86 * on, color: accent && on > 0.5 ? P.signal : P.white, filter: `blur(${(1 - on) * 4}px)` }}>{i === 0 ? '“' : ''}{w}{i === display.length - 1 ? '”' : ''}{' '}</span>;
      })}
    </div>
    {frame >= ok && <div style={{ position: 'absolute', left: 140, top: 760, display: 'flex', gap: 16, alignItems: 'center', opacity: Math.min(1, okP * 1.5), transform: `scale(${1.2 - 0.2 * okP})`, transformOrigin: '0 50%' }}>
      <span style={{ padding: '12px 22px', borderRadius: 999, border: `1.5px solid ${P.green}`, color: P.green, fontFamily: mono, fontWeight: 700, fontSize: 20, letterSpacing: '0.14em', boxShadow: `0 0 30px ${P.green}33` }}>✓ APPROVED</span>
      <Label size={20}>All in on Atlas · unanimous</Label>
    </div>}
    <Vignette/>
  </AbsoluteFill>;
}

function Collapse() {
  const frame = useCurrentFrame();
  const local = (s: number) => F(s - S.collapse);
  const nobody = local(M.nobody), later = local(M.later), gone = local(M.gone);
  const W = 860, Hc = 420;
  // Revenue: up after the decision, then down to nothing.
  const pts = Array.from({ length: 41 }, (_, i) => { const x = i / 40; const y = x < 0.45 ? 0.35 + 0.5 * Math.sin((x / 0.45) * Math.PI / 2) : 0.85 * Math.max(0, 1 - ((x - 0.45) / 0.55) ** 0.8); return [x * W, Hc - y * Hc]; });
  const drawn = lerp(frame, [8, nobody, gone], [0.05, 0.45, 1]);
  const n = Math.max(2, Math.round(drawn * 40) + 1);
  const d = pts.slice(0, n).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const headcount = Math.round(lerp(frame, [nobody, gone], [1240, 0]));
  const out = lerp(frame, [later - 6, later + 4], [1, 0]);
  const closed = useSpr(gone, 12, 170);
  return <AbsoluteFill>
    <Glow x={70} y={60} size={45} opacity={0.08 + 0.16 * lerp(frame, [nobody, gone], [0, 1])}/>
    <Chrome left="Kestrel · the next twelve months" right=""/>
    <div style={{ position: 'absolute', left: 120, top: 300, width: 760, opacity: out }}>
      <Reveal at={F(0.6)}><div style={{ ...H, fontSize: 88 }}>It sounded convincing.</div></Reveal>
      <Reveal at={nobody} style={{ marginTop: 20 }}><div style={{ ...H, fontSize: 88 }}>Nobody checked the <Grad>logic.</Grad></div></Reveal>
    </div>
    {frame >= later - 4 && <div style={{ position: 'absolute', left: 120, top: 300, width: 760 }}>
      <Reveal at={later}><Label size={22}>A year later</Label></Reveal>
      <Reveal at={later + 4} style={{ marginTop: 18 }}><div style={{ ...H, fontSize: 110, position: 'relative', display: 'inline-block' }}>Kestrel Inc.
        <span style={{ position: 'absolute', left: -6, right: -6, top: '52%', height: 9, background: P.signal, transform: `scaleX(${lerp(frame, [gone, gone + 8], [0, 1])})`, transformOrigin: '0 50%', boxShadow: `0 0 18px ${P.signal}` }}/></div></Reveal>
      <Reveal at={later + 8} style={{ marginTop: 14 }}><Label size={20}>2016 – 2027</Label></Reveal>
      {frame >= gone && <div style={{ marginTop: 34, display: 'inline-block', padding: '10px 22px', border: `3px solid ${P.signal}`, color: P.signal, fontFamily: poster, fontSize: 44, letterSpacing: '0.1em', transform: `rotate(-5deg) scale(${1.6 - 0.6 * closed})`, opacity: Math.min(1, closed * 1.5), boxShadow: `0 0 30px rgba(255,45,85,0.35)` }}>CLOSED</div>}
    </div>}
    <div style={{ position: 'absolute', left: 960, top: 300 }}>
      <Label size={16} style={{ marginBottom: 16 }}>Revenue</Label>
      <svg width={W} height={Hc + 20} style={{ overflow: 'visible' }}>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={0} x2={W} y1={Hc - g * Hc} y2={Hc - g * Hc} stroke="rgba(255,255,255,0.06)"/>)}
        <line x1={0} x2={W} y1={Hc} y2={Hc} stroke="rgba(255,255,255,0.2)"/>
        <line x1={0.45 * W} x2={0.45 * W} y1={0} y2={Hc} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 6"/>
        <text x={0.45 * W + 10} y={18} fill={P.grey} fontFamily={mono} fontSize={14} letterSpacing={2}>ALL IN ON ATLAS</text>
        <path d={d} fill="none" stroke={drawn > 0.46 ? P.signal : P.white} strokeWidth={4} strokeLinejoin="round" style={{ filter: drawn > 0.46 ? `drop-shadow(0 0 10px ${P.signal})` : 'none' }}/>
      </svg>
      <div style={{ display: 'flex', gap: 40, marginTop: 22, opacity: lerp(frame, [nobody, nobody + 10], [0, 1]) }}>
        <div><Label size={14}>Headcount</Label><div style={{ ...H, fontSize: 64, marginTop: 6 }}>{headcount.toLocaleString('en-US')}</div></div>
        <div><Label size={14}>Atlas</Label><div style={{ ...H, fontSize: 64, marginTop: 6, color: frame >= gone ? P.signal : P.white }}>{frame >= gone ? 'Shut down' : 'Burning'}</div></div>
      </div>
    </div>
    <AbsoluteFill style={{ background: '#000', opacity: lerp(frame, [gone + 20, F(S.problem - S.collapse)], [0, 0.6]) }}/>
    <Vignette/>
  </AbsoluteFill>;
}

function Problem() {
  return <AbsoluteFill style={{ justifyContent: 'center', padding: '0 140px' }}>
    <Glow x={50} y={55} size={50} opacity={0.12}/>
    <Reveal at={2}><div style={{ ...H, fontSize: 132 }}>Decisions get made on language.</div></Reveal>
    <Reveal at={F(0.9)} style={{ marginTop: 18 }}><div style={{ ...H, fontSize: 132 }}><Grad>Not logic.</Grad></div></Reveal>
    <Vignette/>
  </AbsoluteFill>;
}

function Stat() {
  const frame = useCurrentFrame();
  if (!STAT) return null;
  const statAt = Math.max(4, F(M.statWord - S.stat) - 8);
  const n = STAT.to !== undefined ? count(frame, statAt - 2, STAT.to, 14) : null;
  const text = n !== null ? `${STAT.prefix ?? ''}${n.toLocaleString('en-US')}${STAT.suffix ?? ''}` : STAT.stat;
  const sp = useSpr(statAt, 16, 130);
  return <AbsoluteFill>
    <Glow x={72} y={42} size={45} opacity={0.18 * Math.min(1, sp)}/>
    <Chrome left="The evidence"/>
    <SourceCard outlet={STAT.outlet} date={STAT.date} headline={STAT.headline} at={2} width={800} style={{ left: 110, top: 240 }}/>
    <div style={{ position: 'absolute', left: 1010, top: 200, width: 830 }}>
      <Label size={20} color={P.signal}>{STAT.tag}</Label>
      <div style={{ ...H, fontSize: 280, letterSpacing: '-0.06em', marginTop: 18, opacity: frame >= statAt - 2 ? Math.min(1, sp * 1.4) : 0, filter: `blur(${(1 - Math.min(1, sp * 1.3)) * 12}px)` }}><Grad>{text}</Grad></div>
      <Reveal at={statAt + 6}><div style={{ fontFamily: grot, fontWeight: 600, fontSize: 42, lineHeight: 1.12, color: P.white, letterSpacing: '-0.02em' }}>{STAT.label}</div></Reveal>
      {STAT.sub && <Reveal at={statAt + 16} style={{ marginTop: 16 }}><div style={{ fontFamily: grot, fontSize: 28, color: P.grey }}>{STAT.sub}</div></Reveal>}
    </div>
    <Label size={15} style={{ position: 'absolute', left: 1010, top: 930, width: 840, lineHeight: 1.5, color: P.dim }}>Source: {STAT.source}</Label>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- 2. What's missing ----------
const BAR = `linear-gradient(90deg, ${P.signal}, ${P.orange})`;
function Pivot() {
  const frame = useCurrentFrame();
  const rows: [string, boolean][] = [['Spell-check', true], ['Grammar-check', true], ['Logic check', false]];
  const at = M.checks.map((t) => F(t - S.pivot));
  const bad = at[2] + 3, tag = F(M.tagline - S.pivot);
  const out = ease(lerp(frame, [tag - 8, tag], [0, 1]));
  const tp = useSpr(tag, 16, 130);
  return <AbsoluteFill style={{ justifyContent: 'center', padding: '0 140px' }}>
    <Glow x={50} y={55} size={50} opacity={0.08 + 0.2 * lerp(frame, [bad, bad + 8], [0, 1])}/>
    <Chrome left="What we have · what we don’t"/>
    <div style={{ opacity: 1 - out, transform: `scale(${1 - 0.05 * out})`, filter: `blur(${out * 10}px)` }}>
      {rows.map(([label, ok], i) => {
        const a = i === 2 ? bad : at[i];
        return <Reveal key={label} at={a} style={{ marginTop: i ? 18 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 46, ...H, fontSize: 160 }}>
            <span style={{ position: 'relative', opacity: ok ? 0.9 : 1 }}>{ok ? label : <Grad>{label}</Grad>}
              {!ok && <span style={{ position: 'absolute', left: -8, right: -8, top: '54%', height: 10, background: BAR, transform: `scaleX(${lerp(frame, [a + 4, a + 12], [0, 1])})`, transformOrigin: '0 50%', boxShadow: `0 0 20px ${P.signal}` }}/>}
            </span>
            <span style={{ fontWeight: 300, fontSize: 120, color: ok ? P.grey : P.signal }}>{ok ? '✓' : '✕'}</span>
          </div>
        </Reveal>;
      })}
    </div>
    {frame >= tag && <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: Math.min(1, tp * 1.4), transform: `scale(${1.08 - 0.08 * tp})`, filter: `blur(${(1 - Math.min(1, tp * 1.3)) * 14}px)` }}>
      <div style={{ ...H, fontSize: 210, letterSpacing: '-0.06em', textAlign: 'center' }}>Logic,<br/><Grad>not language.</Grad></div>
    </AbsoluteFill>}
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- 3. Introducing Socrates ----------
function Wordmark({ size, at }: { size: number; at: number }) {
  const frame = useCurrentFrame();
  const p = lerp(frame, [at + 4, at + 34], [-30, 130]);
  // backgroundImage, not the background shorthand: React re-applying the shorthand resets background-clip.
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
      <Reveal at={line} style={{ marginTop: 30 }}><div style={{ fontFamily: grot, fontSize: 30, color: P.grey, lineHeight: 1.35, width: 820 }}>Flags weak arguments in what you read, and in what you write.</div></Reveal>
    </div>
    <Vignette/>
  </AbsoluteFill>;
}

/** The argument under Dan's sentence: what it concludes, what it assumes, what's missing. */
function Structure() {
  const frame = useCurrentFrame();
  const st = F(M.structure - S.structure);
  const box = (x: number, y: number, w: number, label: string, text: string, at: number, kind: 'claim' | 'premise' | 'missing') => {
    const p = useSpr(at, 16, 130);
    const c = kind === 'missing' ? P.dim : kind === 'premise' ? P.signal : P.white;
    return <div style={{ position: 'absolute', left: x, top: y, width: w, padding: '22px 26px', borderRadius: 18, border: `1.5px ${kind === 'missing' ? 'dashed' : 'solid'} ${c}`, background: kind === 'premise' ? 'rgba(255,45,85,0.07)' : 'rgba(255,255,255,0.03)', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 24}px)`, boxShadow: kind === 'premise' ? '0 0 40px rgba(255,45,85,0.18)' : 'none' }}>
      <Label size={15} color={kind === 'premise' ? P.signal : P.grey}>{label}</Label>
      <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 38, color: kind === 'missing' ? P.grey : P.white, letterSpacing: '-0.02em', marginTop: 8, lineHeight: 1.12 }}>{text}</div>
    </div>;
  };
  const line = (x1: number, y1: number, x2: number, y2: number, at: number, dashed = false) => <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * lerp(frame, [at, at + 10], [0, 1])} y2={y1 + (y2 - y1) * lerp(frame, [at, at + 10], [0, 1])} stroke={dashed ? P.dim : 'rgba(255,255,255,0.5)'} strokeWidth={2} strokeDasharray={dashed ? '8 8' : undefined}/>;
  return <AbsoluteFill>
    <Glow x={50} y={60} size={50} opacity={0.12}/>
    <Chrome left="Not the wording · the structure"/>
    <Reveal at={4} style={{ position: 'absolute', left: 140, top: 150, width: 1640 }}><div style={{ fontFamily: grot, fontWeight: 600, fontSize: 50, color: P.white, letterSpacing: '-0.02em', lineHeight: 1.15 }}>“Either we go all in on Atlas, <span style={{ color: frame >= st ? P.signal : P.white }}>or we’re finished.</span>”</div></Reveal>
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      {line(620, 520, 1110, 520, st + 6)}
      {line(380, 700, 380, 600, st + 14, true)}
    </svg>
    {box(140, 440, 480, 'Premise', 'Only two options exist', st, 'premise')}
    {box(1110, 440, 560, 'Conclusion', 'Put the whole budget into Atlas', st + 8, 'claim')}
    {box(140, 700, 700, 'Missing', 'Other options · evidence · decision criteria', st + 16, 'missing')}
    {frame >= st + 14 && <div style={{ position: 'absolute', left: 150, top: 398 }}><FallacyTag name="Possible false dilemma" k={2.1} enter={frame - st - 14} glowPhase={frame}/></div>}
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- 4. The real extension, recorded ----------
type Cam = { cx: number; cy: number; s: number };
const VW = 1280, VH = 720; // the recording's viewport, in CSS px
const ZOOM: Record<string, Cam> = {
  email: { cx: 560, cy: 300, s: 1.3 },
  card: { cx: 470, cy: 262, s: 1.36 },
  reply: { cx: 600, cy: 440, s: 1.3 },
  page: { cx: 640, cy: 360, s: 1.05 },
  acard: { cx: 470, cy: 380, s: 1.3 },
};
const SIDE: Record<string, [string, string, string][]> = {
  email: [['01', 'Dan’s email', 'every weak step, tagged in place'], ['02', 'It asks. It doesn’t tell.', 'one question per flag'], ['03', 'Your reply, too', 'optional · off by default'], ['03', 'Your reply, too', 'optional · off by default'], ['03', 'Rethought', 'the flag clears'], ['03', 'Rethought', 'the flag clears']],
  article: [['01', 'Reads along', 'a fake news site we built to test it'], ['02', 'Every claim, weighed', 'stamps as you scroll'], ['02', 'Every claim, weighed', 'stamps as you scroll'], ['03', 'One question each', 'live, from Claude']],
};

type Clip = { from: number; to: number; rate: number; zoom: string; at: number; len: number };

function Demo({ id }: { id: 'email' | 'article' }) {
  const frame = useCurrentFrame();
  const W = 1400, k = W / VW;
  const ch = TL.chapters.find((c) => c.id === id)!;
  const clips = ch.clips as Clip[];
  const local = (s: number) => F(s - ch.start);
  const ci = Math.max(0, clips.findIndex((c, i) => frame >= local(c.at) && (i === clips.length - 1 || frame < local(clips[i + 1].at))));
  const clip = clips[ci];
  const from = ZOOM[(ci > 0 ? clips[ci - 1].zoom : clip.zoom)], to = ZOOM[clip.zoom];
  const z = ease(lerp(frame, [local(clip.at), local(clip.at) + 14], [0, 1]));
  const cam = { cx: from.cx + (to.cx - from.cx) * z, cy: from.cy + (to.cy - from.cy) * z, s: from.s + (to.s - from.s) * z };
  // Footage time now, for the cursor.
  const src = clip.from + (frame / FPS - (clip.at - ch.start)) * clip.rate;
  const fj = (TL.footage as unknown as Record<string, { cursor: [number, number, number, number][] } | null>)[id];
  const cur = cursorAt(fj?.cursor ?? [], src);
  const enter = useSpr(0, 18, 110);
  const [num, title, sub] = SIDE[id][ci] ?? SIDE[id][0];
  const max = id === 'email' && Math.abs(frame / FPS - (M.replyStamp + 0.24 - ch.start)) < 0.5;
  const shake = max ? Math.sin(frame * 4.3) * 6 : 0;
  return <AbsoluteFill>
    <Glow x={38} y={52} size={55} opacity={0.14 + (max ? 0.3 : 0)}/>
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <Chrome left={id === 'email' ? 'Demo 1 · An email at work' : 'Demo 2 · Reading the web'} right="Real extension · recorded live"/>
      <BrowserFrame url={id === 'email' ? 'mail.google.com/mail/u/0/#inbox' : 'dailycertainty.example/news/remote-work'} width={W} style={{ left: 56, top: 150, transform: `translateY(${(1 - enter) * 60}px)`, opacity: Math.min(1, enter * 1.5) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: (W * 9) / 16, transformOrigin: '0 0', transform: `translate(${W / 2 - cam.cx * k * cam.s}px, ${(W * 9) / 32 - cam.cy * k * cam.s}px) scale(${cam.s})` }}>
          {clips.map((c, i) => <Sequence key={i} from={local(c.at)} durationInFrames={Math.max(1, F(c.len))} layout="none">
            <OffthreadVideo src={staticFile(`footage/${id}.mp4`)} trimBefore={F(c.from)} playbackRate={c.rate} muted style={{ position: 'absolute', left: 0, top: 0, width: W, height: (W * 9) / 16 }}/>
          </Sequence>)}
          {cur && <svg width={30} height={40} viewBox="0 0 24 32" style={{ position: 'absolute', left: cur.x * k, top: cur.y * k, transform: `scale(${cur.down ? 0.85 : 1})`, transformOrigin: '0 0', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))' }}>
            <path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" fill="#111" stroke="#fff" strokeWidth={2} strokeLinejoin="round"/>
          </svg>}
        </div>
      </BrowserFrame>
      <Label size={13} style={{ position: 'absolute', left: 60, top: 1000, color: P.dim, letterSpacing: '0.1em' }}>{id === 'email' ? 'The Socrates extension running live with Claude Opus 5.5, on a Gmail-style page we built for the demo · cuts shortened' : 'The Daily Certainty is a fictional newspaper built to test Socrates · the extension running live with Claude Opus 5.5 · cuts shortened'}</Label>
      <div style={{ position: 'absolute', left: 1500, top: 160, width: 370 }} key={title}>
        <Reveal at={local(clip.at)}><div style={{ ...H, fontSize: 130, letterSpacing: '-0.06em', color: P.dim }}>{num}</div></Reveal>
        <Reveal at={local(clip.at) + 4} style={{ marginTop: 26 }}><div style={{ ...H, fontSize: 48, lineHeight: 1.02, letterSpacing: '-0.035em' }}>{title}</div></Reveal>
        <Reveal at={local(clip.at) + 9} style={{ marginTop: 18 }}><Label size={17}>{sub}</Label></Reveal>
      </div>
    </AbsoluteFill>
    {max && <AbsoluteFill style={{ pointerEvents: 'none', boxShadow: 'inset 0 0 200px 50px rgba(120,0,20,0.6)' }}/>}
    <Vignette strength={0.5}/>
  </AbsoluteFill>;
}

function cursorAt(keys: [number, number, number, number][], t: number) {
  if (!keys.length || t < keys[0][0] - 0.3) return null;
  let i = keys.findIndex((k) => k[0] > t);
  if (i === -1) i = keys.length;
  const a = keys[Math.max(0, i - 1)], b = keys[Math.min(keys.length - 1, i)];
  const u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
  const down = keys.some((k) => k[3] === 1 && t >= k[0] && t < k[0] + 0.18);
  return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u, down };
}

// ---------- 5. Privacy ----------
function Privacy() {
  const frame = useCurrentFrame();
  const at = M.privacy.map((t) => F(t - S.privacy));
  const bullets: [string, number][] = [['Only the email, article or reply you’re on', at[0]], ['Never passwords, forms or ads', at[2] + 8], ['Questions, never verdicts', at[3]]];
  return <AbsoluteFill>
    <Glow x={70} y={55} size={45} opacity={0.12}/>
    <Chrome left="Private by design" right="Only what’s in front of you"/>
    <div style={{ position: 'absolute', left: 140, top: 230, width: 1500 }}>
      <Reveal at={4}><div style={{ ...H, fontSize: 112 }}>It reads what’s in front of you. <Grad>Nothing else.</Grad></div></Reveal>
      <div style={{ marginTop: 70, display: 'flex', gap: 40 }}>
        {bullets.map(([t, a], i) => <Reveal key={t} at={a} style={{ flex: 1, borderTop: `1px solid ${P.line}`, paddingTop: 22 }}>
          <Label size={16} color={P.signal}>{String(i + 1).padStart(2, '0')}</Label>
          <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 34, color: P.white, letterSpacing: '-0.02em', marginTop: 10, lineHeight: 1.15 }}>{t}</div>
        </Reveal>)}
      </div>
      <Label size={15} style={{ marginTop: 40, color: P.dim, opacity: lerp(frame, [at[3] + 10, at[3] + 20], [0, 1]) }}>Your API key stays in the extension · works with Claude or GPT</Label>
    </div>
    <Vignette/>
  </AbsoluteFill>;
}

// ---------- 6. Better decisions ----------
function Impact() {
  const at = M.impact.map((t) => F(t - S.impact));
  return <AbsoluteFill style={{ justifyContent: 'center', padding: '0 140px' }}>
    <Glow x={50} y={60} size={55} opacity={0.16}/>
    <Chrome left="For every team" right="Every proposal · every decision"/>
    <Reveal at={at[0]}><div style={{ ...H, fontSize: 140 }}>Better arguments.</div></Reveal>
    <Reveal at={at[1]} style={{ marginTop: 10 }}><div style={{ ...H, fontSize: 140 }}>Better decisions.</div></Reveal>
    <Reveal at={at[2]} style={{ marginTop: 30 }}><div style={{ ...H, fontSize: 140 }}><Grad>Logic, not language.</Grad></div></Reveal>
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
    <div style={{ position: 'absolute', top: 180, transform: `scale(${0.9 + 0.1 * ip})`, opacity: ip }}><SocratesIcon size={220} glow={26 + 8 * Math.sin(frame / 7)}/></div>
    <Reveal at={name} style={{ position: 'absolute', top: 440, width: '100%', textAlign: 'center' }}><Wordmark size={190} at={name}/></Reveal>
    <Reveal at={line} style={{ position: 'absolute', top: 650, width: '100%', textAlign: 'center' }}><div style={{ ...H, fontSize: 58, letterSpacing: '-0.03em' }}><Grad>Critical thinking, built into your browser.</Grad></div></Reveal>
    <Reveal at={line + 18} style={{ position: 'absolute', top: 740, width: '100%', textAlign: 'center' }}><Label size={20}>Logic, not language</Label></Reveal>
    <Label size={14} style={{ position: 'absolute', bottom: 70, width: '100%', textAlign: 'center', color: P.dim, opacity: lerp(frame, [line + 10, line + 20], [0, 1]) }}>Music: “Interloper”, “Inspired” by Kevin MacLeod (incompetech.com) · CC BY 4.0 · Voice: ElevenLabs</Label>
    <AbsoluteFill style={{ background: '#000', opacity: lerp(frame, [len - 16, len], [0, 1]) }}/>
  </AbsoluteFill>;
}
