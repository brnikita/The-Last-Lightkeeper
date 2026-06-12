// Маяк «The Last Lightkeeper» — процедурная low-poly модель (~22 м).
// Текстуры сгенерированы GPT Image 2 (test/generate-lighthouse-textures.mjs).
// Origin — центр основания (y=0 на земле). 1 unit = 1 м.
// Использование:
//   import { createLighthouse } from './world/Lighthouse.js';
//   const lighthouse = await createLighthouse(THREE);
//   scene.add(lighthouse);
// Именованные узлы:
//   'lighthouseDoor' — дверь (объект взаимодействия игрока)
//   'lampMount'      — пустая Group внутри фонаря (точка крепления лампы/света)

const TEX_DIR = '/assets/textures/lighthouse/';

// ---------- размеры ----------
const BASE_R1 = 3.5, BASE_H1 = 0.7;     // нижняя ступень основания (диаметр 7 м)
const BASE_R2 = 3.05, BASE_H2 = 0.5;    // верхняя ступень
const BASE_H = BASE_H1 + BASE_H2;       // 1.2
const TOWER_R_BOT = 2.75;               // диаметр 5.5 м
const TOWER_R_TOP = 1.6;                // диаметр 3.2 м
const TOWER_H = 14;
const TOWER_TOP_Y = BASE_H + TOWER_H;   // 15.2
const GALLERY_R = 2.55;
const GALLERY_T = 0.22;                 // толщина плиты галереи
const RAIL_R = 2.38;
const LANTERN_R = 1.32;
const LANTERN_H = 2.3;
const DOME_R = 1.62;
// итоговая высота ≈ 15.2 + 0.22 + 2.3 + купол + шпиль ≈ 22 м

async function loadTextures(THREE) {
  const loader = new THREE.TextureLoader();
  const load = async (file, repeat = null) => {
    const t = await loader.loadAsync(TEX_DIR + file);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    t.anisotropy = 8;
    return t;
  };
  const [stripes, stone, door] = await Promise.all([
    // одна «период»-текстура = белая + красная полоса; repeat.y=4 → полоса ≈ 14/8 = 1.75 м
    load('stripes.jpg', [3, 4]),
    // нижняя ступень: блок ≈ 0.35 м высотой (в текстуре ~5 рядов на 1024)
    load('stone.jpg', [10, 0.4]),
    load('door.jpg'),
  ]);
  const stoneSmall = stone.clone();
  stoneSmall.repeat.set(9, 0.3);
  stoneSmall.needsUpdate = true;
  const stoneFrame = stone.clone();
  stoneFrame.repeat.set(1, 1);
  stoneFrame.needsUpdate = true;
  return { stripes, stone, stoneSmall, stoneFrame, door };
}

export async function createLighthouse(THREE) {
  const tex = await loadTextures(THREE);
  const g = new THREE.Group();
  g.name = 'lighthouse';

  // ---------- материалы ----------
  const matStripes = new THREE.MeshStandardMaterial({ map: tex.stripes, roughness: 0.8, metalness: 0 });
  const matStone = new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.85, metalness: 0 });
  const matStoneSmall = new THREE.MeshStandardMaterial({ map: tex.stoneSmall, roughness: 0.85, metalness: 0 });
  const matStoneTop = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.9, metalness: 0 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x343b41, roughness: 0.55, metalness: 0.35 });
  const matDomeRed = new THREE.MeshStandardMaterial({ color: 0xa8362e, roughness: 0.6, metalness: 0.1 });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xb78a3f, roughness: 0.4, metalness: 0.6 });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8ef, roughness: 0.08, metalness: 0,
    transparent: true, opacity: 0.22, side: THREE.DoubleSide,
  });
  const matDoor = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.8, metalness: 0 });
  const matWindow = new THREE.MeshStandardMaterial({ color: 0x1d3540, roughness: 0.15, metalness: 0.2 });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- 1. ступенчатое каменное основание ----------
  add(new THREE.CylinderGeometry(BASE_R1, BASE_R1 + 0.12, BASE_H1, 32), matStone, 0, BASE_H1 / 2);
  add(new THREE.CylinderGeometry(BASE_R2, BASE_R2 + 0.1, BASE_H2, 32), matStoneSmall, 0, BASE_H1 + BASE_H2 / 2);
  // светлая кромка верхней плиты
  add(new THREE.CylinderGeometry(BASE_R2 + 0.05, BASE_R2 + 0.05, 0.1, 32), matStoneTop, 0, BASE_H - 0.05);

  // ---------- 2. конусная башня (слегка вогнутый профиль, Lathe) ----------
  const towerPts = [];
  const SEG_V = 12;
  for (let i = 0; i <= SEG_V; i++) {
    const t = i / SEG_V;
    const sag = 0.22 * Math.sin(Math.PI * t); // вогнутость профиля
    const r = THREE.MathUtils.lerp(TOWER_R_BOT, TOWER_R_TOP, t) - sag;
    towerPts.push(new THREE.Vector2(r, BASE_H + t * TOWER_H));
  }
  const tower = add(new THREE.LatheGeometry(towerPts, 48), matStripes);
  tower.name = 'lighthouseTower';

  // карниз под галереей
  add(new THREE.CylinderGeometry(TOWER_R_TOP + 0.14, TOWER_R_TOP - 0.06, 0.38, 32), matStoneTop, 0, TOWER_TOP_Y - 0.06);

  // ---------- 3. галерея: консоли, плита, перила ----------
  const gallery = new THREE.Group();
  gallery.name = 'gallery';
  gallery.position.y = TOWER_TOP_Y;
  g.add(gallery);

  // консоли (кронштейны) под плитой
  const consoleGeo = new THREE.BoxGeometry(0.16, 0.45, 0.78);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = TOWER_R_TOP + 0.45;
    const c = add(consoleGeo, matMetal, Math.sin(a) * rr, -0.2, Math.cos(a) * rr, gallery);
    c.rotation.y = a;
  }
  // плита галереи
  add(new THREE.CylinderGeometry(GALLERY_R, GALLERY_R - 0.18, GALLERY_T, 40), matMetal, 0, GALLERY_T / 2, 0, gallery);
  // перила: 2 кольца + балясины (20 шт)
  const ringGeo = new THREE.TorusGeometry(RAIL_R, 0.035, 6, 40);
  for (const h of [0.62, 1.05]) {
    const ring = add(ringGeo, matMetal, 0, GALLERY_T + h, 0, gallery);
    ring.rotation.x = Math.PI / 2;
  }
  const balGeo = new THREE.CylinderGeometry(0.028, 0.028, 1.05, 6);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    add(balGeo, matMetal, Math.sin(a) * RAIL_R, GALLERY_T + 0.53, Math.cos(a) * RAIL_R, gallery);
  }

  // ---------- 4. фонарное помещение ----------
  const lanternBaseY = TOWER_TOP_Y + GALLERY_T;
  const lantern = new THREE.Group();
  lantern.name = 'lanternRoom';
  lantern.position.y = lanternBaseY;
  g.add(lantern);

  // цоколь фонаря
  add(new THREE.CylinderGeometry(LANTERN_R + 0.14, LANTERN_R + 0.22, 0.3, 24), matMetal, 0, 0.15, 0, lantern);
  // стекло
  const glassH = LANTERN_H - 0.5;
  const glass = add(new THREE.CylinderGeometry(LANTERN_R, LANTERN_R, glassH, 24, 1, true),
    matGlass, 0, 0.3 + glassH / 2, 0, lantern);
  glass.name = 'lanternGlass';
  // вертикальные рамы-стойки (8 шт)
  const mullGeo = new THREE.BoxGeometry(0.09, glassH, 0.09);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = add(mullGeo, matMetal, Math.sin(a) * LANTERN_R, 0.3 + glassH / 2, Math.cos(a) * LANTERN_R, lantern);
    m.rotation.y = a;
  }
  // верхнее кольцо фонаря
  add(new THREE.CylinderGeometry(LANTERN_R + 0.18, LANTERN_R + 0.12, 0.22, 24), matMetal, 0, LANTERN_H - 0.11, 0, lantern);
  // пьедестал лампы
  add(new THREE.CylinderGeometry(0.22, 0.32, 0.5, 12), matMetal, 0, 0.55, 0, lantern);
  // заготовка под лампу
  const lampMount = new THREE.Group();
  lampMount.name = 'lampMount';
  lampMount.position.set(0, 0.3 + glassH / 2, 0); // центр стеклянной секции
  lantern.add(lampMount);

  // ---------- 5. купол с флюгером ----------
  const domeY = lanternBaseY + LANTERN_H;
  const dome = add(new THREE.SphereGeometry(DOME_R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), matDomeRed, 0, domeY);
  dome.name = 'dome';
  // шпиль (итоговая высота модели ≈ 22 м)
  add(new THREE.CylinderGeometry(0.035, 0.06, 2.6, 8), matMetal, 0, domeY + DOME_R + 0.6);
  add(new THREE.SphereGeometry(0.12, 10, 8), matBrass, 0, domeY + DOME_R + 2.0);
  // флюгер-стрелка
  const vane = add(new THREE.ConeGeometry(0.07, 0.55, 4), matBrass, 0.32, domeY + DOME_R + 1.55, 0);
  vane.rotation.z = -Math.PI / 2;
  add(new THREE.BoxGeometry(0.36, 0.22, 0.02), matBrass, -0.26, domeY + DOME_R + 1.55, 0);

  // ---------- 6. входной портал + дверь + иллюминаторы ----------
  const portal = new THREE.Group();
  portal.name = 'entrancePortal';
  g.add(portal);

  const archShape = (w, h) => {
    // прямоугольник с полукруглым верхом, центр низа в (0,0)
    const s = new THREE.Shape();
    const r = w / 2;
    s.moveTo(-r, 0);
    s.lineTo(-r, h - r);
    s.absarc(0, h - r, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.closePath();
    return s;
  };

  // каменная арка-обрамление (выдавленная), утоплена в основание
  const frameGeo = new THREE.ExtrudeGeometry(archShape(2.1, 3.2), { depth: 0.55, bevelEnabled: false, curveSegments: 10 });
  {
    // UV Extrude — в метрах формы; масштабируем под мировой размер камня
    const uv = frameGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.45, uv.getY(i) * 0.45);
    uv.needsUpdate = true;
  }
  const matStoneFrame = new THREE.MeshStandardMaterial({ map: tex.stoneFrame, roughness: 0.85, metalness: 0 });
  const frame = new THREE.Mesh(frameGeo, matStoneFrame);
  frame.position.set(0, 0.02, 2.6);
  portal.add(frame);

  // дверь — отдельный объект взаимодействия
  const doorGeo = new THREE.ShapeGeometry(archShape(1.55, 2.62), 10);
  {
    // UV по габаритам формы → текстура двери ложится целиком
    doorGeo.computeBoundingBox();
    const bb = doorGeo.boundingBox;
    const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y;
    const pos = doorGeo.attributes.position, uv = doorGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
    }
    uv.needsUpdate = true;
  }
  const door = new THREE.Mesh(doorGeo, matDoor);
  door.name = 'lighthouseDoor';
  door.position.set(0, 0.06, 3.16);
  portal.add(door);

  // ступенька перед входом
  add(new THREE.BoxGeometry(2.4, 0.18, 0.85), matStoneTop, 0, 0.09, 3.5, portal);

  // иллюминаторы (2 шт по высоте, над дверью)
  const portholeRing = new THREE.TorusGeometry(0.34, 0.07, 8, 20);
  const portholeGlass = new THREE.CircleGeometry(0.32, 20);
  const slope = Math.atan2(TOWER_R_BOT - TOWER_R_TOP, TOWER_H);
  for (const y of [6.2, 10.4]) {
    const t = (y - BASE_H) / TOWER_H;
    const r = THREE.MathUtils.lerp(TOWER_R_BOT, TOWER_R_TOP, t) - 0.22 * Math.sin(Math.PI * t);
    const ring = add(portholeRing, matBrass, 0, y, r + 0.03);
    const glassW = add(portholeGlass, matWindow, 0, y, r + 0.02);
    ring.rotation.x = -slope * 0.6;
    glassW.rotation.x = -slope * 0.6;
  }

  // ---------- тени ----------
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  glass.castShadow = false; // стекло не должно давать глухую тень

  return g;
}
