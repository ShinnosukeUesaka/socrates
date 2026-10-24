import { fallacyName } from "../shared/fallacies.js";
import { loadSettings, usesClaude } from "../shared/settings.js";

const MODEL_NAMES = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
};

const $ = (id) => document.getElementById(id);

async function render() {
  const s = await loadSettings();
  $("enabled").checked = s.enabled;
  $("sound").checked = s.sound;
  for (const b of $("intensity").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.value === s.intensity));

  const claude = usesClaude(s) && s.apiKey;
  $("engine").textContent = claude ? MODEL_NAMES[s.model] ?? s.model : "Offline patterns";
  $("engineDot").className = `dot ${claude ? "on" : "warn"}`;
  $("engineDot").title = claude ? "Analyzing with Claude" : "Add an API key in Settings for context-aware analysis";

  const { stats = { total: 0, byType: {} } } = await chrome.storage.local.get("stats");
  $("total").textContent = String(stats.total);
  const top = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  $("top").replaceChildren(
    ...top.map(([type, n]) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = fallacyName(type);
      const count = document.createElement("span");
      count.className = "muted";
      count.textContent = `×${n}`;
      li.append(name, count);
      return li;
    }),
  );
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
