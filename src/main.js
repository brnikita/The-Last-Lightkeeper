import { Engine } from './core/Engine.js';

const loadingEl = document.getElementById('loading');
const hintEl = document.getElementById('loading-hint');
const fillEl = document.getElementById('loading-fill');
const barEl = loadingEl.querySelector('.bar');
const btnContinue = document.getElementById('btn-continue');
const btnNew = document.getElementById('btn-new');
const menuEl = document.getElementById('menu-buttons');

const hasSave = !!localStorage.getItem('lightkeeper_save_v1');
if (hasSave) btnContinue.classList.remove('hidden');

function chooseOnce(fn) {
  let done = false;
  return (...a) => { if (!done) { done = true; fn(...a); } };
}

const boot = chooseOnce(async (newGame) => {
  if (newGame) localStorage.removeItem('lightkeeper_save_v1');
  menuEl.style.display = 'none';
  barEl.style.visibility = 'visible';
  try {
    const engine = new Engine();
    await engine.init(document.getElementById('app'), (p, label) => {
      fillEl.style.width = `${Math.round(p * 100)}%`;
      hintEl.textContent = label;
    });
    engine.start();
    hintEl.textContent = 'Кликни по экрану — мышь управляет камерой. WASD — движение, E — действие.';
    setTimeout(() => loadingEl.classList.add('hidden'), 700);
    window.__engine = engine; // для дебага
  } catch (err) {
    console.error('[boot]', err);
    hintEl.textContent = 'Ошибка запуска: ' + err.message;
  }
});

btnContinue.addEventListener('click', () => boot(false));
btnNew.addEventListener('click', () => boot(true));
