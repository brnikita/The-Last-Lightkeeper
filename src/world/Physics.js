import RAPIER from '@dimforge/rapier3d-compat';

let initialized = false;

export async function initPhysics() {
  if (!initialized) {
    // Warning «using deprecated parameters…» в консоли идёт изнутри
    // rapier3d-compat 0.19.3 — безвреден, нашим кодом не лечится.
    await RAPIER.init();
    initialized = true;
  }
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // тонкие коллайдеры (перила, столбики) — камера их игнорирует
  const cameraIgnored = new Set();
  return { RAPIER, world, cameraIgnored };
}

// Trimesh-коллайдер из THREE.Mesh (для статичного окружения).
export function addTrimeshCollider(RAPIER, world, mesh) {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const positions = geo.attributes.position.array;
  let indices = geo.index ? geo.index.array : null;
  if (!indices) {
    indices = new Uint32Array(positions.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }
  const desc = RAPIER.ColliderDesc.trimesh(
    new Float32Array(positions),
    new Uint32Array(indices)
  );
  const collider = world.createCollider(desc);
  geo.dispose();
  return collider;
}

// Бокс-коллайдер по world-размерам меша (дешевле trimesh для простых форм).
export function addBoxCollider(RAPIER, world, position, halfExtents, rotation = null) {
  const desc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
    .setTranslation(position.x, position.y, position.z);
  if (rotation) desc.setRotation(rotation);
  return world.createCollider(desc);
}
