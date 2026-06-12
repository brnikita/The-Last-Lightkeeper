import * as THREE from 'three';
import { loadHDRI } from '../core/AssetLoader.js';

// Небо (HDRI Poly Haven, предзакат), солнце, вода, туман.
export async function createEnvironment(scene, renderer) {
  // HDRI: environment-освещение + фон
  try {
    const hdri = await loadHDRI('/assets/hdri/sky.hdr');
    scene.environment = hdri;
    scene.background = hdri;
    scene.backgroundIntensity = 1.0;
    scene.environmentIntensity = 0.85;
  } catch (e) {
    console.warn('[Env] HDRI не загрузился, остаёмся на цветном небе:', e.message || e);
    scene.background = new THREE.Color(0xc7a98c);
  }

  // Тёплый закатный туман (Firewatch-палитра)
  scene.fog = new THREE.FogExp2(0xd6b294, 0.0042);

  // Солнце — низкое, тёплое, под HDRI Qwantani Dusk (солнце там на западе)
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-80, 32, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 90;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xd8c3ae, 0x55604f, 0.5);
  scene.add(hemi);

  // Вода: большая плоскость на y=0, отражает HDRI через envMap
  const waterGeo = new THREE.PlaneGeometry(1400, 1400, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1d4f63,
    roughness: 0.3,
    metalness: 0.0,
    transparent: true,
    opacity: 0.95,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.name = 'water';
  water.position.y = 0;
  water.receiveShadow = false;
  scene.add(water);

  // лёгкое волнение — синус по вершинам (обновляется из Engine)
  const wPos = waterGeo.attributes.position;
  const baseY = new Float32Array(wPos.count); // нули, но оставим на будущее
  let t = 0;
  function updateWater(dt) {
    t += dt;
    for (let i = 0; i < wPos.count; i++) {
      const x = wPos.getX(i), z = wPos.getZ(i);
      wPos.setY(i, baseY[i]
        + Math.sin(x * 0.06 + t * 0.9) * 0.12
        + Math.cos(z * 0.05 + t * 0.7) * 0.1);
    }
    wPos.needsUpdate = true;
  }

  return { sun, hemi, water, updateWater };
}
