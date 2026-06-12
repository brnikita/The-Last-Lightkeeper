// Генерация иллюстраций катсцен через OpenAI Images API.
// Запуск: node scripts/generate-cutscenes.mjs [--force]
// Файлы кладутся в public/assets/textures/cutscenes/<id>.jpg; существующие пропускаются.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8').split('\n')
    .filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
const KEY = env.OPENAI_API_KEY;
if (!KEY) { console.error('Нет OPENAI_API_KEY в .env'); process.exit(1); }

const STYLE =
  'Flat vector illustration in the style of vintage American national park posters and the game Firewatch. ' +
  'Large flat color shapes, bold silhouettes, layered landscape planes, warm sunset palette, minimal detail, ' +
  'subtle grain texture. Absolutely no text, no letters, no words, no logos, no borders. No photorealism.';

const SCENES = {
  intro:
    'A small rowboat with a single lone silhouetted figure approaching a rocky island at dawn. ' +
    'On the cliff stands an unlit lighthouse with red and white horizontal stripes, its lamp dark. ' +
    'Soft morning fog over calm water, warm peach and pale orange sunrise sky, melancholic and quiet mood. ' +
    'Wide landscape composition.',
  storm:
    'A dark stormy ocean at night, towering waves, a wall of heavy rain. On a rocky cliff stands a striped lighthouse, ' +
    'and inside its lantern room a warm golden light is just beginning to flare to life, the very first glow cutting the gloom. ' +
    'Deep blue-black palette with one warm amber accent at the lighthouse lamp. Dramatic yet hopeful mood. ' +
    'Wide landscape composition.',
  ending:
    'Night scene: a striped lighthouse on a cliff shines a bright warm sweeping beam of light through falling rain over the sea. ' +
    'Far away on the dark water, the small silhouette of a ship with tiny warm lights sails safely toward a strait between rocks. ' +
    'Deep night blues with warm golden beam, calm and peaceful mood, sense of relief. ' +
    'Wide landscape composition.',
};

const outDir = resolve(root, 'public/assets/textures/cutscenes');
mkdirSync(outDir, { recursive: true });
const force = process.argv.includes('--force');

async function callImages(body) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = (await res.text()).slice(0, 300);
    const err = new Error(`${res.status}: ${txt}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function dataToBuf(d) {
  if (d.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d.url) {
    const r = await fetch(d.url);
    if (!r.ok) throw new Error(`download ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('в ответе нет ни b64_json, ни url');
}

async function generate(id, prompt) {
  // Попытки 1–2: gpt-image-1 / gpt-image-1-mini — умеют сразу отдавать JPEG нужного качества
  for (const model of ['gpt-image-1', 'gpt-image-1-mini']) {
    try {
      const json = await callImages({
        model,
        prompt: `${STYLE} Scene: ${prompt}`,
        size: '1536x1024',
        quality: 'high',
        output_format: 'jpeg',
        output_compression: 85,
        n: 1,
      });
      return { buf: await dataToBuf(json.data[0]), model };
    } catch (e) {
      console.log(`  ${model} не сработал (${e.message.slice(0, 120)}), пробую дальше…`);
    }
  }
  // Попытка 3: dall-e-3 (вернёт PNG — сохраняем как PNG, конвертация в JPEG отдельно)
  const json = await callImages({
    model: 'dall-e-3',
    prompt: `${STYLE} Scene: ${prompt}`,
    size: '1792x1024',
    quality: 'hd',
    n: 1,
  });
  return { buf: await dataToBuf(json.data[0]), model: 'dall-e-3', isPng: true };
}

let ok = 0, skip = 0, fail = 0;
for (const [id, prompt] of Object.entries(SCENES)) {
  const out = resolve(outDir, `${id}.jpg`);
  if (existsSync(out) && !force) { console.log(`SKIP ${id}.jpg (уже есть)`); skip++; continue; }
  process.stdout.write(`Генерирую ${id}… `);
  try {
    const { buf, model, isPng } = await generate(id, prompt);
    writeFileSync(isPng ? resolve(outDir, `${id}.png`) : out, buf);
    console.log(`OK [${model}] (${(buf.length / 1024).toFixed(0)} КБ)${isPng ? ' — сохранён PNG, нужна конвертация в JPEG' : ''}`);
    ok++;
  } catch (e) {
    console.log('FAIL', e.message.slice(0, 200));
    fail++;
    if (e.status === 401) break;
  }
}
console.log(`\nГотово: ${ok} сгенерировано, ${skip} пропущено, ${fail} ошибок`);
process.exit(fail ? 1 : 0);
