import { CATEGORIES, FALLACIES } from "../shared/fallacies.js";
import { loadSettings, providerFor } from "../shared/settings.js";

const $ = (id) => document.getElementById(id);
let savedTimer;

async function save(patch) {
  await chrome.storage.local.set(patch);
  $("saved").classList.add("show");
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $("saved").classList.remove("show"), 1200);
}

async function init() {
  const s = await loadSettings();
  $("apiKey").value = s.apiKey;
  showProvider(s.apiKey);
  $("engine").value = s.engine === "claude" ? "auto" : s.engine;
  $("model").value = s.model;
  $("openaiModel").value = s.openaiModel;
  $("effort").value = s.effort;
  $("debounceMs").value = String(s.debounceMs);
  $("checkPastes").checked = s.checkPastes;
  $("blockedSites").value = s.blockedSites.join("\n");

  $("types").replaceChildren(
    ...Object.entries(CATEGORIES).flatMap(([category, title]) => {
      const heading = document.createElement("h3");
      heading.textContent = title;
      const grid = document.createElement("div");
      grid.className = "types";
      for (const [id, f] of Object.entries(FALLACIES)) {
        if (f.category !== category) continue;
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = id;
        box.checked = !s.mutedTypes.includes(id);
        label.title = f.blurb;
        label.append(box, f.name);
        grid.appendChild(label);
      }
      return [heading, grid];
    }),
  );
}

function showProvider(key) {
  const provider = providerFor(key);
  $("provider").textContent = provider === "openai" ? "OpenAI key. " : provider === "anthropic" ? "Anthropic key. " : key ? "Unrecognised key format. " : "";
}

$("apiKey").addEventListener("input", (e) => showProvider(e.target.value));
$("apiKey").addEventListener("change", (e) => save({ apiKey: e.target.value.trim() }));
for (const id of ["engine", "model", "openaiModel", "effort"]) {
  $(id).addEventListener("change", (e) => save({ [id]: e.target.value }));
}
$("debounceMs").addEventListener("change", (e) => save({ debounceMs: Number(e.target.value) }));
$("checkPastes").addEventListener("change", (e) => save({ checkPastes: e.target.checked }));
$("blockedSites").addEventListener("change", (e) =>
  save({
    blockedSites: e.target.value
      .split(/\s+/)
      .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean),
  }),
);
$("types").addEventListener("change", () => {
  const mutedTypes = [...$("types").querySelectorAll("input:not(:checked)")].map((b) => b.value);
  save({ mutedTypes });
});

$("test").addEventListener("click", async () => {
  const out = $("testResult");
  out.textContent = "Checking…";
  const r = await chrome.runtime.sendMessage({ type: "ctp:test" });
  if (r.error) {
    out.textContent = `Error: ${r.error}`;
    return;
  }
  const lines = [`Sample: “${r.sample}”`, `Engine: ${r.engine === "ai" ? r.modelName : "offline patterns"}`];
  if (r.warning) lines.push(`${r.provider} failed: ${r.warning}`);
  lines.push(
    ...(r.fallacies.length
      ? r.fallacies.map((f) => `→ ${FALLACIES[f.type]?.name ?? f.type}: “${f.quote}”\n  ${f.explanation}\n  Socrates asks: ${f.question}`)
      : ["Nothing flagged."]),
  );
  out.textContent = lines.join("\n");
});

init();
