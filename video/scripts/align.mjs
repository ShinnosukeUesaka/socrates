// Word timings for every narration line, from ElevenLabs speech-to-text (Scribe), so on-screen text and
// stamps can land on the exact spoken word. Output: src/words.json { id: [[word, start, end], ...] } in seconds.
// Run after make-narration.mjs: ELEVENLABS_API_KEY=... node scripts/align.mjs   (only lines whose audio changed are re-aligned)
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const META = join(ROOT, 'src', 'narration.json');
const OUT = join(ROOT, 'src', 'words.json');
const narration = JSON.parse(readFileSync(META, 'utf8'));
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const key = process.env.ELEVENLABS_API_KEY;
const words = {};

for (const id of Object.keys(narration)) {
  const file = join(ROOT, 'public', 'narration', `${id}.mp3`);
  const stamp = `${narration[id].text}|${statSync(file).size}`;
  if (old[id]?.stamp === stamp) { words[id] = old[id]; continue; }
  if (!key) throw new Error('Set ELEVENLABS_API_KEY to align narration.');
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('timestamps_granularity', 'word');
  form.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), `${id}.mp3`);
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const list = data.words.filter((w) => w.type === 'word').map((w) => [w.text, Math.round(w.start * 100) / 100, Math.round(w.end * 100) / 100]);
  words[id] = { stamp, words: list };
  console.log(`${id}: ${list.map((w) => `${w[0]}@${w[1]}`).join(' ')}`);
}
writeFileSync(OUT, JSON.stringify(words, null, 1) + '\n');
