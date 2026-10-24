// Renders the toolbar icon (a glowing question mark) to PNGs.
import { chromium } from "playwright";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="65%">
      <stop offset="0" stop-color="#ffd60a"/>
      <stop offset="0.45" stop-color="#ff6b35"/>
      <stop offset="1" stop-color="#d1002f"/>
    </radialGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="#170a0d"/>
  <circle cx="64" cy="64" r="48" fill="url(#g)"/>
  <text x="64" y="91" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="82" fill="#170a0d">?</text>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${size}" height="${size}">`);
  await page.locator("img").screenshot({ path: `src/icons/${size}.png`, omitBackground: true });
}
await browser.close();
console.log("Icons written to src/icons/");
