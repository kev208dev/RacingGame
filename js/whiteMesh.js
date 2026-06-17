import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const URL = 'assets/cars/white_mesh.glb';

let _loaded = null;     // THREE.Group (원본)
let _loading = null;    // Promise

export function preloadWhiteMesh() {
  if (_loaded) return Promise.resolve(_loaded);
  if (_loading) return _loading;
  const loader = new GLTFLoader();
  _loading = new Promise((resolve, reject) => {
    loader.load(URL, gltf => {
      _loaded = gltf.scene;
      _normalize(_loaded);
      resolve(_loaded);
    }, undefined, reject);
  });
  return _loading;
}

export function getWhiteMeshClone() {
  if (!_loaded) return null;
  const clone = _loaded.clone(true);
  return clone;
}

// GLB의 forward축/스케일이 게임 기대와 다를 수 있어 한 번 정규화.
// car.js에서 model.rotation.y = π/2, scale 5.2 적용함 → 여기서는 단위 박스로 맞춤.
function _normalize(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  // 원점 정렬: 바닥(y_min)을 0에, x/z 중심을 0에.
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box.min.y;
  // 단위화: 가장 큰 축이 2.0이 되도록 (car.js scale 5.2와 조합 시 ~10 단위 카트).
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const k = 2.0 / maxDim;
  scene.scale.multiplyScalar(k);
  scene.traverse(c => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = false;
    }
  });
}
