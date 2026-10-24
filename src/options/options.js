import { FALLACIES } from "../shared/fallacies.js";
import { loadSettings } from "../shared/settings.js";

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
  $("engine").value = s.engine;
  $("model").value = s.model;
  $("effort").value = s.effort;
  $("debounceMs").value = String(s.debounceMs);
  $("checkPastes").checked = s.checkPastes;
  $("blockedSites").value = s.blockedSites.join("\n");

  $("types").replaceChildren(
    ...Object.entries(FALLACIES).map(([id, f]) => {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = id;
      box.checked = !s.mutedTypes.includes(id);
      label.title = f.blurb;
      label.append(box, f.name);
      return label;
    }),
  );
}

$("apiKey").addEventListener("change", (e) => save({ apiKey: e.target.value.trim() }));
for (const id of ["engine", "model", "effort"]) {
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
$("resetStats").addEventListener("click", () => save({ stats: { total: 0, byType: {} } }));

$("test").addEventListener("click", async () => {
  const out = $("testResult");
  out.textContent = "Checking…";
  const r = await chrome.runtime.sendMessage({ type: "ctp:test" });
  if (r.error) {
    out.textContent = `Error: ${r.error}`;
    return;
  }
  const lines = [`Sample: “${r.sample}”`, `Engine: ${r.engine === "claude" ? r.model : "offline patterns"}`];
  if (r.warning) lines.push(`Claude failed: ${r.warning}`);
  lines.push(
    ...(r.fallacies.length
      ? r.fallacies.map((f) => `→ ${FALLACIES[f.type]?.name ?? f.type}: “${f.quote}”\n  ${f.explanation}`)
      : ["No fallacies found."]),
  );
  out.textContent = lines.join("\n");
});

init();
