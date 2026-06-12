import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect,
  SMAAEffect, SMAAPreset,
} from 'postprocessing';

// Цепочка: Render -> SMAA -> Bloom -> Vignette -> ToneMapping(ACES) последним.
// Renderer при этом должен быть в NoToneMapping (иначе двойной тонмаппинг).
export function createPostFX(renderer, scene, camera) {
  renderer.toneMapping = THREE.NoToneMapping;

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
  });
  composer.addPass(new RenderPass(scene, camera));

  const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });
  const bloom = new BloomEffect({
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.2,
    intensity: 0.55,
    mipmapBlur: true,
  });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

  composer.addPass(new EffectPass(camera, smaa, bloom, vignette, tone));

  return {
    composer,
    render(dt) { composer.render(dt); },
    setSize(w, h) { composer.setSize(w, h); },
    dispose() { composer.dispose(); },
  };
}
