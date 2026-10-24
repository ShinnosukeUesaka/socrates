import { activeModel, loadSettings, MODEL_NAMES, usesAI } from "../shared/settings.js";

const $ = (id) => document.getElementById(id);

async function render() {
  const s = await loadSettings();
  $("enabled").checked = s.enabled;
  for (const box of document.querySelectorAll("[data-setting]")) box.checked = Boolean(s[box.dataset.setting]);
  $("sound").checked = s.sound;
  for (const b of $("intensity").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.value === s.intensity));

  const ai = usesAI(s);
  const model = MODEL_NAMES[activeModel(s)] ?? activeModel(s);
  $("engine").textContent = ai ? model : "Offline patterns";
  $("engineDot").className = `dot ${ai ? "on" : "warn"}`;
  $("engineDot").title = ai ? `Analyzing with ${model}` : "Add an OpenAI or Anthropic API key in Settings for context-aware analysis";
}

const NOUNS = { email: "this email", article: "this article", docs: "this document", page: "this page", selection: "your selection", input: "what you type" };

// Asks the page what Socrates is doing there.
async function renderPageStatus() {
  const el = $("pageStatus");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let status = null;
  try {
    status = tab?.id ? await chrome.tabs.sendMessage(tab.id, { type: "ctp:status" }) : null;
  } catch {
    status = null;
  }
  if (!status) {
    el.textContent = "Socrates isn't running on this tab yet. Reload the tab (it can't run on browser pages like chrome://).";
    return;
  }
  if (!status.active) {
    el.textContent = "Socrates is off for this site.";
    return;
  }
  const reading = status.sources.filter((s) => s.mode === "read");
  if (!reading.length) {
    el.textContent = "Nothing to read here automatically. Use “Check this page now”, or select text and right-click “Ask Socrates about this”.";
    return;
  }
  el.textContent = reading
    .map((s) => {
      const what = NOUNS[s.source] ?? "this page";
      if (!s.checked) return `Reading ${what}…`;
      return s.questions ? `${s.questions} question${s.questions === 1 ? "" : "s"} about ${what}.` : `Read ${what}: nothing to question.`;
    })
    .join(" ");
}

$("enabled").addEventListener("change", (e) => chrome.storage.local.set({ enabled: e.target.checked }));
$("sound").addEventListener("change", (e) => chrome.storage.local.set({ sound: e.target.checked }));
$("intensity").addEventListener("click", (e) => {
  const value = e.target.closest("button")?.dataset.value;
  if (value) chrome.storage.local.set({ intensity: value });
});
for (const box of document.querySelectorAll("[data-setting]")) {
  box.addEventListener("change", (e) => chrome.storage.local.set({ [box.dataset.setting]: e.target.checked }));
}
$("checkPage").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "ctp:checkPage" }).catch(() => {});
  window.close();
});
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener(render);
render();
renderPageStatus();
