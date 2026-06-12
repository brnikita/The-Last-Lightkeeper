import * as THREE from 'three';
import Stats from 'stats.js';
import { createRenderer } from './Renderer.js';
import { Loop } from './Loop.js';
import { initPhysics } from '../world/Physics.js';
import { createLighting } from '../world/Lighting.js';
import { createTestLevel } from '../world/TestLevel.js';
import { Input } from '../systems/Input.js';
import { CharacterController } from '../player/CharacterController.js';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js';
import { Character } from '../player/Character.js';

export class Engine {
  async init(container) {
    this.container = container;
    this.renderer = createRenderer(container);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fb8cc);
    this.scene.fog = new THREE.FogExp2(0x9fb8cc, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 300
    );
    this.camera.position.set(4, 3, 6);

    this.physics = await initPhysics();

    createLighting(this.scene, 60);
    createTestLevel(this.scene, this.physics);

    this.input = new Input(this.renderer.domElement);
    this.player = new CharacterController(
      this.physics.RAPIER, this.physics.world, new THREE.Vector3(0, 2, 0)
    );
    this.tpCamera = new ThirdPersonCamera(this.camera, this.physics);

    this.character = new Character();
    await this.character.load(this.scene);

    this.loop = new Loop();
    this._feet = new THREE.Vector3();
    this._moveInput = { x: 0, z: 0 };

    if (import.meta.env.DEV) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      document.body.appendChild(this.stats.dom);
    }

    this.loop.onFixed((dt) => this.fixedUpdate(dt));
    this.loop.onFrame((dt) => this.frameUpdate(dt));

    window.addEventListener('resize', () => this.onResize());
  }

  fixedUpdate(dt) {
    const i = this.input;
    // направление в координатах камеры -> мировые
    let fx = 0, fz = 0;
    if (i.forward) fz -= 1;
    if (i.back) fz += 1;
    if (i.left) fx -= 1;
    if (i.right) fx += 1;
    // поворот input-вектора на yaw камеры: W ведёт от камеры (вперёд)
    const yaw = this.tpCamera.yaw;
    this._moveInput.x = fx * Math.cos(yaw) + fz * Math.sin(yaw);
    this._moveInput.z = -fx * Math.sin(yaw) + fz * Math.cos(yaw);

    this.player.update(dt, this._moveInput, i.run);
    this.physics.world.step();
  }

  frameUpdate(dt) {
    if (this.stats) this.stats.begin();

    const m = this.input.consumeMouse();
    this.tpCamera.applyMouse(m.x, m.y);

    this.player.getFeetPosition(this._feet);
    this.character.update(dt, this._feet, this.player.facing, this.player.speed, this.player.moving);
    this.tpCamera.update(dt, this._feet, this.player.collider);

    this.renderer.render(this.scene, this.camera);
    if (this.stats) this.stats.end();
  }

  start() { this.loop.start(); }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
