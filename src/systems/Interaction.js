import * as THREE from 'three';

const INTERACT_RADIUS = 2.6;
const HIGHLIGHT_COLOR = new THREE.Color(0xe8b96f);

// Интерактивные объекты + триггер-зоны.
// Подсветка — пульс эмиссии у ближайшего доступного объекта; активация — E.
export class Interaction {
  constructor(ui) {
    this.ui = ui;
    this.interactables = []; // { id, object, prompt, onInteract, condition?, used }
    this.zones = [];         // { id, pos, radius, onEnter, once, entered }
    this.focused = null;
    this._time = 0;
    this._tmp = new THREE.Vector3();
  }

  add({ id, object, prompt, onInteract, condition = null, once = true }) {
    object.traverse?.((o) => { if (o.isMesh) o.userData.interactId = id; });
    this.interactables.push({ id, object, prompt, onInteract, condition, once, used: false });
  }

  addZone({ id, pos, radius = 4, onEnter, once = true }) {
    this.zones.push({ id, pos: pos.clone(), radius, onEnter, once, entered: false });
  }

  remove(id) {
    const i = this.interactables.findIndex((x) => x.id === id);
    if (i >= 0) {
      this._setHighlight(this.interactables[i], 0);
      this.interactables.splice(i, 1);
      if (this.focused?.id === id) { this.focused = null; this.ui.hidePrompt(); }
    }
  }

  update(dt, playerPos, interactPressed) {
    this._time += dt;

    // Зоны
    for (const z of this.zones) {
      if (z.entered && z.once) continue;
      const inside = playerPos.distanceTo(z.pos) < z.radius;
      if (inside && !z.entered) {
        z.entered = true;
        if (import.meta.env.DEV) console.log(`[Zone] enter: ${z.id}`);
        z.onEnter();
      } else if (!inside && !z.once) {
        z.entered = false;
      }
    }

    // Ближайший доступный интерактив
    let best = null, bestDist = INTERACT_RADIUS;
    for (const it of this.interactables) {
      if (it.used && it.once) continue;
      if (it.condition && !it.condition()) continue;
      it.object.getWorldPosition(this._tmp);
      const d = this._tmp.distanceTo(playerPos);
      if (d < bestDist) { best = it; bestDist = d; }
    }

    if (best !== this.focused) {
      if (this.focused) this._setHighlight(this.focused, 0);
      this.focused = best;
      if (best) this.ui.showPrompt(best.prompt);
      else this.ui.hidePrompt();
    }
    if (this.focused) {
      const pulse = 0.35 + 0.25 * Math.sin(this._time * 4);
      this._setHighlight(this.focused, pulse);
      if (interactPressed) {
        const it = this.focused;
        it.used = true;
        this._setHighlight(it, 0);
        this.focused = null;
        this.ui.hidePrompt();
        it.onInteract();
      }
    }
  }

  _setHighlight(it, intensity) {
    it.object.traverse?.((o) => {
      if (o.isMesh && o.material && 'emissive' in o.material) {
        if (!o.userData._origEmissive) {
          o.userData._origEmissive = o.material.emissive.clone();
          o.material = o.material.clone(); // не подсвечивать другие меши с тем же материалом
        }
        o.material.emissive.copy(o.userData._origEmissive).lerp(HIGHLIGHT_COLOR, intensity);
        o.material.emissiveIntensity = intensity > 0 ? 1 : 1;
      }
    });
  }
}
