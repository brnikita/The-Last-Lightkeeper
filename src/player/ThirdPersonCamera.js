import * as THREE from 'three';

const DISTANCE = 4.5;
const MIN_PITCH = -0.45;
const MAX_PITCH = 1.2;
const SENSITIVITY = 0.0022;
const HEAD_OFFSET = new THREE.Vector3(0, 1.55, 0); // точка над плечами, на которую смотрим
const COLLISION_MARGIN = 0.25; // отступ от стены ~ размер near-plane бокса
const POSITION_LERP = 18;

// Камера третьего лица с коллизией: луч от головы игрока к желаемой позиции
// камеры через Rapier castShape (толстый луч — сфера, чтобы не клипать near-plane).
export class ThirdPersonCamera {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics; // { RAPIER, world }
    this.yaw = 0;
    this.pitch = 0.25;
    this.currentDistance = DISTANCE;
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this.collisionSphere = new physics.RAPIER.Ball(COLLISION_MARGIN);
  }

  applyMouse(dx, dy) {
    this.yaw -= dx * SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * SENSITIVITY, MIN_PITCH, MAX_PITCH);
  }

  update(dt, playerFeetPos, playerCollider) {
    this._target.copy(playerFeetPos).add(HEAD_OFFSET);

    this._dir.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this._desired.copy(this._target).addScaledVector(this._dir, DISTANCE);

    // castShape сферой от головы к желаемой позиции камеры, игнорируя коллайдер игрока
    let targetDistance = DISTANCE;
    const hit = this.physics.world.castShape(
      this._target,
      { x: 0, y: 0, z: 0, w: 1 },
      this._dir,
      this.collisionSphere,
      0,            // targetDistance (доп. зазор не нужен — сфера уже с запасом)
      DISTANCE,
      true,         // stop at penetration
      undefined, undefined,
      playerCollider ?? undefined,
      undefined,
      (c) => c !== playerCollider
    );
    if (hit) targetDistance = Math.max(0.4, hit.time_of_impact);

    // приближение мгновенно (чтобы не видеть сквозь стену), отдаление — плавно
    if (targetDistance < this.currentDistance) {
      this.currentDistance = targetDistance;
    } else {
      this.currentDistance += (targetDistance - this.currentDistance) * Math.min(1, POSITION_LERP * dt);
    }

    this.camera.position.copy(this._target).addScaledVector(this._dir, this.currentDistance);
    this.camera.lookAt(this._target);
  }
}
