// A single fixed, full-viewport layer (inside a shadow root so page CSS can't
// touch it) that draws highlights, tags and the explanation card.

import { categoryName, FALLACIES, possibleName } from "../shared/fallacies.js";
import { Effects } from "./effects.js";
import { OVERLAY_CSS } from "./styles.js";

const TAG_HEIGHT = 20;
const ICON_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.2" fill="currentColor" opacity=".25"/><path fill="currentColor" d="M7.1 10.2v-.5c0-.9.4-1.5 1.2-2 .6-.4.9-.7.9-1.2 0-.6-.5-1-1.2-1-.7 0-1.2.4-1.3 1.1H5.1C5.2 5 6.4 4 8.1 4c1.7 0 2.8.9 2.8 2.3 0 1-.5 1.6-1.3 2.1-.6.4-.8.6-.8 1.2v.6H7.1Zm-.1 1.1h1.8V13H7v-1.7Z"/></svg>';

export class Overlay {
  constructor({ onDismiss, onMute, onNext }) {
    this.onDismiss = onDismiss;
    this.onMute = onMute;
    this.onNext = onNext;
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
    tag.append(possibleName(flag.type));
    tag.title = `${possibleName(flag.type)}: click to see Socrates' question`;
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
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };
    const card = el("div", "ctp-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", possibleName(flag.type));
    const yours = el("p", "label", "Your reasoning");
    const quote = el("p", "quote", `“${flag.quote}”`);
    const chip = el("span", "chip", categoryName(flag.type));
    const h = el("h3", null, possibleName(flag.type));
    const why = el("p", "why", flag.explanation || info.blurb);
    const ask = el("div", "ask");
    ask.append(el("p", "label", "Socrates asks"), el("p", "question", flag.question || info.question || ""));
    const meta = el(
      "p",
      "meta",
      flag.checkedBy ? `${flag.confidence === "high" ? "Clear case" : "Depends on context"} · checked by ${flag.checkedBy}` : "Offline pattern check",
    );
    const actions = el("div", "actions");
    const mute = el("button", null, "Don't flag this kind");
    mute.type = "button";
    mute.dataset.action = "mute";
    const ok = el("button", "primary", "Got it");
    ok.type = "button";
    ok.dataset.action = "dismiss";
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
    card.append(yours, quote, chip, h, why, ask, meta, actions);
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

  // A small pill counting the questions on the page; clicking it scrolls to
  // the next flagged passage.
  navigator(count) {
    if (!this.host) return;
    if (!count) {
      this.navEl?.remove();
      this.navEl = null;
      return;
    }
    if (!this.navEl) {
      this.navEl = document.createElement("button");
      this.navEl.type = "button";
      this.navEl.className = "ctp-nav";
      this.navEl.addEventListener("click", () => this.onNext?.());
      this.layer.appendChild(this.navEl);
    }
    const label = `${count} question${count === 1 ? "" : "s"} on this page`;
    if (this.navEl.dataset.label !== label) {
      this.navEl.dataset.label = label;
      this.navEl.innerHTML = ICON_SVG;
      this.navEl.append(label, Object.assign(document.createElement("span"), { textContent: "Next ↓" }));
    }
  }

  clear() {
    for (const id of [...this.views.keys()]) this.removeView(id);
    this.navigator(0);
  }
}
