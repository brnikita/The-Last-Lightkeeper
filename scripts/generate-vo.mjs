// Предгенерация всей озвучки через ElevenLabs TTS (eleven_multilingual_v2).
// Запуск: node scripts/generate-vo.mjs [--force]
// Файлы кладутся в public/assets/audio/vo/<lineId>.mp3; существующие пропускаются.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8').split('\n')
    .filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
const KEY = env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Нет ELEVENLABS_API_KEY в .env'); process.exit(1); }

// Премейд-голоса ElevenLabs (multilingual):
const VOICES = {
  eli: 'TX3LPaxmHKxFdv7VOQHJ',   // Liam — молодой, тёплый
  ded: 'JBFqnCBsd6RMkjVDRZzb',   // George — пожилой, тёплый, с хрипотцой
  marta: 'EXAVITQu4vr4xnSDxMaL', // Sarah — спокойный женский
};
const SETTINGS = {
  eli: { stability: 0.45, similarity_boost: 0.8, style: 0.25 },
  ded: { stability: 0.55, similarity_boost: 0.8, style: 0.35 },
  marta: { stability: 0.6, similarity_boost: 0.8, style: 0.2 },
};

const dialogues = JSON.parse(readFileSync(resolve(root, 'src/data/dialogues.json'), 'utf8'));
const outDir = resolve(root, 'public/assets/audio/vo');
mkdirSync(outDir, { recursive: true });

const force = process.argv.includes('--force');
let ok = 0, skip = 0, fail = 0;

for (const [id, line] of Object.entries(dialogues.lines)) {
  const out = resolve(outDir, `${id}.mp3`);
  if (existsSync(out) && !force) { skip++; continue; }
  const voiceId = VOICES[line.speaker];
  if (!voiceId) { console.warn(`Нет голоса для ${line.speaker}`); fail++; continue; }

  // Реплики деда — «старая запись»: текст без изменений, фильтр наложим на клиенте/ffmpeg
  process.stdout.write(`TTS ${id} (${line.speaker})… `);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: line.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: SETTINGS[line.speaker],
        }),
      }
    );
    if (!res.ok) {
      console.log(`FAIL ${res.status}: ${(await res.text()).slice(0, 200)}`);
      fail++;
      if (res.status === 401 || res.status === 429) break; // нет смысла продолжать
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(out, buf);
    console.log(`OK (${(buf.length / 1024).toFixed(0)} КБ)`);
    ok++;
    await new Promise((r) => setTimeout(r, 400)); // не душить API
  } catch (e) {
    console.log('ERROR', e.message);
    fail++;
  }
}
console.log(`\nГотово: ${ok} сгенерировано, ${skip} пропущено, ${fail} ошибок`);
