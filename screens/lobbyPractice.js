import * as THREE from 'three';
import { createCar, createCar3D, updateCar3D } from '../js/car.js';
import { updatePhysics } from '../js/physics.js';
import { getInput } from '../utils/input.js';

let renderer = null;
let scene = null;
let camera = null;
let car = null;
let carMesh = null;
let running = false;
let selectedCarData = null;
let toastTimer = 0;
let practiceName = '';

const START_POS = { x: 0, y: 0, angle: 0 };
const PRACTICE_TRACK = makePracticeTrack();

export function initLobbyPractice(carData) {
  selectedCarData = carData;
  const canvas = document.getElementById('three-canvas');
  const hudCanvas = document.getElementById('hud-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  if (hudCanvas) hudCanvas.style.display = 'none';

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050816);
  scene.fog = new THREE.Fog(0x050816, 220, 900);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);

  buildPracticeArena(scene);
  spawnLobbyCar(carData);
  window.addEventListener('resize', onResize);
  running = true;
}

export function stopLobbyPractice() {
  running = false;
  window.removeEventListener('resize', onResize);
}

export function updateLobbyPractice(dt) {
  if (!running || !renderer || !scene || !camera || !car) return;
  const input = getInput();
  if (input.reset) respawnLobbyCar();
  if (input.escape) document.querySelector('.lobby-hub')?.classList.toggle('panels-collapsed');
  updatePhysics(car, input, Math.min(dt, 0.033), PRACTICE_TRACK);
  updateCar3D(carMesh, car, input, PRACTICE_TRACK);
  updateLobbyCamera(dt);
  renderer.render(scene, camera);
}

export function switchLobbyCar(carData) {
  selectedCarData = carData;
  if (!scene) return initLobbyPractice(carData);
  if (carMesh) scene.remove(carMesh);
  spawnLobbyCar(carData);
  showLobbyCarToast(carData?.name || 'Selected car');
}

export function respawnLobbyCar() {
  if (!selectedCarData) return;
  if (!car) {
    spawnLobbyCar(selectedCarData);
    return;
  }
  car.x = START_POS.x;
  car.y = START_POS.y;
  car.angle = START_POS.angle;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
}

export function showLobbyCarToast(name) {
  practiceName = name;
  toastTimer = 1.4;
}

function spawnLobbyCar(carData) {
  car = createCar(carData, START_POS);
  carMesh = createCar3D(carData);
  scene.add(carMesh);
  updateCar3D(carMesh, car, { throttle: 0, brake: 0, steer: 0 }, PRACTICE_TRACK);
}

function buildPracticeArena(target) {
  target.add(new THREE.AmbientLight(0xb8d4ff, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(180, 260, 120);
  target.add(key);
  const rim = new THREE.DirectionalLight(0xff5a1f, 0.7);
  rim.position.set(-160, 90, -180);
  target.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 720),
    new THREE.MeshStandardMaterial({ color: 0x07111f, roughness: 0.88, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  target.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x171d27, roughness: 0.78, metalness: 0.08 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.92 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });

  const circle = new THREE.Mesh(new THREE.RingGeometry(112, 166, 96), roadMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.02;
  target.add(circle);

  const straight = new THREE.Mesh(new THREE.PlaneGeometry(420, 74), roadMat);
  straight.rotation.x = -Math.PI / 2;
  straight.position.set(0, 0.03, 0);
  target.add(straight);

  for (let i = -4; i <= 4; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(22, 2), lineMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 46, 0.06, 0);
    target.add(stripe);
  }

  for (const [x, z, s] of [[-210, -110, 1.1], [220, 115, 1.3], [-130, 170, 0.9], [145, -180, 1]]) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7 * s, 20 * s, 18),
      new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.55 })
    );
    cone.position.set(x, 10 * s, z);
    target.add(cone);
  }

  for (const z of [-230, 230]) {
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(720, 3), cyanMat);
    neon.rotation.x = -Math.PI / 2;
    neon.position.set(0, 0.08, z);
    target.add(neon);
  }
}

function updateLobbyCamera(dt) {
  const back = 92;
  const height = 44;
  const lookAhead = 58;
  const targetX = car.x - Math.cos(car.angle) * back;
  const targetZ = -car.y + Math.sin(car.angle) * back;
  const lerp = Math.min(1, dt * 4.2);
  camera.position.lerp(new THREE.Vector3(targetX, height, targetZ), lerp);
  const look = new THREE.Vector3(
    car.x + Math.cos(car.angle) * lookAhead,
    8,
    -(car.y + Math.sin(car.angle) * lookAhead)
  );
  camera.lookAt(look);
  if (toastTimer > 0) toastTimer = Math.max(0, toastTimer - dt);
  const toast = document.getElementById('lobby-car-toast');
  if (toast) {
    toast.textContent = practiceName;
    toast.classList.toggle('visible', toastTimer > 0);
  }
}

function onResize() {
  if (!renderer || !camera) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function makePracticeTrack() {
  const centerLine = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    centerLine.push([Math.cos(a) * 140, Math.sin(a) * 140]);
  }
  centerLine.push(centerLine[0]);
  return {
    id: 'lobby_practice',
    name: 'Lobby Practice Arena',
    width: 360,
    centerLine,
    startPos: START_POS,
    roadProfile: { type: 'practice', roughness: 0.35 },
  };
}
