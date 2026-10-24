// Content script: watches only text the user types into fields on the page
// (and into Google Docs), asks the background worker to analyze it, and pins
// dramatic flags onto the exact spans that may contain a reasoning error.
//
// What counts as "written by the user": text produced by trusted (real,
// not script-generated) keyboard/input events. Text that was already in a
// field when it was focused, text a page script inserts, quoted replies and,
// unless enabled in settings, pasted text are folded into a per-field
// baseline and never sent for analysis. Passwords and payment-style fields
// are ignored entirely, and page content outside editable fields is never read.

import { DEFAULT_SETTINGS } from "../shared/settings.js";
import { buildPassages, locateQuote, newSentenceKeys, sentenceKey, splitSentences } from "../shared/text.js";
import { prefersReducedMotion } from "./effects.js";
import { fieldFromEvent, fieldKind, readField } from "./extract.js";
import { docsEditor, docsInputDocument, isDocsInputFrame, isGoogleDocs, readDocs } from "./gdocs.js";
import { Mirror, rectsForSpan } from "./geometry.js";
import { Overlay } from "./overlay.js";

const EDIT_WINDOW_MS = 700;
// Docs repaints its text layer asynchronously, so give typing a longer window.
const DOCS_EDIT_WINDOW_MS = 1500;
const POLL_MS = 500;
const STAGGER_MS = 650;

let settings = { ...DEFAULT_SETTINGS };
const fields = new Map();
let nextFlagId = 1;
let renderQueued = false;

const overlay = new Overlay({
  onDismiss(flag) {
    flag.field.dismissed.add(flag.key);
    removeFlag(flag.field, flag, { celebrate: false });
  },
  onMute(flag) {
    const mutedTypes = [...new Set([...settings.mutedTypes, flag.type])];
    chrome.storage.local.set({ mutedTypes });
  },
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

function read(field) {
  return field.kind === "gdocs" ? readDocs() : readField(field.el);
}

function ensureField(el, kind = fieldKind(el)) {
  let field = fields.get(el);
  if (field) return field;
  field = { el, kind };
  const { text, segments } = read(field);
  Object.assign(field, {
    text,
    segments,
    // Whatever is in the field before the user starts typing isn't theirs.
    baseline: new Set(splitSentences(text).map((s) => sentenceKey(s.text))),
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
  const typed = userAuthored(field);
  for (const key of newSentenceKeys(field.text, text)) {
    if (typed) field.authored.add(key);
    else if (!field.authored.has(key)) field.baseline.add(key);
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
  if (typed) scheduleAnalysis(field);
  requestRender();
}

function scheduleAnalysis(field) {
  clearTimeout(field.timer);
  field.timer = setTimeout(() => analyze(field), settings.debounceMs);
}

// --- Analysis --------------------------------------------------------------

async function analyze(field) {
  if (!active() || !field.el.isConnected) return;
  const text = field.text;
  const passages = buildPassages(text, field.baseline);
  const seq = ++field.seq;
  if (!passages.length) {
    applyResults(field, [], null);
    return;
  }
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "ctp:analyze",
      passages: passages.map(({ id, text: t }) => ({ id, text: t })),
    });
  } catch {
    return; // Extension was reloaded or updated; this content script is orphaned.
  }
  if (seq !== field.seq || !response) return;
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
  const fresh = [];
  for (const r of results) {
    if (settings.mutedTypes.includes(r.type)) continue;
    const key = `${r.type}|${sentenceKey(r.quote)}`;
    if (field.dismissed.has(key) || keep.has(key)) continue;
    keep.add(key);
    const existing = field.flags.get(key) ?? reworded(field, r);
    if (existing) {
      if (existing.key !== key) {
        field.flags.delete(existing.key);
        field.flags.set(key, existing);
      }
      Object.assign(existing, {
        key,
        start: r.start,
        end: r.end,
        quote: r.quote,
        explanation: r.explanation,
        question: r.question,
        confidence: r.confidence,
        checkedBy,
        stale: false,
      });
    } else {
      const flag = {
        id: nextFlagId++,
        key,
        field,
        type: r.type,
        start: r.start,
        end: r.end,
        quote: r.quote,
        explanation: r.explanation,
        question: r.question,
        confidence: r.confidence,
        checkedBy,
        entering: true,
        stale: false,
      };
      field.flags.set(key, flag);
      fresh.push(flag);
    }
  }
  for (const flag of [...field.flags.values()]) {
    if (!keep.has(flag.key) && !flag.offscreen) removeFlag(field, flag, { celebrate: true });
  }
  if (fresh.length) {
    overlay.mount();
    renderNow();
    fresh.forEach((flag, i) => setTimeout(() => enter(flag, i === 0), i * STAGGER_MS));
  } else {
    requestRender();
  }
}

// A hidden (stale) flag of the same type near the new finding: the user
// reworded the sentence but the fallacy survived, so keep the flag quietly.
function reworded(field, r) {
  for (const flag of field.flags.values()) {
    if (flag.stale && flag.type === r.type && r.start <= flag.end + 40 && r.end >= flag.start - 40) return flag;
  }
  return null;
}

function enter(flag, lead) {
  flag.entering = false;
  const v = overlay.elements(flag.id);
  if (!v || !flag.field.flags.has(flag.key)) return;
  overlay.effects.entrance({
    flag,
    rects: flagRects(flag),
    tagEl: v.tag,
    hlEls: v.hls,
    field: flag.field.el,
    intensity: intensity(),
    sound: settings.sound,
    lead,
  });
}

function removeFlag(field, flag, { celebrate }) {
  if (!field.flags.has(flag.key)) return;
  const rect = celebrate ? flag.lastRect : null;
  field.flags.delete(flag.key);
  overlay.removeView(flag.id, { animate: celebrate });
  if (rect) overlay.effects.resolved({ rect, sound: settings.sound && intensity() !== "subtle" });
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
  for (const field of fields.values()) {
    for (const flag of field.flags.values()) {
      if (flag.stale || flag.offscreen) continue;
      const rects = flagRects(flag);
      if (rects.length) flag.lastRect = rects[0];
      items.push({ flag, rects });
    }
  }
  overlay.render(items);
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

// --- Events ----------------------------------------------------------------

function onFocusIn(e) {
  if (!active()) return;
  const el = fieldFromEvent(e);
  if (el) ensureField(el);
}

function onBeforeInput(e) {
  if (!e.isTrusted || !active()) return;
  const el = fieldFromEvent(e);
  if (!el) return;
  const field = ensureField(el);
  markEdit(field, /^insertFrom(Paste|Drop|PasteAsQuotation)$/.test(e.inputType) ? "paste" : "type");
  // Some editors cancel beforeinput and apply the change themselves.
  setTimeout(() => sync(field), 0);
  setTimeout(() => sync(field), 150);
}

function onInput(e) {
  if (!e.isTrusted || !active()) return;
  const el = fieldFromEvent(e);
  if (!el) return;
  const field = ensureField(el);
  if (performance.now() > field.editUntil) markEdit(field, /paste|drop/i.test(e.inputType ?? "") ? "paste" : "type");
  sync(field);
}

function onKeyDown(e) {
  if (!e.isTrusted || !active()) return;
  const el = fieldFromEvent(e);
  if (!el) return;
  const field = ensureField(el);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") markEdit(field, "paste");
  else if (e.key.length === 1 || ["Backspace", "Delete", "Enter"].includes(e.key)) markEdit(field, "type");
}

function onPasteOrDrop(e) {
  if (!e.isTrusted || !active()) return;
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

function attachDocs() {
  if (!isGoogleDocs() || !active()) return;
  const editor = docsEditor();
  if (!editor) return;
  const field = ensureField(editor, "gdocs");
  const doc = docsInputDocument();
  if (!doc || watchedDocsInputs.has(doc)) return;
  watchedDocsInputs.add(doc);
  for (const type of ["keydown", "beforeinput", "paste", "drop"]) {
    doc.addEventListener(type, (e) => docsTyping(field, e), true);
  }
}

function poll() {
  attachDocs();
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
  window.addEventListener("scroll", requestRender, { capture: true, passive: true });
  window.addEventListener("resize", requestRender, { passive: true });
  setInterval(poll, POLL_MS);
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
  if (!active()) {
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
