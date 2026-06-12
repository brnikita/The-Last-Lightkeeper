import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Кэширующий загрузчик: один GLTF грузится один раз, дальше клоны.
const gltfCache = new Map();
const loader = new GLTFLoader();
const rgbe = new RGBELoader();

export async function loadGLTF(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, loader.loadAsync(url).catch((e) => {
      console.warn(`[Assets] Не загрузился ${url}:`, e.message || e);
      gltfCache.delete(url);
      return null;
    }));
  }
  return gltfCache.get(url);
}

// Клон сцены GLTF с тенями. Возвращает Group или красную заглушку при ошибке.
export async function instantiate(url, { castShadow = true, receiveShadow = true } = {}) {
  const gltf = await loadGLTF(url);
  if (!gltf) {
    const stub = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff3355 })
    );
    stub.position.y = 0.5;
    const g = new THREE.Group();
    g.add(stub);
    return g;
  }
  const clone = gltf.scene.clone(true);
  clone.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = castShadow;
      o.receiveShadow = receiveShadow;
    }
  });
  return clone;
}

export function loadHDRI(url) {
  return rgbe.loadAsync(url).then((tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  });
}

// Достаёт все меши (geometry+material) из GLTF для инстансинга.
export async function getMeshParts(url) {
  const gltf = await loadGLTF(url);
  if (!gltf) return [];
  const parts = [];
  gltf.scene.updateWorldMatrix(true, true);
  gltf.scene.traverse((o) => {
    if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() });
  });
  return parts;
}
