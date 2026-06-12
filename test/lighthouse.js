// Визуальный тест маяка: только модель, небо, свет, OrbitControls.
// Открыть: http://localhost:5174/test/lighthouse.html
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLighthouse } from '../src/world/Lighthouse.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// градиентное небо
{
  const c = document.createElement('canvas');
  c.width = 1; c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#4f8fd0');
  grd.addColorStop(0.6, '#a8cce8');
  grd.addColorStop(1, '#e8e2cf');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
}
scene.fog = new THREE.Fog(0xa8cce8, 80, 220);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(26, 14, 30);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 10, 0);
controls.enableDamping = true;
window.__cam = (px, py, pz, tx, ty, tz) => {
  camera.position.set(px, py, pz);
  controls.target.set(tx, ty, tz);
  controls.update();
};

// свет — тёплое предзакатное
const sun = new THREE.DirectionalLight(0xffe7c4, 2.6);
sun.position.set(28, 32, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -5;
sun.shadow.camera.far = 110;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbcd8f0, 0x6d7a5e, 0.9));

// земля
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(80, 48),
  new THREE.MeshStandardMaterial({ color: 0x7d9468, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const info = document.getElementById('info');
try {
  const lighthouse = await createLighthouse(THREE);
  scene.add(lighthouse);

  // подсчёт треугольников
  let tris = 0;
  lighthouse.traverse((o) => {
    if (o.isMesh) {
      const idx = o.geometry.index;
      tris += (idx ? idx.count : o.geometry.attributes.position.count) / 3;
    }
  });
  const box = new THREE.Box3().setFromObject(lighthouse);
  info.textContent =
    `треугольников: ${Math.round(tris)}\n` +
    `высота: ${(box.max.y - box.min.y).toFixed(2)} м\n` +
    `door: ${!!lighthouse.getObjectByName('lighthouseDoor')}, lampMount: ${!!lighthouse.getObjectByName('lampMount')}`;
  window.__tris = Math.round(tris);

  // демо-лампа в lampMount, чтобы проверить точку крепления
  const mount = lighthouse.getObjectByName('lampMount');
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd980, emissiveIntensity: 2 })
  );
  mount.add(bulb);
} catch (e) {
  info.textContent = 'ОШИБКА: ' + e.message;
  console.error(e);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
