import * as THREE from 'three';

const WALK_SPEED = 2.5;   // м/с
const RUN_SPEED = 5.0;
const SWIM_SPEED = 1.7;
const CAPSULE_HALF_HEIGHT = 0.55; // цилиндрическая часть
const CAPSULE_RADIUS = 0.35;
const GRAVITY = -9.81;
const TURN_LERP = 12; // скорость поворота модели к направлению движения
const SWIM_DEPTH = -0.95;     // глубина дна, при которой начинаем плыть
const SWIM_CENTER_Y = 0.32;   // центр капсулы на плаву (по грудь в воде)

// Кинематический контроллер на Rapier: позицию двигает контроллер, не анимация.
export class CharacterController {
  constructor(RAPIER, world, spawnPosition) {
    this.world = world;

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        spawnPosition.x, spawnPosition.y, spawnPosition.z
      )
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS),
      this.body
    );

    this.controller = world.createCharacterController(0.01); // offset — зазор от геометрии
    this.controller.enableAutostep(0.4, 0.2, true);          // ступеньки до 40 см
    this.controller.enableSnapToGround(0.4);                 // не парить на склонах
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    this.verticalVelocity = 0;
    this.grounded = false;
    this.swimming = false;
    this.groundHeightFn = null; // (x, z) -> высота терена; задаёт Engine

    // Куда смотрит модель персонажа (yaw, рад) и фактическая скорость для анимаций
    this.facing = 0;
    this.speed = 0;
    this.moving = false;

    this.position = new THREE.Vector3().copy(spawnPosition);
  }

  // moveInput: {x, z} в мировых координатах (уже повёрнут по yaw камеры), run: bool
  update(dt, moveInput, run) {
    // в глубокой воде — плывём: дно не достать, держимся у поверхности
    const groundH = this.groundHeightFn
      ? this.groundHeightFn(this.position.x, this.position.z)
      : -100;
    this.swimming = groundH < SWIM_DEPTH && this.position.y < SWIM_CENTER_Y + 0.5;

    const speed = this.swimming ? SWIM_SPEED : run ? RUN_SPEED : WALK_SPEED;
    const len = Math.hypot(moveInput.x, moveInput.z);
    this.moving = len > 0.01;

    let dx = 0, dz = 0;
    if (this.moving) {
      dx = (moveInput.x / len) * speed * dt;
      dz = (moveInput.z / len) * speed * dt;
      const targetFacing = Math.atan2(moveInput.x, moveInput.z);
      let diff = targetFacing - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, TURN_LERP * dt);
    }
    this.speed = this.moving ? speed : 0;

    let dy;
    if (this.swimming) {
      // плавучесть: мягко подтягиваемся к поверхности, гравитация выключена
      this.verticalVelocity = 0;
      dy = (SWIM_CENTER_Y - this.position.y) * Math.min(1, 6 * dt);
    } else {
      this.verticalVelocity = this.grounded ? -0.5 : this.verticalVelocity + GRAVITY * dt;
      dy = this.verticalVelocity * dt;
    }

    this.controller.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz });
    this.grounded = this.controller.computedGrounded();
    const corrected = this.controller.computedMovement();

    const t = this.body.translation();
    const next = { x: t.x + corrected.x, y: t.y + corrected.y, z: t.z + corrected.z };
    this.body.setNextKinematicTranslation(next);
    this.position.set(next.x, next.y, next.z);
  }

  // Мгновенное перемещение (спавн, загрузка сейва, катсцены).
  teleport(pos) {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.position.set(pos.x, pos.y, pos.z);
    this.verticalVelocity = 0;
  }

  // Точка под ногами (низ капсулы) — сюда ставим модель персонажа.
  getFeetPosition(target) {
    return target.set(
      this.position.x,
      this.position.y - CAPSULE_HALF_HEIGHT - CAPSULE_RADIUS,
      this.position.z
    );
  }
}

export const PLAYER_CAPSULE = { halfHeight: CAPSULE_HALF_HEIGHT, radius: CAPSULE_RADIUS };
