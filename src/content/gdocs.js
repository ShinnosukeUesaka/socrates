// Google Docs paints text onto a <canvas>, so there's no DOM text to read or
// measure. In "annotated canvas" mode (switched on by docs-annotate.js) Docs
// also keeps an invisible SVG layer in sync: one <rect> per run of text on a
// line, with the text in aria-label and its font in data-font-css. We read the
// document's visible text from that layer and measure spans against it.

const EDITOR_SELECTOR = ".kix-appview-editor";
const INPUT_IFRAME_SELECTOR = "iframe.docs-texteventtarget-iframe";

export function isGoogleDocs() {
  return location.hostname === "docs.google.com" && location.pathname.startsWith("/document/");
}

export function docsEditor() {
  return document.querySelector(EDITOR_SELECTOR);
}

// Docs routes every keystroke through a hidden iframe. Returns its document
// so the caller can listen for trusted typing there.
export function docsInputDocument() {
  try {
    return document.querySelector(INPUT_IFRAME_SELECTOR)?.contentDocument ?? null;
  } catch {
    return null;
  }
}

// True inside Docs' hidden keystroke iframe, where the generic field logic
// must stay out of the way (its contenteditable is emptied after every key).
export function isDocsInputFrame() {
  try {
    return Boolean(window.frameElement?.classList.contains("docs-texteventtarget-iframe"));
  } catch {
    return false;
  }
}

// Returns the visible document text plus {rect, start, text, font} segments.
// Paragraphs are separated by a blank line and wrapped lines by a space, so
// sentences read naturally and paragraphs become separate passages.
export function readDocs() {
  const groups = [...document.querySelectorAll(`${EDITOR_SELECTOR} g[role="paragraph"]`)]
    .map((g) => ({ g, box: g.getBoundingClientRect() }))
    .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  let text = "";
  const segments = [];
  for (const { g } of groups) {
    const rects = g.querySelectorAll("rect[aria-label]");
    if (!rects.length) continue;
    if (text) text += "\n\n";
    let lastTop = null;
    for (const rect of rects) {
      const label = rect.getAttribute("aria-label");
      if (!label) continue;
      const top = rect.getBoundingClientRect().top;
      if (lastTop !== null && Math.abs(top - lastTop) > 2 && !/\s$/.test(text)) text += " ";
      segments.push({ rect, start: text.length, text: label, font: rect.getAttribute("data-font-css") || "" });
      text += label;
      lastTop = top;
    }
  }
  return { text, segments };
}

let measureCtx;
function measure(font, s) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  return measureCtx.measureText(s).width;
}

// Viewport rectangles for [start, end) of the text returned by readDocs().
// Widths are measured with the run's own font, then scaled to the rect's
// on-screen width so Docs' zoom level doesn't matter.
export function docsRects(segments, start, end) {
  const out = [];
  for (const seg of segments ?? []) {
    const segEnd = seg.start + seg.text.length;
    if (segEnd <= start || seg.start >= end || !seg.rect.isConnected) continue;
    const box = seg.rect.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const full = measure(seg.font, seg.text);
    const scale = full ? box.width / full : 1;
    const a = Math.max(start, seg.start) - seg.start;
    const b = Math.min(end, segEnd) - seg.start;
    out.push({
      left: box.left + measure(seg.font, seg.text.slice(0, a)) * scale,
      right: box.left + measure(seg.font, seg.text.slice(0, b)) * scale,
      top: box.top,
      bottom: box.bottom,
      width: 0,
      height: box.height,
    });
  }
  for (const r of out) r.width = r.right - r.left;
  return out;
}
