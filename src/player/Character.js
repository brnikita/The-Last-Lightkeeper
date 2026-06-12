import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = '/assets/models/character.glb';
const CROSSFADE = 0.25;

// Имена клипов ищем по подстрокам — у KayKit/Mixamo они различаются.
const CLIP_PATTERNS = {
  idle: [/^idle$/i, /idle/i],
  walk: [/^walking?(_a)?$/i, /walk/i],
  run: [/^running?(_a)?$/i, /run/i, /sprint/i],
  jump: [/^jump_idle$/i, /jump/i],
  swim: [/^lie_idle$/i, /swim/i],
  interact: [/^interact$/i, /^use_item$/i, /^pickup$/i],
};

function findClip(clips, patterns) {
  for (const p of patterns) {
    const c = clips.find((c) => p.test(c.name));
    if (c) return c;
  }
  return null;
}

// Визуальный персонаж: GLB + AnimationMixer с кроссфейдом idle/walk/run.
// Позицию задаёт CharacterController; анимации in-place (без root motion).
export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.loaded = false;
  }

  async load(scene) {
    scene.add(this.root);
    try {
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      const model = gltf.scene;
      const WEAPON_RE = /knife|crossbow|throwable|sword|axe|dagger|bow|shield|staff|arrow/i;
      model.traverse((o) => {
        if (o.isMesh) {
          if (WEAPON_RE.test(o.name)) {
            o.visible = false; // Эли — смотритель, не боец
            return;
          }
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false; // скиннед-меши неверно отсекаются по исходному AABB
        }
      });

      // Нормализация масштаба: рост персонажа ~1.75 м
      const bbox = new THREE.Box3().setFromObject(model);
      const height = bbox.max.y - bbox.min.y;
      if (height > 0.1) {
        const k = 1.75 / height;
        if (Math.abs(k - 1) > 0.05) model.scale.setScalar(k);
      }
      // Ноги на пол: пивот может быть не в ступнях
      const bbox2 = new THREE.Box3().setFromObject(model);
      model.position.y = -bbox2.min.y;

      this.root.add(model);

      this.mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations || [];
      for (const key of Object.keys(CLIP_PATTERNS)) {
        const clip = findClip(clips, CLIP_PATTERNS[key]);
        if (clip) {
          this.actions[key] = this.mixer.clipAction(clip);
          this.actions[key].enabled = true;
        } else {
          console.warn(`[Character] Нет клипа для состояния "${key}"`);
        }
      }
      // Фолбэк: если нет walk/run — используем idle, чтобы не было T-позы
      this.actions.walk = this.actions.walk || this.actions.idle;
      this.actions.run = this.actions.run || this.actions.walk;
      this.actions.jump = this.actions.jump || this.actions.idle;
      this.actions.swim = this.actions.swim || this.actions.walk;
      if (this.actions.idle) this.play('idle');
      this.loaded = true;
      console.log('[Character] Загружен, клипы:', clips.map((c) => c.name).join(', '));
    } catch (err) {
      console.warn('[Character] Модель не загрузилась, ставлю заглушку-капсулу:', err.message);
      const placeholder = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.05, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xcc6644, roughness: 0.7 })
      );
      placeholder.position.y = 0.9;
      placeholder.castShadow = true;
      this.root.add(placeholder);
      // «нос» — видно направление
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.3, 12),
        new THREE.MeshStandardMaterial({ color: 0xffaa33 })
      );
      nose.position.set(0, 1.5, 0.4);
      nose.rotation.x = Math.PI / 2;
      this.root.add(nose);
    }
  }

  play(name) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().fadeIn(CROSSFADE).play();
    if (this.current) this.current.fadeOut(CROSSFADE);
    this.current = next;
  }

  // Одноразовая анимация (Interact и т.п.); по окончании возвращается idle.
  playOnce(name, onDone = null) {
    const act = this.actions[name];
    if (!act || !this.mixer) { onDone?.(); return; }
    this.oneShot = true;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.reset().fadeIn(0.15).play();
    if (this.current && this.current !== act) this.current.fadeOut(0.15);
    this.current = act;
    const onFin = (e) => {
      if (e.action !== act) return;
      this.mixer.removeEventListener('finished', onFin);
      this.oneShot = false;
      this.play('idle');
      onDone?.();
    };
    this.mixer.addEventListener('finished', onFin);
  }

  update(dt, feetPosition, facing, speed, moving, swimming = false, airborne = false) {
    this.root.position.copy(feetPosition);
    this.root.rotation.y = facing;
    if (this.mixer) {
      if (this.oneShot) {
        this.mixer.update(dt);
        return;
      }
      if (swimming) {
        // лежачая поза на поверхности воды + лёгкое покачивание
        this.play('swim');
        this._swimT = (this._swimT || 0) + dt;
        this.root.position.y = -0.22 + Math.sin(this._swimT * 1.8) * 0.05;
      } else if (airborne) {
        this.play('jump');
      } else {
        if (this.actions.walk) this.actions.walk.timeScale = 1;
        if (!moving) this.play('idle');
        else if (speed > 3.5) this.play('run');
        else this.play('walk');
      }
      this.mixer.update(dt);
    }
  }
}
