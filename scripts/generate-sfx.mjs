// Генерация SFX через ElevenLabs Sound Effects API (eleven_text_to_sound_v2).
// 40 кредитов/сек при заданной длительности. Запуск: node scripts/generate-sfx.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8').split('\n')
    .filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
const KEY = env.ELEVENLABS_API_KEY;

const SFX = [
  // Эмбиент-лупы
  { id: 'waves_loop', dur: 10, loop: true, text: 'gentle ocean waves lapping against a wooden pier, calm sea ambience, soft water, seagulls very distant' },
  { id: 'wind_loop', dur: 10, loop: true, text: 'soft coastal wind blowing through grass, calm island breeze ambience, gentle airy whoosh' },
  { id: 'forest_loop', dur: 10, loop: true, text: 'quiet pine forest ambience, wind in pine needles, occasional small bird chirps, peaceful' },
  { id: 'storm_loop', dur: 10, loop: true, text: 'heavy rain storm with strong wind gusts, distant rolling thunder, dramatic but not scary' },
  { id: 'lighthouse_hum', dur: 6, loop: true, text: 'low mechanical hum of large rotating lighthouse lamp machinery, gentle electric buzz, rhythmic' },
  { id: 'fire_loop', dur: 6, loop: true, text: 'small campfire crackling softly, cozy fireplace' },
  // Уанншоты
  { id: 'footstep_grass', dur: 0.5, text: 'single soft footstep on grass and dirt' },
  { id: 'footstep_wood', dur: 0.5, text: 'single footstep on old wooden planks, slight creak' },
  { id: 'pickup', dur: 1, text: 'picking up a small glass object, gentle chime, soft magical shimmer' },
  { id: 'pickup_item', dur: 0.8, text: 'picking up an object, cloth and metal handling sound' },
  { id: 'door_open', dur: 2, text: 'old heavy wooden door creaking open slowly' },
  { id: 'door_locked', dur: 1.2, text: 'locked door handle rattle, metal lock refusing to open' },
  { id: 'paper', dur: 1, text: 'paper note unfolding, page rustle' },
  { id: 'radio_static', dur: 2, text: 'old radio static crackle, tuning between stations, vintage receiver noise' },
  { id: 'radio_on', dur: 1.5, text: 'vintage radio switching on with a click and warm tube hum rising' },
  { id: 'thunder', dur: 4, text: 'single distant thunder rumble rolling across the sea' },
  { id: 'lamp_ignite', dur: 3.5, text: 'huge lighthouse lamp igniting: deep whoosh of flame, rising bright hum, triumphant mechanical click' },
  { id: 'ship_horn', dur: 4, text: 'distant ship foghorn, single long warm blast across water' },
  { id: 'key_unlock', dur: 1.5, text: 'brass key turning in old heavy lock, satisfying clunk' },
  { id: 'stairs_metal', dur: 1, text: 'footsteps on metal spiral staircase, two steps with slight ring' },
];

const outDir = resolve(root, 'public/assets/audio/sfx');
mkdirSync(outDir, { recursive: true });
let ok = 0, skip = 0, fail = 0;

for (const s of SFX) {
  const out = resolve(outDir, `${s.id}.mp3`);
  if (existsSync(out)) { skip++; continue; }
  process.stdout.write(`SFX ${s.id} (${s.dur}s${s.loop ? ', loop' : ''})… `);
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: s.text,
        model_id: 'eleven_text_to_sound_v2',
        duration_seconds: s.dur,
        loop: !!s.loop,
        prompt_influence: 0.4,
      }),
    });
    if (!res.ok) {
      console.log(`FAIL ${res.status}: ${(await res.text()).slice(0, 160)}`);
      fail++;
      if (res.status === 401 || res.status === 429) break;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(out, buf);
    console.log(`OK (${(buf.length / 1024).toFixed(0)} КБ)`);
    ok++;
    await new Promise((r) => setTimeout(r, 500));
  } catch (e) { console.log('ERROR', e.message); fail++; }
}
console.log(`\nГотово: ${ok} ок, ${skip} пропущено, ${fail} ошибок`);
