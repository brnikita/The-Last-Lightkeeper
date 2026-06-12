import { Engine } from './core/Engine.js';

const loadingEl = document.getElementById('loading');
const hintEl = document.getElementById('loading-hint');
const fillEl = document.getElementById('loading-fill');

async function boot() {
  try {
    fillEl.style.width = '20%';
    const engine = new Engine();
    await engine.init(document.getElementById('app'));
    fillEl.style.width = '100%';
    engine.start();
    hintEl.textContent = 'Кликни по экрану — мышь управляет камерой. WASD — движение, Shift — бег.';
    setTimeout(() => loadingEl.classList.add('hidden'), 600);
    window.__engine = engine; // для дебага в консоли
  } catch (err) {
    console.error('[boot]', err);
    hintEl.textContent = 'Ошибка запуска: ' + err.message;
  }
}

boot();
