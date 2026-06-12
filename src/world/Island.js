import * as THREE from 'three';
import { instantiate } from '../core/AssetLoader.js';
import { scatterInstanced, scatterPoints, mulberry32 } from './Scatter.js';

const ENV = '/assets/models/env';

// Сборка острова. Возвращает anchors — позиции/объекты для сюжетной обвязки.
export async function createIsland(scene, physics, terrain) {
  const { RAPIER, world } = physics;
  const H = terrain.height;
  const anchors = { interactables: {}, positions: {}, lights: [] };
  const placed = []; // {x, z, r} — запретные зоны для рассадки травы/деревьев

  // ---------- helpers ----------
  function addBoxColliderFor(obj, shrink = 0.9) {
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    if (size.y < 0.5) return; // мелочь не коллайдим
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((size.x / 2) * shrink, size.y / 2, (size.z / 2) * shrink)
        .setTranslation(center.x, center.y, center.z)
    );
  }

  async function place(url, x, z, { rotY = 0, scale = 1, yOff = 0, collider = 'box', avoidR = 0, onWater = false } = {}) {
    const obj = await instantiate(url);
    const y = (onWater ? 0 : H(x, z)) + yOff;
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    obj.scale.setScalar(scale);
    scene.add(obj);
    obj.updateWorldMatrix(true, true);
    if (collider === 'box') addBoxColliderFor(obj);
    if (avoidR > 0) placed.push({ x, z, r: avoidR });
    return obj;
  }

  function makeLensFragment() {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0xbfe3ff, emissive: 0x6fb7e8, emissiveIntensity: 0.9,
        roughness: 0.05, transmission: 0.7, thickness: 0.5, ior: 1.5,
      })
    );
    glass.scale.y = 1.6;
    glass.position.y = 0.45;
    glass.castShadow = true;
    g.add(glass);
    const light = new THREE.PointLight(0x7fc4ee, 1.6, 5, 2);
    light.position.y = 0.6;
    g.add(light);
    g.userData.spin = glass;
    return g;
  }

  // ---------- ПРИСТАНЬ (юг, x≈-12 z≈42) ----------
  const dockBase = { x: -12, z: 36 };
  // настил от берега в море
  for (let i = 0; i < 4; i++) {
    await place(`${ENV}/pirate/structure-platform-dock.glb`, dockBase.x, dockBase.z + 4 + i * 2.45,
      { onWater: true, yOff: 0.4, collider: i === 0 ? 'box' : 'box' });
  }
  await place(`${ENV}/pirate/structure-platform-dock-small.glb`, dockBase.x + 2.5, dockBase.z + 9, { onWater: true, yOff: 0.4 });
  const playerBoat = await place(`${ENV}/pirate/boat-row-small.glb`, dockBase.x - 2.6, dockBase.z + 11.5,
    { onWater: true, rotY: 0.4, collider: 'none' });
  await place(`${ENV}/pirate/barrel.glb`, dockBase.x + 1, dockBase.z + 5, { onWater: true, yOff: 0.82, collider: 'none' });
  await place(`${ENV}/pirate/crate.glb`, dockBase.x - 1, dockBase.z + 7.5, { onWater: true, yOff: 0.82, collider: 'none' });
  const noticeBoard = await place(`${ENV}/survival/signpost.glb`, dockBase.x + 2, dockBase.z + 1.5, { rotY: Math.PI, avoidR: 2 });
  anchors.interactables.noticeBoard = noticeBoard;
  anchors.positions.spawn = new THREE.Vector3(dockBase.x, H(dockBase.x, dockBase.z) + 1.2, dockBase.z + 6);
  anchors.positions.dock = new THREE.Vector3(dockBase.x, 1, dockBase.z + 6);

  // лебёдка/кран у пристани (столб с перекладиной)
  const crane = await place(`${ENV}/town/poles-horizontal.glb`, dockBase.x - 5, dockBase.z - 1, { rotY: 0.8, avoidR: 2 });
  anchors.interactables.crane = crane;

  // фрагмент 1 — на дальнем конце пристани
  const lens1 = makeLensFragment();
  lens1.position.set(dockBase.x + 2.5, 0.85, dockBase.z + 9);
  scene.add(lens1);
  anchors.interactables.lens_1 = lens1;

  // ---------- ДЕРЕВНЯ (центр-юг) ----------
  const V = 4.6; // масштаб KayKit-домов
  await place(`${ENV}/village/building_home_A_red.gltf`, -24, 22, { rotY: 0.9, scale: V, avoidR: 7 });
  const dedHouse = await place(`${ENV}/village/building_home_B_red.gltf`, 9, 13, { rotY: -2.2, scale: V, avoidR: 7 });
  anchors.interactables.dedHouse = dedHouse;
  anchors.positions.dedHouseDoor = new THREE.Vector3(6.5, H(6.5, 16) , 16);
  await place(`${ENV}/village/building_tavern_red.gltf`, -14, 10, { rotY: 1.7, scale: V, avoidR: 9 });
  await place(`${ENV}/village/building_market_red.gltf`, -2, 24, { rotY: Math.PI, scale: V, avoidR: 7 });
  const well = await place(`${ENV}/village/building_well_red.gltf`, -6, 14, { scale: V, avoidR: 4 });
  await place(`${ENV}/village/building_windmill_red.gltf`, -34, -16, { rotY: 0.6, scale: V * 1.15, avoidR: 9 });

  // рыбный рынок: прилавок, телега, бочки, рыба
  await place(`${ENV}/town/stall.glb`, -4, 30, { rotY: Math.PI, avoidR: 3 });
  await place(`${ENV}/town/cart.glb`, -9, 28, { rotY: 2.6, avoidR: 3 });
  await place(`${ENV}/survival/fish-large.glb`, -3, 28.6, { scale: 0.6, collider: 'none' });
  await place(`${ENV}/pirate/barrel.glb`, -6.2, 30.5, { collider: 'none' });
  await place(`${ENV}/survival/box-open.glb`, -5, 31.5, { collider: 'none' });
  // ручка от радио — на прилавке рынка
  const radioHandle = await place(`${ENV}/survival/bucket.glb`, -3.6, 30.2, { scale: 0.55, collider: 'none' });
  anchors.interactables.radioHandle = radioHandle;

  // фонари деревни (свет — только у двух, бюджет)
  const lanternPositions = [[-10, 17], [3, 19], [-18, 26]];
  for (let i = 0; i < lanternPositions.length; i++) {
    const [lx, lz] = lanternPositions[i];
    await place(`${ENV}/town/lantern.glb`, lx, lz, { avoidR: 1.5, collider: 'none' });
    if (i < 2) {
      const pl = new THREE.PointLight(0xffb45e, 0, 14, 1.8); // включим в сумерках/шторме
      pl.position.set(lx, H(lx, lz) + 2.3, lz);
      scene.add(pl);
      anchors.lights.push(pl);
    }
  }

  // заборчики
  await place(`${ENV}/town/fence.glb`, 4, 17, { rotY: 0.9, collider: 'none' });
  await place(`${ENV}/town/fence-broken.glb`, -20, 19, { rotY: 2.4, collider: 'none' });

  // фрагмент 2 — у колодца
  const lens2 = makeLensFragment();
  lens2.position.set(-6, H(-6, 14) + 0.3, 12.4);
  scene.add(lens2);
  anchors.interactables.lens_2 = lens2;
  anchors.interactables.well = well;

  // дом деда: фонарь, радио, жестянка — невидимые маркеры внутри/у дома
  const lanternSpot = new THREE.Group();
  lanternSpot.position.set(7.8, H(7.8, 14.5) + 0.8, 14.5);
  scene.add(lanternSpot);
  const oldLantern = await place(`${ENV}/town/lantern.glb`, 7.8, 14.8, { scale: 0.45, collider: 'none' });
  anchors.interactables.oldLantern = oldLantern;
  const radioSpot = await place(`${ENV}/survival/box.glb`, 10.5, 11.5, { scale: 0.8, collider: 'none' });
  anchors.interactables.radio = radioSpot;
  const tinSpot = await place(`${ENV}/pirate/chest.glb`, 9.8, 14.8, { scale: 0.7, collider: 'none' });
  anchors.interactables.teaTin = tinSpot;

  // ---------- ЛЕС (восток) ----------
  anchors.positions.forestEntry = new THREE.Vector3(20, H(20, -2), -2);
  // сторожка лесника — деревянная вышка + костровище
  const hut = await place(`${ENV}/pirate/tower-watch.glb`, 38, -18, { rotY: -0.7, avoidR: 6 });
  anchors.interactables.forestHut = hut;
  await place(`${ENV}/survival/campfire-fishing-stand.glb`, 35, -14, { collider: 'none', avoidR: 2 });
  const tape1 = await place(`${ENV}/survival/box-large.glb`, 36.6, -17, { scale: 0.8, collider: 'none' });
  anchors.interactables.tape_1 = tape1;
  // журнал сторожки
  const hutNote = await place(`${ENV}/survival/signpost-single.glb`, 39.5, -15.5, { rotY: 2.2, collider: 'none' });
  anchors.interactables.hutNote = hutNote;

  // фрагмент 3 — у большого пня за сторожкой
  await place(`${ENV}/nature/stump_round.glb`, 42, -22, { scale: 6, collider: 'none' });
  const lens3 = makeLensFragment();
  lens3.position.set(42, H(42, -22) + 0.55, -22);
  scene.add(lens3);
  anchors.interactables.lens_3 = lens3;

  // ---------- БУХТА (запад) ----------
  anchors.positions.coveEntry = new THREE.Vector3(-44, H(-44, 6), 6);
  const dedBoat = await place(`${ENV}/pirate/boat-row-large.glb`, -58, 9, { rotY: 1.1, yOff: 0.15, avoidR: 4 });
  anchors.interactables.dedBoat = dedBoat;
  const tape2 = await place(`${ENV}/pirate/crate-bottles.glb`, -55.5, 11.5, { scale: 0.9, collider: 'none' });
  anchors.interactables.tape_2 = tape2;
  await place(`${ENV}/pirate/rocks-a.glb`, -63, 4, { scale: 1.6, avoidR: 3 });
  await place(`${ENV}/pirate/rocks-b.glb`, -60, 16, { scale: 1.3, avoidR: 3 });
  // записка Михалыча — на двери дальнего дома... повесим у лодочного сарая (доски)
  await place(`${ENV}/survival/resource-planks.glb`, -52, 14, { collider: 'none' });

  // фрагмент 4 — в лодке деда
  const lens4 = makeLensFragment();
  lens4.position.set(-58, H(-58, 9) + 0.75, 9);
  scene.add(lens4);
  anchors.interactables.lens_4 = lens4;

  // ---------- МАЯК (северо-восточный холм) ----------
  anchors.positions.lighthouse = new THREE.Vector3(46, H(46, -50), -50);
  // сундук смотрителя с последней записью — у подножия
  const tape3 = await place(`${ENV}/pirate/chest.glb`, 42, -46, { rotY: 0.8 });
  anchors.interactables.tape_3 = tape3;

  // ---------- ЛЕС и растительность (instanced) ----------
  const rng = mulberry32(20260612);
  const avoidAll = [
    ...placed,
    { x: 46, z: -50, r: 13 },           // маяк
    { x: dockBase.x, z: dockBase.z, r: 10 },
    { x: -5, z: 18, r: 22 },            // деревня целиком
    { x: -58, z: 9, r: 8 },             // бухта
  ];
  // сосновый лес на востоке + редкие сосны по острову
  const forest = [
    ...scatterPoints(rng, 60, 34, -16, 26, { minR: 6, avoid: avoidAll, heightFn: H, hMin: 1.6, hMax: 11 }),
  ];
  // отдельные сосны по холмам
  forest.push(...scatterPoints(rng, 26, -20, -30, 45, { avoid: avoidAll, heightFn: H, hMin: 2, hMax: 10 }));

  const pineVariants = ['tree_pineTallA', 'tree_pineDefaultA', 'tree_pineRoundB'];
  const perVariant = Math.ceil(forest.length / pineVariants.length);
  for (let v = 0; v < pineVariants.length; v++) {
    const chunk = forest.slice(v * perVariant, (v + 1) * perVariant)
      .map((p) => ({ ...p, scale: (p.scale ?? 1) * 6.2 }));
    if (!chunk.length) continue;
    await scatterInstanced(scene, `${ENV}/nature/${pineVariants[v]}.glb`, chunk, H);
    // коллайдеры стволов
    for (const p of chunk) {
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(4, 0.35).setTranslation(p.x, H(p.x, p.z) + 4, p.z)
      );
    }
  }

  // камни
  const rocks = scatterPoints(rng, 30, -2, -12, 85, { avoid: avoidAll, heightFn: H, hMin: 0.4, hMax: 13 });
  await scatterInstanced(scene, `${ENV}/nature/rock_largeA.glb`, rocks.map((p) => ({ ...p, scale: p.scale * 3 })), H);

  // трава и кусты (без коллайдеров)
  const grass = scatterPoints(rng, 220, -2, -8, 80, { avoid: avoidAll, heightFn: H, hMin: 1.2, hMax: 9 });
  await scatterInstanced(scene, `${ENV}/nature/grass_large.glb`, grass.map((p) => ({ ...p, scale: p.scale * 3.4 })), H, { castShadow: false });
  const bushes = scatterPoints(rng, 40, -2, -8, 78, { avoid: avoidAll, heightFn: H, hMin: 1.4, hMax: 8 });
  await scatterInstanced(scene, `${ENV}/nature/plant_bushSmall.glb`, bushes.map((p) => ({ ...p, scale: p.scale * 4 })), H, { castShadow: false });

  // цветы у деревни
  const flowers = scatterPoints(rng, 26, -8, 20, 18, { avoid: placed, heightFn: H, hMin: 1.2, hMax: 6 });
  await scatterInstanced(scene, `${ENV}/nature/flower_yellowA.glb`, flowers.map((p) => ({ ...p, scale: p.scale * 3 })), H, { castShadow: false });

  // анимация фрагментов линзы (вращение/покачивание)
  const lenses = [lens1, lens2, lens3, lens4];
  anchors.updateLenses = (t) => {
    for (const l of lenses) {
      if (!l.parent) continue;
      l.userData.spin.rotation.y = t * 1.2;
      l.userData.spin.position.y = 0.45 + Math.sin(t * 2) * 0.07;
    }
  };

  return anchors;
}
