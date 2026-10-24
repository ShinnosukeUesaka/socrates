// Renders review stills from one bundle: node scripts/stills.mjs <outDir> <sec> [sec...]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [out, ...secs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'CTPPitch' });
for (const s of secs) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(s) * 30));
  await renderStill({ composition, serveUrl, frame, output: join(out, `s${s}.jpg`), imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5 });
  console.log('rendered', s);
}
