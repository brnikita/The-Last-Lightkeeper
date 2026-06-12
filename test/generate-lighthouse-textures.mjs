// Генерация текстур маяка через OpenAI Images API (gpt-image-1, фолбэк dall-e-3).
// Запуск: node test/generate-lighthouse-textures.mjs [--force]
// Результат: public/assets/textures/lighthouse/*.jpg
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

const outDir = resolve(root, 'public/assets/textures/lighthouse');
mkdirSync(outDir, { recursive: true });
const force = process.argv.includes('--force');

const STYLE = 'stylized hand-painted game texture, flat clean colors, subtle weathering, soft painterly shading, no photorealism, Firewatch / Kenney low-poly game art style';

const TEXTURES = [
  {
    name: 'stripes',
    prompt: `Seamless tileable texture of painted lighthouse plaster wall. The image is split into exactly two equal horizontal bands: the TOP half is warm off-white painted plaster, the BOTTOM half is deep signal-red painted plaster. Perfectly straight horizontal edge between the bands, bands span the full width edge to edge. Subtle weathering: faint chipped paint, very light rust streaks running down, gentle color variation. ${STYLE}. Flat frontal view, no perspective, no shadows from objects, no border, no text. Must tile seamlessly both horizontally and vertically.`,
  },
  {
    name: 'stone',
    prompt: `Seamless tileable texture of grey stone masonry blocks, large rectangular granite blocks with thin recessed mortar joints, cool grey with slight blue-green tint, subtle moss hints in some crevices. ${STYLE}. Flat frontal view, even lighting, no perspective, no border, no text. Must tile seamlessly both horizontally and vertically.`,
  },
  {
    name: 'door',
    prompt: `Single old wooden door texture for a lighthouse, full-frame front view of an arched-top plank door made of weathered teal-green painted wooden planks, dark iron hinges, round brass door handle on the right side, brass details slightly worn. The door fills the entire image edge to edge. ${STYLE}. Flat frontal orthographic view, no wall around it, no perspective, no text.`,
  },
];

async function gen(model, prompt) {
  const body = { model, prompt, size: '1024x1024', n: 1 };
  if (model.startsWith('gpt-image')) {
    body.quality = 'high';
    body.output_format = 'jpeg';
    body.output_compression = 85;
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const item = data.data[0];
  if (item.b64_json) return { buf: Buffer.from(item.b64_json, 'base64'), ext: model.startsWith('gpt-image') ? 'jpg' : 'png' };
  if (item.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error(`download ${img.status}`);
    return { buf: Buffer.from(await img.arrayBuffer()), ext: 'png' };
  }
  throw new Error('нет данных изображения в ответе');
}

const MODELS = ['gpt-image-2', 'gpt-image-1', 'chatgpt-image-latest'];
let modelIdx = 0;
for (const t of TEXTURES) {
  const outJpg = resolve(outDir, `${t.name}.jpg`);
  if (existsSync(outJpg) && !force) { console.log(`skip ${t.name}`); continue; }
  let done = false;
  while (!done && modelIdx < MODELS.length) {
    const model = MODELS[modelIdx];
    process.stdout.write(`gen ${t.name} (${model})… `);
    try {
      const { buf, ext } = await gen(model, t.prompt);
      writeFileSync(resolve(outDir, `${t.name}.${ext}`), buf);
      console.log(`OK ${(buf.length / 1024).toFixed(0)} KB (${ext})`);
      done = true;
    } catch (e) {
      console.log(`FAIL: ${e.message.slice(0, 200)}`);
      if (/403|does not have access|model_not_found|404/.test(e.message)) modelIdx++;
      else { done = true; } // другая ошибка — не зацикливаемся
    }
  }
}
