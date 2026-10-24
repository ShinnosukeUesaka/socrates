// The dramatic part: stamp slams, screen shake, embers, alarm stingers.
// Everything is built from Web Animations on throwaway elements in the
// overlay, so the page's own DOM is never modified (the field shake is a
// temporary animation that the browser removes when it ends).

import { fallacyName } from "../shared/fallacies.js";

const EMBER_COLORS = ["#ff2d55", "#ff6b35", "#ffd60a", "#fff3b0"];
const GREEN_COLORS = ["#1fd17a", "#8affc1", "#e8fff3"];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

function centerOf(rects) {
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export class Effects {
  constructor(fx) {
    this.fx = fx;
    this.audio = null;
  }

  spawn(className, text) {
    const el = document.createElement("div");
    el.className = className;
    if (text) el.textContent = text;
    this.fx.appendChild(el);
    return el;
  }

  async entrance({ flag, rects, tagEl, hlEls, field, intensity, sound, lead }) {
    for (const hl of hlEls) {
      hl.removeAttribute("data-pending");
      hl.classList.add("ctp-hl--enter");
    }
    if (!rects.length || intensity === "subtle") {
      if (sound && lead) this.blip();
      this.revealTag(tagEl);
      return;
    }

    const max = intensity === "maximum";
    const c = centerOf(rects);
    const stamp = this.spawn(`ctp-stamp${max ? " ctp-stamp--max" : ""}`);
    stamp.textContent = `${fallacyName(flag.type)}!`;
    const sub = document.createElement("small");
    sub.textContent = "fallacy detected";
    stamp.appendChild(sub);
    const sr = stamp.getBoundingClientRect();
    const x = Math.min(Math.max(c.x - sr.width / 2, 8), window.innerWidth - sr.width - 8);
    const y = Math.min(Math.max(c.y - sr.height / 2, 8), window.innerHeight - sr.height - 8);
    stamp.style.left = `${x}px`;
    stamp.style.top = `${y}px`;

    stamp.animate(
      [
        { transform: "scale(3.4) rotate(-26deg)", opacity: 0 },
        { transform: "scale(0.9) rotate(-6deg)", opacity: 1, offset: 0.8 },
        { transform: "scale(1) rotate(-8deg)", opacity: 1 },
      ],
      { duration: 280, easing: "cubic-bezier(.55,0,.8,.2)", fill: "forwards" },
    );
    await wait(240);

    // Impact.
    this.embers(c.x, c.y, max ? 64 : 30, EMBER_COLORS);
    this.ring(c.x, c.y);
    if (lead) {
      this.vignette();
      this.shake(max ? document.body : field, max ? 9 : 6);
      if (sound) this.alarm();
      if (max) this.cinematic();
    }

    await wait(max ? 1300 : 900);

    // Fly the stamp into the tag's spot, then reveal the tag.
    const tr = tagEl.getBoundingClientRect();
    const dx = tr.left + tr.width / 2 - (x + sr.width / 2);
    const dy = tr.top + tr.height / 2 - (y + sr.height / 2);
    const scale = Math.max(tr.width / sr.width, 0.15);
    const fly = stamp.animate(
      [
        { transform: "scale(1) rotate(-8deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, opacity: 0.2 },
      ],
      { duration: 380, easing: "cubic-bezier(.6,0,.4,1)", fill: "forwards" },
    );
    await fly.finished.catch(() => {});
    stamp.remove();
    this.revealTag(tagEl);
    this.embers(tr.left + 8, tr.top + tr.height / 2, 10, EMBER_COLORS, 40);
  }

  revealTag(tagEl) {
    if (!tagEl.isConnected) return;
    tagEl.removeAttribute("data-pending");
    tagEl.classList.add("ctp-tag--enter");
  }

  resolved({ rect, sound }) {
    if (!rect) return;
    const el = this.spawn("ctp-fixed", "✓ Fixed");
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.min(Math.max(rect.left, 8), window.innerWidth - r.width - 8)}px`;
    el.style.top = `${Math.max(rect.top - r.height - 6, 8)}px`;
    el.animate(
      [
        { transform: "scale(0.3) rotate(-10deg)", opacity: 0 },
        { transform: "scale(1.15) rotate(-4deg)", opacity: 1, offset: 0.25 },
        { transform: "scale(1) rotate(-4deg)", opacity: 1, offset: 0.7 },
        { transform: "translateY(-26px) rotate(-4deg)", opacity: 0 },
      ],
      { duration: 1300, easing: "ease-out", fill: "forwards" },
    ).finished.finally(() => el.remove());
    this.embers(rect.left + 20, rect.top, 14, GREEN_COLORS, 70);
    if (sound) this.chime();
  }

  embers(x, y, count, colors, reach = 170) {
    for (let i = 0; i < count; i++) {
      const el = this.spawn("ctp-ember");
      const size = rand(4, 9);
      const color = colors[i % colors.length];
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = color;
      el.style.boxShadow = `0 0 ${size * 2}px ${color}`;
      const angle = rand(0, Math.PI * 2);
      const dist = rand(reach * 0.35, reach);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist + rand(10, 50);
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          { transform: `translate(${x + dx}px, ${y + dy}px) scale(0.2)`, opacity: 0 },
        ],
        { duration: rand(650, 1250), easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" },
      ).finished.finally(() => el.remove());
    }
  }

  ring(x, y) {
    const el = this.spawn("ctp-ring");
    el.style.width = "24px";
    el.style.height = "24px";
    el.animate(
      [
        { transform: `translate(${x - 12}px, ${y - 12}px) scale(0.4)`, opacity: 0.95 },
        { transform: `translate(${x - 12}px, ${y - 12}px) scale(9)`, opacity: 0 },
      ],
      { duration: 650, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    ).finished.finally(() => el.remove());
  }

  vignette() {
    const el = this.spawn("ctp-vignette");
    el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.55, offset: 0.4 }, { opacity: 0 }], {
      duration: 1000,
      easing: "ease-out",
      fill: "forwards",
    }).finished.finally(() => el.remove());
  }

  shake(target, amp) {
    if (!target?.animate) return;
    const frames = [];
    for (let i = 0; i < 9; i++) {
      const k = amp * (1 - i / 9);
      frames.push({ transform: `translate(${rand(-k, k)}px, ${rand(-k / 2, k / 2)}px) rotate(${rand(-k / 8, k / 8)}deg)` });
    }
    frames.push({ transform: "none" });
    target.animate(frames, { duration: 520, easing: "ease-out" });
  }

  cinematic() {
    const top = this.spawn("ctp-bar");
    const bottom = this.spawn("ctp-bar");
    top.style.top = "0";
    bottom.style.bottom = "0";
    const bar = (el, dir) =>
      el.animate(
        [
          { transform: `translateY(${dir * 100}%)` },
          { transform: "none", offset: 0.15 },
          { transform: "none", offset: 0.85 },
          { transform: `translateY(${dir * 100}%)` },
        ],
        { duration: 1900, easing: "ease-in-out", fill: "forwards" },
      ).finished.finally(() => el.remove());
    bar(top, -1);
    bar(bottom, 1);
    const banner = this.spawn("ctp-banner", "⚠ Fallacy detected ⚠");
    banner.animate(
      [
        { opacity: 0, letterSpacing: "0.6em" },
        { opacity: 1, letterSpacing: "0.18em", offset: 0.15 },
        { opacity: 0.4, offset: 0.2 },
        { opacity: 1, offset: 0.25 },
        { opacity: 1, offset: 0.85 },
        { opacity: 0 },
      ],
      { duration: 1900, fill: "forwards" },
    ).finished.finally(() => banner.remove());
  }

  // --- Sound -------------------------------------------------------------

  ctx() {
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === "suspended") this.audio.resume();
      return this.audio;
    } catch {
      return null;
    }
  }

  // Low impact thud + a three-hit "dun dun DUNNN" stinger.
  alarm() {
    const ctx = this.ctx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    src.connect(lp).connect(master);
    src.start(t0);

    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.frequency.setValueAtTime(120, t0);
    boom.frequency.exponentialRampToValueAtTime(38, t0 + 0.4);
    boomGain.gain.setValueAtTime(0.9, t0);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    boom.connect(boomGain).connect(master);
    boom.start(t0);
    boom.stop(t0 + 0.5);

    const hits = [
      [0.08, 0.16, 196.0],
      [0.3, 0.16, 185.0],
      [0.54, 1.1, 155.56],
    ];
    for (const [at, dur, f] of hits) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1800, t0 + at);
      filter.frequency.exponentialRampToValueAtTime(400, t0 + at + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0 + at);
      env.gain.exponentialRampToValueAtTime(0.5, t0 + at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
      filter.connect(env).connect(master);
      for (const [type, mult] of [["sawtooth", 1], ["sawtooth", 1.006], ["square", 0.5]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        o.connect(filter);
        o.start(t0 + at);
        o.stop(t0 + at + dur + 0.05);
      }
    }
  }

  blip() {
    this.tone([[0, 0.12, 660, 0.06], [0.06, 0.14, 440, 0.06]]);
  }

  chime() {
    this.tone([[0, 0.3, 880, 0.1], [0.09, 0.4, 1318.5, 0.1]]);
  }

  tone(notes) {
    const ctx = this.ctx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    for (const [at, dur, f, vol] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.05);
    }
  }
}
