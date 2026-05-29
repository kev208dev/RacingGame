import * as THREE from 'three';
import { createCar, createCar3D, updateCar3D } from '../js/car.js';
import { KMH_PER_UNIT, TOP_SPEED_MULT, updatePhysics } from '../js/physics.js';
import { getInput } from '../utils/input.js';

let renderer = null;
let scene = null;
let camera = null;
let car = null;
let carMesh = null;
let hudCanvas = null;
let hudCtx = null;
let running = false;
let selectedCarData = null;
let toastTimer = 0;
let practiceName = '';
let accumulator = 0;
let boostFlash = 0;
let driftPulse = 0;
let camLook = new THREE.Vector3();
let camTarget = new THREE.Vector3();
let smokeParticles = [];
const FIXED_DT = 1 / 60;

const START_POS = { x: 0, y: 0, angle: 0 };
const PRACTICE_TRACK = makePracticeTrack();

export function initLobbyPractice(carData) {
  selectedCarData = carData;
  const canvas = document.getElementById('three-canvas');
  hudCanvas = document.getElementById('hud-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  if (hudCanvas) {
    hudCanvas.style.display = 'block';
    hudCtx = hudCanvas.getContext('2d');
    resizeHud();
  }

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bd7ff);
  scene.fog = new THREE.Fog(0x9bd7ff, 520, 2600);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3600);
  camLook.set(0, 8, -20);
  camTarget.set(0, 44, 92);

  buildPracticeArena(scene);
  smokeParticles = createSmokeParticles(scene);
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
  const driveInput = makeLobbyDriveInput(input);
  accumulator += Math.min(dt, 0.05);
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 4) {
    if (!car.boosting) car.boostMeter = Math.min(100, (car.boostMeter || 0) + FIXED_DT * 28);
    updatePhysics(car, driveInput, FIXED_DT, PRACTICE_TRACK);
    if (car.boosting) boostFlash = Math.min(1, boostFlash + FIXED_DT * 8);
    if (car.drifting) {
      driftPulse = Math.min(1, driftPulse + FIXED_DT * 5);
      spawnLobbyDriftSmoke();
    }
    accumulator -= FIXED_DT;
    steps++;
  }
  boostFlash = Math.max(0, boostFlash - dt * 2.8);
  driftPulse = Math.max(0, driftPulse - dt * 2.4);
  updateCar3D(carMesh, car, driveInput, PRACTICE_TRACK);
  updateLobbyFx(dt);
  updateSmokeParticles(dt);
  updateLobbyCamera(dt);
  renderer.render(scene, camera);
  drawLobbyHud(dt);
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
  car.boostMeter = 100;
  car.superBoostMeter = 100;
  carMesh = createCar3D(carData);
  scene.add(carMesh);
  updateCar3D(carMesh, car, { throttle: 0, brake: 0, steer: 0 }, PRACTICE_TRACK);
}

function buildPracticeArena(target) {
  target.add(new THREE.HemisphereLight(0xdff4ff, 0x5f7f62, 1.25));
  target.add(new THREE.AmbientLight(0xffffff, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(260, 360, 180);
  target.add(key);
  const rim = new THREE.DirectionalLight(0xff9a42, 0.62);
  rim.position.set(-160, 90, -180);
  target.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshStandardMaterial({ color: 0x304b5e, roughness: 0.9, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  target.add(ground);

  const grid = new THREE.GridHelper(9000, 120, 0xffffff, 0x86c5e8);
  grid.position.y = 0.05;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  target.add(grid);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3d4652, roughness: 0.72, metalness: 0.06 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xff7a1f, transparent: true, opacity: 0.94 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x0077ff, transparent: true, opacity: 0.62 });

  const circle = new THREE.Mesh(new THREE.RingGeometry(190, 270, 128), roadMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.02;
  target.add(circle);

  const straight = new THREE.Mesh(new THREE.PlaneGeometry(1400, 96), roadMat);
  straight.rotation.x = -Math.PI / 2;
  straight.position.set(0, 0.03, 0);
  target.add(straight);

  const cross = new THREE.Mesh(new THREE.PlaneGeometry(96, 920), roadMat);
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.025, 0);
  target.add(cross);

  for (let i = -14; i <= 14; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(28, 2.2), lineMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 46, 0.07, 0);
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

  for (const z of [-340, 340]) {
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(1500, 4), cyanMat);
    neon.rotation.x = -Math.PI / 2;
    neon.position.set(0, 0.08, z);
    target.add(neon);
  }
}

function updateLobbyCamera(dt) {
  const speedN = Math.min(1, (car.speed || 0) / Math.max(1, (car.maxSpeed || 280) * TOP_SPEED_MULT));
  const back = 98 + speedN * 30 + boostFlash * 20;
  const height = 40 + speedN * 12;
  const lookAhead = 62 + speedN * 36;
  const targetX = car.x - Math.cos(car.angle) * back;
  const targetZ = -car.y + Math.sin(car.angle) * back;
  const lerp = Math.min(1, dt * (3.0 + speedN * 2.2));
  camTarget.set(targetX, height, targetZ);
  camera.position.lerp(camTarget, lerp);
  camLook.lerp(new THREE.Vector3(
    car.x + Math.cos(car.angle) * lookAhead,
    7 + speedN * 5,
    -(car.y + Math.sin(car.angle) * lookAhead)
  ), Math.min(1, dt * 5.5));
  camera.fov += ((62 + speedN * 6 + boostFlash * 8) - camera.fov) * Math.min(1, dt * 5.5);
  camera.updateProjectionMatrix();
  camera.lookAt(camLook);
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
  resizeHud();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function makeLobbyDriveInput(input) {
  const cost = car?.boostCost || 38;
  const boostReady = (car?.boostMeter || 0) >= cost && (car?.boostTimer || 0) <= 0;
  return {
    ...input,
    boostJust: input.boostJust || (input.boost && boostReady),
  };
}

function updateLobbyFx(dt) {
  if (!carMesh) return;
  const flame = carMesh.getObjectByName?.('boostFlame') || carMesh.getObjectByName?.('exhaustFlame');
  if (flame) {
    flame.visible = !!car.boosting || boostFlash > 0.08;
    const scale = 1 + boostFlash * 1.2;
    flame.scale.setScalar(scale);
  }
}

function resizeHud() {
  if (!hudCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  hudCanvas.width = Math.round(window.innerWidth * dpr);
  hudCanvas.height = Math.round(window.innerHeight * dpr);
  hudCanvas.style.width = `${window.innerWidth}px`;
  hudCanvas.style.height = `${window.innerHeight}px`;
  hudCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawLobbyHud(dt) {
  if (!hudCtx || !hudCanvas || !car) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  hudCtx.clearRect(0, 0, w, h);
  const kmh = Math.round((car.speed || 0) * KMH_PER_UNIT);
  drawSpeedStreaks(hudCtx, w, h, kmh, dt);
  drawBoostHud(hudCtx, w, h, kmh);
}

function drawSpeedStreaks(ctx, w, h, kmh, dt) {
  const intensity = Math.min(1, Math.max(0, (kmh - 120) / 220) + boostFlash * 0.7);
  if (intensity <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = 0.18 * intensity;
  ctx.strokeStyle = car.boosting ? '#facc15' : '#38bdf8';
  ctx.lineWidth = 2 + intensity * 3;
  const count = Math.floor(12 + intensity * 18);
  for (let i = 0; i < count; i++) {
    const y = ((i * 73 + performance.now() * (0.08 + intensity * 0.12)) % h);
    const side = i % 2 ? 1 : -1;
    const x = side > 0 ? w - 20 - (i % 5) * 16 : 20 + (i % 5) * 16;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - side * (80 + intensity * 120), y + 28);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoostHud(ctx, w, h, kmh) {
  const x = Math.max(18, w * 0.5 - 170);
  const y = h - 82;
  const bw = 340;
  const bh = 12;
  const boost = Math.max(0, Math.min(100, car.boostMeter || 0));
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
  ctx.strokeStyle = car.boosting ? 'rgba(250, 204, 21, 0.92)' : 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  roundRect(ctx, x - 14, y - 34, bw + 28, 62, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 18px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(`${kmh} km/h`, x, y - 10);
  ctx.textAlign = 'right';
  ctx.fillStyle = car.boosting ? '#facc15' : '#38bdf8';
  ctx.fillText(car.boosting ? 'BOOST' : 'LOBBY PRACTICE', x + bw, y - 10);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  roundRect(ctx, x, y, bw, bh, 999);
  ctx.fill();
  const grad = ctx.createLinearGradient(x, y, x + bw, y);
  grad.addColorStop(0, '#ff5a1f');
  grad.addColorStop(0.55, '#facc15');
  grad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, bw * boost / 100, bh, 999);
  ctx.fill();
  if (driftPulse > 0.05) {
    ctx.globalAlpha = driftPulse;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('DRIFT CHARGING BOOST', x + bw / 2, y + 30);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function makePracticeTrack() {
  return {
    id: 'lobby_practice',
    name: 'Infinite Practice Arena',
    width: 999999,
    centerLine: [],
    startPos: START_POS,
    roadProfile: { type: 'practice', roughness: 0.12 },
  };
}

function createSmokeParticles(target) {
  const particles = [];
  const geometry = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 46; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xe9f2ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    target.add(mesh);
    particles.push({ mesh, life: 0, maxLife: 1, vx: 0, vz: 0, vy: 0, scale: 1 });
  }
  return particles;
}

function spawnLobbyDriftSmoke() {
  if (!smokeParticles.length || !car) return;
  const speed = Math.max(0, car.speed || 0);
  if (speed < 16) return;
  const particle = smokeParticles.find(item => item.life <= 0) || smokeParticles[0];
  const side = Math.sign(car.sideSpeed || car.steerAngle || 1);
  const backX = car.x - Math.cos(car.angle) * 13 - Math.sin(car.angle) * side * 7;
  const backY = car.y - Math.sin(car.angle) * 13 + Math.cos(car.angle) * side * 7;
  particle.life = 0.75;
  particle.maxLife = 0.75;
  particle.vx = -Math.cos(car.angle) * 10 + (Math.random() - 0.5) * 8;
  particle.vz = Math.sin(car.angle) * 10 + (Math.random() - 0.5) * 8;
  particle.vy = 6 + Math.random() * 8;
  particle.scale = 6 + Math.min(14, speed * 0.08);
  particle.mesh.visible = true;
  particle.mesh.position.set(backX, 3.5, -backY);
  particle.mesh.scale.setScalar(1);
  particle.mesh.material.opacity = 0.38;
}

function updateSmokeParticles(dt) {
  for (const particle of smokeParticles) {
    if (particle.life <= 0) continue;
    particle.life -= dt;
    const t = Math.max(0, particle.life / particle.maxLife);
    particle.mesh.position.x += particle.vx * dt;
    particle.mesh.position.y += particle.vy * dt;
    particle.mesh.position.z += particle.vz * dt;
    particle.mesh.scale.setScalar(particle.scale * (1.1 - t));
    particle.mesh.material.opacity = 0.34 * t;
    if (particle.life <= 0) {
      particle.mesh.visible = false;
      particle.mesh.material.opacity = 0;
    }
  }
}
