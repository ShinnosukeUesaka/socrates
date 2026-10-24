import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';

// Launch-film look: near-black, white type set tight, one accent (the Socrates glow, red into orange),
// soft light instead of decoration. The story beats and sound design follow the Ember pitch (codebees/video).
export const grot = loadInterTight('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }).fontFamily;
export const mono = loadJetBrains('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily;
/** Condensed poster face standing in for the extension's Impact stamps. */
export const poster = loadAnton('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily;

export const P = {
  bg: '#060606', panel: '#101012', panel2: '#17171A', line: 'rgba(255,255,255,0.09)',
  white: '#F5F5F7', grey: '#8E8E93', dim: '#55555A',
  // The extension's own colours (src/content/styles.js) and its icon's glow.
  signal: '#FF2D55', signalDeep: '#D1002F', orange: '#FF8A1F', blood: '#170A0D', yellow: '#FFD60A', green: '#1FD17A', cyan: '#00E5FF',
};
export const GRAD = `linear-gradient(90deg, ${P.signal} 0%, ${P.orange} 100%)`;

export const lerp = (frame: number, input: number[], output: number[]) => interpolate(frame, input, output, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** Text that types out between two frames. */
export function typed(text: string, frame: number, from: number, to: number) {
  return text.slice(0, Math.floor(lerp(frame, [from, to], [0, text.length])));
}

export function useSpr(at: number, damping = 14, stiffness = 140) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness } });
}

/** Text that rises into place out of a blur. */
export function Reveal({ children, at, style, dy = 28 }: { children: ReactNode; at: number; style?: CSSProperties; dy?: number }) {
  const frame = useCurrentFrame();
  const p = useSpr(at, 20, 120);
  if (frame < at) return <div style={{ ...style, opacity: 0 }}>{children}</div>;
  return <div style={{ ...style, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * dy}px)`, filter: `blur(${(1 - Math.min(1, p * 1.2)) * 14}px)` }}>{children}</div>;
}

/** Accent gradient text. */
export function Grad({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', ...style }}>{children}</span>;
}

/** Small mono label. */
export function Label({ children, size = 18, color = P.grey, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return <div style={{ fontFamily: mono, fontWeight: 500, fontSize: size, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>;
}

/** Section marker top left, product top right. */
export function Chrome({ left, right = 'SOCRATES' }: { left: string; right?: string }) {
  const frame = useCurrentFrame();
  const o = lerp(frame, [0, 10], [0, 1]);
  return <>
    <Label size={17} style={{ position: 'absolute', left: 72, top: 54, opacity: o }}>{left}</Label>
    <Label size={17} style={{ position: 'absolute', right: 72, top: 54, opacity: o }}>{right}</Label>
  </>;
}

/** Slow-drifting accent light on black. */
export function Glow({ x = 50, y = 50, size = 60, opacity = 0.35, color = P.signal }: { x?: number; y?: number; size?: number; opacity?: number; color?: string }) {
  const frame = useCurrentFrame();
  const dx = Math.sin(frame / 90) * 3, dy = Math.cos(frame / 110) * 3;
  return <AbsoluteFill style={{ background: `radial-gradient(circle at ${x + dx}% ${y + dy}%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent ${size}%)`, pointerEvents: 'none' }}/>;
}

/** Very light film grain, re-seeded every two frames. */
export function Grain({ opacity = 0.04 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 50;
  return <AbsoluteFill style={{ pointerEvents: 'none', opacity, mixBlendMode: 'overlay' }}>
    <svg width="1920" height="1080"><filter id={`g${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed}/></filter><rect width="1920" height="1080" filter={`url(#g${seed})`}/></svg>
  </AbsoluteFill>;
}

/** Vignette that keeps the frame edges dark. */
export function Vignette({ strength = 0.6 }: { strength?: number }) {
  return <AbsoluteFill style={{ pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,${strength}))` }}/>;
}

/** Number that counts up between two frames. */
export function count(frame: number, at: number, to: number, dur = 18, from = 0) {
  return Math.round(lerp(frame, [at, at + dur], [from, to]));
}

/** Dark glass card. */
export function Glass({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))', border: `1px solid ${P.line}`, borderRadius: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)', ...style }}>{children}</div>;
}

/** A source card for a real headline: outlet, date, headline. */
export function SourceCard({ outlet, date, headline, at, width = 820, style }: { outlet: string; date: string; headline: string; at: number; width?: number; style?: CSSProperties }) {
  const p = useSpr(at, 18, 130);
  return <Glass style={{ width, padding: '34px 40px 38px', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 40}px) scale(${0.96 + 0.04 * p})`, ...style }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, marginBottom: 22, borderBottom: `1px solid ${P.line}` }}>
      <span style={{ fontFamily: grot, fontWeight: 700, fontSize: 28, color: P.white, letterSpacing: '-0.01em' }}>{outlet}</span>
      <Label size={16}>{date}</Label>
    </div>
    <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 52, lineHeight: 1.08, letterSpacing: '-0.025em', color: P.white }}>{headline}</div>
  </Glass>;
}

/** Scrolling ticker along the bottom. */
export function Ticker({ items, speed = 3 }: { items: string[]; speed?: number }) {
  const frame = useCurrentFrame();
  const text = items.join('     /     ') + '     /     ';
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, borderTop: `1px solid ${P.line}`, background: 'rgba(10,10,12,0.9)', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 150, background: P.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, borderRight: `1px solid ${P.line}` }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: P.signal, marginRight: 10, boxShadow: `0 0 12px ${P.signal}`, opacity: Math.floor(frame / 15) % 2 ? 0.35 : 1 }}/><Label size={15} color={P.white}>Live</Label>
    </div>
    <div style={{ whiteSpace: 'nowrap', fontFamily: mono, fontWeight: 500, fontSize: 17, letterSpacing: '0.08em', color: P.grey, transform: `translateX(${170 - ((frame * speed) % (text.length * 10.2))}px)` }}>{text.toUpperCase()}{text.toUpperCase()}</div>
  </div>;
}

/** Dark browser window around a page. The page area is width × 9/16. */
export function BrowserFrame({ children, url, width, style, ext = true }: { children: ReactNode; url: string; width: number; style?: CSSProperties; ext?: boolean }) {
  const bar = Math.round(width * 0.028);
  return <div style={{ position: 'absolute', width, borderRadius: 16, overflow: 'hidden', background: '#1C1C1E', boxShadow: '0 50px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)', ...style }}>
    <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: bar * 0.28, padding: `0 ${bar * 0.6}px` }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: bar * 0.32, height: bar * 0.32, borderRadius: '50%', background: c }}/>)}
      <div style={{ marginLeft: bar * 0.6, flex: 1, maxWidth: width * 0.42, height: bar * 0.6, borderRadius: bar * 0.3, background: '#2C2C2E', display: 'flex', alignItems: 'center', padding: `0 ${bar * 0.45}px`, fontFamily: grot, fontWeight: 500, fontSize: bar * 0.34, color: '#98989D' }}>{url}</div>
      {ext && <div style={{ marginLeft: 'auto', display: 'flex' }}><SocratesIcon size={bar * 0.62}/></div>}
    </div>
    <div style={{ width, height: width * 9 / 16, position: 'relative', overflow: 'hidden', background: '#fff' }}>{children}</div>
  </div>;
}

/** The Socrates mark (src/icons): a glowing red-to-orange disc with a question mark, on a dark rounded square. */
export function SocratesIcon({ size, glow = 0, plate = true }: { size: number; glow?: number; plate?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${glow}px ${P.signal}) drop-shadow(0 0 ${glow * 2}px ${P.orange}88)` : undefined }}>
    <defs>
      <radialGradient id="soc" cx="0.45" cy="0.4" r="0.65"><stop offset="0" stopColor="#FFB23F"/><stop offset="0.55" stopColor="#FF5A2A"/><stop offset="1" stopColor="#E3123F"/></radialGradient>
    </defs>
    {plate && <rect x="2" y="2" width="96" height="96" rx="24" fill="#0B0607"/>}
    <circle cx="50" cy="50" r="34" fill="url(#soc)"/>
    <path d="M40 40 Q40 28 51 28 Q62 28 62 38 Q62 45 55 49 Q51 51.5 51 57 L51 59" fill="none" stroke="#120708" strokeWidth="8" strokeLinecap="round"/>
    <circle cx="51" cy="70" r="5" fill="#120708"/>
  </svg>;
}

const TAG_ICON = 'M7.1 10.2v-.5c0-.9.4-1.5 1.2-2 .6-.4.9-.7.9-1.2 0-.6-.5-1-1.2-1-.7 0-1.2.4-1.3 1.1H5.1C5.2 5 6.4 4 8.1 4c1.7 0 2.8.9 2.8 2.3 0 1-.5 1.6-1.3 2.1-.6.4-.8.6-.8 1.2v.6H7.1Zm-.1 1.1h1.8V13H7v-1.7Z';

/** The tag exactly as the extension draws it (styles.js .ctp-tag), scaled by `k`. `enter` is frames since it appeared. */
export function FallacyTag({ name, k = 1, enter = 99, glowPhase = 0, style }: { name: string; k?: number; enter?: number; glowPhase?: number; style?: CSSProperties }) {
  // ctp-tag-enter: 520 ms of scale + skew with a cyan/yellow split on the text.
  const t = enter / 30 / 0.52;
  const scale = t >= 1 ? 1 : interpolate(t, [0, 0.35, 0.55, 0.75, 1], [0.2, 1.35, 0.94, 1.04, 1]);
  const rot = t >= 1 ? 0 : interpolate(t, [0, 0.35, 0.55, 1], [-12, 3, 0, 0]);
  const skew = t >= 1 ? 0 : interpolate(t, [0, 0.35, 0.55, 0.75, 1], [0, 0, -8, 4, 0]);
  const split = t > 0.3 && t < 0.7 ? (t < 0.5 ? 1 : -1) : 0;
  const glow = 0.45 + 0.3 * (0.5 - 0.5 * Math.cos(((glowPhase / 30) / 2.6) * Math.PI * 2));
  return <div style={{ position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 5 * k, height: 20 * k, padding: `0 ${8 * k}px 0 ${6 * k}px`, borderRadius: `${5 * k}px ${5 * k}px ${5 * k}px ${1 * k}px`, background: 'linear-gradient(180deg, #ff3b5f 0%, #d1002f 100%)', color: '#fff', fontFamily: grot, fontWeight: 800, fontSize: 10.5 * k, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: `0 ${3 * k}px ${(12 + 6 * glow) * k}px rgba(209, 0, 47, ${glow}), inset 0 0 0 ${k}px rgba(255,255,255,0.22)`, transform: `scale(${scale}) rotate(${rot}deg) skewX(${skew}deg)`, transformOrigin: '0 100%', opacity: t <= 0 ? 0 : Math.min(1, t * 4), textShadow: split ? `${-2 * split * k}px 0 ${P.cyan}, ${2 * split * k}px 0 ${P.yellow}` : 'none', ...style }}>
    <svg viewBox="0 0 16 16" width={12 * k} height={12 * k}><circle cx="8" cy="8" r="7.2" fill="currentColor" opacity=".25"/><path fill="currentColor" d={TAG_ICON}/></svg>{name}
    <span style={{ position: 'absolute', left: 0, bottom: -5 * k, width: 0, height: 0, borderLeft: `${6 * k}px solid #d1002f`, borderBottom: `${5 * k}px solid transparent` }}/>
  </div>;
}

/** The "NAME?" stamp (styles.js .ctp-stamp, effects.js entrance()). */
export function Stamp({ name, k = 1, max = false, style }: { name: string; k?: number; max?: boolean; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', padding: `${7 * k}px ${16 * k}px ${6 * k}px`, border: `${4 * k}px solid ${P.signal}`, outline: `${2 * k}px solid ${P.signal}`, outlineOffset: 3 * k, borderRadius: 6 * k, background: 'rgba(23, 4, 9, 0.88)', color: P.signal, fontFamily: poster, fontSize: (max ? 44 : 30) * k, lineHeight: 1, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: `0 0 ${16 * k}px rgba(255, 45, 85, 0.85)`, boxShadow: `0 0 ${46 * k}px rgba(255, 45, 85, 0.65), inset 0 0 ${18 * k}px rgba(255, 45, 85, 0.35)`, ...style }}>
    {name}?
    <small style={{ display: 'block', marginTop: 4 * k, fontFamily: mono, fontWeight: 700, fontSize: 10 * k, letterSpacing: '0.3em', color: P.yellow, textShadow: 'none' }}>SOCRATES HAS A QUESTION</small>
  </div>;
}

const EMBER_COLORS = [P.signal, '#FF6B35', P.yellow, '#fff3b0'];
export const GREEN_COLORS = [P.green, '#8affc1', '#e8fff3'];

/** Deterministic version of the extension's ember burst (effects.js embers()), in local frames. */
export function Embers({ at, x, y, n, reach = 170, k = 1, colors = EMBER_COLORS, seed = 'e', life = 40 }: { at: number; x: number; y: number; n: number; reach?: number; k?: number; colors?: string[]; seed?: string; life?: number }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > life) return null;
  return <>{Array.from({ length: n }, (_, i) => {
    const r = (s: string) => random(`${seed}${at}${i}${s}`);
    const size = (3 + r('s') * 4) * k;
    const angle = r('a') * Math.PI * 2, dist = (reach * 0.35 + r('d') * reach * 0.65) * k;
    const dur = (0.65 + r('u') * 0.6) * 30 * (life / 40);
    const p = Math.min(1, t / dur), e = 1 - (1 - p) ** 3;
    const color = colors[i % colors.length];
    return <div key={i} style={{ position: 'absolute', left: x + Math.cos(angle) * dist * e, top: y + (Math.sin(angle) * dist + (10 + r('y') * 40) * k) * e, width: size, height: size, borderRadius: '50%', background: color, boxShadow: `0 0 ${size * 2}px ${color}`, transform: `translate(-50%, -50%) scale(${1 - 0.8 * p})`, opacity: 1 - p, pointerEvents: 'none' }}/>;
  })}</>;
}

/** The shockwave ring (effects.js ring()). */
export function Ring({ at, x, y, k = 1, color = P.signal }: { at: number; x: number; y: number; k?: number; color?: string }) {
  const frame = useCurrentFrame();
  const t = (frame - at) / 30 / 0.65;
  if (t < 0 || t > 1) return null;
  const e = 1 - (1 - t) ** 2.4;
  const s = 0.4 + 8.6 * e;
  return <div style={{ position: 'absolute', left: x - 12 * k, top: y - 12 * k, width: 24 * k, height: 24 * k, border: `${3 * k / s}px solid ${color}`, borderRadius: '50%', transform: `scale(${s})`, opacity: 0.95 * (1 - t), pointerEvents: 'none' }}/>;
}

/** Slowly rising sparks of light, for title cards. */
export function Motes({ n = 40, seed = 'm', color = P.orange, opacity = 0.6 }: { n?: number; seed?: string; color?: string; opacity?: number }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{Array.from({ length: n }, (_, i) => {
    const r = (s: string) => random(`${seed}${i}${s}`);
    const speed = 0.4 + r('v') * 1.2;
    const y = ((r('y') * 1200 - frame * speed) % 1200 + 1200) % 1200 - 60;
    const x = r('x') * 1920 + Math.sin(frame / (40 + r('w') * 40) + i) * 20;
    const s = 2 + r('s') * 3;
    return <div key={i} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: color, boxShadow: `0 0 ${s * 4}px ${color}`, opacity: opacity * (0.3 + 0.7 * r('o')) }}/>;
  })}</AbsoluteFill>;
}
