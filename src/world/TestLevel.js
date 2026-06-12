import * as THREE from 'three';
import { addBoxCollider } from './Physics.js';

// Тестовый «гимнастический зал» для этапов 0–2: пол, ящики, лестница, рампа.
// Будет заменён реальным уровнем на этапе 3.
export function createTestLevel(scene, physics) {
  const { RAPIER, world } = physics;
  const group = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x808487, roughness: 0.95 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x9c8a6e, roughness: 0.85 });

  // Пол 60x60
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60), floorMat);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  group.add(floor);
  addBoxCollider(RAPIER, world, floor.position, new THREE.Vector3(30, 0.5, 30));

  const addBox = (x, y, z, sx, sy, sz, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), boxMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
    addBoxCollider(RAPIER, world, m.position, new THREE.Vector3(sx / 2, sy / 2, sz / 2), q);
  };

  // Ящики и стены для теста коллизий камеры и движения
  addBox(5, 0.75, 3, 1.5, 1.5, 1.5);
  addBox(7, 0.5, -4, 1, 1, 1, 0.5);
  addBox(-6, 1.5, 5, 8, 3, 0.4);      // стена
  addBox(-6, 1.5, -6, 0.4, 3, 6, 0.3); // стена под углом

  // Лестница (ступени 25 см — тест autostep); каждый бокс от пола до верха ступени
  for (let i = 0; i < 6; i++) {
    const top = 0.25 * (i + 1);
    addBox(10 + i * 0.6, top / 2, 8, 0.6, top, 3);
  }

  // Рампа ~20°
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 4), boxMat);
  ramp.position.set(-2, 1.3, -12);
  ramp.rotation.z = -0.35;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  group.add(ramp);
  const rq = new THREE.Quaternion().setFromEuler(ramp.rotation);
  addBoxCollider(RAPIER, world, ramp.position, new THREE.Vector3(4, 0.15, 2), rq);

  scene.add(group);
  return group;
}
