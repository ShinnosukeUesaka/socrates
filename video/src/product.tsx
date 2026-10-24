import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { FALLACIES } from '../../src/shared/fallacies.js';
import { Embers, FallacyTag, GREEN_COLORS, P, Ring, Stamp, grot, lerp, mono, poster, serif, typed } from './editorial';

// A recreation of the extension on a discussion page, built from its own overlay styles (src/content/styles.js)
// and entrance choreography (src/content/effects.js). The page is drawn at 1400 × 788, the size of the demo's
// browser frame. All times are frames relative to the page's own Sequence.

export const PAGE_W = 1400, PAGE_H = 788;
/** Overlay scale: the extension's CSS pixels drawn 1.25× so the tags read on video. */
export const K = 1.25;

export const SENTENCE_1 = "You've never run a company, so your opinion is worthless.";
export const SENTENCE_2 = 'If we allow remote work, soon nobody will work at all.';
export const REWRITE_1 = 'Does that study hold for teams like ours, though?';

export type Flag = {
  id: 'ad_hominem' | 'slippery_slope';
  /** Frame the entrance starts (stamp begins to fall). */
  at: number;
  max?: boolean;
  /** Frame the flag clears (the user fixed the sentence). */
  clearAt?: number;
};

// Entrance timings from effects.js, in frames at 30 fps.
const IMPACT = 7; // 240 ms
const HOLD = (max?: boolean) => (max ? 39 : 27); // 1300 / 900 ms
const FLY = 11; // 380 ms
export const tagAt = (f: Flag) => f.at + IMPACT + HOLD(f.max) + FLY;
export const impactAt = (f: Flag) => f.at + IMPACT;

const name = (id: Flag['id']) => FALLACIES[id].name;

/** The wavy red highlight under a fallacy (styles.js .ctp-hl, with the 900 ms enter flash). */
function Highlight({ children, flag, clearT }: { children: ReactNode; flag?: Flag; clearT: number }) {
  const frame = useCurrentFrame();
  if (!flag || frame < flag.at || clearT >= 1) return <span style={{ position: 'relative' }}>{children}</span>;
  const t = frame - flag.at;
  const enter = lerp(t, [0, 27], [1, 0]);
  const breathe = 0.5 - 0.5 * Math.cos((t / 78) * Math.PI * 2);
  const bg = 0.13 + 0.62 * enter + 0.07 * breathe * (1 - enter);
  const glow = 24 * enter + 10 * breathe * (1 - enter);
  const wave = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3' fill='none' stroke='%23ff2d55' stroke-width='1.4'/%3E%3C/svg%3E") repeat-x left bottom / ${8 * K}px ${4 * K}px`;
  return <span style={{ position: 'relative', borderRadius: 3 * K, background: `${wave}, rgba(255, 45, 85, ${bg * (1 - clearT)})`, boxShadow: `0 0 ${glow}px ${glow / 4}px rgba(255, 45, 85, ${0.18 + 0.6 * enter}), 0 0 0 1px rgba(255, 45, 85, 0.18)`, padding: '0 2px', opacity: 1 - clearT }}>{children}</span>;
}

/** Stamp → impact → fly into the tag spot → tag. Positioned relative to the sentence's line box. */
function FlagFx({ flag, width, clearT }: { flag: Flag; width: number; clearT: number }) {
  const frame = useCurrentFrame();
  const t = frame - flag.at;
  if (t < 0) return null;
  const k = K * (flag.max ? 1.35 : 1.15);
  const cx = width / 2, cy = 16;
  const flyStart = IMPACT + HOLD(flag.max), tagT = flyStart + FLY;
  // Stamp: fall (280 ms), hold, then fly to the tag spot at the start of the sentence.
  let stamp: ReactNode = null;
  if (t < tagT) {
    const fall = Math.min(1, t / 8.4);
    const sc = fall < 0.8 ? interpolate(fall, [0, 0.8], [3.4, 0.9]) : interpolate(fall, [0.8, 1], [0.9, 1]);
    const rot = fall < 0.8 ? interpolate(fall, [0, 0.8], [-26, -6]) : interpolate(fall, [0.8, 1], [-6, -8]);
    const fly = Math.max(0, Math.min(1, (t - flyStart) / FLY));
    const e = fly < 0.5 ? 2 * fly * fly : 1 - (-2 * fly + 2) ** 2 / 2;
    const x = cx + (60 - cx) * e, y = cy + (-22 - cy) * e;
    stamp = <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${sc * (1 - 0.8 * e)}) rotate(${rot * (1 - e)}deg)`, opacity: Math.min(1, fall * 1.6) * (1 - 0.8 * e), zIndex: 30 }}>
      <Stamp name={name(flag.id)} k={k} max={flag.max} style={{ position: 'relative' }}/>
    </div>;
  }
  // Tag leaves when the flag clears (styles.js ctp-leave: up 14 px, scale 0.6, fade, 380 ms).
  const leave = clearT;
  return <>
    {stamp}
    <Embers at={flag.at + IMPACT} x={cx} y={cy} n={flag.max ? 64 : 30} k={K} seed={flag.id}/>
    <Ring at={flag.at + IMPACT} x={cx} y={cy} k={K}/>
    {t >= tagT && leave < 1 && <FallacyTag name={name(flag.id)} k={K} enter={t - tagT} glowPhase={t} style={{ left: 0, top: -28 * K, opacity: 1 - leave, transform: leave > 0 ? `translateY(${-14 * K * leave}px) scale(${1 - 0.4 * leave})` : undefined, zIndex: 20 }}/>}
    <Embers at={flag.at + tagT} x={8 * K} y={-16 * K} n={10} reach={40} k={K} seed={`${flag.id}t`}/>
  </>;
}

/** Page-wide effects for the lead flag: red vignette, and at maximum the cinematic bars and banner. */
function ViewportFx({ flags }: { flags: Flag[] }) {
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
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: PAGE_H * 0.09, background: '#000', transform: `translateY(${-bars * 100}%)` }}/>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: PAGE_H * 0.09, background: '#000', transform: `translateY(${bars * 100}%)` }}/>
        <div style={{ position: 'absolute', left: '50%', top: PAGE_H * 0.09, transform: 'translateX(-50%)', padding: '10px 22px', color: '#fff', fontFamily: poster, fontSize: 22 * K, letterSpacing: `${0.18 + 0.42 * Math.max(0, 1 - bt / 0.15)}em`, textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: `-2px 0 ${P.cyan}, 2px 0 ${P.signal}`, opacity: Math.max(0, banner) }}>⚠ Fallacy detected ⚠</div>
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

/** The explanation card (styles.js .ctp-card), with the content the overlay builds for a Claude flag. */
function Card({ at, hot }: { at: number; hot: 'why' | 'ask' | null }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const f = FALLACIES.ad_hominem;
  const s = (n: number) => n * 1.1; // a little smaller than the tags so the whole card fits above the field
  const ring = (on: boolean): CSSProperties => (on ? { outline: `${s(2)}px solid ${P.yellow}`, outlineOffset: s(3), borderRadius: s(6) } : {});
  return <div style={{ position: 'absolute', left: 0, bottom: 0, width: s(320), padding: `${s(14)}px ${s(16)}px ${s(12)}px`, borderRadius: s(10), background: P.blood, color: '#f6e9eb', borderTop: `${s(3)}px solid ${P.signal}`, boxShadow: `0 ${s(18)}px ${s(50)}px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.25)`, fontFamily: grot, fontSize: s(13), lineHeight: 1.45, whiteSpace: 'normal', opacity: lerp(t, [0, 5.4], [0, 1]), transform: `translateY(${lerp(t, [0, 5.4], [-6, 0])}px)`, zIndex: 50, textAlign: 'left' }}>
    <div style={{ fontWeight: 800, fontSize: s(15), color: '#ff4d6d', letterSpacing: '0.02em', marginBottom: s(2) }}>{f.name}</div>
    <div style={{ fontSize: s(11), color: '#b38f96', marginBottom: s(10) }}>{f.blurb} · High confidence · Claude</div>
    <div style={{ paddingLeft: s(9), borderLeft: `${s(2)}px solid ${P.signal}`, color: '#e2c9ce', fontStyle: 'italic', marginBottom: s(10) }}>“{SENTENCE_1}”</div>
    <div style={{ marginBottom: s(10), ...ring(hot === 'why') }}>Whether Dana has run a company doesn't change what the study found. You're answering the person, not the evidence.</div>
    <div style={{ padding: `${s(8)}px ${s(10)}px`, borderRadius: s(7), background: 'rgba(255, 214, 10, 0.08)', color: '#ffe48a', marginBottom: s(12), ...ring(hot === 'ask') }}>
      <b style={{ display: 'block', marginBottom: s(2), fontSize: s(10.5), letterSpacing: '0.08em', textTransform: 'uppercase', color: P.yellow }}>Ask yourself</b>
      {f.question}
    </div>
    <div style={{ display: 'flex', gap: s(8), justifyContent: 'flex-end' }}>
      {[`Stop flagging ${f.name}`, 'Got it'].map((b, i) => <span key={b} style={{ fontWeight: 600, fontSize: s(12), padding: `${s(7)}px ${s(11)}px`, borderRadius: s(6), border: `1px solid ${i ? P.signal : 'rgba(255,255,255,0.16)'}`, background: i ? P.signal : 'transparent', color: '#fff' }}>{b}</span>)}
    </div>
  </div>;
}

/** The green "✓ Fixed" stamp (styles.js .ctp-fixed, effects.js resolved()). */
function Fixed({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const t = (frame - at) / 39;
  if (t < 0 || t > 1) return null;
  const sc = t < 0.25 ? interpolate(t, [0, 0.25], [0.3, 1.15]) : t < 0.7 ? interpolate(t, [0.25, 0.7], [1.15, 1]) : 1;
  const op = t < 0.25 ? t / 0.25 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  const dy = t > 0.7 ? -26 * ((t - 0.7) / 0.3) : 0;
  return <>
    <div style={{ position: 'absolute', left: 0, top: -38 * K, padding: `${5 * K}px ${11 * K}px`, border: `${3 * K}px solid ${P.green}`, borderRadius: 6 * K, background: 'rgba(3, 26, 14, 0.9)', color: P.green, fontFamily: poster, fontSize: 16 * K, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 0 24px rgba(31, 209, 122, 0.55)', transform: `translateY(${dy}px) scale(${sc}) rotate(-4deg)`, opacity: op, transformOrigin: '0 100%', zIndex: 30 }}>✓ Fixed</div>
    <Embers at={at} x={20 * K} y={-10} n={14} reach={70} k={K} colors={GREEN_COLORS} seed="fixed"/>
  </>;
}

type Who = { handle: string; color: string; text: string; time: string };
const OP: Who = { handle: 'maya_r', color: '#6D8BC9', time: '3h', text: 'Our team went hybrid last year. Output held steady and people seem happier. Curious what others have seen.' };
const DANA: Who = { handle: 'dana_k', color: '#5BA581', time: '2m', text: 'Studies suggest remote work can boost productivity. Maybe it’s worth a real try?' };
const LEO_POST: Who = { handle: 'leo_m', color: '#E0703A', time: 'now', text: `${SENTENCE_1} ${SENTENCE_2}` };

function Comment({ who, style, children }: { who: Who; style?: CSSProperties; children?: ReactNode }) {
  return <div style={{ position: 'absolute', display: 'flex', gap: 16, ...style }}>
    <div style={{ width: 40, height: 40, borderRadius: 20, background: who.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 800, fontSize: 18, flex: 'none' }}>{who.handle[0].toUpperCase()}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: grot, fontWeight: 700, fontSize: 17, color: '#2b2a27' }}>@{who.handle} <span style={{ fontWeight: 500, color: '#9a958b' }}>· {who.time}</span></div>
      <div style={{ fontFamily: grot, fontWeight: 500, fontSize: 19, lineHeight: 1.45, color: '#3a3833', marginTop: 4 }}>{who.text}</div>
      {children}
    </div>
  </div>;
}

/** "Ignored" / "watched" annotation box drawn over the page in chapter 01 (video annotation, not extension UI). */
function Note({ box, label, at, until = 1e9, on = false }: { box: [number, number, number, number]; label: string; at: number; until?: number; on?: boolean }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const p = lerp(t, [0, 6], [0, 1]) * lerp(frame, [until - 8, until], [1, 0]);
  if (p <= 0) return null;
  const c = on ? P.signal : '#8A857C';
  const [x, y, w, h] = box;
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: `3px dashed ${c}`, borderRadius: 12, background: on ? 'rgba(255,45,85,0.06)' : 'rgba(30,28,25,0.55)', opacity: p, transform: `scale(${1.04 - 0.04 * p})`, zIndex: 35, boxShadow: on ? `0 0 ${20 + 10 * Math.sin(t / 5)}px rgba(255,45,85,0.45)` : undefined }}>
    <div style={{ position: 'absolute', left: 12, top: -17, background: c, color: '#fff', fontFamily: mono, fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', padding: '5px 10px', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
      {on && <span style={{ width: 9, height: 9, borderRadius: 5, background: '#fff', opacity: Math.floor(t / 8) % 2 ? 0.35 : 1 }}/>}{label}
    </div>
  </div>;
}

export type DemoScript = {
  /** Ch. 01 annotations: when the "ignored" boxes and the "watched" box appear. */
  ignore?: number; watch?: number; focus?: number;
  type1?: [number, number]; type2?: [number, number];
  flags?: Flag[];
  card?: { at: number; until: number; hot: (frame: number) => 'why' | 'ask' | null };
  /** Select sentence 1, then type the rewrite. */
  select?: number; type3?: [number, number]; fixed?: number;
  /** Before the extension: the comment is posted. */
  postAt?: number;
  cursor?: [number, number, number][]; // [frame, x, y] keyframes
  clickAt?: number[];
};

/** The discussion page, with or without the extension running. */
export function ForumPage({ s, ext = true }: { s: DemoScript; ext?: boolean }) {
  const frame = useCurrentFrame();
  const flags = ext ? s.flags ?? [] : [];
  const f1 = flags.find((f) => f.id === 'ad_hominem'), f2 = flags.find((f) => f.id === 'slippery_slope');
  const clear1 = f1?.clearAt !== undefined ? lerp(frame, [f1.clearAt, f1.clearAt + 11], [0, 1]) : 0;
  const posted = s.postAt !== undefined && frame >= s.postAt;
  // Composer text.
  const fixing = s.select !== undefined && frame >= s.select;
  const deleted = s.type3 !== undefined && frame >= s.type3[0];
  const line1 = deleted ? typed(REWRITE_1, frame, s.type3![0], s.type3![1]) : s.type1 ? typed(SENTENCE_1, frame, s.type1[0], s.type1[1]) : '';
  const line2 = s.type2 ? typed(SENTENCE_2, frame, s.type2[0], s.type2[1]) : '';
  const caretLine = deleted && frame < s.type3![1] + 20 ? 1 : line2 ? 2 : 1;
  const focused = s.focus !== undefined && frame >= s.focus;
  const caret = focused && !posted && Math.floor(frame / 8) % 2 === 0;
  // Field shake on the lead flag (dramatic: the field; maximum: the whole page).
  let fieldShake = { x: 0, y: 0, r: 0 }, pageShake = { x: 0, y: 0, r: 0 };
  for (const f of flags) {
    const sh = shakeAt(frame, impactAt(f), f.max ? 9 * K : 6 * K, f.id);
    if (f.max) pageShake = sh; else fieldShake = sh;
  }
  const lineStyle: CSSProperties = { position: 'relative', fontFamily: grot, fontWeight: 500, fontSize: 24, lineHeight: '34px', color: '#1f1e1b', whiteSpace: 'nowrap', minHeight: 34 };
  const caretEl = <span style={{ display: 'inline-block', width: 2, height: 26, background: '#1f1e1b', verticalAlign: -5, marginLeft: 1, opacity: caret ? 1 : 0 }}/>;
  const w1 = line1.length * 11.6, w2 = line2.length * 11.6; // approximate rendered widths, to centre the stamp

  return <AbsoluteFill style={{ background: '#FBFAF7', transform: `translate(${pageShake.x}px, ${pageShake.y}px) rotate(${pageShake.r}deg)` }}>
    {/* Site header */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 58, borderBottom: '1px solid #E6E1D6', display: 'flex', alignItems: 'center', padding: '0 44px', gap: 34, background: '#fff' }}>
      <span style={{ fontFamily: serif, fontSize: 32, color: '#1f1e1b' }}>the commons</span>
      {['Discussions', 'Work', 'Tech', 'Life'].map((t, i) => <span key={t} style={{ fontFamily: grot, fontWeight: i === 1 ? 700 : 500, fontSize: 17, color: i === 1 ? '#1f1e1b' : '#8a857c', borderBottom: i === 1 ? '3px solid #1f1e1b' : 'none', paddingBottom: 4 }}>{t}</span>)}
      <span style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 17, background: LEO_POST.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: grot, fontWeight: 800 }}>L</span>
    </div>
    {/* Thread */}
    <div style={{ position: 'absolute', left: 130, top: 84, fontFamily: grot, fontWeight: 600, fontSize: 14, color: '#9a958b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Work · 38 replies</div>
    <div style={{ position: 'absolute', left: 130, top: 106, fontFamily: serif, fontSize: 46, color: '#1f1e1b' }}>Is remote work here to stay?</div>
    <Comment who={OP} style={{ left: 130, top: 178, width: 830 }}/>
    <Comment who={DANA} style={{ left: 186, top: 286, width: 774 }}/>
    {/* Composer, or Leo's posted reply */}
    {posted ? <Comment who={LEO_POST} style={{ left: 186, top: 392, width: 774, background: '#FFF6E8', padding: 14, borderRadius: 12, marginLeft: -14 }}/> :
      <div style={{ position: 'absolute', left: 186, top: 388, width: 774 }}>
        <div style={{ fontFamily: grot, fontWeight: 600, fontSize: 15, color: '#9a958b', marginBottom: 8 }}>Reply to @dana_k</div>
        <div style={{ position: 'relative', height: 196, background: '#fff', border: `2px solid ${focused ? '#1f1e1b' : '#DDD6C8'}`, borderRadius: 14, padding: '18px 22px', transform: `translate(${fieldShake.x}px, ${fieldShake.y}px) rotate(${fieldShake.r}deg)` }}>
          {!line1 && !line2 && !focused && <div style={{ ...lineStyle, color: '#B0AB9F' }}>Write a reply…</div>}
          {(line1 || focused) && <div style={lineStyle}>
            {fixing && !deleted ? <span style={{ background: '#B4D2FF' }}>{SENTENCE_1}</span> :
              <Highlight flag={deleted ? undefined : f1} clearT={clear1}>{line1}</Highlight>}
            {caretLine === 1 && caretEl}
            {f1 && <div style={{ position: 'absolute', left: 0, top: 0 }}><FlagFx flag={f1} width={w1} clearT={clear1}/></div>}
            {s.fixed !== undefined && <div style={{ position: 'absolute', left: 0, top: 0 }}><Fixed at={s.fixed}/></div>}
            {s.card && frame >= s.card.at && frame < s.card.until && <div style={{ position: 'absolute', left: 0, bottom: 74 }}><Card at={s.card.at} hot={s.card.hot(frame)}/></div>}
          </div>}
          {line2 && <div style={{ ...lineStyle, marginTop: 44 }}>
            <Highlight flag={f2} clearT={0}>{line2}</Highlight>{caretLine === 2 && caretEl}
            {f2 && <div style={{ position: 'absolute', left: 0, top: 0 }}><FlagFx flag={f2} width={w2} clearT={0}/></div>}
          </div>}
          <div style={{ position: 'absolute', right: 16, bottom: 14, background: '#1f1e1b', color: '#fff', fontFamily: grot, fontWeight: 700, fontSize: 16, padding: '10px 18px', borderRadius: 10 }}>Post reply</div>
        </div>
      </div>}
    <Comment who={{ handle: 'sam_t', color: '#A46BB0', time: '5m', text: 'Hybrid has worked for us, but onboarding new people remotely is genuinely hard.' }} style={{ left: 130, top: posted ? 560 : 640, width: 830 }}/>
    {/* Sidebar */}
    <div style={{ position: 'absolute', left: 1010, top: 106, width: 330, background: '#fff', border: '1px solid #E6E1D6', borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ fontFamily: grot, fontWeight: 800, fontSize: 16, color: '#1f1e1b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Trending</div>
      {['Four-day week: the data so far', 'Are open offices over?', 'Best tools for async teams'].map((t) => <div key={t} style={{ fontFamily: grot, fontWeight: 500, fontSize: 17, color: '#3a3833', marginTop: 14 }}>{t}</div>)}
    </div>
    <div style={{ position: 'absolute', left: 1010, top: 330, width: 330, height: 200, borderRadius: 14, background: 'linear-gradient(135deg, #E9E4D8, #DCD5C6)', display: 'grid', placeItems: 'center', fontFamily: mono, fontSize: 13, color: '#8a857c', letterSpacing: '0.1em' }}>SPONSORED</div>

    {/* Chapter 01 annotations */}
    {ext && s.ignore !== undefined && <>
      <Note box={[112, 96, 870, 180]} label="NOT YOURS · IGNORED" at={s.ignore} until={s.type1?.[0]}/>
      <Note box={[170, 278, 812, 92]} label="NOT YOURS · IGNORED" at={s.ignore + 5} until={s.type1?.[0]}/>
      <Note box={[996, 92, 358, 452]} label="IGNORED" at={s.ignore + 10} until={s.type1?.[0]}/>
      <Note box={[112, 628, 870, 110]} label="IGNORED" at={s.ignore + 15} until={s.type1?.[0]}/>
      {s.watch !== undefined && <Note box={[176, 412, 794, 220]} label="YOUR WORDS · CHECKED" at={s.watch} until={(s.type1?.[0] ?? 1e9) + 10} on/>}
    </>}
    <ViewportFx flags={flags}/>
    <Cursor s={s}/>
  </AbsoluteFill>;
}

function Cursor({ s }: { s: DemoScript }) {
  const frame = useCurrentFrame();
  const keys = s.cursor ?? [];
  if (!keys.length || frame < keys[0][0]) return null;
  let x = keys[0][1], y = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const [f, kx, ky] = keys[i], [pf, px, py] = keys[i - 1];
    if (frame >= f) { x = kx; y = ky; continue; }
    if (frame > pf) { const t = (frame - pf) / (f - pf); const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; x = px + (kx - px) * e; y = py + (ky - py) * e; }
    break;
  }
  const press = (s.clickAt ?? []).some((c) => frame >= c && frame < c + 5);
  return <svg width={30} height={40} viewBox="0 0 24 32" style={{ position: 'absolute', left: x, top: y, zIndex: 60, transform: `scale(${press ? 0.85 : 1})`, transformOrigin: '0 0', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))' }}>
    <path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" fill="#111" stroke="#fff" strokeWidth={2} strokeLinejoin="round"/>
  </svg>;
}
