import { activeModel, loadSettings, MODEL_NAMES, usesAI } from "../shared/settings.js";

const $ = (id) => document.getElementById(id);

async function render() {
  const s = await loadSettings();
  $("enabled").checked = s.enabled;
  $("sound").checked = s.sound;
  for (const b of $("intensity").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.value === s.intensity));

  const ai = usesAI(s);
  const model = MODEL_NAMES[activeModel(s)] ?? activeModel(s);
  $("engine").textContent = ai ? model : "Offline patterns";
  $("engineDot").className = `dot ${ai ? "on" : "warn"}`;
  $("engineDot").title = ai ? `Analyzing with ${model}` : "Add an OpenAI or Anthropic API key in Settings for context-aware analysis";
}

$("enabled").addEventListener("change", (e) => chrome.storage.local.set({ enabled: e.target.checked }));
$("sound").addEventListener("change", (e) => chrome.storage.local.set({ sound: e.target.checked }));
$("intensity").addEventListener("click", (e) => {
  const value = e.target.closest("button")?.dataset.value;
  if (value) chrome.storage.local.set({ intensity: value });
});
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener(render);
render();
