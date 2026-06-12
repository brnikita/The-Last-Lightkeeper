import * as THREE from 'three';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Временно тонмаппим на рендерере; на этапе 4 (PostFX) переключаем на
  // NoToneMapping, т.к. ACES уйдёт последним эффектом в EffectComposer.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft удалён в r184
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  return renderer;
}
