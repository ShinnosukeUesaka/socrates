// Generates the pitch narration with ElevenLabs Eleven v4 text-to-speech. [Bracketed] audio tags steer the delivery.
// Run: ELEVENLABS_API_KEY=... node scripts/make-narration.mjs   (reads the key from the environment, never from code)
// Output: public/narration/<id>.mp3 and src/narration.json (text + duration in seconds), used by src/Pitch.tsx.
// Lines whose text and voice have not changed are not regenerated. Pass line ids to generate only those.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'narration');
const META = join(ROOT, 'src', 'narration.json');
const RAW = join(ROOT, '.narration-raw'); // untouched API output, git-ignored
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });
// Trim silence at both ends and speed up slightly (pitch preserved) so the narration fits two minutes.
const TEMPO = 1.1;
const FILTER = `silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo=${TEMPO}`;

const MODEL = 'eleven_v4';
const NARRATOR = 'JBFqnCBsd6RMkjVDRZzb'; // George: warm, captivating storyteller (ElevenLabs premade voice)
const ANNOUNCER = 'SOYHLrjzK2X1ezoPC6cr'; // Harry: fierce warrior (ElevenLabs premade voice), shouts the fallacy name
const DAN = 'cjVigY5qzO86Huf0OWal'; // Eric: smooth, trustworthy (ElevenLabs premade voice), the persuasive colleague

export const LINES = [
  // The office: Dan's pitch, and what it cost.
  ['open', NARRATOR, '[softly] Meet Dan. He wins every meeting.'],
  ['dan', DAN, "[confidently] Trust me, I've done this for twenty years. Either we go all in on Atlas, or we're finished."],
  ['collapse', NARRATOR, '[gravely] It sounded convincing. Nobody checked the logic. [long pause] A year later, the company was gone.'],
  // What's missing.
  ['pivot', NARRATOR, '[intensely] We have spell-check. We have grammar-check. [long pause] But nothing checks our logic.'],
  ['intro', NARRATOR, '[confident] Meet Socrates: critical thinking, built into your browser. It flags weak arguments in what you read, and in what you write.'],
  ['structure', NARRATOR, '[confident] It looks past the wording, to the structure of the argument.'],
  // The real extension: an email, then an article.
  ['d2', NARRATOR, '[suspenseful] When the reasoning slips, the exact words get tagged.'],
  ['d3', NARRATOR, "Click the tag. [pause] Socrates won't tell you what to think. It asks the question that helps you decide."],
  ['d5a', NARRATOR, '[amused] And it checks your own replies too.'],
  ['d5b', NARRATOR, '[amused] Subtle, it is not. [pause] Rethink it, and the flag clears.'],
  ['d1', NARRATOR, '[calm] Open an article, and it reads along with you.'],
  ['science', NARRATOR, '[confident] It catches the fallacies and biases behind bad decisions, [pause] and stays quiet when the reasoning holds.'],
  ['privacy', NARRATOR, '[warmly] It reads only the article, email or reply in front of you, [pause] and it never tells you what to believe.'],
  ['impact', NARRATOR, '[confident] Better arguments. Better decisions. [pause] Logic, not language.'],
  ['outro', NARRATOR, '[warmly] Socrates. [pause] Critical thinking, built into your browser.'],
];

const key = process.env.ELEVENLABS_API_KEY;
const only = new Set(process.argv.slice(2));
const old = existsSync(META) ? JSON.parse(readFileSync(META, 'utf8')) : {};
const meta = { ...old };

async function speak([id, voice, text]) {
  const file = join(OUT, `${id}.mp3`);
  const tag = `${MODEL}:${voice}:${TEMPO}`;
  const raw = join(RAW, `${id}.mp3`);
  if (old[id]?.text === text && old[id]?.voice === tag && existsSync(file)) return;
  if (old[id]?.text === text && old[id]?.voice?.startsWith(`${MODEL}:${voice}:`) && existsSync(raw)) return finish(id, text, tag, raw, file);
  if (!key) throw new Error('Set ELEVENLABS_API_KEY to generate narration.');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  finish(id, text, tag, raw, file);
}

function finish(id, text, tag, raw, file) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', FILTER, '-b:a', '160k', file]);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  meta[id] = { text, voice: tag, duration: Math.round(duration * 100) / 100 };
  console.log(`${id}: ${meta[id].duration}s`);
  writeFileSync(META, JSON.stringify(meta, null, 2) + '\n');
}

// Two requests at a time: the ElevenLabs plan allows two concurrent requests.
const queue = LINES.filter(([id]) => !only.size || only.has(id));
await Promise.all(Array.from({ length: 2 }, async () => { while (queue.length) await speak(queue.shift()); }));
writeFileSync(META, JSON.stringify(Object.fromEntries(LINES.filter(([id]) => meta[id]).map(([id]) => [id, meta[id]])), null, 2) + '\n');
console.log(`Narration written to ${OUT}`);
