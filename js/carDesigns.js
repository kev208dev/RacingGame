import * as THREE from 'three';

// 절차적 카트 디자인은 전부 제거됨. 카트는 GLB(assets/cars/kart_a, kart_b)만 사용.
// 이 함수는 GLB 로드 실패 시 fallback 박스만 반환.
export function createCarDesign(_type = 'kart_a') {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1.0, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4 })
  );
  mesh.name = 'fallback_body';
  mesh.position.y = 0.5;
  g.add(mesh);
  g.userData.designType = 'fallback';
  return g;
}
