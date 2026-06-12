const KEY = 'lightkeeper_save_v1';

// localStorage: позиция, инвентарь, прослушанные реплики, флаги прогресса.
export class SaveSystem {
  constructor() {
    this.flags = new Set(); // произвольные флаги: radio_fixed, door_open, finale...
  }

  setFlag(f) { this.flags.add(f); this.dirty = true; }
  hasFlag(f) { return this.flags.has(f); }

  save(engine) {
    try {
      const p = engine.player.position;
      const data = {
        v: 1,
        pos: { x: p.x, y: p.y, z: p.z },
        yaw: engine.tpCamera.yaw,
        inventory: engine.inventory.serialize(),
        dialogue: engine.dialogue.serialize(),
        flags: [...this.flags],
        t: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Save] Не удалось сохранить:', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      this.flags = new Set(data.flags || []);
      return data;
    } catch {
      return null;
    }
  }

  clear() { localStorage.removeItem(KEY); this.flags.clear(); }
}
