// Мобильное управление: виртуальный джойстик слева, свайп-камера справа, кнопка E.
// Активируется только на тач-устройствах.
export function isTouchDevice() {
  return ('ontouchstart' in window) && navigator.maxTouchPoints > 0
    && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

export class TouchControls {
  constructor(input, hud) {
    this.input = input;
    this.moveX = 0;
    this.moveZ = 0;
    this.active = false;

    const css = `
      .tc-stick { position: fixed; left: 26px; bottom: 26px; width: 120px; height: 120px;
        border: 2px solid rgba(232,185,111,0.4); border-radius: 50%; z-index: 30; touch-action: none; }
      .tc-knob { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px;
        background: rgba(232,185,111,0.55); border-radius: 50%; }
      .tc-btn { position: fixed; right: 30px; bottom: 48px; width: 72px; height: 72px; z-index: 30;
        border-radius: 50%; border: 2px solid rgba(232,185,111,0.6); color: #e8b96f;
        background: rgba(10,12,16,0.5); font: 26px Georgia; display: flex; align-items: center; justify-content: center;
        touch-action: none; user-select: none; }
      .tc-look { position: fixed; right: 0; top: 0; width: 55%; height: 100%; z-index: 20; touch-action: none; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.stick = document.createElement('div');
    this.stick.className = 'tc-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'tc-knob';
    this.stick.appendChild(this.knob);

    this.btn = document.createElement('div');
    this.btn.className = 'tc-btn';
    this.btn.textContent = 'E';

    this.look = document.createElement('div');
    this.look.className = 'tc-look';

    document.body.append(this.look, this.stick, this.btn);
    this.active = true;

    // джойстик
    let sid = null, cx = 0, cy = 0;
    const R = 52;
    this.stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sid = t.identifier;
      const r = this.stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    this.stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = dx / len * R; dy = dy / len * R; }
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.moveX = dx / R; this.moveZ = dy / R;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        sid = null; this.moveX = 0; this.moveZ = 0;
        this.knob.style.transform = '';
      }
    };
    this.stick.addEventListener('touchend', end);
    this.stick.addEventListener('touchcancel', end);

    // камера
    let lid = null, lx = 0, ly = 0;
    this.look.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lid = t.identifier; lx = t.clientX; ly = t.clientY;
    });
    this.look.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lid) continue;
        input.mouseDX += (t.clientX - lx) * 2.2;
        input.mouseDY += (t.clientY - ly) * 2.2;
        lx = t.clientX; ly = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });

    // действие
    this.btn.addEventListener('touchstart', (e) => {
      input.interactPressed = true;
      e.preventDefault();
    }, { passive: false });
  }
}
