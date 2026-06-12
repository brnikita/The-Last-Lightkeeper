import * as THREE from 'three';
import Stats from 'stats.js';
import { createRenderer } from './Renderer.js';
import { Loop } from './Loop.js';
import { initPhysics } from '../world/Physics.js';
import { createTerrain } from '../world/Terrain.js';
import { createEnvironment } from '../world/Environment.js';
import { createIsland } from '../world/Island.js';
import { Input } from '../systems/Input.js';
import { CharacterController } from '../player/CharacterController.js';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js';
import { Character } from '../player/Character.js';
import { createPostFX } from '../systems/PostFX.js';
import { AudioManager } from '../systems/AudioManager.js';
import { Dialogue } from '../systems/Dialogue.js';
import { Inventory } from '../systems/Inventory.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { Interaction } from '../systems/Interaction.js';
import { HUD } from '../ui/HUD.js';
import { GameScript } from '../game/GameScript.js';

export class Engine {
  async init(container, onProgress = () => {}) {
    this.container = container;
    this.renderer = createRenderer(container);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 600);

    onProgress(0.1, 'Физика…');
    this.physics = await initPhysics();

    onProgress(0.2, 'Небо и море…');
    this.env = await createEnvironment(this.scene, this.renderer);

    onProgress(0.35, 'Остров…');
    this.terrain = createTerrain(this.scene, this.physics);

    onProgress(0.5, 'Деревня и пристань…');
    this.anchors = await createIsland(this.scene, this.physics, this.terrain);

    onProgress(0.7, 'Маяк…');
    await this._buildLighthouse();

    onProgress(0.8, 'Смотритель…');
    this.input = new Input(this.renderer.domElement);
    this.hud = new HUD();
    this.audio = new AudioManager();
    this.inventory = new Inventory(this.hud);
    this.dialogue = new Dialogue(this.audio, this.hud);
    this.saveSystem = new SaveSystem();
    this.interaction = new Interaction(this.hud);

    const spawn = this.anchors.positions.spawn;
    this.player = new CharacterController(this.physics.RAPIER, this.physics.world,
      new THREE.Vector3(spawn.x, spawn.y + 1.2, spawn.z));
    this.tpCamera = new ThirdPersonCamera(this.camera, this.physics);
    this.tpCamera.yaw = 0; // камера с моря, Эли лицом к острову
    this.player.facing = Math.PI;

    this.character = new Character();
    await this.character.load(this.scene);

    onProgress(0.9, 'Свет и пост-обработка…');
    this.postfx = createPostFX(this.renderer, this.scene, this.camera);
    this._initRain();

    // сейв
    const saved = this.saveSystem.load();
    if (saved) {
      this.inventory.restore(saved.inventory);
      this.dialogue.restore(saved.dialogue);
      this.player.teleport(saved.pos);
      this.tpCamera.yaw = saved.yaw ?? Math.PI;
    }

    this.script = new GameScript(this, this.anchors);
    this.script.start(!!saved);
    this._applySavedFlags();

    this.loop = new Loop();
    this._feet = new THREE.Vector3();
    this._moveInput = { x: 0, z: 0 };
    this._time = 0;
    this._stepTimer = 0;
    this._saveTimer = 0;
    this._savePending = false;

    if (import.meta.env.DEV) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      document.body.appendChild(this.stats.dom);
      console.log('[Engine] draw calls будут видны: __engine.renderer.info.render.calls');
    }

    this.loop.onFixed((dt) => this.fixedUpdate(dt));
    this.loop.onFrame((dt) => this.frameUpdate(dt));
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('beforeunload', () => this.saveSystem.save(this));
    onProgress(1, 'Готово');
  }

  async _buildLighthouse() {
    const pos = this.anchors.positions.lighthouse;
    let group = null;
    try {
      const mod = await import('../world/Lighthouse.js');
      group = await mod.createLighthouse(THREE);
    } catch (e) {
      console.warn('[Engine] Lighthouse.js недоступен, ставлю замену из Pirate Kit:', e.message);
      const { instantiate } = await import('./AssetLoader.js');
      group = await instantiate('/assets/models/env/pirate/tower-complete-large.glb');
      group.scale.setScalar(1.8);
      const door = new THREE.Object3D();
      door.name = 'lighthouseDoor';
      door.position.set(0, 1, 2.6);
      group.add(door);
    }
    group.position.copy(pos);
    this.scene.add(group);
    this.lighthouse = group;
    group.updateWorldMatrix(true, true);

    const bbox = new THREE.Box3().setFromObject(group);
    const size = bbox.getSize(new THREE.Vector3());
    const { RAPIER, world } = this.physics;

    // именованные узлы модели
    let door = null, gallery = null, lampMount = null;
    group.traverse((o) => {
      if (o.name === 'lighthouseDoor') door = o;
      if (o.name === 'gallery') gallery = o;
      if (o.name === 'lampMount') lampMount = o;
    });
    this.anchors.lighthouseDoor = door || group;

    const galleryY = gallery
      ? gallery.getWorldPosition(new THREE.Vector3()).y
      : pos.y + size.y * 0.68;

    // коллайдеры: тело башни до галереи, диск галереи, фонарь, перила-стенка
    world.createCollider(RAPIER.ColliderDesc.cylinder((galleryY - pos.y) / 2, 2.45)
      .setTranslation(pos.x, pos.y + (galleryY - pos.y) / 2, pos.z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.12, 2.6)
      .setTranslation(pos.x, galleryY + 0.12, pos.z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.2, 1.5)
      .setTranslation(pos.x, galleryY + 0.24 + 1.2, pos.z));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0));
      const rail = world.createCollider(RAPIER.ColliderDesc.cuboid(0.7, 0.6, 0.05)
        .setTranslation(pos.x + Math.sin(a) * 2.45, galleryY + 0.8, pos.z + Math.cos(a) * 2.45)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
      this.physics.cameraIgnored.add(rail.handle);
    }

    // точка появления игрока на галерее — на кольце между башней и перилами
    this.anchors.positions.lighthouseTop = new THREE.Vector3(pos.x + 2.0, galleryY + 0.3, pos.z);

    // лампа и луч (выключены до финала)
    const lampPos = lampMount
      ? lampMount.getWorldPosition(new THREE.Vector3())
      : pos.clone().add(new THREE.Vector3(0, Math.max(18, size.y * 0.9), 0));
    this.lampLight = new THREE.SpotLight(0xffe6b0, 0, 400, 0.16, 0.45, 0.6);
    this.lampLight.position.copy(lampPos);
    this.lampLight.target.position.set(lampPos.x - 60, lampPos.y - 8, lampPos.z);
    this.scene.add(this.lampLight, this.lampLight.target);

    const lampCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x332f25, emissive: 0x000000, emissiveIntensity: 0 })
    );
    lampCore.position.copy(lampPos);
    this.scene.add(lampCore);
    this.lampCore = lampCore;

    // конус луча — additive, виден в тумане
    const beamGeo = new THREE.ConeGeometry(7, 90, 24, 1, true);
    beamGeo.translate(0, -45, 0);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe9bd, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.position.copy(lampPos);
    this.scene.add(this.beam);
    this.lighthouseLit = false;
  }

  _applySavedFlags() {
    const s = this.saveSystem;
    for (let i = 1; i <= 4; i++) {
      if (s.hasFlag(`lens_${i}_taken`)) {
        const o = this.anchors.interactables[`lens_${i}`];
        o?.parent?.remove(o);
        this.interaction.remove(`lens_${i}`);
      }
    }
    if (s.hasFlag('lantern_taken')) this.interaction.remove('oldLantern');
    if (s.hasFlag('key_taken')) this.interaction.remove('teaTin');
    if (this.inventory.has('radio_handle') || s.hasFlag('radio_fixed')) this.interaction.remove('radioHandle');
    if (s.hasFlag('finale_done')) { this.setStorm(false, true); this.igniteLighthouse(); }
    this.script.refreshObjective();
  }

  // ---------- шторм и финал ----------
  setStorm(on, calmAfter = false) {
    this.storm = on;
    if (on) {
      this.scene.fog.color.set(0x4a5666);
      this.scene.fog.density = 0.016;
      this.scene.backgroundIntensity = 0.25;
      this.scene.environmentIntensity = 0.3;
      this.env.sun.intensity = 0.5;
      this.env.sun.color.set(0x9fb2cc);
      this.audio.loadSfx('storm_loop', { loop: true, volume: 0 }).play();
      const st = this.audio.sfx.get('storm_loop');
      st.fade(0, 0.7, 3000);
      this.rain.visible = true;
      for (const l of this.anchors.lights) l.intensity = 1.4;
      setTimeout(() => this.audio.playSfx('thunder', 0.8), 4000);
    } else {
      const st = this.audio.sfx.get('storm_loop');
      if (st) { st.fade(st.volume(), 0, 2000); setTimeout(() => st.stop(), 2100); }
      this.rain.visible = false;
      if (calmAfter) {
        this.scene.fog.color.set(0x39435a);
        this.scene.fog.density = 0.01;
        this.scene.backgroundIntensity = 0.35;
        for (const l of this.anchors.lights) l.intensity = 1.2;
      }
    }
  }

  igniteLighthouse() {
    this.lighthouseLit = true;
    this.lampLight.intensity = 900;
    this.lampCore.material.emissive.set(0xffe6b0);
    this.lampCore.material.emissiveIntensity = 6;
    this.beam.material.opacity = 0.16;
    this.audio.addPositional('lighthouse_hum', this.lampCore.position, { refDist: 6, maxDist: 60, volume: 0.6 });
  }

  _initRain() {
    const N = 1600;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaabbd0, size: 0.12, transparent: true, opacity: 0.55, sizeAttenuation: true, fog: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  requestSave() { this._savePending = true; }

  // ---------- циклы ----------
  fixedUpdate(dt) {
    const i = this.input;
    let fx = 0, fz = 0;
    if (!this.hud.modalOpen) {
      if (i.forward) fz -= 1;
      if (i.back) fz += 1;
      if (i.left) fx -= 1;
      if (i.right) fx += 1;
    }
    const yaw = this.tpCamera.yaw;
    this._moveInput.x = fx * Math.cos(yaw) + fz * Math.sin(yaw);
    this._moveInput.z = -fx * Math.sin(yaw) + fz * Math.cos(yaw);
    this.player.update(dt, this._moveInput, i.run);
    this.physics.world.step();

    // шаги
    if (this.player.moving && this.player.grounded) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        this._stepTimer = this.player.speed > 3.5 ? 0.32 : 0.5;
        const groundH = this.terrain.height(this.player.position.x, this.player.position.z);
        const onStructure = this.player.position.y - groundH > 3; // галерея маяка
        const overWater = groundH < 0.3;
        this.audio.playSfx(onStructure ? 'stairs_metal' : overWater ? 'footstep_wood' : 'footstep_grass', 0.35);
      }
    }
  }

  frameUpdate(dt) {
    if (this.stats) this.stats.begin();
    this._time += dt;

    const m = this.input.consumeMouse();
    if (!this.hud.modalOpen) this.tpCamera.applyMouse(m.x, m.y);

    this.player.getFeetPosition(this._feet);
    this.character.update(dt, this._feet, this.player.facing, this.player.speed, this.player.moving);
    this.tpCamera.update(dt, this._feet, this.player.collider);
    // вблизи прячем модель, чтобы камера не оказывалась внутри головы
    this.character.root.visible = this.tpCamera.currentDistance > 1.05;

    this.interaction.update(dt, this.player.position, this.hud.modalOpen ? false : this.input.consumeInteract());
    this.anchors.updateLenses?.(this._time);
    this.env.updateWater(dt);
    this.audio.updateListener(this.camera);

    // вращение луча маяка
    if (this.lighthouseLit) {
      const a = this._time * 0.45;
      this.beam.rotation.y = a;
      const t = this.lampLight.target.position;
      const lp = this.lampLight.position;
      t.set(lp.x - Math.cos(a) * 80, lp.y - 7, lp.z + Math.sin(a) * 80);
    }

    // дождь следует за игроком
    if (this.rain.visible) {
      const rp = this.rain.geometry.attributes.position;
      for (let i = 0; i < rp.count; i++) {
        let y = rp.getY(i) - dt * 22;
        if (y < 0) y = 28;
        rp.setY(i, y);
      }
      rp.needsUpdate = true;
      this.rain.position.set(this.player.position.x, 0, this.player.position.z);
    }

    // автосейв (раз в 5с при изменениях)
    this._saveTimer += dt;
    if (this._savePending && this._saveTimer > 5) {
      this._saveTimer = 0;
      this._savePending = false;
      this.saveSystem.save(this);
    }

    this.postfx.render(dt);
    if (this.stats) this.stats.end();
  }

  start() { this.loop.start(); }

  onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx.setSize(w, h);
  }
}
