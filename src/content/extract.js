// Finding the fields the user types into, reading their text, and mapping text
// offsets back to DOM ranges for contenteditable editors.

const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);
const SENSITIVE_RE = /pass|card|cvv|cvc|ssn|social.?security|otp|one.?time|token|secret|iban|routing|account.?num|pin\b/i;
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE",
  "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
  "PRE", "SECTION", "TABLE", "TR", "UL",
]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "BLOCKQUOTE", "CTP-OVERLAY"]);

export function fieldKind(el) {
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLInputElement) return "input";
  return "ce";
}

function looksSensitive(el) {
  const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
  if (/cc-|one-time-code|new-password|current-password/.test(autocomplete)) return true;
  const hints = [el.name, el.id, el.getAttribute("aria-label"), el.getAttribute("placeholder")].filter(Boolean).join(" ");
  return SENSITIVE_RE.test(hints);
}

export function isAllowedField(el) {
  if (!el || el.closest?.("[data-ctp-ignore]")) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled && !looksSensitive(el);
  if (el instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has((el.getAttribute("type") || "").toLowerCase()) && !el.readOnly && !el.disabled && !looksSensitive(el);
  }
  return Boolean(el.isContentEditable);
}

// Resolves an event to the editable field it happened in (or null). Uses the
// composed path so editors inside open shadow roots are found too.
export function fieldFromEvent(e) {
  const origin = e.composedPath?.()[0] ?? e.target;
  let el = origin?.nodeType === Node.ELEMENT_NODE ? origin : origin?.parentElement;
  if (!el) return null;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return isAllowedField(el) ? el : null;
  if (!el.isContentEditable) return null;
  while (el.parentElement?.isContentEditable) el = el.parentElement;
  return isAllowedField(el) ? el : null;
}

function skipElement(el) {
  return (
    SKIP_TAGS.has(el.tagName) ||
    el.classList.contains("gmail_quote") ||
    el.getAttribute("contenteditable") === "false" ||
    el.hasAttribute("data-ctp-ignore")
  );
}

// Returns the field's text plus, for contenteditable, a list of
// {node, start} segments mapping text offsets back to DOM text nodes.
// Quoted replies (blockquote, Gmail quotes) are left out entirely.
export function readField(el) {
  const kind = fieldKind(el);
  if (kind !== "ce") return { text: el.value ?? "", segments: null };

  let text = "";
  const segments = [];
  const breakLine = () => {
    if (text.length && !text.endsWith("\n")) text += "\n";
  };
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.data) continue;
        segments.push({ node: child, start: text.length });
        text += child.data;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === "BR") {
          text += "\n";
          continue;
        }
        const block = BLOCK_TAGS.has(child.tagName);
        if (skipElement(child)) {
          if (block) breakLine();
          continue;
        }
        if (block) breakLine();
        walk(child);
        if (block) breakLine();
      }
    }
  };
  walk(el);
  return { text, segments };
}

// Converts [start, end) text offsets into a DOM Range over the segments.
export function rangeFromSegments(segments, start, end) {
  if (!segments?.length) return null;
  let startSeg = null;
  let endSeg = null;
  for (const seg of segments) {
    const segEnd = seg.start + seg.node.data.length;
    if (!startSeg && segEnd > start) startSeg = seg;
    if (seg.start < end) endSeg = seg;
  }
  if (!startSeg || !endSeg) return null;
  if (!startSeg.node.isConnected || !endSeg.node.isConnected) return null;
  const range = document.createRange();
  const startOffset = Math.max(0, start - startSeg.start);
  const endOffset = Math.min(endSeg.node.data.length, end - endSeg.start);
  try {
    range.setStart(startSeg.node, Math.min(startOffset, startSeg.node.data.length));
    range.setEnd(endSeg.node, Math.max(0, endOffset));
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}
