import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const out = "dist";
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await build({
  entryPoints: {
    background: "src/background/index.js",
    content: "src/content/index.js",
    "docs-annotate": "src/content/docs-annotate.js",
    popup: "src/popup/popup.js",
    options: "src/options/options.js",
  },
  outdir: out,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  logLevel: "warning",
});

await Promise.all([
  cp("src/manifest.json", `${out}/manifest.json`),
  cp("src/ui.css", `${out}/ui.css`),
  cp("src/popup/popup.html", `${out}/popup.html`),
  cp("src/options/options.html", `${out}/options.html`),
  cp("src/icons", `${out}/icons`, { recursive: true }),
]);

console.log(`Built extension into ${out}/`);
