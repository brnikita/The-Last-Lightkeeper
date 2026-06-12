const FIXED_STEP = 1 / 60; // фиксированный шаг физики — защита от туннелирования
const MAX_SUBSTEPS = 5;

export class Loop {
  constructor() {
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedCallbacks = []; // физика, контроллер
    this.frameCallbacks = []; // камера, анимации, рендер
    this.running = false;
  }

  onFixed(cb) { this.fixedCallbacks.push(cb); }
  onFrame(cb) { this.frameCallbacks.push(cb); }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1); // кламп против скачков после потери фокуса
      this.lastTime = now;
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
        for (const cb of this.fixedCallbacks) cb(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        steps++;
      }
      if (steps === MAX_SUBSTEPS) this.accumulator = 0;
      for (const cb of this.frameCallbacks) cb(dt);
    };
    requestAnimationFrame(tick);
  }

  stop() { this.running = false; }
}
