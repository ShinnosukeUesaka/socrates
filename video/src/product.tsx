import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { FALLACIES } from '../../src/shared/fallacies.js';
import { Embers, FallacyTag, GREEN_COLORS, P, Ring, Stamp, grot, lerp, mono, poster, typed } from './editorial';

// A recreation of Socrates on a sample news article, an inbox and a comment box, built from the extension's own
// overlay styles (src/content/styles.js), entrance choreography (src/content/effects.js), card layout
// (src/content/overlay.js) and catalogue (src/shared/fallacies.js). Pages are drawn in a 1400-wide coordinate
// space; the browser viewport is 1400 × 788. All times are frames relative to the demo's Sequence.

export const PAGE_W = 1400, VIEW_H = 788;
/** Overlay scale: the extension's CSS pixels drawn 1.25× so the tags read on video. */
export const K = 1.25;

type FlagId = 'false_dilemma' | 'false_urgency' | 'slippery_slope';
export type Flag = { id: FlagId; at: number; max?: boolean; clearAt?: number };

// Entrance timings from effects.js, in frames at 30 fps.
const IMPACT = 7; // 240 ms
const HOLD = (max?: boolean) => (max ? 39 : 27); // 1300 / 900 ms
const FLY = 11; // 380 ms
export const impactAt = (f: Flag) => f.at + IMPACT;
export const tagAt = (f: Flag) => f.at + IMPACT + HOLD(f.max) + FLY;

const fname = (id: FlagId) => (FALLACIES as Record<string, { name: string }>)[id].name;

/** The wavy red highlight under a flagged span (styles.js .ctp-hl, with the 900 ms enter flash). */
function Highlight({ children, flag }: { children: ReactNode; flag?: Flag }) {
  const frame = useCurrentFrame();
  if (!flag || frame < flag.at) return <span>{children}</span>;
  const t = frame - flag.at;
  const enter = lerp(t, [0, 27], [1, 0]);
  const breathe = 0.5 - 0.5 * Math.cos((t / 78) * Math.PI * 2);
  const bg = 0.13 + 0.62 * enter + 0.07 * breathe * (1 - enter);
  const glow = 24 * enter + 10 * breathe * (1 - enter);
  const wave = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3' fill='none' stroke='%23ff2d55' stroke-width='1.4'/%3E%3C/svg%3E") repeat-x left bottom / ${8 * K}px ${4 * K}px`;
  return <span style={{ borderRadius: 3 * K, background: `${wave}, rgba(255, 45, 85, ${bg})`, boxShadow: `0 0 ${glow}px ${glow / 4}px rgba(255, 45, 85, ${0.18 + 0.6 * enter}), 0 0 0 1px rgba(255, 45, 85, 0.18)`, padding: '0 2px' }}>{children}</span>;
}

/** Stamp → impact → fly into the tag spot → tag, positioned relative to the flagged line's box. */
function FlagFx({ flag, width, clearT = 0 }: { flag: Flag; width: number; clearT?: number }) {
  const frame = useCurrentFrame();
  const t = frame - flag.at;
  if (t < 0) return null;
  const k = K * (flag.max ? 1.35 : 1.15);
  const cx = width / 2, cy = 16;
  const flyStart = IMPACT + HOLD(flag.max), tagT = flyStart + FLY;
  let stamp: ReactNode = null;
  if (t < tagT) {
    const fall = Math.min(1, t / 8.4);
    const sc = fall < 0.8 ? interpolate(fall, [0, 0.8], [3.4, 0.9]) : interpolate(fall, [0.8, 1], [0.9, 1]);
    const rot = fall < 0.8 ? interpolate(fall, [0, 0.8], [-26, -6]) : interpolate(fall, [0.8, 1], [-6, -8]);
    const fly = Math.max(0, Math.min(1, (t - flyStart) / FLY));
    const e = fly < 0.5 ? 2 * fly * fly : 1 - (-2 * fly + 2) ** 2 / 2;
    const x = cx + (60 - cx) * e, y = cy + (-22 - cy) * e;
    stamp = <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${sc * (1 - 0.8 * e)}) rotate(${rot * (1 - e)}deg)`, opacity: Math.min(1, fall * 1.6) * (1 - 0.8 * e), zIndex: 30 }}>
      <Stamp name={fname(flag.id)} k={k} max={flag.max} style={{ position: 'relative' }}/>
    </div>;
  }
  return <>
    {stamp}
    <Embers at={flag.at + IMPACT} x={cx} y={cy} n={flag.max ? 64 : 30} k={K} seed={flag.id}/>
    <Ring at={flag.at + IMPACT} x={cx} y={cy} k={K}/>
    {t >= tagT && clearT < 1 && <FallacyTag name={fname(flag.id)} k={K} enter={t - tagT} glowPhase={t} style={{ left: 0, top: -28 * K, opacity: 1 - clearT, transform: clearT > 0 ? `translateY(${-14 * K * clearT}px) scale(${1 - 0.4 * clearT})` : undefined, zIndex: 20 }}/>}
    <Embers at={flag.at + tagT} x={8 * K} y={-16 * K} n={10} reach={40} k={K} seed={`${flag.id}t`}/>
  </>;
}

/** One line of text that can carry a flag. Lines don't wrap, so the tag can sit on the line's start. */
export function FlagLine({ text, flag, highlight = true, clearT = 0, style, caret, children }: { text: string; flag?: Flag; highlight?: boolean; clearT?: number; style?: CSSProperties; caret?: boolean; children?: ReactNode }) {
  const frame = useCurrentFrame();
  return <div style={{ position: 'relative', whiteSpace: 'nowrap', ...style }}>
    <Highlight flag={highlight ? flag : undefined}>{text}</Highlight>
    {caret !== undefined && <span style={{ display: 'inline-block', width: 2, height: '1.1em', background: '#1f1e1b', verticalAlign: '-0.2em', marginLeft: 1, opacity: caret && Math.floor(frame / 8) % 2 === 0 ? 1 : 0 }}/>}
    {flag && <div style={{ position: 'absolute', left: 0, top: 0 }}><FlagFx flag={flag} width={text.length * 10.6} clearT={clearT}/></div>}
    {children}
  </div>;
}

/** Viewport-wide effects for each flag: red vignette, and at maximum the cinematic bars and banner. */
export function ViewportFx({ flags }: { flags: Flag[] }) {
  const frame = useCurrentFrame();
  return <>{flags.map((f) => {
    const t = frame - impactAt(f);
    if (t < 0 || t > 60) return null;
    const v = interpolate(t, [0, 3.6, 12, 30], [0, 1, 0.55, 0], { extrapolateRight: 'clamp' });
    const bars = f.max ? interpolate(t, [0, 8.5, 48.5, 57], [1, 0, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
    const bt = t / 57;
    const banner = f.max ? (bt < 0.15 ? bt / 0.15 : bt < 0.2 ? 0.4 : bt < 0.85 ? 1 : 1 - (bt - 0.85) / 0.15) : 0;
    return <AbsoluteFill key={f.id} style={{ pointerEvents: 'none', zIndex: 40 }}>
      <AbsoluteFill style={{ opacity: v, boxShadow: 'inset 0 0 160px 40px rgba(255, 0, 48, 0.75)', background: 'radial-gradient(ellipse at center, rgba(255,0,48,0) 55%, rgba(255,0,48,0.28) 100%)' }}/>
      {f.max && <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: VIEW_H * 0.09, background: '#000', transform: `translateY(${-bars * 100}%)` }}/>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: VIEW_H * 0.09, background: '#000', transform: `translateY(${bars * 100}%)` }}/>
        <div style={{ position: 'absolute', left: '50%', top: VIEW_H * 0.09 + 8, transform: 'translateX(-50%)', padding: '10px 22px', color: '#fff', background: 'rgba(0,0,0,0.55)', fontFamily: poster, fontSize: 22 * K, letterSpacing: `${0.18 + 0.42 * Math.max(0, 1 - bt / 0.15)}em`, textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: `-2px 0 ${P.cyan}, 2px 0 ${P.signal}`, opacity: Math.max(0, banner) }}>Socrates has a question</div>
      </>}
    </AbsoluteFill>;
  })}</>;
}

/** Deterministic shake (effects.js shake(): 9 random offsets decaying over 520 ms). */
export function shakeAt(frame: number, at: number, amp: number, seed: string) {
  const t = frame - at;
  if (t < 0 || t >= 16) return { x: 0, y: 0, r: 0 };
  const i = Math.floor((t / 16) * 9);
  const k = amp * (1 - i / 9);
  const r = (s: string) => random(`${seed}${i}${s}`) * 2 - 1;
  return { x: r('x') * k, y: (r('y') * k) / 2, r: (r('r') * k) / 8 };
}

/** The card a tag opens (overlay.js toggleCard()), with example text of the kind the model writes for it. */
export function Card({ at, hot, quote, label, chip, title, why, question }: { at: number; hot: boolean; quote: string; label: string; chip: string; title: string; why: string; question: string }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const s = (n: number) => n * 1.15;
  const lab: CSSProperties = { fontWeight: 800, fontSize: s(10.5), lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b38f96', marginBottom: s(4) };
  return <div style={{ position: 'absolute', left: 0, top: 0, width: s(320), padding: `${s(14)}px ${s(16)}px ${s(12)}px`, borderRadius: s(10), background: P.blood, color: '#f6e9eb', borderTop: `${s(3)}px solid ${P.signal}`, boxShadow: `0 ${s(18)}px ${s(50)}px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.25)`, fontFamily: grot, fontSize: s(13), lineHeight: 1.45, whiteSpace: 'normal', opacity: lerp(t, [0, 5.4], [0, 1]), transform: `translateY(${lerp(t, [0, 5.4], [-6, 0])}px)`, zIndex: 50, textAlign: 'left' }}>
    <div style={lab}>{label}</div>
    <div style={{ paddingLeft: s(9), borderLeft: `${s(2)}px solid ${P.signal}`, color: '#e2c9ce', fontStyle: 'italic', marginBottom: s(12) }}>“{quote}”</div>
    <span style={{ display: 'inline-block', marginBottom: s(6), padding: `${s(2)}px ${s(7)}px`, borderRadius: 99, background: 'rgba(255,45,85,0.16)', color: '#ff8fa3', fontWeight: 700, fontSize: s(10.5), letterSpacing: '0.04em' }}>{chip}</span>
    <div style={{ fontWeight: 800, fontSize: s(16), lineHeight: 1.25, color: '#fff', marginBottom: s(4) }}>{title}</div>
    <div style={{ color: '#e9d9dc', marginBottom: s(12) }}>{why}</div>
    <div style={{ marginBottom: s(10), padding: `${s(10)}px ${s(12)}px`, borderRadius: s(8), background: `rgba(255, 214, 10, ${hot ? 0.16 : 0.09})`, border: `1px solid rgba(255, 214, 10, ${hot ? 0.55 : 0.18})`, boxShadow: hot ? `0 0 ${s(24)}px rgba(255,214,10,0.25)` : 'none' }}>
      <div style={{ ...lab, color: P.yellow }}>Socrates asks</div>
      <div style={{ color: '#fff3c4', fontWeight: 600, fontSize: s(14), lineHeight: 1.45 }}>{question}</div>
    </div>
    <div style={{ fontSize: s(11), color: '#8f747a', marginBottom: s(10) }}>Clear case · checked by Claude</div>
    <div style={{ display: 'flex', gap: s(8), justifyContent: 'flex-end' }}>
      {['Don’t flag this kind', 'Got it'].map((b, i) => <span key={b} style={{ fontWeight: 600, fontSize: s(12), padding: `${s(7)}px ${s(11)}px`, borderRadius: s(6), border: `1px solid ${i ? P.signal : 'rgba(255,255,255,0.16)'}`, background: i ? P.signal : 'transparent', color: '#fff' }}>{b}</span>)}
    </div>
  </div>;
}

/** The green "✓ Rethought" stamp (styles.js .ctp-fixed, effects.js resolved()). */
export function Rethought({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const t = (frame - at) / 39;
  if (t < 0 || t > 1) return null;
  const sc = t < 0.25 ? interpolate(t, [0, 0.25], [0.3, 1.15]) : t < 0.7 ? interpolate(t, [0.25, 0.7], [1.15, 1]) : 1;
  const op = t < 0.25 ? t / 0.25 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  const dy = t > 0.7 ? -26 * ((t - 0.7) / 0.3) : 0;
  return <>
    <div style={{ position: 'absolute', left: 0, top: -38 * K, padding: `${5 * K}px ${11 * K}px`, border: `${3 * K}px solid ${P.green}`, borderRadius: 6 * K, background: 'rgba(3, 26, 14, 0.9)', color: P.green, fontFamily: poster, fontSize: 16 * K, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 0 24px rgba(31, 209, 122, 0.55)', transform: `translateY(${dy}px) scale(${sc}) rotate(-4deg)`, opacity: op, transformOrigin: '0 100%', zIndex: 30 }}>✓ Rethought</div>
    <Embers at={at} x={20 * K} y={-10} n={14} reach={70} k={K} colors={GREEN_COLORS} seed="fixed"/>
  </>;
}

/** "Reading" / "skipped" box drawn over the page (a video annotation, not extension UI). */
export function Note({ box, label, at, until = 1e9, on = false }: { box: [number, number, number, number]; label: string; at: number; until?: number; on?: boolean }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const p = lerp(t, [0, 6], [0, 1]) * lerp(frame, [until - 8, until], [1, 0]);
  if (p <= 0) return null;
  const c = on ? P.signal : '#8A8A8F';
  const [x, y, w, h] = box;
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: `3px dashed ${c}`, borderRadius: 12, background: on ? 'rgba(255,45,85,0.04)' : 'rgba(20,20,22,0.62)', opacity: p, transform: `scale(${1.03 - 0.03 * p})`, zIndex: 35, boxShadow: on ? `0 0 ${20 + 10 * Math.sin(t / 5)}px rgba(255,45,85,0.4)` : undefined }}>
    <div style={{ position: 'absolute', left: 12, top: -16, background: c, color: '#fff', fontFamily: mono, fontWeight: 700, fontSize: 14, letterSpacing: '0.12em', padding: '5px 10px', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
      {on && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#fff', opacity: Math.floor(t / 8) % 2 ? 0.35 : 1 }}/>}{label}
    </div>
  </div>;
}

export function Cursor({ keys, clicks = [] }: { keys: [number, number, number][]; clicks?: number[] }) {
  const frame = useCurrentFrame();
  if (!keys.length || frame < keys[0][0]) return null;
  let x = keys[0][1], y = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const [f, kx, ky] = keys[i], [pf, px, py] = keys[i - 1];
    if (frame >= f) { x = kx; y = ky; continue; }
    if (frame > pf) { const t = (frame - pf) / (f - pf); const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; x = px + (kx - px) * e; y = py + (ky - py) * e; }
    break;
  }
  const press = clicks.some((c) => frame >= c && frame < c + 5);
  return <svg width={30} height={40} viewBox="0 0 24 32" style={{ position: 'absolute', left: x, top: y, zIndex: 60, transform: `scale(${press ? 0.85 : 1})`, transformOrigin: '0 0', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))' }}>
    <path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" fill="#111" stroke="#fff" strokeWidth={2} strokeLinejoin="round"/>
  </svg>;
}

// ---------------------------------------------------------------- The article
export const ARTICLE = {
  title: ['Remote work is killing productivity.', 'Every CEO knows it.'],
  p1: 'Walk into any city centre on a Monday and you’ll see it: empty desks, empty trains, empty promises.',
  dilemma: 'Either we bring everyone back to the office, or the economy will collapse.',
  p3: 'My neighbour’s startup went remote last year and folded within months.',
  p4: 'Remote work isn’t the future. It’s a slow-motion shutdown.',
  reply: 'If we allow remote work, soon nobody will work at all.',
  rewrite: 'Is one startup really enough evidence, though?',
};
/** Where things sit on the article page (page coordinates), for the camera, cursor and notes. */
export const A = { dilemmaY: 352, lineX: 170, replyY: 1068 };

const ink = '#16161A', soft = '#5C5C66', rule = '#E7E7EC', siteBlue = '#1747C9';
const body: CSSProperties = { fontFamily: grot, fontWeight: 400, fontSize: 21, lineHeight: '34px', color: '#26262C' };

export type Reply = { type1: [number, number]; select: number; type2: [number, number]; fixed: number; focus: number };

export function ArticlePage({ flag1, flag3, reply, card, notes }: { flag1?: Flag; flag3?: Flag; reply?: Reply; card?: ReactNode; notes?: { at: number; until: number } }) {
  const frame = useCurrentFrame();
  const clear3 = flag3?.clearAt !== undefined ? lerp(frame, [flag3.clearAt, flag3.clearAt + 11], [0, 1]) : 0;
  const sh1 = flag1 ? shakeAt(frame, impactAt(flag1), 6 * K, 'a1') : { x: 0, y: 0, r: 0 };
  // The reply box: typing, the flag, selecting the sentence, the rewrite.
  let replyEl: ReactNode = <div style={{ ...body, color: '#A0A0A8' }}>Add a comment…</div>;
  if (reply && frame >= reply.focus) {
    const caret = frame < reply.select || frame >= reply.type2[0];
    if (frame >= reply.type2[0]) {
      replyEl = <FlagLine text={typed(ARTICLE.rewrite, frame, reply.type2[0], reply.type2[1])} flag={flag3} highlight={false} clearT={clear3} style={body} caret={caret}>
        <div style={{ position: 'absolute', left: 0, top: 0 }}><Rethought at={reply.fixed}/></div>
      </FlagLine>;
    } else if (frame >= reply.select) {
      replyEl = <FlagLine text={ARTICLE.reply} flag={flag3} highlight={false} style={body}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ARTICLE.reply.length * 10.2, background: 'rgba(80,140,255,0.32)', borderRadius: 3 }}/>
      </FlagLine>;
    } else {
      replyEl = <FlagLine text={typed(ARTICLE.reply, frame, reply.type1[0], reply.type1[1])} flag={flag3} style={body} caret={caret}/>;
    }
  }
  return <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: 1500, background: '#fff' }}>
    {/* Masthead */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 62, borderBottom: `1px solid ${rule}`, display: 'flex', alignItems: 'center', padding: '0 56px', gap: 34 }}>
      <span style={{ fontFamily: grot, fontWeight: 900, fontSize: 28, letterSpacing: '-0.04em', color: ink }}>The Daily Pulse</span>
      {['World', 'Business', 'Tech', 'Opinion'].map((t, i) => <span key={t} style={{ fontFamily: grot, fontWeight: i === 3 ? 700 : 500, fontSize: 16, color: i === 3 ? ink : soft }}>{t}</span>)}
      <span style={{ marginLeft: 'auto', fontFamily: grot, fontWeight: 700, fontSize: 15, color: '#fff', background: siteBlue, padding: '9px 16px', borderRadius: 8 }}>Subscribe</span>
    </div>
    {/* Share rail */}
    <div style={{ position: 'absolute', left: 70, top: 180, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {['↗', 'f', 'in', '✉'].map((t) => <span key={t} style={{ width: 40, height: 40, borderRadius: 20, border: `1px solid ${rule}`, display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 700, fontSize: 15, color: soft }}>{t}</span>)}
    </div>
    {/* Article */}
    <div style={{ position: 'absolute', left: A.lineX, top: 92, width: 820 }}>
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 13, letterSpacing: '0.14em', color: siteBlue }}>OPINION</div>
      <div style={{ fontFamily: grot, fontWeight: 800, fontSize: 42, lineHeight: 1.08, letterSpacing: '-0.03em', color: ink, marginTop: 10 }}>{ARTICLE.title[0]}<br/>{ARTICLE.title[1]}</div>
      <div style={{ fontFamily: grot, fontWeight: 500, fontSize: 15, color: soft, marginTop: 12 }}>By Mark Ellison · 6 min read</div>
      <div style={{ ...body, marginTop: 20, width: 790 }}>{ARTICLE.p1}</div>
      <div style={{ transform: `translate(${sh1.x}px, ${sh1.y}px) rotate(${sh1.r}deg)` }}>
        <FlagLine text={ARTICLE.dilemma} flag={flag1} style={{ ...body, marginTop: 18 }}>{card}</FlagLine>
      </div>
      <div style={{ ...body, marginTop: 18 }}>{ARTICLE.p3}</div>
      <div style={{ ...body, marginTop: 18 }}>{ARTICLE.p4}</div>
      <div style={{ ...body, marginTop: 18, width: 790 }}>Managers everywhere are saying the same thing in private. Productivity, culture and mentoring all depend on people sharing a room.</div>
      <div style={{ ...body, marginTop: 18, width: 790, color: '#9A9AA3' }}>Companies that hesitate now will spend the next decade explaining why their best people stopped showing up…</div>
    </div>
    {/* Sidebar */}
    <div style={{ position: 'absolute', left: 1040, top: 100, width: 300, height: 250, borderRadius: 12, background: 'linear-gradient(135deg, #EEF1F8, #DDE3F0)', display: 'grid', placeItems: 'center', fontFamily: mono, fontSize: 12, letterSpacing: '0.14em', color: '#8A90A6' }}>SPONSORED</div>
    <div style={{ position: 'absolute', left: 1040, top: 372, width: 300, borderRadius: 12, border: `1px solid ${rule}`, padding: 20 }}>
      <div style={{ fontFamily: grot, fontWeight: 800, fontSize: 17, color: ink }}>Get the Pulse daily</div>
      <div style={{ fontFamily: grot, fontSize: 14, color: soft, marginTop: 6 }}>The stories everyone is talking about.</div>
      <div style={{ marginTop: 12, height: 38, borderRadius: 8, background: siteBlue }}/>
    </div>
    <div style={{ position: 'absolute', left: 1040, top: 548, width: 300 }}>
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', color: soft }}>MOST READ</div>
      {['The four-day week, one year on', 'Inside the return-to-office fight', 'Why commutes got longer'].map((t, i) => <div key={t} style={{ fontFamily: grot, fontWeight: 600, fontSize: 16, color: ink, marginTop: 14 }}><span style={{ color: siteBlue, marginRight: 10 }}>{i + 1}</span>{t}</div>)}
    </div>
    {/* Comments */}
    <div style={{ position: 'absolute', left: A.lineX, top: 940, width: 820, borderTop: `1px solid ${rule}`, paddingTop: 28 }}>
      <div style={{ fontFamily: grot, fontWeight: 800, fontSize: 22, color: ink }}>214 comments</div>
      <div style={{ marginTop: 18, display: 'flex', gap: 16 }}>
        <span style={{ width: 42, height: 42, borderRadius: 21, background: '#E0703A', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 800, flex: 'none' }}>L</span>
        <div style={{ flex: 1, height: 150, borderRadius: 12, border: `2px solid ${reply && frame >= reply.focus ? ink : rule}`, padding: '18px 20px', position: 'relative' }}>
          {replyEl}
          <span style={{ position: 'absolute', right: 14, bottom: 12, fontFamily: grot, fontWeight: 700, fontSize: 14, color: '#fff', background: ink, padding: '8px 14px', borderRadius: 8 }}>Post</span>
        </div>
      </div>
      {[['rita_m', 'Hybrid has worked fine for my team, for what it’s worth.'], ['owen.k', 'Totally agree. Back to the office, everyone.']].map(([h, t], i) => <div key={h} style={{ marginTop: 22, marginLeft: 58 }}>
        <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 15, color: ink }}>@{h} <span style={{ fontWeight: 500, color: soft }}>· {i + 2}h</span></div>
        <div style={{ ...body, fontSize: 18, marginTop: 2 }}>{t}</div>
      </div>)}
    </div>
    {notes && <>
      <Note box={[A.lineX - 18, 80, 856, 640]} label="READING" at={notes.at} until={notes.until} on/>
      <Note box={[52, 168, 76, 220]} label="SKIPPED" at={notes.at + 6} until={notes.until}/>
      <Note box={[1024, 88, 332, 650]} label="ADS · LINKS · SKIPPED" at={notes.at + 10} until={notes.until}/>
    </>}
  </div>;
}

// ---------------------------------------------------------------- The inbox
export const EMAIL = {
  subject: 'Action required: your account will be suspended',
  urgency: 'Verify within 24 hours or all your files will be permanently deleted.',
};
export const E = { urgencyY: 330, lineX: 620 };

export function MailPage({ flag2 }: { flag2?: Flag }) {
  const frame = useCurrentFrame();
  const sh = flag2 ? shakeAt(frame, impactAt(flag2), 6 * K, 'm2') : { x: 0, y: 0, r: 0 };
  const rows: [string, string, boolean][] = [['Account Security', EMAIL.subject, true], ['Priya (Design)', 'Re: Friday review deck', false], ['The Daily Pulse', 'Remote work is killing productivity…', false], ['Calendar', 'Reminder: 1:1 with Sam at 10:00', false], ['Bank', 'Your monthly statement is ready', false]];
  return <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: VIEW_H, background: '#fff', fontFamily: grot }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 210, background: '#F4F5F8', borderRight: `1px solid ${rule}`, padding: '22px 18px' }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: ink, letterSpacing: '-0.02em' }}>Mail</div>
      <div style={{ marginTop: 20, background: ink, color: '#fff', fontWeight: 700, fontSize: 15, padding: '11px 16px', borderRadius: 10 }}>Compose</div>
      {[['Inbox', '3'], ['Starred', ''], ['Sent', ''], ['Drafts', '1']].map(([f, n], i) => <div key={f} style={{ marginTop: i ? 6 : 18, display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, background: i === 0 ? '#E3E7F2' : 'transparent', fontWeight: i === 0 ? 700 : 500, fontSize: 15, color: ink }}><span>{f}</span><span style={{ color: soft }}>{n}</span></div>)}
    </div>
    <div style={{ position: 'absolute', left: 210, top: 0, bottom: 0, width: 360, borderRight: `1px solid ${rule}` }}>
      {rows.map(([from, subj, on], i) => <div key={i} style={{ padding: '16px 20px', borderBottom: `1px solid ${rule}`, background: on ? '#EEF2FC' : '#fff', borderLeft: on ? `4px solid ${siteBlue}` : '4px solid transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: on ? 800 : 600, fontSize: 15, color: ink }}><span>{from}</span><span style={{ fontWeight: 500, color: soft, fontSize: 13 }}>{['1:14 AM', '12:02 AM', 'Yesterday', 'Yesterday', 'Mon'][i]}</span></div>
        <div style={{ fontSize: 14, color: soft, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subj}</div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: E.lineX, top: 70, width: 740 }}>
      <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: ink }}>{EMAIL.subject}</div>
      <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ width: 38, height: 38, borderRadius: 19, background: '#8A8F9C', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>A</span>
        <div><div style={{ fontWeight: 700, fontSize: 15, color: ink }}>Account Security <span style={{ fontWeight: 500, color: soft }}>&lt;security@acc0unt-help.example&gt;</span></div><div style={{ fontSize: 13, color: soft }}>to me · 1:14 AM</div></div>
      </div>
      <div style={{ ...body, marginTop: 26 }}>Dear customer,</div>
      <div style={{ ...body, marginTop: 10 }}>We noticed unusual sign-in activity on your account.</div>
      <div style={{ transform: `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg)` }}><FlagLine text={EMAIL.urgency} flag={flag2} style={{ ...body, marginTop: 30 }}/></div>
      <div style={{ marginTop: 26, display: 'inline-block', background: siteBlue, color: '#fff', fontWeight: 700, fontSize: 17, padding: '13px 26px', borderRadius: 10 }}>Verify now</div>
      <div style={{ ...body, fontSize: 15, color: '#9A9AA3', marginTop: 26 }}>This is an automated message. Please do not reply.</div>
    </div>
  </div>;
}
