// Synthesises every sound effect and the extra sounds as WAV files, so the
// video needs no third-party audio assets. Output: public/audio/*.wav
// Adapted from the Ember pitch video (codebees/video/scripts/make-sounds.mjs); the alarm sounds at the end are new.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

// Deterministic noise so renders are reproducible.
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rand() * 2 - 1;

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const TAU = Math.PI * 2;

const wave = {
  sine: (p) => Math.sin(TAU * p),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  pulse: (p) => (p % 1 < 0.25 ? 1 : -1),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  saw: (p) => 2 * (p % 1) - 1,
};

// Add a tone to `out` starting at `start` seconds. `freq` may be a function of t.
function tone(out, { start = 0, dur, freq, type = 'sine', vol = 0.3, attack = 0.005, release = 0.05, decay = 0, vibrato = 0 }) {
  const s0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR;
    let f = typeof freq === 'function' ? freq(t) : freq;
    if (vibrato) f *= 1 + vibrato * Math.sin(TAU * 5.5 * t);
    phase += f / SR;
    let env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release);
    if (decay) env *= Math.exp(-t / decay);
    out[s0 + i] += wave[type](phase) * vol * Math.max(0, env);
  }
}

// Filtered noise burst. Cutoff may be a function of t (state-variable filter).
function hiss(out, { start = 0, dur, vol = 0.3, cutoff = 4000, q = 0.7, mode = 'band', decay = 0, attack = 0.002 }) {
  const s0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  let low = 0, band = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR;
    const fc = typeof cutoff === 'function' ? cutoff(t) : cutoff;
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const x = noise();
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    let env = Math.min(1, t / attack) * Math.min(1, (dur - t) / 0.01);
    if (decay) env *= Math.exp(-t / decay);
    const y = mode === 'low' ? low : mode === 'high' ? high : band;
    out[s0 + i] += y * vol * Math.max(0, env);
  }
}

const kick = (o, t, v = 0.9) => tone(o, { start: t, dur: 0.3, freq: (x) => 50 + 110 * Math.exp(-x * 30), vol: v, decay: 0.12 });
const snare = (o, t, v = 0.35) => { hiss(o, { start: t, dur: 0.18, vol: v, cutoff: 3000, q: 0.5, decay: 0.06 }); tone(o, { start: t, dur: 0.1, freq: 190, vol: v * 0.5, decay: 0.04 }); };
const hat = (o, t, v = 0.12) => hiss(o, { start: t, dur: 0.05, vol: v, cutoff: 9000, mode: 'high', decay: 0.015 });

function save(name, data, gain = 1) {
  let peak = 0;
  for (const x of data) peak = Math.max(peak, Math.abs(x));
  const norm = peak > 0 ? (0.89 * gain) / peak : 1;
  const pcm = Buffer.alloc(44 + data.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + data.length * 2, 4); pcm.write('WAVE', 8);
  pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(data.length * 2, 40);
  data.forEach((x, i) => pcm.writeInt16LE(Math.round(Math.tanh(x * norm) * 32767), 44 + i * 2));
  writeFileSync(join(OUT, `${name}.wav`), pcm);
}

// ---------- Sound effects ----------
{ const o = buf(2.2); let t = 0.02; while (t < 2.1) { hiss(o, { start: t, dur: 0.03, vol: 0.5, cutoff: 2500 + rand() * 2500, q: 0.3, decay: 0.008 }); tone(o, { start: t, dur: 0.02, freq: 900 + rand() * 300, vol: 0.08, decay: 0.006 }); t += 0.055 + rand() * 0.07; } save('typing', o, 0.6); }
{ const o = buf(0.5); hiss(o, { dur: 0.5, vol: 1, cutoff: (t) => 300 + 5000 * Math.sin(Math.PI * t / 0.5), q: 0.25, attack: 0.15 }); save('whoosh', o, 0.7); }
{ const o = buf(0.18); tone(o, { dur: 0.18, freq: (t) => 380 + 1400 * t / 0.18, vol: 0.6, decay: 0.06 }); save('pop', o, 0.7); }
{ const o = buf(1.2); [1, 2.76, 5.4].forEach((m, i) => tone(o, { dur: 1.2, freq: 1318 * m, vol: 0.4 / (i + 1), decay: 0.35 - i * 0.1 })); save('ding', o, 0.6); }
{ const o = buf(0.35); kick(o, 0, 1); hiss(o, { dur: 0.12, vol: 0.6, cutoff: 1500, decay: 0.04 }); save('stamp', o, 0.85); }
{ const o = buf(0.7); tone(o, { dur: 0.32, freq: 120, type: 'square', vol: 0.3 }); tone(o, { dur: 0.32, freq: 127, type: 'square', vol: 0.3 }); tone(o, { start: 0.36, dur: 0.32, freq: 112, type: 'square', vol: 0.3 }); tone(o, { start: 0.36, dur: 0.32, freq: 118, type: 'square', vol: 0.3 }); save('buzzer', o, 0.45); }
{ const o = buf(2.6); [[58, 0, 0.42], [57, 0.45, 0.42], [56, 0.9, 0.42], [55, 1.35, 1.2]].forEach(([n, s, d], i) => { tone(o, { start: s, dur: d, freq: midi(n - 12), type: 'saw', vol: 0.25, attack: 0.04, release: 0.15, vibrato: i === 3 ? 0.025 : 0.004 }); tone(o, { start: s, dur: d, freq: midi(n - 12) * 1.005, type: 'square', vol: 0.12, attack: 0.04, release: 0.15, vibrato: i === 3 ? 0.025 : 0 }); }); save('trombone', o, 0.6); }
{ const o = buf(0.6); hiss(o, { dur: 0.6, vol: 1, cutoff: (t) => 600 + 2200 * Math.abs(Math.sin(TAU * 4.2 * t)) * (1 - t), q: 0.12, decay: 0.3 }); tone(o, { dur: 0.5, freq: (t) => 300 + 500 * Math.abs(Math.sin(TAU * 4.2 * t)), type: 'saw', vol: 0.15, decay: 0.2 }); save('scratch', o, 0.75); }
{ const o = buf(0.5); [0, 0.07, 0.2].forEach((s) => hiss(o, { start: s, dur: 0.06, vol: 1, cutoff: 3500, q: 0.2, decay: 0.012 })); save('crack', o, 0.8); }
{ const o = buf(1.1); for (let i = 0; i < 12; i++) tone(o, { start: i * 0.055, dur: 0.35, freq: midi(84 + [0, 4, 7, 12, 16, 19][i % 6] + (i > 5 ? 12 : 0)), vol: 0.18, decay: 0.12 }); save('sparkle', o, 0.55); }
{ const o = buf(2); [60, 64, 67, 72].forEach((n, i) => tone(o, { start: i * 0.11, dur: 0.14, freq: midi(n + 12), type: 'square', vol: 0.18 })); [72, 76, 79].forEach((n) => tone(o, { start: 0.46, dur: 1.4, freq: midi(n), type: 'pulse', vol: 0.13, release: 0.6, vibrato: 0.006 })); tone(o, { start: 0.46, dur: 1.4, freq: midi(48), type: 'tri', vol: 0.4, release: 0.6 }); kick(o, 0.46); save('fanfare', o, 0.7); }
{ const o = buf(0.5); [0, 0.2].forEach((s) => { hiss(o, { start: s, dur: 0.12, vol: 1, cutoff: 1800, q: 0.4, decay: 0.04 }); tone(o, { start: s, dur: 0.08, freq: 160, vol: 0.4, decay: 0.03 }); }); save('chomp', o, 0.7); }
{ const o = buf(1); [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(o, { start: i * 0.06, dur: i === 6 ? 0.5 : 0.09, freq: midi(n + 12), type: 'square', vol: 0.17, release: i === 6 ? 0.3 : 0.02 })); save('levelup', o, 0.6); }
{ const o = buf(0.6); tone(o, { dur: 0.08, freq: midi(83), type: 'square', vol: 0.2 }); tone(o, { start: 0.08, dur: 0.45, freq: midi(88), type: 'square', vol: 0.2, release: 0.3 }); save('coin', o, 0.55); }
{ const o = buf(0.08); tone(o, { dur: 0.04, freq: 2200, vol: 0.5, decay: 0.008 }); hiss(o, { dur: 0.03, vol: 0.4, cutoff: 6000, decay: 0.006 }); save('click', o, 0.6); }
{ const o = buf(0.6); tone(o, { dur: 0.6, freq: (t) => 900 * Math.exp(-t * 3.2), type: 'tri', vol: 0.4, release: 0.15, vibrato: 0.02 }); save('shrink', o, 0.6); }
{ const o = buf(0.6); tone(o, { dur: 0.6, freq: (t) => 250 * Math.exp(t * 3.2), type: 'tri', vol: 0.4, release: 0.15, vibrato: 0.02 }); save('grow', o, 0.6); }
{ const o = buf(0.5); kick(o, 0, 1); tone(o, { dur: 0.4, freq: (t) => 220 + 180 * Math.sin(TAU * 9 * t) * Math.exp(-t * 6), type: 'tri', vol: 0.35, decay: 0.15 }); save('slam', o, 0.75); }
{ const o = buf(1.2); tone(o, { dur: 1.2, freq: (t) => 200 + 30 * Math.sin(TAU * 7 * t), type: 'tri', vol: 0.3, decay: 0.5, attack: 0.02 }); hiss(o, { dur: 1, vol: 0.15, cutoff: 900, decay: 0.4 }); save('wobble', o, 0.45); }
{ const o = buf(1.6); tone(o, { dur: 1.2, freq: (t) => 38 + 90 * Math.exp(-t * 18), vol: 1, decay: 0.45 }); hiss(o, { dur: 1.5, vol: 0.45, cutoff: (t) => 7000 - 4000 * t, q: 0.4, decay: 0.35 }); hiss(o, { dur: 0.08, vol: 0.8, cutoff: 1200, decay: 0.03 }); save('impact', o, 0.9); }
{ const o = buf(0.45); for (let k = 0; k < 9; k++) { const s = k * 0.045 + rand() * 0.01; if (rand() < 0.75) tone(o, { start: s, dur: 0.03, freq: 200 + rand() * 2400, type: 'square', vol: 0.35 }); hiss(o, { start: s, dur: 0.025, vol: 0.5, cutoff: 1000 + rand() * 6000, q: 0.2 }); } save('glitch', o, 0.55); }
{ const o = buf(0.5); tone(o, { dur: 0.45, freq: (t) => 45 + 70 * Math.exp(-t * 25), vol: 1, decay: 0.12 }); hiss(o, { dur: 0.1, vol: 0.4, cutoff: 600, decay: 0.03 }); save('thud', o, 0.85); }
{ const o = buf(2); hiss(o, { dur: 2, vol: 0.8, cutoff: (t) => 400 * 2 ** (t * 3.5), q: 0.3, attack: 1.4 }); tone(o, { dur: 2, freq: (t) => 110 * 2 ** (t * 1.5), type: 'saw', vol: 0.12, attack: 1.6, vibrato: 0.01 }); save('riser', o, 0.6); }
{ const o = buf(0.5); tone(o, { dur: 0.16, freq: midi(70), type: 'square', vol: 0.2, release: 0.03 }); tone(o, { start: 0.17, dur: 0.28, freq: midi(65), type: 'square', vol: 0.2, release: 0.12, vibrato: 0.01 }); save('nope', o, 0.45); }

// Two-pole low-pass, cutoff may be a function of t.
function lowpass(data, cutoff) {
  let a = 0, b = 0;
  for (let i = 0; i < data.length; i++) {
    const fc = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff;
    const k = 1 - Math.exp(-TAU * fc / SR);
    a += k * (data[i] - a); b += k * (a - b); data[i] = b;
  }
}

// ---------- Critical Thinking Partner: the fallacy alarm ----------
// Two-tone alarm blip, the "fallacy detected" signature.
{ const o = buf(0.9); [0, 0.22, 0.44].forEach((s, i) => { tone(o, { start: s, dur: 0.18, freq: i % 2 ? 660 : 880, type: 'square', vol: 0.22, release: 0.04 }); tone(o, { start: s, dur: 0.18, freq: (i % 2 ? 660 : 880) * 1.006, type: 'saw', vol: 0.12, release: 0.04 }); }); save('alarm', o, 0.55); }
// Sub drop for the cinematic bars.
{ const o = buf(2.2); tone(o, { dur: 2.2, freq: (t) => 30 + 70 * Math.exp(-t * 2.2), vol: 1, attack: 0.01, decay: 0.9 }); hiss(o, { dur: 0.25, vol: 0.5, cutoff: 900, decay: 0.08 }); save('boom', o, 0.95); }
// Electric zap for the tag snapping onto the text.
{ const o = buf(0.35); tone(o, { dur: 0.3, freq: (t) => 2400 * Math.exp(-t * 14) + 120, type: 'saw', vol: 0.4, decay: 0.1 }); hiss(o, { dur: 0.2, vol: 0.5, cutoff: (t) => 8000 - 20000 * t, q: 0.3, decay: 0.06 }); save('zap', o, 0.6); }
// Heartbeat for the tension before the reveal.
{ const o = buf(1.0); [0, 0.24].forEach((s, i) => tone(o, { start: s, dur: 0.25, freq: (t) => 48 + 40 * Math.exp(-t * 30), vol: i ? 0.7 : 1, decay: 0.08 })); save('heartbeat', o, 0.8); }
// Bright resolve when a fallacy is fixed.
{ const o = buf(1.2); [72, 76, 79, 84].forEach((n, i) => tone(o, { start: i * 0.07, dur: 0.9 - i * 0.1, freq: midi(n), type: 'tri', vol: 0.3, decay: 0.35 })); tone(o, { start: 0.28, dur: 0.9, freq: midi(91), vol: 0.12, decay: 0.3 }); save('fixed', o, 0.6); }
// Low drone swell that sits under the cold open title.
{ const o = buf(3.5); [38, 45, 50].forEach((n) => tone(o, { dur: 3.5, freq: midi(n), type: 'saw', vol: 0.12, attack: 1.2, release: 1.2, vibrato: 0.003 })); lowpass(o, (t) => 300 + 600 * Math.min(1, t / 2)); save('drone', o, 0.6); }
// The extension's own alarm (src/content/effects.js alarm()): low thud, then a "dun dun DUNNN" of detuned saws.
{
  const o = buf(2.0);
  tone(o, { dur: 0.5, freq: (t) => 120 * (38 / 120) ** Math.min(1, t / 0.4), vol: 0.9, decay: 0.12 });
  hiss(o, { dur: 0.35, vol: 0.5, cutoff: 700, mode: 'low', decay: 0.1 });
  [[0.08, 0.16, 196.0], [0.3, 0.16, 185.0], [0.54, 1.1, 155.56]].forEach(([at, dur, f]) => {
    const h = buf(2.0);
    [['saw', 1], ['saw', 1.006], ['square', 0.5]].forEach(([type, m]) => tone(h, { start: at, dur, freq: f * m, type, vol: 0.25, attack: 0.015, decay: dur / 3 }));
    lowpass(h, (t) => (t < at ? 1800 : Math.max(400, 1800 * (400 / 1800) ** ((t - at) / dur))));
    h.forEach((x, i) => { o[i] += x; });
  });
  save('stinger', o, 0.85);
}
// The extension's "fixed" chime and "subtle" blip (effects.js chime() and blip()).
{ const o = buf(0.6); tone(o, { dur: 0.3, freq: 880, vol: 0.4, attack: 0.01, decay: 0.1 }); tone(o, { start: 0.09, dur: 0.4, freq: 1318.5, vol: 0.4, attack: 0.01, decay: 0.13 }); save('chime', o, 0.6); }
