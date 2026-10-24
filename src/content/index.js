// Content script. Socrates looks at two kinds of text:
//
// Reading (on by default): the body of the email you open in Gmail, the main
// text of news articles and blog posts, Google Docs you have open, and any
// selection you ask about via the context menu. Navigation, share bars,
// captions and quoted replies are left out.
//
// Writing (off by default): text produced by trusted (real, not
// script-generated) keyboard input in fields and Google Docs. Text that was
// already there, text a page script inserts, quoted replies and, unless
// enabled, pasted text are folded into a per-field baseline and never sent.
// Password and payment-style fields are always ignored.
//
// Either way the text is analyzed in the background worker and flags are
// pinned onto the exact spans that may contain a reasoning error.

import { DEFAULT_SETTINGS } from "../shared/settings.js";
import { buildPassages, locateQuote, newSentenceKeys, sentenceKey, splitSentences } from "../shared/text.js";
import { prefersReducedMotion } from "./effects.js";
import { fieldFromEvent, fieldKind, rangeFromSegments, readField } from "./extract.js";
import { docsEditor, docsInputDocument, isDocsInputFrame, isGoogleDocs, readDocs } from "./gdocs.js";
import { Mirror, rectsForSpan } from "./geometry.js";
import { Overlay } from "./overlay.js";
import { blockAncestor, findArticle, gmailMessages, isArticleJunk, isGmail } from "./reader.js";

const EDIT_WINDOW_MS = 700;
// Docs repaints its text layer asynchronously, so give typing a longer window.
const DOCS_EDIT_WINDOW_MS = 1500;
const READ_DEBOUNCE_MS = 900;
// Finishing a sentence triggers a check almost immediately…
const SENTENCE_END_DELAY_MS = 150;
// …and steady typing without pauses still gets checked at least this often.
const MAX_WAIT_MS = 3000;
const POLL_MS = 500;
const DISCOVER_MS = 1500;
const STAGGER_MS = 650;
// Screen flash, shake and sound at most this often; other flags just stamp.
const LEAD_COOLDOWN_MS = 5000;
const NOUNS = { email: "email", article: "article", docs: "document" };

let settings = { ...DEFAULT_SETTINGS };
const fields = new Map();
let nextFlagId = 1;
let renderQueued = false;
let nextEntranceAt = 0;
let lastLeadAt = -Infinity;
let lastDiscover = 0;
let savedSelection = null;

const overlay = new Overlay({
  onDismiss(flag) {
    flag.field.dismissed.add(flag.key);
    removeFlag(flag.field, flag, { celebrate: false });
  },
  onMute(flag) {
    const mutedTypes = [...new Set([...settings.mutedTypes, flag.type])];
    chrome.storage.local.set({ mutedTypes });
  },
  onNext: scrollToNextFlag,
});

function active() {
  if (!settings.enabled) return false;
  const host = location.hostname;
  return !settings.blockedSites.some((s) => s && (host === s || host.endsWith(`.${s}`)));
}

function intensity() {
  return prefersReducedMotion() ? "subtle" : settings.intensity;
}

// --- Field state -----------------------------------------------------------
//
// A "field" is any element whose text Socrates analyzes. mode is "write" for
// the user's own input and "read" for things they're reading; source says
// where reading text came from (email, article, docs, selection, page).

function read(field) {
  if (field.kind === "gdocs") return readDocs();
  return readField(field.el, field.source === "article" || field.source === "page" ? { skip: isArticleJunk } : {});
}

function ensureField(el, { kind = fieldKind(el), mode = "write", source = "input", range = null } = {}) {
  let field = fields.get(el);
  if (field) return field;
  field = { el, kind, mode, source, range };
  const { text, segments } = read(field);
  Object.assign(field, {
    text,
    segments,
    // In writing mode, whatever is in the field before the user starts typing
    // isn't theirs. Reading mode analyzes everything.
    baseline: mode === "write" ? new Set(splitSentences(text).map((s) => sentenceKey(s.text))) : new Set(),
    // Sentences the user typed. Remembered so that text which scrolls out of
    // Google Docs' rendered pages and back in is still recognised as theirs.
    authored: new Set(),
    flags: new Map(),
    dismissed: new Set(),
    editUntil: 0,
    editKind: null,
    timer: null,
    seq: 0,
    mirror: null,
  });
  fields.set(el, field);
  if (mode === "read") scheduleAnalysis(field, source === "selection" || source === "page" ? 0 : READ_DEBOUNCE_MS);
  return field;
}

function dropField(field) {
  clearTimeout(field.timer);
  for (const flag of field.flags.values()) overlay.removeView(flag.id);
  field.mirror?.destroy();
  fields.delete(field.el);
}

function markEdit(field, kind) {
  field.editKind = kind;
  field.editUntil = performance.now() + (field.kind === "gdocs" ? DOCS_EDIT_WINDOW_MS : EDIT_WINDOW_MS);
}

function userAuthored(field) {
  if (performance.now() > field.editUntil) return false;
  return field.editKind === "type" || (field.editKind === "paste" && settings.checkPastes);
}

// Reads the field and reconciles everything with its new text.
function sync(field) {
  if (!field.el.isConnected) {
    dropField(field);
    return;
  }
  const { text, segments } = read(field);
  field.segments = segments;
  if (text === field.text) return;
  const reading = field.mode === "read";
  const typed = !reading && userAuthored(field);
  if (!reading) {
    for (const key of newSentenceKeys(field.text, text)) {
      if (typed) field.authored.add(key);
      else if (!field.authored.has(key)) field.baseline.add(key);
    }
  }
  // A field that was emptied (message sent) or mostly replaced isn't a "fix".
  const cleared = text.trim().length === 0 || text.length < field.text.length * 0.4;
  const prev = field.text;
  field.text = text;
  if (!text.trim() && field.kind !== "gdocs") {
    field.baseline.clear();
    field.authored.clear();
  }
  for (const flag of [...field.flags.values()]) {
    const loc = locateQuote(text, flag.quote, { hint: flag.start });
    if (loc) {
      flag.start = loc.start;
      flag.end = loc.end;
      flag.stale = false;
      flag.offscreen = false;
    } else if (typed && !cleared && prev.length > 0) {
      // The user is editing the flagged text. Hide the flag until the next
      // analysis decides whether it was fixed or just reworded.
      flag.stale = true;
    } else if (field.kind === "gdocs") {
      // Scrolled out of the pages Docs has rendered; it'll be back.
      flag.offscreen = true;
    } else {
      removeFlag(field, flag, { celebrate: false });
    }
  }
  if (typed || reading) {
    const base = typed ? settings.debounceMs : READ_DEBOUNCE_MS;
    scheduleAnalysis(field, endsSentence(prev, text) ? SENTENCE_END_DELAY_MS : base);
  }
  requestRender();
}

// True when the edit from prev to next just finished a sentence or line.
function endsSentence(prev, next) {
  if (next.length <= prev.length) return false;
  let i = 0;
  while (i < prev.length && prev[i] === next[i]) i++;
  const inserted = next.slice(i, i + next.length - prev.length);
  return /[.!?…\n]/.test(inserted);
}

// Debounced, but never postponed past MAX_WAIT_MS from the first request.
function scheduleAnalysis(field, delay) {
  const now = performance.now();
  field.waitingSince ??= now;
  const due = Math.min(now + delay, field.waitingSince + MAX_WAIT_MS);
  clearTimeout(field.timer);
  field.timer = setTimeout(() => {
    field.waitingSince = null;
    analyze(field);
  }, Math.max(0, due - now));
}

// --- Analysis --------------------------------------------------------------

function passagesFor(field) {
  const [from, to] = field.range ?? [0, field.text.length];
  const passages = buildPassages(field.text.slice(from, to), field.baseline).map((p) => ({ ...p, start: p.start + from, end: p.end + from }));
  if (field.mode !== "read") return passages;
  // Bound how much of a long article goes out in one go.
  const kept = [];
  let total = 0;
  for (const p of passages) {
    total += p.text.length;
    if (total > settings.maxReadChars) break;
    kept.push(p);
  }
  return kept;
}

async function analyze(field) {
  if (!active() || !field.el.isConnected) return;
  const text = field.text;
  const passages = passagesFor(field);
  const seq = ++field.seq;
  const explicit = field.source === "selection" || field.source === "page";
  if (!passages.length) {
    field.appliedSeq = seq;
    applyResults(field, [], null);
    if (explicit) overlay.status("There isn't enough text here for Socrates to look at.");
    return;
  }
  if (explicit) overlay.status("Socrates is reading…");
  else if (field.mode === "read" && !field.receipted) overlay.receipt(`Socrates is reading this ${NOUNS[field.source] ?? "page"}…`);
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "ctp:analyze",
      mode: field.mode,
      passages: passages.map(({ id, text: t }) => ({ id, text: t })),
    });
  } catch {
    return; // Extension was reloaded or updated; this content script is orphaned.
  }
  // Responses can overlap while the user keeps typing. Apply each one that's
  // newer than what's on screen, so flags keep arriving mid-stream.
  if (seq <= (field.appliedSeq ?? 0) || !response) return;
  field.appliedSeq = seq;
  if (response.error) {
    overlay.status(`Socrates couldn't check this text: ${response.error}`);
    return;
  }
  if (response.warning) maybeWarn(response);

  const results = [];
  for (const f of response.fallacies) {
    const p = passages.find((x) => x.id === f.passageId);
    if (!p) continue;
    let loc = { start: p.start + f.start, end: p.start + f.end };
    if (field.text !== text) loc = locateQuote(field.text, f.quote, { hint: loc.start });
    if (loc) results.push({ ...f, ...loc });
  }
  applyResults(field, results, response.engine === "ai" ? response.modelName : null);
  if (field.mode === "read" && !explicit && !field.receipted) {
    field.receipted = true;
    const noun = NOUNS[field.source] ?? "page";
    if (field.flags.size === 0) overlay.receipt(`Socrates read this ${noun}: nothing to question`, { done: true });
  }
  if (explicit) {
    const n = field.flags.size;
    overlay.status(n ? `Socrates has ${n} question${n === 1 ? "" : "s"} about this.` : "Nothing here that Socrates would question.");
  }
}

let warnedCode = null;
function maybeWarn(response) {
  if (warnedCode === response.errorCode) return;
  warnedCode = response.errorCode;
  overlay.status(`${response.provider} unavailable (${response.warning}). Using offline pattern checks for now.`);
}

// `checkedBy` is the model's display name, or null for offline patterns.
function applyResults(field, results, checkedBy) {
  const keep = new Set();
  let fresh = 0;
  for (const r of results) {
    if (settings.mutedTypes.includes(r.type)) continue;
    const key = `${r.type}|${sentenceKey(r.quote)}`;
    if (field.dismissed.has(key) || keep.has(key)) continue;
    keep.add(key);
    const existing = field.flags.get(key) ?? reworded(field, r);
    const details = {
      key,
      start: r.start,
      end: r.end,
      quote: r.quote,
      explanation: r.explanation,
      question: r.question,
      confidence: r.confidence,
      checkedBy,
      stale: false,
    };
    if (existing) {
      if (existing.key !== key) {
        field.flags.delete(existing.key);
        field.flags.set(key, existing);
      }
      Object.assign(existing, details);
    } else {
      field.flags.set(key, { id: nextFlagId++, field, type: r.type, entering: true, ...details });
      fresh++;
    }
  }
  for (const flag of [...field.flags.values()]) {
    if (!keep.has(flag.key) && !flag.offscreen) removeFlag(field, flag, { celebrate: field.mode === "write" });
  }
  if (fresh) {
    overlay.mount();
    renderNow();
  } else {
    requestRender();
  }
}

// A hidden (stale) flag of the same type near the new finding: the user
// reworded the sentence but the issue survived, so keep the flag quietly.
function reworded(field, r) {
  for (const flag of field.flags.values()) {
    if (flag.stale && flag.type === r.type && r.start <= flag.end + 40 && r.end >= flag.start - 40) return flag;
  }
  return null;
}

// New flags make their entrance the first time they're on screen, one at a
// time, so reading down an article stamps each issue as you reach it.
function queueEntrance(flag) {
  flag.queued = true;
  const now = performance.now();
  const at = Math.max(now, nextEntranceAt);
  nextEntranceAt = at + STAGGER_MS;
  setTimeout(() => enter(flag), at - now);
}

function enter(flag) {
  flag.entering = false;
  const v = overlay.elements(flag.id);
  if (!v || !flag.field.flags.has(flag.key)) return;
  const lead = performance.now() - lastLeadAt > LEAD_COOLDOWN_MS;
  if (lead) lastLeadAt = performance.now();
  overlay.effects.entrance({
    flag,
    rects: flagRects(flag),
    tagEl: v.tag,
    hlEls: v.hls,
    field: shakeTarget(flag),
    intensity: intensity(),
    sound: settings.sound,
    lead,
  });
}

function anchorElement(flag) {
  if (flag.field.kind !== "ce") return null;
  const range = rangeFromSegments(flag.field.segments, flag.start, flag.end);
  return range ? blockAncestor(range.startContainer) : null;
}

function shakeTarget(flag) {
  if (flag.field.mode === "read") return anchorElement(flag) ?? flag.field.el;
  return flag.field.el;
}

function removeFlag(field, flag, { celebrate }) {
  if (!field.flags.has(flag.key)) return;
  const rect = celebrate ? flag.lastRect : null;
  field.flags.delete(flag.key);
  overlay.removeView(flag.id, { animate: celebrate });
  if (rect) overlay.effects.resolved({ rect, sound: settings.sound && intensity() !== "subtle" });
}

// Goes to the first flag the reader hasn't seen yet, otherwise the next one
// below the middle of the screen, wrapping around to the top.
function scrollToNextFlag() {
  const anchors = [];
  for (const field of fields.values()) {
    if (field.mode !== "read") continue;
    for (const flag of field.flags.values()) {
      const el = anchorElement(flag);
      if (el) anchors.push({ el, top: el.getBoundingClientRect().top, unseen: flag.entering && !flag.queued });
    }
  }
  if (!anchors.length) return;
  anchors.sort((a, b) => a.top - b.top);
  const next = anchors.find((a) => a.unseen) ?? anchors.find((a) => a.top > window.innerHeight * 0.55) ?? anchors[0];
  next.el.scrollIntoView({ block: "center", behavior: "smooth" });
}

// --- Rendering -------------------------------------------------------------

function flagRects(flag) {
  const field = flag.field;
  if (field.kind === "textarea" || field.kind === "input") {
    field.mirror ??= new Mirror(overlay.mirrors);
    field.mirror.sync(field.el, field.text);
  }
  return rectsForSpan(field, flag.start, flag.end);
}

function renderNow() {
  renderQueued = false;
  if (!overlay.host) return;
  const items = [];
  let readingFlags = 0;
  for (const field of fields.values()) {
    for (const flag of field.flags.values()) {
      if (field.mode === "read" && field.kind !== "gdocs") readingFlags++;
      if (flag.stale || flag.offscreen) continue;
      const rects = flagRects(flag);
      if (rects.length) flag.lastRect = rects[0];
      items.push({ flag, rects });
    }
  }
  overlay.render(items);
  overlay.navigator(readingFlags);
  for (const { flag, rects } of items) {
    if (flag.entering && !flag.queued && rects.length) queueEntrance(flag);
  }
}

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderNow);
}

function clearAll() {
  for (const field of [...fields.values()]) dropField(field);
  overlay.clear();
}

// --- Writing: events ---------------------------------------------------------

function writing() {
  return active() && settings.checkWriting;
}

function onFocusIn(e) {
  if (!writing()) return;
  const el = fieldFromEvent(e);
  if (el) ensureField(el);
}

function onBeforeInput(e) {
  if (!e.isTrusted || !writing()) return;
  const el = fieldFromEvent(e);
  if (!el) return;
  const field = ensureField(el);
  markEdit(field, /^insertFrom(Paste|Drop|PasteAsQuotation)$/.test(e.inputType) ? "paste" : "type");
  // Some editors cancel beforeinput and apply the change themselves.
  setTimeout(() => sync(field), 0);
  setTimeout(() => sync(field), 150);
}

function onInput(e) {
  if (!e.isTrusted || !writing()) return;
  const el = fieldFromEvent(e);
  if (!el) return;
  const field = ensureField(el);
  if (performance.now() > field.editUntil) markEdit(field, /paste|drop/i.test(e.inputType ?? "") ? "paste" : "type");
  sync(field);
}

function onKeyDown(e) {
  if (!e.isTrusted || !writing()) return;
  const el = fieldFromEvent(e);
  if (!el) return;
  const field = ensureField(el);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") markEdit(field, "paste");
  else if (e.key.length === 1 || ["Backspace", "Delete", "Enter"].includes(e.key)) markEdit(field, "type");
}

function onPasteOrDrop(e) {
  if (!e.isTrusted || !writing()) return;
  const el = fieldFromEvent(e);
  if (el) markEdit(ensureField(el), "paste");
}

// --- Google Docs -----------------------------------------------------------

const watchedDocsInputs = new WeakSet();

function docsTyping(field, e) {
  if (!e.isTrusted || !active()) return;
  if (e.type === "keydown") {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") markEdit(field, "paste");
    else if (e.key.length === 1 || ["Backspace", "Delete", "Enter"].includes(e.key)) markEdit(field, "type");
    else return;
  } else if (e.type === "paste" || e.type === "drop") {
    markEdit(field, "paste");
  } else if (e.type === "beforeinput") {
    markEdit(field, /^insertFrom(Paste|Drop|PasteAsQuotation)$/.test(e.inputType) ? "paste" : "type");
  }
  for (const ms of [60, 250, 700, 1200]) setTimeout(() => sync(field), ms);
}

// In reading mode a Doc is analyzed in full; in writing-only mode just what
// the user types into it.
function attachDocs() {
  const mode = settings.checkDocs ? "read" : settings.checkWriting ? "write" : null;
  if (!mode) return;
  const editor = docsEditor();
  if (!editor) return;
  const field = ensureField(editor, { kind: "gdocs", mode, source: "docs" });
  const doc = docsInputDocument();
  if (!doc || watchedDocsInputs.has(doc)) return;
  watchedDocsInputs.add(doc);
  for (const type of ["keydown", "beforeinput", "paste", "drop"]) {
    doc.addEventListener(type, (e) => docsTyping(field, e), true);
  }
}

// --- Reading: discovery ----------------------------------------------------

function discover() {
  if (isGmail()) {
    if (settings.checkEmails) for (const el of gmailMessages()) ensureField(el, { kind: "ce", mode: "read", source: "email" });
    return;
  }
  if (!settings.checkArticles || [...fields.values()].some((f) => f.source === "article")) return;
  const article = findArticle();
  if (article) ensureField(article, { kind: "ce", mode: "read", source: "article" });
}

function checkPage() {
  const el = findArticle({ minChars: 150 }) ?? document.body;
  const existing = fields.get(el);
  if (existing) {
    scheduleAnalysis(existing, 0);
    return;
  }
  ensureField(el, { kind: "ce", mode: "read", source: "page" });
}

// Remembers what was selected when the context menu opened, since the
// selection can be gone by the time the menu item is clicked.
function onContextMenu(e) {
  if (!e.isTrusted) return;
  const sel = getSelection();
  savedSelection = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
}

function offsetIn(segments, node, offset) {
  for (const seg of segments ?? []) {
    if (seg.node === node) return seg.start + Math.min(offset, seg.node.data.length);
  }
  return null;
}

function checkSelection() {
  const sel = getSelection();
  const range = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : savedSelection;
  if (!range) return;
  const el = blockAncestor(range.commonAncestorContainer);
  const existing = fields.get(el);
  if (existing) dropField(existing);
  const { segments, text } = readField(el);
  const from = offsetIn(segments, range.startContainer, range.startOffset) ?? 0;
  const to = offsetIn(segments, range.endContainer, range.endOffset) ?? text.length;
  ensureField(el, { kind: "ce", mode: "read", source: "selection", range: [from, Math.max(from, to)] });
}

// What Socrates is doing on this page, for the popup.
function pageStatus() {
  return {
    active: active(),
    sources: [...fields.values()].map((f) => ({
      source: f.source,
      mode: f.mode,
      chars: f.text.length,
      checked: Boolean(f.appliedSeq),
      questions: f.flags.size,
    })),
  };
}

function poll() {
  // Docs must be hooked up before the first keystroke, so check every tick.
  if (active() && isGoogleDocs()) attachDocs();
  else if (active() && performance.now() - lastDiscover > DISCOVER_MS) {
    lastDiscover = performance.now();
    discover();
  }
  for (const field of [...fields.values()]) sync(field);
  if (overlay.host && [...fields.values()].some((f) => f.flags.size)) requestRender();
}

function start() {
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("beforeinput", onBeforeInput, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("paste", onPasteOrDrop, true);
  document.addEventListener("drop", onPasteOrDrop, true);
  document.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("scroll", requestRender, { capture: true, passive: true });
  window.addEventListener("resize", requestRender, { passive: true });
  setInterval(poll, POLL_MS);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "ctp:status" && window === window.top) {
      sendResponse(pageStatus());
      return;
    }
    if (!active()) return;
    if (msg?.type === "ctp:checkSelection") checkSelection();
    if (msg?.type === "ctp:checkPage" && window === window.top) checkPage();
  });
}

if (!isDocsInputFrame()) start();

chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS)).then((stored) => {
  settings = { ...DEFAULT_SETTINGS, ...stored };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [k, { newValue }] of Object.entries(changes)) {
    if (k in DEFAULT_SETTINGS) settings[k] = newValue ?? DEFAULT_SETTINGS[k];
  }
  const sources = ["enabled", "blockedSites", "checkEmails", "checkArticles", "checkDocs", "checkWriting"];
  if (!active() || sources.some((k) => k in changes)) {
    clearAll();
    return;
  }
  if (changes.mutedTypes) {
    for (const field of fields.values()) {
      for (const flag of [...field.flags.values()]) {
        if (settings.mutedTypes.includes(flag.type)) removeFlag(field, flag, { celebrate: false });
      }
    }
  }
});
