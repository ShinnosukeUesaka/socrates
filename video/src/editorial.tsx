import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight';
import { loadFont as loadInstrumentSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';

// The editorial pitch look of the Ember pitch video (codebees/video), re-inked for the fallacy alarm:
// warm paper and near-black ink, tight grotesk headlines, and the extension's signal red instead of terracotta.
export const grot = loadInterTight('normal', { weights: ['500', '600', '700', '800', '900'], subsets: ['latin'] }).fontFamily;
export const serif = loadInstrumentSerif('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily;
loadInstrumentSerif('italic', { weights: ['400'], subsets: ['latin'] });
export const mono = loadJetBrains('normal', { weights: ['500', '700'], subsets: ['latin'] }).fontFamily;
/** Condensed poster face standing in for the extension's Impact stamps. */
export const poster = loadAnton('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily;

export const P = {
  slab: '#F0364A', slabDeep: '#C8102E', ink: '#141413', ivory: '#F4EFE6', paper: '#F7F3EA',
  white: '#FFFFFF', grey: '#8A857C', night: '#0E0D0C',
  // The extension's own colours (src/content/styles.js).
  signal: '#FF2D55', signalDeep: '#D1002F', blood: '#170A0D', yellow: '#FFD60A', green: '#1FD17A', cyan: '#00E5FF', orange: '#FF6B35',
};

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

/** A line of text that slides up out of a mask. */
export function Reveal({ children, at, style, dy = 1.1 }: { children: ReactNode; at: number; style?: CSSProperties; dy?: number }) {
  const p = useSpr(at, 18, 150);
  return <div style={{ overflow: 'hidden', paddingBottom: '0.08em', ...style }}>
    <div style={{ transform: `translateY(${(1 - p) * dy * 100}%)` }}>{children}</div>
  </div>;
}

/** Small mono label used for section markers and sources. */
export function Mono({ children, size = 20, color = P.ink, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return <div style={{ fontFamily: mono, fontWeight: 500, fontSize: size, letterSpacing: '0.04em', textTransform: 'uppercase', color, ...style }}>{children}</div>;
}

/** Top bar shared by every section: section marker left, product right. */
export function Masthead({ left, right = 'EMBER · CRITICAL THINKING PARTNER', color = P.ink }: { left: string; right?: string; color?: string }) {
  return <>
    <div style={{ position: 'absolute', left: 64, top: 48, fontFamily: grot, fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color }}>{left}</div>
    <div style={{ position: 'absolute', right: 64, top: 50, fontFamily: grot, fontWeight: 500, fontSize: 22, color, opacity: 0.85 }}>{right}</div>
    <div style={{ position: 'absolute', left: 64, right: 64, top: 92, height: 2, background: color, opacity: 0.85 }}/>
  </>;
}

/** Film grain over the whole frame, re-seeded every two frames. */
export function Grain({ opacity = 0.08 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 50;
  return <AbsoluteFill style={{ pointerEvents: 'none', opacity, mixBlendMode: 'overlay' }}>
    <svg width="1920" height="1080"><filter id={`g${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed}/></filter><rect width="1920" height="1080" filter={`url(#g${seed})`}/></svg>
  </AbsoluteFill>;
}

/** Number that counts up between two frames. */
export function count(frame: number, at: number, to: number, dur = 18, from = 0) {
  return Math.round(lerp(frame, [at, at + dur], [from, to]));
}

/** A newspaper clipping: masthead, date, headline in serif. */
export function Clipping({ outlet, date, headline, at, rot = -2, width = 860, style, children }: { outlet: string; date: string; headline: string; at: number; rot?: number; width?: number; style?: CSSProperties; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const p = useSpr(at, 13, 170);
  const drift = (frame - at) * 0.04;
  return <div style={{ position: 'absolute', width, background: P.paper, color: P.ink, padding: '34px 44px 40px', boxShadow: '0 30px 60px rgba(0,0,0,0.45)', transform: `translateY(${(1 - p) * 90}px) rotate(${rot + (1 - p) * 4 + drift * 0.2}deg) scale(${0.92 + 0.08 * p})`, opacity: Math.min(1, p * 2), clipPath: 'polygon(0 1%, 4% 0, 18% 1.5%, 33% 0.3%, 52% 1.2%, 71% 0, 88% 1%, 100% 0.2%, 99.4% 30%, 100% 62%, 99.2% 100%, 80% 98.8%, 61% 100%, 40% 98.6%, 22% 100%, 6% 98.9%, 0 100%, 0.7% 70%, 0 38%)', ...style }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `3px solid ${P.ink}`, paddingBottom: 12, marginBottom: 22 }}>
      <span style={{ fontFamily: serif, fontSize: 40, letterSpacing: '0.02em' }}>{outlet}</span>
      <span style={{ fontFamily: mono, fontSize: 18, color: '#5c574f' }}>{date}</span>
    </div>
    <div style={{ fontFamily: serif, fontSize: 70, lineHeight: 1.02, letterSpacing: '-0.01em' }}>{headline}</div>
    {children}
  </div>;
}

/** Scrolling news ticker along the bottom. */
export function Ticker({ items, speed = 4, color = P.slab }: { items: string[]; speed?: number; color?: string }) {
  const frame = useCurrentFrame();
  const text = items.join('   ●   ') + '   ●   ';
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, background: color, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 190, background: P.ink, color: P.white, fontFamily: grot, fontWeight: 900, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, letterSpacing: '0.04em' }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: P.signal, marginRight: 12, opacity: Math.floor(frame / 12) % 2 ? 0.3 : 1 }}/>LIVE
    </div>
    <div style={{ whiteSpace: 'nowrap', fontFamily: grot, fontWeight: 800, fontSize: 26, color: P.ink, transform: `translateX(${210 - ((frame * speed) % (text.length * 15.5))}px)`, letterSpacing: '0.01em' }}>{text.toUpperCase()}{text.toUpperCase()}</div>
  </div>;
}

/** Browser window around a page. The page area is width × 9/16. */
export function BrowserFrame({ children, url, width, style, ext = true }: { children: ReactNode; url: string; width: number; style?: CSSProperties; ext?: boolean }) {
  const bar = Math.round(width * 0.03);
  return <div style={{ position: 'absolute', width, borderRadius: 18, overflow: 'hidden', background: '#ECE8DF', boxShadow: '0 40px 90px rgba(20,20,19,0.35), 0 0 0 1px rgba(20,20,19,0.12)', ...style }}>
    <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: bar * 0.28, padding: `0 ${bar * 0.6}px`, background: '#E6E1D6' }}>
      {['#ee6a5f', '#f5bd4f', '#61c454'].map((c) => <span key={c} style={{ width: bar * 0.34, height: bar * 0.34, borderRadius: '50%', background: c }}/>)}
      <div style={{ marginLeft: bar * 0.6, flex: 1, maxWidth: width * 0.45, height: bar * 0.62, borderRadius: bar * 0.31, background: '#FBFAF7', display: 'flex', alignItems: 'center', padding: `0 ${bar * 0.45}px`, fontFamily: grot, fontWeight: 500, fontSize: bar * 0.36, color: '#6b6760' }}>{url}</div>
      {ext && <div style={{ marginLeft: 'auto', width: bar * 0.62, height: bar * 0.62, borderRadius: bar * 0.16, background: P.blood, display: 'grid', placeItems: 'center' }}><WarnIcon size={bar * 0.46}/></div>}
    </div>
    <div style={{ width, height: width * 9 / 16, position: 'relative', overflow: 'hidden', background: P.paper }}>{children}</div>
  </div>;
}

/** The extension's mark: a glowing warning triangle (src/icons, redrawn as a vector so it scales). */
export function WarnIcon({ size, glow = 0 }: { size: number; glow?: number }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${glow}px ${P.signal})` : undefined }}>
    <defs><linearGradient id="warn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF2D55"/><stop offset="1" stopColor="#FFB020"/></linearGradient></defs>
    <path d="M50 6 L96 88 Q98 94 92 94 L8 94 Q2 94 4 88 Z" fill="url(#warn)" stroke="#FF5A3C" strokeWidth={3} strokeLinejoin="round"/>
    <rect x="44" y="34" width="12" height="34" rx="6" fill={P.blood}/>
    <circle cx="50" cy="80" r="7" fill={P.blood}/>
  </svg>;
}

const TAG_ICON = 'M8 1.3 15.3 14H.7L8 1.3Zm-.9 4.5v4.3h1.8V5.8H7.1Zm0 5.4V13h1.8v-1.8H7.1Z';

/** The fallacy tag exactly as the extension draws it (styles.js .ctp-tag), scaled by `k`. `enter` is frames since it appeared. */
export function FallacyTag({ name, k = 1, enter = 99, glowPhase = 0, style }: { name: string; k?: number; enter?: number; glowPhase?: number; style?: CSSProperties }) {
  // ctp-tag-enter: 520 ms of scale + skew with a cyan/yellow split on the text.
  const t = enter / 30 / 0.52;
  const scale = t >= 1 ? 1 : interpolate(t, [0, 0.35, 0.55, 0.75, 1], [0.2, 1.35, 0.94, 1.04, 1]);
  const rot = t >= 1 ? 0 : interpolate(t, [0, 0.35, 0.55, 1], [-12, 3, 0, 0]);
  const skew = t >= 1 ? 0 : interpolate(t, [0, 0.35, 0.55, 0.75, 1], [0, 0, -8, 4, 0]);
  const split = t > 0.3 && t < 0.7 ? (t < 0.5 ? 1 : -1) : 0;
  const glow = 0.45 + 0.3 * (0.5 - 0.5 * Math.cos(((glowPhase / 30) / 2.6) * Math.PI * 2));
  return <div style={{ position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 5 * k, height: 20 * k, padding: `0 ${8 * k}px 0 ${6 * k}px`, borderRadius: `${5 * k}px ${5 * k}px ${5 * k}px ${1 * k}px`, background: 'linear-gradient(180deg, #ff3b5f 0%, #d1002f 100%)', color: '#fff', fontFamily: grot, fontWeight: 800, fontSize: 10.5 * k, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: `0 ${3 * k}px ${(12 + 6 * glow) * k}px rgba(209, 0, 47, ${glow}), inset 0 0 0 ${k}px rgba(255,255,255,0.22)`, transform: `scale(${scale}) rotate(${rot}deg) skewX(${skew}deg)`, transformOrigin: '0 100%', opacity: t <= 0 ? 0 : Math.min(1, t * 4), textShadow: split ? `${-2 * split * k}px 0 ${P.cyan}, ${2 * split * k}px 0 ${P.yellow}` : 'none', ...style }}>
    <svg viewBox="0 0 16 16" width={12 * k} height={12 * k}><path fill="currentColor" d={TAG_ICON}/></svg>{name}
    <span style={{ position: 'absolute', left: 0, bottom: -5 * k, width: 0, height: 0, borderLeft: `${6 * k}px solid #d1002f`, borderBottom: `${5 * k}px solid transparent` }}/>
  </div>;
}

/** The "FALLACY!" stamp (styles.js .ctp-stamp). */
export function Stamp({ name, k = 1, max = false, style }: { name: string; k?: number; max?: boolean; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', padding: `${7 * k}px ${16 * k}px ${6 * k}px`, border: `${4 * k}px solid ${P.signal}`, outline: `${2 * k}px solid ${P.signal}`, outlineOffset: 3 * k, borderRadius: 6 * k, background: 'rgba(23, 4, 9, 0.88)', color: P.signal, fontFamily: poster, fontSize: (max ? 44 : 30) * k, lineHeight: 1, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: `0 0 ${16 * k}px rgba(255, 45, 85, 0.85)`, boxShadow: `0 0 ${46 * k}px rgba(255, 45, 85, 0.65), inset 0 0 ${18 * k}px rgba(255, 45, 85, 0.35)`, ...style }}>
    {name}!
    <small style={{ display: 'block', marginTop: 4 * k, fontFamily: mono, fontWeight: 700, fontSize: 10 * k, letterSpacing: '0.3em', color: P.yellow, textShadow: 'none' }}>FALLACY DETECTED</small>
  </div>;
}

const EMBER_COLORS = [P.signal, P.orange, P.yellow, '#fff3b0'];
export const GREEN_COLORS = [P.green, '#8affc1', '#e8fff3'];

/** Deterministic version of the extension's ember burst (effects.js embers()), in local frames. */
export function Embers({ at, x, y, n, reach = 170, k = 1, colors = EMBER_COLORS, seed = 'e' }: { at: number; x: number; y: number; n: number; reach?: number; k?: number; colors?: string[]; seed?: string }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 40) return null;
  return <>{Array.from({ length: n }, (_, i) => {
    const r = (s: string) => random(`${seed}${at}${i}${s}`);
    const size = (3 + r('s') * 4) * k;
    const angle = r('a') * Math.PI * 2, dist = (reach * 0.35 + r('d') * reach * 0.65) * k;
    const dur = (0.65 + r('u') * 0.6) * 30;
    const p = Math.min(1, t / dur), e = 1 - (1 - p) ** 3;
    const color = colors[i % colors.length];
    return <div key={i} style={{ position: 'absolute', left: x + Math.cos(angle) * dist * e, top: y + (Math.sin(angle) * dist + (10 + r('y') * 40) * k) * e, width: size, height: size, borderRadius: '50%', background: color, boxShadow: `0 0 ${size * 2}px ${color}`, transform: `translate(-50%, -50%) scale(${1 - 0.8 * p})`, opacity: 1 - p, pointerEvents: 'none' }}/>;
  })}</>;
}

/** The shockwave ring (effects.js ring()). */
export function Ring({ at, x, y, k = 1 }: { at: number; x: number; y: number; k?: number }) {
  const frame = useCurrentFrame();
  const t = (frame - at) / 30 / 0.65;
  if (t < 0 || t > 1) return null;
  const e = 1 - (1 - t) ** 2.4;
  const s = 0.4 + 8.6 * e;
  return <div style={{ position: 'absolute', left: x - 12 * k, top: y - 12 * k, width: 24 * k, height: 24 * k, border: `${3 * k / s}px solid ${P.signal}`, borderRadius: '50%', transform: `scale(${s})`, opacity: 0.95 * (1 - t), pointerEvents: 'none' }}/>;
}

/** Paper confetti in the brand colours. */
export function PaperBits({ at, x, y, count: n = 40, spread = 1 }: { at: number; x: number; y: number; count?: number; spread?: number }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 70) return null;
  const colors = [P.signal, P.ink, P.yellow, P.ivory, P.orange];
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {Array.from({ length: n }, (_, i) => {
      const a = random(`pa${at}${i}`) * Math.PI * 2, v = (6 + random(`pv${at}${i}`) * 16) * spread;
      return <div key={i} style={{ position: 'absolute', left: x + Math.cos(a) * v * t, top: y + Math.sin(a) * v * t + 0.3 * t * t, width: 16, height: 10, background: colors[i % colors.length], transform: `rotate(${t * 9 + i * 37}deg)`, opacity: lerp(t, [45, 70], [1, 0]) }}/>;
    })}
  </AbsoluteFill>;
}

export type Face = 'neutral' | 'smug' | 'panic' | 'angry' | 'tired';

/** Leo, the commenter. A simple SVG character with a few expressions (after Mia in the Ember pitch). */
export function Leo({ face = 'neutral', size = 300, style, shirt = '#2F3B52', hair = '#2B1D17' }: { face?: Face; size?: number; style?: CSSProperties; shirt?: string; hair?: string }) {
  const frame = useCurrentFrame();
  const shake = face === 'panic' ? Math.sin(frame * 2.3) * 3 : face === 'angry' ? Math.sin(frame * 1.7) * 1.2 : 0;
  const skin = '#E9B994';
  return <svg viewBox="0 0 200 220" width={size} height={size * 1.1} style={{ overflow: 'visible', ...style }}>
    <g transform={`translate(${shake} 0)`}>
      <path d="M28 220q0-64 72-64t72 64Z" fill={shirt}/>
      <path d="M78 158q22 20 44 0" fill="none" stroke="#1d2433" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="100" cy="98" r="48" fill={skin}/>
      <ellipse cx="52" cy="102" rx="7" ry="11" fill={skin}/><ellipse cx="148" cy="102" rx="7" ry="11" fill={skin}/>
      <path d="M50 92q-4-50 50-52 46 0 52 44-14-10-26-24-14 16-48 14-14 4-28 18Z" fill={hair}/>
      <path d="M58 60q20-26 56-20 22 6 30 26-30-14-86-6Z" fill={hair}/>
      {face === 'smug' ? <>
        <rect x="64" y="88" width="30" height="16" rx="6" fill="#111"/><rect x="106" y="88" width="30" height="16" rx="6" fill="#111"/><path d="M94 94h12" stroke="#111" strokeWidth="4"/>
        <path d="M84 122q18 8 32-4" fill="none" stroke="#6b3427" strokeWidth="4" strokeLinecap="round"/>
      </> : face === 'panic' ? <>
        <circle cx="80" cy="96" r="11" fill="white" stroke="#2a1d18" strokeWidth="3"/><circle cx="120" cy="96" r="11" fill="white" stroke="#2a1d18" strokeWidth="3"/>
        <circle cx="80" cy="96" r="3.5" fill="#2a1d18"/><circle cx="120" cy="96" r="3.5" fill="#2a1d18"/>
        <ellipse cx="100" cy="126" rx="10" ry="12" fill="#6b3427"/>
        <path d="M152 70q8 12 0 18-8-6 0-18Z" fill="#8fd3f0"/><path d="M46 76q7 10 0 15-7-5 0-15Z" fill="#8fd3f0"/>
      </> : face === 'angry' ? <>
        <path d="M66 82l24 8M134 82l-24 8" stroke="#2a1d18" strokeWidth="5" strokeLinecap="round"/>
        <ellipse cx="80" cy="99" rx="5" ry="6" fill="#2a1d18"/><ellipse cx="120" cy="99" rx="5" ry="6" fill="#2a1d18"/>
        <path d="M86 124q14-8 28 0" fill="none" stroke="#6b3427" strokeWidth="4" strokeLinecap="round"/>
      </> : face === 'tired' ? <>
        <path d="M70 98h20m20 0h20" stroke="#2a1d18" strokeWidth="4" strokeLinecap="round"/>
        <ellipse cx="100" cy="125" rx="8" ry="6" fill="#6b3427"/>
      </> : <>
        <ellipse cx="80" cy="98" rx="6" ry="8" fill="#2a1d18"/><ellipse cx="120" cy="98" rx="6" ry="8" fill="#2a1d18"/><circle cx="82" cy="95" r="2" fill="white"/><circle cx="122" cy="95" r="2" fill="white"/>
        <path d="M88 120q12 6 24 0" fill="none" stroke="#6b3427" strokeWidth="4" strokeLinecap="round"/>
      </>}
    </g>
  </svg>;
}
