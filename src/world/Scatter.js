import * as THREE from 'three';
import { getMeshParts } from '../core/AssetLoader.js';

// Палитра Kenney Nature Kit слишком пастельная (бирюзовая хвоя) —
// перекрашиваем по имени материала в природные тона Firewatch.
const TINTS = {
  leafsDark: 0x3f7252,
  leafs: 0x4d8159,
  grass: 0x6da25e,
  woodBark: 0x7d5a3e,
  woodBarkDark: 0x6e4f36,
  dirt: 0x8f7250,
  _defaultMat: 0x969088,
};
const tinted = new Map();
function tintMaterial(mat) {
  if (!mat?.name || !(mat.name in TINTS)) return mat;
  if (!tinted.has(mat.name)) {
    const m = mat.clone();
    m.color.set(TINTS[mat.name]);
    tinted.set(mat.name, m);
  }
  return tinted.get(mat.name);
}

// Рассадка растительности через InstancedMesh: один GLB -> по InstancedMesh на меш.
// transforms: [{x, z, rotY, scale}] — y берётся из height(x, z).
export async function scatterInstanced(scene, url, transforms, height, {
  castShadow = true, yOffset = 0,
} = {}) {
  const parts = await getMeshParts(url);
  if (!parts.length) return [];
  const dummy = new THREE.Object3D();
  const meshes = [];
  for (const part of parts) {
    const im = new THREE.InstancedMesh(part.geometry, tintMaterial(part.material), transforms.length);
    im.castShadow = castShadow;
    im.receiveShadow = true;
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      dummy.position.set(t.x, height(t.x, t.z) + yOffset, t.z);
      dummy.rotation.set(0, t.rotY ?? 0, 0);
      dummy.scale.setScalar(t.scale ?? 1);
      dummy.updateMatrix();
      // матрица меша внутри GLB (части дерева смещены друг относительно друга)
      dummy.matrix.multiply(part.matrix);
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    meshes.push(im);
  }
  return meshes;
}

// Случайные точки в круге с минимальной дистанцией от запретных зон.
export function scatterPoints(rng, count, cx, cz, radius, { minR = 0, avoid = [], heightFn = null, hMin = -Infinity, hMax = Infinity } = {}) {
  const pts = [];
  let guard = 0;
  while (pts.length < count && guard++ < count * 30) {
    const a = rng() * Math.PI * 2;
    const r = minR + Math.sqrt(rng()) * (radius - minR);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (avoid.some((av) => Math.hypot(x - av.x, z - av.z) < av.r)) continue;
    if (heightFn) {
      const h = heightFn(x, z);
      if (h < hMin || h > hMax) continue;
    }
    pts.push({ x, z, rotY: rng() * Math.PI * 2, scale: 0.85 + rng() * 0.4 });
  }
  return pts;
}

// Детерминированный PRNG, чтобы остров был одинаковым между сессиями.
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
