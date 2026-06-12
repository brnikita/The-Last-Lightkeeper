import * as THREE from 'three';

export function createLighting(scene, levelSize = 50) {
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.6);
  sun.position.set(30, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = levelSize * 0.7;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbdd4e8, 0x6b5d4a, 0.9);
  scene.add(hemi);

  return { sun, hemi };
}
