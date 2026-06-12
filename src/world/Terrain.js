import * as THREE from 'three';

// Остров ~220x220 м. Высота — сумма гауссовых холмов; берег плавно уходит под воду.
// Уровень воды y=0. Вершинные цвета: песок -> трава -> скалы.
const SIZE = 220;
const SEGMENTS = 128;

const HILLS = [
  // x, z, радиус, высота
  [46, -50, 40, 13],    // северо-восточный холм под маяком
  [-15, -30, 38, 5],    // центральное плато (деревня на южном склоне)
  [25, -10, 30, 4.5],   // восточный лес
  [-55, -55, 30, 6],    // северо-западные скалы
  [-12, 32, 26, 2.2],   // прибрежная полоса у пристани
  [-58, 8, 22, 1.6],    // западная коса у бухты
];

function islandMask(x, z) {
  // мягкий «блин» острова: 1 в центре, 0 за радиусом
  const cx = -2, cz = -16;
  const r = Math.hypot((x - cx) / 86, (z - cz) / 64);
  // 1 при r<=0.6, плавный спад к 0 при r>=1.02
  return 1 - THREE.MathUtils.smoothstep(r, 0.6, 1.02);
}

export function terrainHeight(x, z) {
  let bump = 0;
  for (const [hx, hz, hr, hh] of HILLS) {
    const d2 = ((x - hx) ** 2 + (z - hz) ** 2) / (hr * hr);
    bump += hh * Math.exp(-d2 * 1.6);
  }
  // лёгкий шум, чтобы поверхность не была мёртвой
  const n = Math.sin(x * 0.18) * Math.cos(z * 0.16) * 0.35
    + Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.06 - 0.4) * 0.8;
  const mask = islandMask(x, z);
  // от морского дна (-3.5) к суше (~2.4 + холмы)
  let h = THREE.MathUtils.lerp(-3.5, 2.4 + bump + n, mask);

  // ровное плато под маяком (центр 46,-50), радиус 9, мягкий переход до 16
  const dl = Math.hypot(x - 46, z + 50);
  if (dl < 16) {
    const k = 1 - THREE.MathUtils.smoothstep(dl, 7, 16);
    h = THREE.MathUtils.lerp(h, 9.0, k);
  }
  return h;
}

const COL_SAND = new THREE.Color(0xcfb98a);
const COL_GRASS = new THREE.Color(0x6f8f4e);
const COL_GRASS_DRY = new THREE.Color(0x9aa05c);
const COL_ROCK = new THREE.Color(0x8d8578);
const COL_SEABED = new THREE.Color(0x73806f);

export function createTerrain(scene, physics) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // окраска по высоте + лёгкая вариация
    const v = Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.5 + 0.5;
    if (h < 0.25) c.copy(COL_SEABED).lerp(COL_SAND, THREE.MathUtils.clamp((h + 1.5) / 1.75, 0, 1));
    else if (h < 1.1) c.copy(COL_SAND);
    else if (h < 7.5) c.copy(COL_GRASS).lerp(COL_GRASS_DRY, v * 0.55);
    else c.copy(COL_GRASS_DRY).lerp(COL_ROCK, THREE.MathUtils.clamp((h - 7.5) / 4, 0, 1));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  // Trimesh-коллайдер
  const { RAPIER, world } = physics;
  const vertices = new Float32Array(pos.array);
  const indices = new Uint32Array(geo.index.array);
  world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices));

  return { mesh, height: terrainHeight, size: SIZE };
}
