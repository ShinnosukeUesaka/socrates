// Pure text helpers shared by the content script, the background worker and
// the tests: sentence splitting, quote location, and deciding which parts of a
// field the user actually wrote.

const SENTENCE_RE = /[^.!?…\n]+(?:[.!?…]+["'”’)\]]*)?|[.!?…]+/g;
const HAS_WORD_RE = /[\p{L}\p{N}]/u;
const PARAGRAPH_BREAK_RE = /\n\s*\n/;

export const MAX_PASSAGE_CHARS = 1200;
export const MIN_PASSAGE_WORDS = 3;

export function splitSentences(text) {
  const out = [];
  SENTENCE_RE.lastIndex = 0;
  let m;
  while ((m = SENTENCE_RE.exec(text))) {
    let start = m.index;
    let end = m.index + m[0].length;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    const slice = text.slice(start, end);
    if (end > start && HAS_WORD_RE.test(slice)) out.push({ start, end, text: slice });
  }
  return out;
}

export function wordCount(text) {
  return text.split(/\s+/).filter((w) => HAS_WORD_RE.test(w)).length;
}

const CHAR_FOLD = {
  "‘": "'", "’": "'", "‛": "'", "′": "'", "`": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "‒": "-",
};

// Lowercases, folds typographic punctuation and collapses whitespace, keeping
// a map from each normalized char back to its index in the source string.
export function normalizeWithMap(s) {
  let norm = "";
  const map = [];
  let lastWasSpace = false;
  for (let i = 0; i < s.length; i++) {
    let ch = s[i];
    if (ch === "​" || ch === "‌" || ch === "‍" || ch === "﻿") continue;
    if (ch === "…") {
      norm += "...";
      map.push(i, i, i);
      lastWasSpace = false;
      continue;
    }
    ch = CHAR_FOLD[ch] ?? ch;
    if (/\s/.test(ch)) {
      if (lastWasSpace || norm.length === 0) continue;
      norm += " ";
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    norm += ch.toLowerCase();
    map.push(i);
    lastWasSpace = false;
  }
  if (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    map.pop();
  }
  return { norm, map };
}

export function normalize(s) {
  return normalizeWithMap(s).norm;
}

export function sentenceKey(s) {
  return normalize(s).replace(/[.!?…\s]+$/, "");
}

function allIndexes(haystack, needle) {
  const out = [];
  if (!needle) return out;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return out;
}

function nearest(candidates, hint) {
  let best = null;
  for (const c of candidates) {
    if (best === null || Math.abs(c.start - hint) < Math.abs(best.start - hint)) best = c;
  }
  return best;
}

function cleanQuote(quote) {
  return String(quote ?? "")
    .trim()
    .replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "")
    .replace(/^(\.\.\.|…)\s*|\s*(\.\.\.|…)$/g, "")
    .trim();
}

function locateExactOrNormalized(text, quote, hint) {
  const exact = allIndexes(text, quote).map((i) => ({ start: i, end: i + quote.length }));
  if (exact.length) return nearest(exact, hint);

  const { norm, map } = normalizeWithMap(text);
  const nq = normalize(quote);
  if (!nq) return null;
  const fuzzy = allIndexes(norm, nq).map((i) => ({ start: map[i], end: map[i + nq.length - 1] + 1 }));
  return fuzzy.length ? nearest(fuzzy, hint) : null;
}

// Finds `quote` inside `text`, tolerating case, whitespace, curly quotes and an
// elided middle ("first part ... last part"). Returns {start, end} or null.
export function locateQuote(text, quote, { hint = 0, within } = {}) {
  const offset = within ? within[0] : 0;
  const scope = within ? text.slice(within[0], within[1]) : text;
  const q = cleanQuote(quote);
  if (!q) return null;
  const localHint = hint - offset;

  let found = locateExactOrNormalized(scope, q, localHint);
  if (!found && /\.\.\.|…/.test(q)) {
    const parts = q.split(/\s*(?:\.\.\.|…)\s*/).filter(Boolean);
    if (parts.length >= 2) {
      const first = locateExactOrNormalized(scope, parts[0], localHint);
      if (first) {
        const rest = scope.slice(first.end);
        const last = locateExactOrNormalized(rest, parts[parts.length - 1], 0);
        if (last) found = { start: first.start, end: first.end + last.end };
      }
    }
  }
  return found ? { start: found.start + offset, end: found.end + offset } : null;
}

// Sentences that appear in `nextText` but not in `prevText`. Used to fold
// text the user did not type (pre-filled drafts, pastes, app-inserted
// templates) into the baseline so it is never analyzed.
export function newSentenceKeys(prevText, nextText) {
  const before = new Set(splitSentences(prevText).map((s) => sentenceKey(s.text)));
  return splitSentences(nextText)
    .map((s) => sentenceKey(s.text))
    .filter((k) => k && !before.has(k));
}

// Groups the sentences the user wrote (anything not in `baseline`) into
// passages: contiguous runs inside one paragraph, capped in length so that
// unchanged chunks hit the analysis cache.
export function buildPassages(text, baseline = new Set()) {
  const passages = [];
  let cur = null;
  const close = () => {
    if (cur && wordCount(text.slice(cur.start, cur.end)) >= MIN_PASSAGE_WORDS) {
      passages.push({ id: `p${passages.length}`, start: cur.start, end: cur.end, text: text.slice(cur.start, cur.end) });
    }
    cur = null;
  };
  for (const s of splitSentences(text)) {
    if (baseline.has(sentenceKey(s.text))) {
      close();
      continue;
    }
    const contiguous = cur && !PARAGRAPH_BREAK_RE.test(text.slice(cur.end, s.start));
    if (contiguous && s.end - cur.start <= MAX_PASSAGE_CHARS) {
      cur.end = s.end;
    } else {
      close();
      cur = { start: s.start, end: s.end };
    }
  }
  close();
  return passages;
}
