// Весь UI — DOM поверх канваса: субтитры, промпт, инвентарь, записки, цели, фейды.
const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: Georgia, 'Times New Roman', serif; z-index: 10; }
#hud .subtitle {
  position: absolute; bottom: 7%; left: 50%; transform: translateX(-50%);
  max-width: 760px; padding: 14px 26px; text-align: center;
  background: rgba(8, 10, 14, 0.62); border-radius: 6px;
  color: #f0e9dc; font-size: 19px; line-height: 1.45;
  opacity: 0; transition: opacity 0.25s ease;
}
#hud .subtitle.visible { opacity: 1; }
#hud .subtitle .speaker { color: #e8b96f; font-size: 13px; letter-spacing: 3px; display: block; margin-bottom: 4px; }
#hud .subtitle.radio { font-style: italic; color: #cfe0e8; }
#hud .prompt {
  position: absolute; bottom: 22%; left: 50%; transform: translateX(-50%);
  color: #f0e9dc; font-size: 16px; background: rgba(8, 10, 14, 0.55);
  padding: 8px 18px; border-radius: 20px; opacity: 0; transition: opacity 0.2s;
}
#hud .prompt.visible { opacity: 1; }
#hud .prompt b { color: #e8b96f; border: 1px solid #e8b96f; border-radius: 4px; padding: 0 7px; margin-right: 8px; font-weight: normal; }
#hud .toast {
  position: absolute; top: 12%; left: 50%; transform: translateX(-50%);
  color: #f0e9dc; background: rgba(8, 10, 14, 0.65); padding: 10px 22px;
  border-radius: 6px; font-size: 16px; opacity: 0; transition: opacity 0.4s;
}
#hud .toast.visible { opacity: 1; }
#hud .objective {
  position: absolute; top: 24px; right: 28px; max-width: 320px; text-align: right;
  color: rgba(240, 233, 220, 0.85); font-size: 14px; font-style: italic;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
#hud .lenses { position: absolute; top: 52px; right: 28px; display: flex; gap: 6px; justify-content: flex-end; }
#hud .lenses .l { width: 14px; height: 14px; border: 1px solid #e8b96f; transform: rotate(45deg); opacity: 0.35; }
#hud .lenses .l.on { background: #e8b96f; opacity: 1; box-shadow: 0 0 8px #e8b96f; }
#hud .note-overlay {
  position: absolute; inset: 0; background: rgba(5, 7, 10, 0.82);
  display: none; align-items: center; justify-content: center; pointer-events: auto;
}
#hud .note-overlay.visible { display: flex; }
#hud .note-paper {
  background: #e8dfc8; color: #2a241a; max-width: 520px; width: 86%;
  padding: 42px 46px; border-radius: 2px; box-shadow: 0 12px 60px rgba(0,0,0,0.7);
  font-size: 17px; line-height: 1.6; white-space: pre-line;
}
#hud .note-paper h3 { margin-bottom: 16px; font-size: 15px; letter-spacing: 2px; color: #6b5d40; }
#hud .note-close { text-align: center; color: #9b8c6a; margin-top: 24px; font-size: 13px; }
#hud .inv-panel {
  position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78);
  display: none; align-items: center; justify-content: center; pointer-events: auto;
}
#hud .inv-panel.visible { display: flex; }
#hud .inv-box { max-width: 640px; width: 90%; }
#hud .inv-box h2 { color: #e8b96f; font-weight: normal; letter-spacing: 4px; font-size: 18px; margin-bottom: 20px; text-align: center; }
#hud .inv-grid { display: flex; flex-direction: column; gap: 10px; }
#hud .inv-item { background: rgba(232, 223, 200, 0.08); border: 1px solid rgba(232, 185, 111, 0.25); border-radius: 6px; padding: 12px 18px; }
#hud .inv-item .nm { color: #e8b96f; font-size: 16px; }
#hud .inv-item .ds { color: #c9c0ae; font-size: 14px; margin-top: 4px; line-height: 1.4; }
#hud .inv-empty { color: #8a8270; text-align: center; font-style: italic; }
#hud .fade { position: absolute; inset: 0; background: #05070a; opacity: 0; transition: opacity 1.2s ease; }
#hud .fade.dark { opacity: 1; }
#hud .cutscene-img {
  position: absolute; inset: 0; background-size: cover; background-position: center;
  opacity: 0; transition: opacity 1.5s ease;
}
#hud .cutscene-img.visible { opacity: 1; }
#hud .controls-hint { position: absolute; bottom: 18px; left: 22px; color: rgba(240,233,220,0.45); font-size: 12.5px; }
#hud .end-screen {
  position: absolute; inset: 0; display: none; flex-direction: column;
  align-items: center; justify-content: center; pointer-events: auto;
  background: linear-gradient(rgba(5,7,10,0.25), rgba(5,7,10,0.78));
}
#hud .end-screen.visible { display: flex; }
#hud .end-screen h1 { color: #f0e9dc; font-weight: normal; font-size: 34px; letter-spacing: 8px; text-shadow: 0 2px 18px rgba(0,0,0,0.9); }
#hud .end-screen .credits { color: rgba(240,233,220,0.75); font-size: 14px; line-height: 1.9; text-align: center; margin-top: 26px; text-shadow: 0 1px 6px rgba(0,0,0,0.9); }
#hud .end-screen button {
  margin-top: 38px; font-family: inherit; font-size: 15px; letter-spacing: 3px;
  background: rgba(8,10,14,0.5); border: 1px solid #e8b96f; color: #e8b96f;
  padding: 12px 38px; cursor: pointer;
}
#hud .end-screen button:hover { background: rgba(232,185,111,0.18); }
`;

export class HUD {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="fade"></div>
      <div class="cutscene-img"></div>
      <div class="subtitle"><span class="speaker"></span><span class="text"></span></div>
      <div class="prompt"><b>E</b><span class="ptext"></span></div>
      <div class="toast"></div>
      <div class="objective"></div>
      <div class="lenses"><div class="l"></div><div class="l"></div><div class="l"></div><div class="l"></div></div>
      <div class="note-overlay"><div class="note-paper"><h3></h3><div class="nbody"></div><div class="note-close">E / Esc — закрыть</div></div></div>
      <div class="inv-panel"><div class="inv-box"><h2>КАРМАНЫ ЭЛИ</h2><div class="inv-grid"></div></div></div>
      <div class="controls-hint">WASD — движение · Shift — бег · Space — прыжок · E — действие · Tab — инвентарь</div>
      <div class="end-screen">
        <h1>ПОСЛЕДНИЙ СМОТРИТЕЛЬ</h1>
        <div class="credits">Свет передан. Кто-то знал, что его ждут дома.<br><br>
          Модели: Kenney · KayKit (CC0) · Небо: Poly Haven (CC0)<br>
          Музыка: Kevin MacLeod (CC-BY 4.0) · Голоса и звук: ElevenLabs<br>
          Иллюстрации и текстуры маяка: GPT Image</div>
        <button class="end-menu-btn">В ГЛАВНОЕ МЕНЮ</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.$ = (s) => this.root.querySelector(s);
    this.noteOpen = false;
    this.invOpen = false;
    this._toastTimer = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); this.toggleInventory(); }
      if ((e.code === 'Escape' || e.code === 'KeyE') && this.noteOpen) this.hideNote();
    });
    this.$('.end-menu-btn').addEventListener('click', () => location.reload());
  }

  showEndScreen() {
    document.exitPointerLock?.();
    this.$('.end-screen').classList.add('visible');
  }

  get modalOpen() { return this.noteOpen || this.invOpen; }

  showSubtitle(speaker, text, isRadio) {
    const el = this.$('.subtitle');
    el.querySelector('.speaker').textContent = speaker;
    el.querySelector('.text').textContent = text;
    el.classList.toggle('radio', isRadio);
    el.classList.add('visible');
  }
  hideSubtitle() { this.$('.subtitle').classList.remove('visible'); }

  showPrompt(text) {
    this.$('.prompt .ptext').textContent = text;
    this.$('.prompt').classList.add('visible');
  }
  hidePrompt() { this.$('.prompt').classList.remove('visible'); }

  toast(text, ms = 2800) {
    const el = this.$('.toast');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  }

  setObjective(text) { this.$('.objective').textContent = text; }

  setLensCount(n) {
    this.$('.lenses').querySelectorAll('.l').forEach((el, i) => el.classList.toggle('on', i < n));
  }

  showNote(title, text) {
    this.noteOpen = true;
    this.$('.note-paper h3').textContent = title.toUpperCase();
    this.$('.note-paper .nbody').textContent = text;
    this.$('.note-overlay').classList.add('visible');
  }
  hideNote() { this.noteOpen = false; this.$('.note-overlay').classList.remove('visible'); }

  toggleInventory() {
    this.invOpen = !this.invOpen;
    this.$('.inv-panel').classList.toggle('visible', this.invOpen);
  }

  refreshInventory(items) {
    const grid = this.$('.inv-grid');
    grid.innerHTML = items.length
      ? items.map((it) => `<div class="inv-item"><div class="nm">${it.name}</div><div class="ds">${it.description}</div></div>`).join('')
      : '<div class="inv-empty">Пусто. Только ветер в карманах.</div>';
  }

  fade(dark) { this.$('.fade').classList.toggle('dark', dark); }

  showCutsceneImage(url, instant = false) {
    const el = this.$('.cutscene-img');
    el.style.backgroundImage = `url(${url})`;
    if (instant) {
      el.style.transition = 'none';
      el.classList.add('visible');
      requestAnimationFrame(() => { el.style.transition = ''; });
    } else {
      el.classList.add('visible');
    }
  }
  hideCutsceneImage() { this.$('.cutscene-img').classList.remove('visible'); }
}
