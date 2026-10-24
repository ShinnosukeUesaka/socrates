// A single fixed, full-viewport layer (inside a shadow root so page CSS can't
// touch it) that draws highlights, tags and the explanation card.

import { FALLACIES, fallacyName } from "../shared/fallacies.js";
import { Effects } from "./effects.js";
import { OVERLAY_CSS } from "./styles.js";

const TAG_HEIGHT = 20;
const ICON_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.3 15.3 14H.7L8 1.3Zm-.9 4.5v4.3h1.8V5.8H7.1Zm0 5.4V13h1.8v-1.8H7.1Z"/></svg>';

export class Overlay {
  constructor({ onDismiss, onMute }) {
    this.onDismiss = onDismiss;
    this.onMute = onMute;
    this.host = null;
    this.views = new Map();
    this.card = null;
    this.cardFlag = null;
  }

  mount() {
    if (this.host?.isConnected) return;
    this.host = document.createElement("ctp-overlay");
    this.host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
    const shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = OVERLAY_CSS;
    this.layer = document.createElement("div");
    this.layer.className = "layer";
    this.mirrors = document.createElement("div");
    this.fx = document.createElement("div");
    this.fx.className = "fx";
    shadow.append(style, this.mirrors, this.layer, this.fx);
    document.documentElement.appendChild(this.host);
    this.effects = new Effects(this.fx);
    this.views.clear();
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (this.card && !e.composedPath().includes(this.host)) this.closeCard();
      },
      true,
    );
  }

  view(flag) {
    let v = this.views.get(flag.id);
    if (v) return v;
    const tag = document.createElement("button");
    tag.className = "ctp-tag";
    tag.type = "button";
    tag.setAttribute("aria-expanded", "false");
    tag.innerHTML = ICON_SVG;
    tag.append(fallacyName(flag.type));
    tag.title = `${fallacyName(flag.type)}: click for details`;
    if (flag.entering) tag.setAttribute("data-pending", "");
    tag.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCard(flag);
    });
    tag.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the field
    this.layer.appendChild(tag);
    v = { tag, hls: [], flag };
    this.views.set(flag.id, v);
    return v;
  }

  // items: [{flag, rects}] for every visible flag on the page.
  render(items) {
    if (!this.host) return;
    const seen = new Set();
    const placed = [];
    const sorted = [...items].sort((a, b) => (a.rects[0]?.top ?? 0) - (b.rects[0]?.top ?? 0) || (a.rects[0]?.left ?? 0) - (b.rects[0]?.left ?? 0));
    for (const { flag, rects } of sorted) {
      const v = this.view(flag);
      v.flag = flag;
      seen.add(flag.id);

      while (v.hls.length > rects.length) v.hls.pop().remove();
      while (v.hls.length < rects.length) {
        const hl = document.createElement("div");
        hl.className = "ctp-hl";
        if (flag.entering) hl.setAttribute("data-pending", "");
        this.layer.insertBefore(hl, this.layer.firstChild);
        v.hls.push(hl);
      }
      rects.forEach((r, i) => {
        const s = v.hls[i].style;
        s.left = `${r.left - 1}px`;
        s.top = `${r.top}px`;
        s.width = `${r.right - r.left + 2}px`;
        s.height = `${r.bottom - r.top + 1}px`;
      });

      if (!rects.length) {
        v.tag.style.display = "none";
        continue;
      }
      v.tag.style.display = "";
      const w = v.tag.offsetWidth;
      const first = rects[0];
      const last = rects[rects.length - 1];
      let left = first.left - 1;
      let top = first.top - TAG_HEIGHT - 6;
      let below = false;
      if (top < 4) {
        top = last.bottom + 6;
        below = true;
      }
      for (let tries = 0; tries < 8; tries++) {
        const hit = placed.find((p) => left < p.right + 4 && left + w > p.left - 4 && top < p.bottom && top + TAG_HEIGHT > p.top);
        if (!hit) break;
        left = hit.right + 6;
        if (left + w > window.innerWidth - 4) {
          left = first.left - 1;
          top += below ? TAG_HEIGHT + 4 : -(TAG_HEIGHT + 4);
        }
      }
      left = Math.min(Math.max(left, 4), window.innerWidth - w - 4);
      v.tag.style.left = `${left}px`;
      v.tag.style.top = `${top}px`;
      v.tag.toggleAttribute("data-below", below);
      placed.push({ left, top, right: left + w, bottom: top + TAG_HEIGHT });
    }
    for (const id of [...this.views.keys()]) {
      if (!seen.has(id)) this.removeView(id);
    }
    if (this.card) this.positionCard();
  }

  elements(flagId) {
    return this.views.get(flagId);
  }

  removeView(id, { animate = false } = {}) {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    if (this.cardFlag?.id === id) this.closeCard();
    for (const hl of v.hls) hl.remove();
    if (animate) {
      v.tag.classList.remove("ctp-tag--enter");
      v.tag.classList.add("ctp-tag--leave");
      setTimeout(() => v.tag.remove(), 400);
    } else {
      v.tag.remove();
    }
  }

  toggleCard(flag) {
    if (this.cardFlag?.id === flag.id) {
      this.closeCard();
      return;
    }
    this.closeCard();
    const info = FALLACIES[flag.type] ?? {};
    const card = document.createElement("div");
    card.className = "ctp-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", fallacyName(flag.type));
    const h = document.createElement("h3");
    h.textContent = fallacyName(flag.type);
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [
      info.blurb,
      flag.engine === "claude" ? `${flag.confidence === "high" ? "High" : "Medium"} confidence · Claude` : "Pattern match",
    ]
      .filter(Boolean)
      .join(" · ");
    const quote = document.createElement("p");
    quote.className = "quote";
    quote.textContent = `“${flag.quote}”`;
    const why = document.createElement("p");
    why.className = "why";
    why.textContent = flag.explanation;
    const ask = document.createElement("p");
    ask.className = "ask";
    const askLabel = document.createElement("b");
    askLabel.textContent = "Ask yourself";
    ask.append(askLabel, flag.question || info.question || "");
    const actions = document.createElement("div");
    actions.className = "actions";
    const mute = document.createElement("button");
    mute.type = "button";
    mute.dataset.action = "mute";
    mute.textContent = `Stop flagging ${fallacyName(flag.type)}`;
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "primary";
    ok.dataset.action = "dismiss";
    ok.textContent = "Got it";
    for (const b of [mute, ok]) b.addEventListener("mousedown", (e) => e.preventDefault());
    mute.addEventListener("click", () => {
      this.closeCard();
      this.onMute(flag);
    });
    ok.addEventListener("click", () => {
      this.closeCard();
      this.onDismiss(flag);
    });
    actions.append(mute, ok);
    card.append(h, meta, quote, why, ask, actions);
    this.layer.appendChild(card);
    this.card = card;
    this.cardFlag = flag;
    this.views.get(flag.id)?.tag.setAttribute("aria-expanded", "true");
    this.positionCard();
  }

  positionCard() {
    const v = this.views.get(this.cardFlag?.id);
    if (!v || v.tag.style.display === "none") {
      this.closeCard();
      return;
    }
    const t = v.tag.getBoundingClientRect();
    const c = this.card.getBoundingClientRect();
    let top = t.bottom + 8;
    if (top + c.height > window.innerHeight - 8) top = Math.max(t.top - c.height - 8, 8);
    const left = Math.min(Math.max(t.left, 8), window.innerWidth - c.width - 8);
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  closeCard() {
    if (!this.card) return;
    this.views.get(this.cardFlag?.id)?.tag.setAttribute("aria-expanded", "false");
    this.card.remove();
    this.card = null;
    this.cardFlag = null;
  }

  status(message) {
    this.mount();
    this.statusEl?.remove();
    const el = document.createElement("div");
    el.className = "ctp-status";
    el.textContent = message;
    this.layer.appendChild(el);
    this.statusEl = el;
    setTimeout(() => el.remove(), 6000);
  }

  clear() {
    for (const id of [...this.views.keys()]) this.removeView(id);
  }
}
