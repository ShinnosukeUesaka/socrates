// Turns text offsets inside a field into on-screen rectangles.
// Textareas and inputs don't expose layout for their text, so we lay the same
// text out in an invisible "mirror" div with identical metrics stacked exactly
// over the field, and measure that instead.

import { fieldKind, rangeFromSegments } from "./extract.js";

const COPIED_PROPS = [
  "direction", "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust",
  "lineHeight", "fontFamily", "fontFeatureSettings", "fontKerning", "fontVariationSettings", "textAlign",
  "textTransform", "textIndent", "letterSpacing", "wordSpacing", "tabSize", "wordBreak", "textRendering",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
];

const px = (v) => parseFloat(v) || 0;

export class Mirror {
  constructor(container) {
    this.div = document.createElement("div");
    this.div.className = "ctp-mirror";
    container.appendChild(this.div);
    this.text = null;
  }

  sync(el, text) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const s = this.div.style;
    for (const p of COPIED_PROPS) s[p] = cs[p];
    s.borderStyle = "solid";
    s.borderColor = "transparent";
    s.boxSizing = "border-box";
    s.left = `${r.left}px`;
    s.top = `${r.top}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
    // Without a scrollbar of its own, the mirror pads by the field's scrollbar
    // width so lines wrap at exactly the same place.
    const scrollbar = el.offsetWidth - el.clientWidth - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
    s.paddingRight = `${px(cs.paddingRight) + Math.max(0, scrollbar)}px`;
    if (fieldKind(el) === "input") {
      s.whiteSpace = "pre";
      const inner = r.height - px(cs.paddingTop) - px(cs.paddingBottom) - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
      s.lineHeight = `${Math.max(inner, 0)}px`;
    } else {
      s.whiteSpace = "pre-wrap";
      s.overflowWrap = "break-word";
    }
    if (this.text !== text) {
      // The zero-width tail keeps a trailing newline from collapsing.
      this.div.textContent = `${text}​`;
      this.text = text;
    }
    this.div.scrollTop = el.scrollTop;
    this.div.scrollLeft = el.scrollLeft;
  }

  rects(start, end) {
    const node = this.div.firstChild;
    if (!node) return [];
    const range = document.createRange();
    range.setStart(node, Math.min(start, node.data.length));
    range.setEnd(node, Math.min(end, node.data.length));
    return [...range.getClientRects()];
  }

  destroy() {
    this.div.remove();
  }
}

// Visible box of the field's text area, in viewport coordinates.
export function clipBox(el) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const scrollbarY = el.offsetWidth - el.clientWidth - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
  const scrollbarX = el.offsetHeight - el.clientHeight - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
  return {
    left: Math.max(r.left + px(cs.borderLeftWidth), 0),
    top: Math.max(r.top + px(cs.borderTopWidth), 0),
    right: Math.min(r.right - px(cs.borderRightWidth) - Math.max(0, scrollbarY), window.innerWidth),
    bottom: Math.min(r.bottom - px(cs.borderBottomWidth) - Math.max(0, scrollbarX), window.innerHeight),
  };
}

// Merges per-node fragments into one rectangle per visual line.
export function mergeLineRects(rects) {
  const lines = [];
  const sorted = rects
    .filter((r) => r.width > 0.5 && r.height > 0.5)
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
    .sort((a, b) => a.top - b.top || a.left - b.left);
  for (const r of sorted) {
    const line = lines.find((l) => {
      const overlap = Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top);
      return overlap > 0.5 * Math.min(l.bottom - l.top, r.bottom - r.top) && r.left <= l.right + 4 && r.right >= l.left - 4;
    });
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    } else {
      lines.push({ ...r });
    }
  }
  return lines;
}

function clip(rect, box) {
  const left = Math.max(rect.left, box.left);
  const right = Math.min(rect.right, box.right);
  const top = Math.max(rect.top, box.top);
  const bottom = Math.min(rect.bottom, box.bottom);
  if (right - left < 1 || bottom - top < 1) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

// Viewport rectangles covering [start, end) of the field's text, one per line,
// clipped to what's actually visible.
export function rectsForSpan(field, start, end) {
  const { el } = field;
  let raw;
  if (field.kind === "ce") {
    const range = rangeFromSegments(field.segments, start, end);
    raw = range ? [...range.getClientRects()] : [];
  } else {
    raw = field.mirror.rects(start, end);
  }
  const box = clipBox(el);
  return mergeLineRects(raw)
    .map((r) => clip(r, box))
    .filter(Boolean);
}
