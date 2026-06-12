import * as THREE from 'three';
import { instantiate } from '../core/AssetLoader.js';

const INT = '/assets/models/env/interior';

// Интерьеры строятся в «карманах» мира, далеко от острова и выше воды.
let pocketIndex = 0;
function nextOrigin() {
  return new THREE.Vector3(300 + pocketIndex++ * 40, 3, 0);
}

// Универсальная комната: пол W x D тайлов, стены, мебель по конфигу.
// furniture: [{ file, x, z, rotY?, y?, scale?, collider? }] — координаты
// относительно центра комнаты.
async function createRoom(scene, physics, { tilesW = 3, tilesD = 2, furniture = [], lights = [] }) {
  const { RAPIER, world } = physics;
  const origin = nextOrigin();
  const g = new THREE.Group();
  g.position.copy(origin);
  scene.add(g);

  const colliderFor = (obj, shrink = 1) => {
    obj.updateWorldMatrix(true, true);
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((size.x / 2) * shrink, size.y / 2, (size.z / 2) * shrink)
        .setTranslation(center.x, center.y, center.z)
    );
  };

  const put = async (file, x, z, { rotY = 0, y = 0, scale = 1, collider = false, pack = null } = {}) => {
    const url = pack ? `/assets/models/env/${pack}/${file}` : `${INT}/${file}`;
    const o = await instantiate(url);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    o.scale.setScalar(scale);
    g.add(o);
    if (collider) colliderFor(o);
    return o;
  };

  // тайл пола — замер размера
  const probe = await instantiate(`${INT}/floor_wood_large.gltf.glb`);
  const tile = new THREE.Box3().setFromObject(probe).getSize(new THREE.Vector3());
  const T = Math.max(tile.x, tile.z) || 4;
  const W = tilesW, D = tilesD;
  const halfW = (W * T) / 2, halfD = (D * T) / 2;

  for (let i = 0; i < W; i++) {
    for (let j = 0; j < D; j++) {
      await put('floor_wood_large.gltf.glb', (i - (W - 1) / 2) * T, (j - (D - 1) / 2) * T);
    }
  }
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfW + 0.5, 0.15, halfD + 0.5)
      .setTranslation(origin.x, origin.y - 0.1, origin.z)
  );

  // стены; вход — по центру южной (z+)
  const doorCol = Math.floor(W / 2);
  const walls = [];
  for (let i = 0; i < W; i++) {
    const x = (i - (W - 1) / 2) * T;
    walls.push(put(i === doorCol ? 'wall_archedwindow_open.gltf.glb' : 'wall.gltf.glb', x, -halfD, { rotY: Math.PI, collider: true }));
    walls.push(put(i === doorCol ? 'wall_doorway.glb' : 'wall.gltf.glb', x, halfD, { rotY: 0, collider: i !== doorCol }));
  }
  for (let j = 0; j < D; j++) {
    const z = (j - (D - 1) / 2) * T;
    walls.push(put(j === 0 ? 'wall_archedwindow_open.gltf.glb' : 'wall.gltf.glb', -halfW, z, { rotY: Math.PI / 2, collider: true }));
    walls.push(put('wall.gltf.glb', halfW, z, { rotY: -Math.PI / 2, collider: true }));
  }
  await Promise.all(walls);
  // косяки дверного проёма
  const doorX = (doorCol - (W - 1) / 2) * T;
  for (const side of [-1, 1]) {
    world.createCollider(RAPIER.ColliderDesc.cuboid((W * T - T) / 4 + 0.6, 1.8, 0.3)
      .setTranslation(origin.x + doorX + side * (T / 2 + (W * T - T) / 4), origin.y + 1.8, origin.z + halfD));
  }
  // сам проём закрыт невидимой стеной: выйти можно только через E
  // (иначе игрок выпадает из «кармана» в море)
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 2.0, 0.12)
    .setTranslation(origin.x + doorX, origin.y + 2.0, origin.z + halfD + 0.35));

  for (const f of furniture) {
    await put(f.file, f.x, f.z, f);
  }
  for (const l of lights) {
    const pl = new THREE.PointLight(l.color ?? 0xffb45e, l.intensity ?? 1.3, l.dist ?? 12, 1.6);
    pl.position.set(origin.x + l.x, origin.y + (l.y ?? 1.9), origin.z + l.z);
    scene.add(pl);
  }

  return {
    group: g,
    origin,
    bounds: { halfW, halfD, T },
    entryPoint: origin.clone().add(new THREE.Vector3(doorX, 1.1, halfD - 1.6)),
    doorInside: (() => {
      const d = new THREE.Object3D();
      d.position.set(doorX, 1, halfD - 0.3);
      g.add(d);
      return d;
    })(),
    put, // для дополнительной сюжетной начинки
  };
}

// ---------- интерьеры всех зданий ----------
export async function createInteriors(scene, physics) {
  const rooms = {};

  // Дом деда: кровать, стол с радио, полка с жестянкой, фонарь
  const ded = await createRoom(scene, physics, {
    tilesW: 3, tilesD: 2,
    furniture: [
      { file: 'bed_decorated.gltf.glb', x: -4.5, z: -2.6, rotY: Math.PI / 2, collider: true },
      { file: 'table_medium_decorated_A.gltf.glb', x: 3.8, z: -2.7, collider: true },
      { file: 'chair.gltf.glb', x: 2.4, z: -2.5, rotY: 1.2 },
      { file: 'shelf_large.gltf.glb', x: 0, z: -3.55, collider: true },
      { file: 'shelf_small_candles.gltf.glb', x: 5.55, z: 0, rotY: -Math.PI / 2 },
      { file: 'barrel_small.gltf.glb', x: -5.2, z: 3 },
      { file: 'crates_stacked.gltf.glb', x: 5, z: 2.9, rotY: 0.4, collider: true },
      { file: 'stool.gltf.glb', x: -1.3, z: 0.6, rotY: 0.8 },
      { file: 'candle_triple.gltf.glb', x: 3.8, z: -2.7, y: 1.05 },
      { file: 'candle_lit.gltf.glb', x: 0.1, z: -3.5, y: 1.55 },
    ],
    lights: [
      { x: 3.8, z: -2.4, intensity: 1.5 },
      { x: 0, z: 0, intensity: 0.9, color: 0xffc887 },
    ],
  });
  // сюжетные объекты
  ded.radio = await ded.put('box.glb', 3.4, -2.4, { y: 1.05, scale: 0.45, pack: 'survival' });
  ded.lantern = await ded.put('lantern.glb', -2.9, -3.1, { scale: 0.32, pack: 'town' });
  ded.tin = await ded.put('chest.glb', 0.5, -3.4, { y: 1.05, scale: 0.4, pack: 'pirate' });
  rooms.dedHouse = ded;

  // Дом соседей (Михалыча): простой жилой
  const homeA = await createRoom(scene, physics, {
    tilesW: 3, tilesD: 2,
    furniture: [
      { file: 'bed_decorated.gltf.glb', x: 4.5, z: -2.6, rotY: -Math.PI / 2, collider: true },
      { file: 'table_medium_decorated_A.gltf.glb', x: -3.8, z: -2.5, collider: true },
      { file: 'stool.gltf.glb', x: -2.5, z: -1.6, rotY: 2.2 },
      { file: 'shelf_small_candles.gltf.glb', x: 0, z: -3.55 },
      { file: 'barrel_small.gltf.glb', x: -5.2, z: 2.8 },
      { file: 'candle_lit.gltf.glb', x: -3.8, z: -2.5, y: 1.05 },
    ],
    lights: [{ x: -3.5, z: -2, intensity: 1.2 }],
  });
  rooms.homeA = homeA;

  // Таверна: большая, длинные столы
  const tavern = await createRoom(scene, physics, {
    tilesW: 4, tilesD: 3,
    furniture: [
      { file: 'table_long_tablecloth_decorated_A.gltf.glb', x: -3, z: -2, collider: true },
      { file: 'table_long.gltf.glb', x: 3, z: -2, collider: true },
      { file: 'table_medium_tablecloth.gltf.glb', x: -3.5, z: 3, collider: true },
      { file: 'chair.gltf.glb', x: -3, z: -0.6, rotY: Math.PI },
      { file: 'chair.gltf.glb', x: -4.2, z: -3.4, rotY: 0 },
      { file: 'stool.gltf.glb', x: 3, z: -0.7 },
      { file: 'stool.gltf.glb', x: 4.2, z: -3.2 },
      { file: 'barrel_small.gltf.glb', x: 6.8, z: -4.5 },
      { file: 'crates_stacked.gltf.glb', x: -6.8, z: -4.4, rotY: 0.3, collider: true },
      { file: 'candle_triple.gltf.glb', x: -3, z: -2, y: 1.05 },
      { file: 'candle_lit.gltf.glb', x: 3, z: -2, y: 1.05 },
    ],
    lights: [
      { x: -3, z: -2, intensity: 1.4 },
      { x: 3.5, z: 1.5, intensity: 1.1 },
    ],
  });
  rooms.tavern = tavern;

  // Рынок: склад — ящики, бочки, прилавок
  const market = await createRoom(scene, physics, {
    tilesW: 3, tilesD: 2,
    furniture: [
      { file: 'crates_stacked.gltf.glb', x: -4.6, z: -2.8, collider: true },
      { file: 'crates_stacked.gltf.glb', x: -2.8, z: -3.1, rotY: 1.1, collider: true },
      { file: 'barrel_small.gltf.glb', x: 4.8, z: -3 },
      { file: 'barrel_small.gltf.glb', x: 5.4, z: -1.9 },
      { file: 'table_medium.gltf.glb', x: 1, z: -2.8, collider: true },
      { file: 'fish-large.glb', x: 1, z: -2.6, y: 1.1, scale: 0.5, pack: 'survival' },
      { file: 'box-open.glb', x: 3.2, z: 2.6, pack: 'survival' },
      { file: 'candle_lit.gltf.glb', x: 1, z: -2.9, y: 1.05 },
    ],
    lights: [{ x: 0, z: -1, intensity: 1.1 }],
  });
  rooms.market = market;

  // Мельница: мешки-ящики, жернова-бочки
  const windmill = await createRoom(scene, physics, {
    tilesW: 2, tilesD: 2,
    furniture: [
      { file: 'barrel_small.gltf.glb', x: -2.6, z: -2.6 },
      { file: 'barrel_small.gltf.glb', x: -1.7, z: -3 },
      { file: 'crates_stacked.gltf.glb', x: 2.6, z: -2.7, rotY: 0.6, collider: true },
      { file: 'resource-planks.glb', x: 2.6, z: 2.4, pack: 'survival' },
      { file: 'candle_lit.gltf.glb', x: 0, z: -3.3, y: 0.1 },
    ],
    lights: [{ x: 0, z: 0, intensity: 1.0 }],
  });
  rooms.windmill = windmill;

  return rooms;
}
