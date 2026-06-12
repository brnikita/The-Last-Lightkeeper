import * as THREE from 'three';
import { instantiate } from '../core/AssetLoader.js';

const INT = '/assets/models/env/interior';
// Интерьер строится в «кармане» мира, далеко от острова (и выше воды)
export const INTERIOR_ORIGIN = new THREE.Vector3(300, 3, 0);

// Комната дома деда: пол/стены KayKit Dungeon Remastered + мебель.
// Возвращает анкеры сюжетных объектов и точку входа.
export async function createDedHouseInterior(scene, physics) {
  const { RAPIER, world } = physics;
  const g = new THREE.Group();
  g.position.copy(INTERIOR_ORIGIN);
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

  const put = async (file, x, z, { rotY = 0, y = 0, scale = 1, collider = false } = {}) => {
    const o = await instantiate(`${INT}/${file}`);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    o.scale.setScalar(scale);
    g.add(o);
    if (collider) colliderFor(o);
    return o;
  };

  // измеряем тайл пола, чтобы выложить сетку без щелей
  const probe = await instantiate(`${INT}/floor_wood_large.gltf.glb`);
  const tile = new THREE.Box3().setFromObject(probe).getSize(new THREE.Vector3());
  const T = Math.max(tile.x, tile.z) || 4;

  // пол 3x2 тайла -> комната ~ (3T x 2T)
  const W = 3, D = 2;
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < D; j++) {
      await put('floor_wood_large.gltf.glb', (i - (W - 1) / 2) * T, (j - (D - 1) / 2) * T);
    }
  }
  // сплошной коллайдер пола
  world.createCollider(
    RAPIER.ColliderDesc.cuboid((W * T) / 2 + 0.5, 0.15, (D * T) / 2 + 0.5)
      .setTranslation(INTERIOR_ORIGIN.x, INTERIOR_ORIGIN.y - 0.1, INTERIOR_ORIGIN.z)
  );

  // стены по периметру; вход — в южной стене (z+)
  const halfW = (W * T) / 2, halfD = (D * T) / 2;
  const walls = [];
  for (let i = 0; i < W; i++) {
    const x = (i - (W - 1) / 2) * T;
    // северная сплошная/с окном
    walls.push(put(i === 1 ? 'wall_archedwindow_open.gltf.glb' : 'wall.gltf.glb', x, -halfD, { rotY: Math.PI, collider: true }));
    // южная: в центре дверной проём
    walls.push(put(i === 1 ? 'wall_doorway.glb' : 'wall.gltf.glb', x, halfD, { rotY: 0, collider: i !== 1 }));
  }
  for (let j = 0; j < D; j++) {
    const z = (j - (D - 1) / 2) * T;
    walls.push(put(j === 0 ? 'wall_archedwindow_open.gltf.glb' : 'wall.gltf.glb', -halfW, z, { rotY: Math.PI / 2, collider: true }));
    walls.push(put('wall.gltf.glb', halfW, z, { rotY: -Math.PI / 2, collider: true }));
  }
  await Promise.all(walls);
  // дверной проём: боковые косяки-коллайдеры
  world.createCollider(RAPIER.ColliderDesc.cuboid(T / 2 - 0.8, 1.6, 0.3)
    .setTranslation(INTERIOR_ORIGIN.x - T / 2 - 0.5, INTERIOR_ORIGIN.y + 1.6, INTERIOR_ORIGIN.z + halfD));
  world.createCollider(RAPIER.ColliderDesc.cuboid(T / 2 - 0.8, 1.6, 0.3)
    .setTranslation(INTERIOR_ORIGIN.x + T / 2 + 0.5, INTERIOR_ORIGIN.y + 1.6, INTERIOR_ORIGIN.z + halfD));

  // ---------- мебель ----------
  await put('bed_decorated.gltf.glb', -halfW + 1.5, -halfD + 1.4, { rotY: Math.PI / 2, collider: true });
  const table = await put('table_medium_decorated_A.gltf.glb', halfW - 2.2, -halfD + 1.3, { collider: true });
  await put('chair.gltf.glb', halfW - 3.6, -halfD + 1.5, { rotY: 1.2 });
  const shelf = await put('shelf_large.gltf.glb', 0, -halfD + 0.45, { rotY: 0, collider: true });
  await put('shelf_small_candles.gltf.glb', halfW - 0.45, 0.0, { rotY: -Math.PI / 2 });
  await put('barrel_small.gltf.glb', -halfW + 0.8, halfD - 1, {});
  await put('crates_stacked.gltf.glb', halfW - 1, halfD - 1.1, { rotY: 0.4, collider: true });
  await put('stool.gltf.glb', -1.3, 0.6, { rotY: 0.8 });
  const candle = await put('candle_triple.gltf.glb', halfW - 2.2, -halfD + 1.3, { y: 1.05 });
  await put('candle_lit.gltf.glb', 0.1, -halfD + 0.5, { y: 1.55 });

  // тёплый свет свечей
  const warm = new THREE.PointLight(0xffb45e, 1.5, 12, 1.6);
  warm.position.set(INTERIOR_ORIGIN.x + halfW - 2.2, INTERIOR_ORIGIN.y + 1.8, INTERIOR_ORIGIN.z - halfD + 1.6);
  scene.add(warm);
  const warm2 = new THREE.PointLight(0xffc887, 0.9, 10, 1.6);
  warm2.position.set(INTERIOR_ORIGIN.x, INTERIOR_ORIGIN.y + 2.0, INTERIOR_ORIGIN.z);
  scene.add(warm2);

  // ---------- сюжетные объекты ----------
  // радио — на столе
  const radio = await instantiate('/assets/models/env/survival/box.glb');
  radio.scale.setScalar(0.45);
  radio.position.set(halfW - 2.0, 1.05, -halfD + 1.0);
  g.add(radio);
  // дедушкин фонарь — у кровати
  const lantern = await instantiate('/assets/models/env/town/lantern.glb');
  lantern.scale.setScalar(0.32);
  lantern.position.set(-halfW + 2.6, 0, -halfD + 0.9);
  g.add(lantern);
  // жестянка с ключом — на полке
  const tin = await instantiate('/assets/models/env/pirate/chest.glb');
  tin.scale.setScalar(0.4);
  tin.position.set(0.5, 1.05, -halfD + 0.45);
  g.add(tin);

  // точки входа/выхода (внутри, перед дверью)
  const entryPoint = INTERIOR_ORIGIN.clone().add(new THREE.Vector3(0, 1.1, halfD - 1.6));
  const doorInside = new THREE.Object3D();
  doorInside.position.set(0, 1, halfD - 0.3);
  g.add(doorInside);

  return {
    group: g,
    radio, lantern, tin,
    entryPoint, doorInside,
    bounds: { halfW, halfD },
  };
}
