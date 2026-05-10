import * as THREE from 'three';
import { createCar, createCar3D, updateCar3D } from '../js/car.js';
import { updatePhysics, KMH_PER_UNIT }  from '../js/physics.js';
import { getTrackGroup }  from '../js/track3d.js';
import { drawHUD }        from '../js/hud.js';
import { createTiming, updateTiming } from '../js/timing.js';
import { getInput }       from '../utils/input.js';
import { startEngine, stopEngine, updateEngineSound, resumeContext, playLapDing, playWallThud } from '../js/audio.js';
import { formatTime } from '../utils/math.js';
import { saveBestLap, addLapHistory } from '../utils/storage.js';
import {
  createSmokePool, spawnSmoke, updateSmoke,
  createSkidBuffer,
  createSparkPool, spawnSparks, updateSparks,
  makeShake, triggerShake, tickShake,
  makeSpeedLines, drawSpeedLines,
  updateFovPump,
} from '../js/effects.js';
import { scatterProps, updateScenery } from '../js/scenery.js';

// ── Three.js renderer (persists across retries) ──────────────
let renderer = null;

// ── per-session state ────────────────────────────────────────
let scene     = null;
let camera3d  = null;
let car       = null;
let carMesh   = null;
let track     = null;
let carData   = null;
let timing    = null;
let onResults = null;
let onMenu    = null;
let running   = false;
let hudCanvas = null;
let hudCtx    = null;
let cameraMode = 'chase'; // 'chase' | 'high'

// fx
let smokePool = null;
let skidBuf   = null;
let sparkPool = null;
let shake     = null;
let speedLines = null;
let propsGroup = null;
let lastWallHitId = 0;

// lap-complete banner state
let lapBannerTimer = 0;
let lapBannerText  = '';
let lapBannerSub   = '';
let lapBannerNew   = false;
let pendingResults = null;

// fixed-step physics
const FIXED_DT  = 1 / 60;
let accumulator = 0;

// camera state (lerped)
const _camPos    = new THREE.Vector3();
const _camLook   = new THREE.Vector3();
let   _camAngle  = 0;     // smoothed heading (rad)

// ── public API ───────────────────────────────────────────────
export function initGame(cd, tr, resultsCb, menuCb) {
  carData     = cd;
  track       = tr;
  onResults   = resultsCb;
  onMenu      = menuCb;
  running     = true;
  accumulator = 0;
  cameraMode  = 'chase';
  lastWallHitId = 0;

  // ── HUD canvas ──
  hudCanvas = document.getElementById('hud-canvas');
  hudCtx    = hudCanvas ? hudCanvas.getContext('2d') : null;
  if (hudCanvas) hudCanvas.style.display = 'block';

  // ── renderer ──
  const threeCanvas = document.getElementById('three-canvas');
  if (threeCanvas) threeCanvas.style.display = 'block';

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // ── scene ──
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog        = new THREE.Fog(0x87ceeb, 1500, 7000);

  // ── camera ──
  camera3d = new THREE.PerspectiveCamera(
    64, window.innerWidth / window.innerHeight, 1, 12000
  );
  const sa = tr.startPos.angle;
  _camPos.set(
    tr.startPos.x - Math.cos(sa) * 78,
    22,
    -(tr.startPos.y - Math.sin(sa) * 78)
  );
  _camLook.set(
    tr.startPos.x + Math.cos(sa) * 45,
    6,
    -(tr.startPos.y + Math.sin(sa) * 45)
  );
  _camAngle = sa;
  camera3d.position.copy(_camPos);
  camera3d.lookAt(_camLook);

  // ── lights ──
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xfff5dc, 1.1);
  sun.position.set(400, 700, -300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near   = 10;
  sun.shadow.camera.far    = 1500;
  sun.shadow.camera.left   = -400;
  sun.shadow.camera.right  =  400;
  sun.shadow.camera.top    =  400;
  sun.shadow.camera.bottom = -400;
  scene.add(sun);
  scene.add(sun.target);
  scene.sunLight = sun;

  const fill = new THREE.DirectionalLight(0xadd8e6, 0.35);
  fill.position.set(-200, 200, 300);
  scene.add(fill);

  // ── track ──
  getTrackGroup(track, scene);

  // ── scenery (mountains, trees, billboards, pit garages, etc) ──
  propsGroup = scatterProps(scene, track);

  // ── car ──
  car     = createCar(cd, tr.startPos);
  carMesh = createCar3D(cd);
  scene.add(carMesh);
  updateCar3D(carMesh, car, { brake: 0 });

  // ── effects ──
  smokePool  = createSmokePool(scene, 80);
  skidBuf    = createSkidBuffer(scene, 400);
  sparkPool  = createSparkPool(scene, 40);
  shake      = makeShake();
  speedLines = makeSpeedLines(60);

  // ── timing ──
  timing = createTiming();

  window.addEventListener('resize', _onResize);

  const hint = document.getElementById('controls-hint');
  if (hint) {
    hint.style.display    = 'flex';
    hint.style.opacity    = '1';
    hint.style.animation  = 'none';
    void hint.offsetHeight;
    hint.style.animation       = 'fadeout 4s forwards';
    hint.style.animationDelay  = '5s';
  }

  startEngine();
}

export function stopGame() {
  running = false;
  stopEngine();
  window.removeEventListener('resize', _onResize);

  const tc = document.getElementById('three-canvas');
  if (tc) tc.style.display = 'none';
  const hc = document.getElementById('hud-canvas');
  if (hc) { hc.style.display = 'none'; if (hudCtx) hudCtx.clearRect(0, 0, hc.width, hc.height); }
  const hint = document.getElementById('controls-hint');
  if (hint) hint.style.display = 'none';
}

export function updateGame(dt, now) {
  if (!running || !car) return;

  const input = getInput();
  resumeContext();

  if (input.cameraToggle) {
    cameraMode = (cameraMode === 'chase') ? 'high' : 'chase';
  }
  if (input.reset)  _resetCar();
  if (input.escape) { stopGame(); if (onMenu) onMenu(); return; }

  // ── fixed-step physics ──
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 5) {
    updatePhysics(car, input, FIXED_DT, track);
    accumulator -= FIXED_DT;
    steps++;
  }

  // ── audio ──
  updateEngineSound(car.rpm, car.maxRpm);

  // ── timing ──
  const event = updateTiming(timing, car, track, now);
  if (event?.type === 'lapComplete') {
    const isNew = !!event.isNew;
    saveBestLap(carData.id, track.id, event.lapMs);
    addLapHistory(carData.id, track.id, {
      lapMs: event.lapMs, sectors: event.sectors, date: Date.now()
    });
    // Show in-game banner first; results screen follows after a beat.
    lapBannerText  = formatTime(event.lapMs);
    lapBannerSub   = isNew ? '🏆 NEW BEST LAP' : 'LAP COMPLETE';
    lapBannerNew   = isNew;
    lapBannerTimer = 1.8;
    pendingResults = { ...event };
    playLapDing(isNew);
  }
  if (lapBannerTimer > 0) {
    lapBannerTimer -= dt;
    if (lapBannerTimer <= 0 && pendingResults) {
      const ev = pendingResults;
      pendingResults = null;
      if (onResults) onResults(ev);
      return;
    }
  }

  // ── effects: drift smoke + skid marks ──
  _emitDriftFx(dt);

  // ── effects: wall hit sparks + screen shake + thud ──
  if (car.lastWallHit && car.lastWallHit.time !== lastWallHitId) {
    lastWallHitId = car.lastWallHit.time;
    const w = car.lastWallHit;
    if (car.speed > 60) {
      spawnSparks(sparkPool, w.x, 5, -w.y, 12);
      playWallThud(Math.min(2, car.speed / 120));
    }
    if (car.speed > 160) {
      triggerShake(shake, Math.min(12, car.speed * 0.04));
    }
  }
  updateSmoke(smokePool, dt);
  updateSparks(sparkPool, dt);

  // ── 3D update ──
  updateCar3D(carMesh, car, input);
  updateScenery(propsGroup, now);
  _updateCamera(dt);

  // ── FOV pump (visual speed sensation) ──
  const kmh = car.speed * KMH_PER_UNIT;
  updateFovPump(camera3d, kmh, car.maxSpeed, !!car.boosting, dt);

  // ── render ──
  renderer.render(scene, camera3d);
  _renderHUD(dt, kmh);
}

// ── drift smoke + skid mark emission ─────────────────────────
function _emitDriftFx(dt) {
  if (!car.drifting || car.speed < 25) return;
  // World positions of rear wheels (from car frame, mesh local coords).
  const a = car.angle;
  const cs = Math.cos(a), sn = Math.sin(a);
  // rear wheels: x=-10 (back), z=±9 (sides) in mesh-local; in physics 2D the
  // sides correspond to perpendicular ±9 from car heading.
  const rearOffset = -10;
  const sideOffset = 9;
  for (const sideSign of [-1, 1]) {
    // mesh-local (-10, 0, sideSign*9). Convert to world-physics 2D:
    //   world x = car.x + rearOffset*cos(a) - sideSign*sideOffset*sin(a)
    //   world y = car.y + rearOffset*sin(a) + sideSign*sideOffset*cos(a)
    const wx = car.x + rearOffset * cs - sideSign * sideOffset * sn;
    const wy = car.y + rearOffset * sn + sideSign * sideOffset * cs;
    const w3z = -wy;
    // Smoke puff occasionally (don't spawn every frame)
    if (Math.random() < 0.55) {
      spawnSmoke(smokePool, wx, 3, w3z);
    }
    // Skid mark: append a quad from the previous wheel position to the current.
    const key = sideSign < 0 ? '_lastSkidL' : '_lastSkidR';
    const prev = car[key];
    if (prev) {
      // Only append if moved a noticeable amount (avoids tons of zero-len quads)
      const dx = wx - prev.x, dz = w3z - prev.z;
      if (dx*dx + dz*dz > 1.2) {
        skidBuf.appendQuad(prev.x, prev.z, wx, w3z, 1.2);
        car[key] = { x: wx, z: w3z };
      }
    } else {
      car[key] = { x: wx, z: w3z };
    }
  }
}

// ── chase camera (framerate-independent smoothing) ──────────
function _updateCamera(dt) {
  const DIST       = cameraMode === 'high' ? 0   : 78;
  const HEIGHT     = cameraMode === 'high' ? 380 : 22;
  const LOOK_AHEAD = 45;

  let dA = car.angle - _camAngle;
  while (dA >  Math.PI) dA -= Math.PI * 2;
  while (dA < -Math.PI) dA += Math.PI * 2;
  const angK = 1 - Math.exp(-9.0 * dt);
  _camAngle += dA * angK;

  const a  = _camAngle;
  const cs = Math.cos(a), sn = Math.sin(a);

  const tx = car.x - cs * DIST;
  const ty = HEIGHT;
  const tz = -(car.y - sn * DIST);

  const lx = car.x + cs * LOOK_AHEAD;
  const ly = 6;
  const lz = -(car.y + sn * LOOK_AHEAD);

  const posK  = 1 - Math.exp(-12.0 * dt);
  const lookK = 1 - Math.exp(-15.0 * dt);

  _camPos.x += (tx - _camPos.x) * posK;
  _camPos.y += (ty - _camPos.y) * posK;
  _camPos.z += (tz - _camPos.z) * posK;

  _camLook.x += (lx - _camLook.x) * lookK;
  _camLook.y += (ly - _camLook.y) * lookK;
  _camLook.z += (lz - _camLook.z) * lookK;

  // Apply screen-shake offset on top of the smoothed position.
  const shk = tickShake(shake, dt);
  camera3d.position.set(_camPos.x + shk.x, _camPos.y + shk.y, _camPos.z);
  camera3d.lookAt(_camLook);

  if (scene && scene.sunLight) {
    const carZ = -car.y;
    scene.sunLight.position.set(car.x + 400, 700, carZ - 300);
    scene.sunLight.target.position.set(car.x, 0, carZ);
    scene.sunLight.target.updateMatrixWorld();
  }
}

// ── HUD overlay ──────────────────────────────────────────────
function _renderHUD(dt, kmh) {
  if (!hudCtx || !hudCanvas) return;
  hudCanvas.width  = window.innerWidth;
  hudCanvas.height = window.innerHeight;
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  // speed-line streaks below normal HUD
  drawSpeedLines(hudCtx, speedLines, kmh, hudCanvas.width, hudCanvas.height, dt, cameraMode);
  drawHUD(hudCtx, car, timing, hudCanvas.width, hudCanvas.height, track);
  if (lapBannerTimer > 0) _drawLapBanner(hudCtx, hudCanvas.width, hudCanvas.height);
}

function _drawLapBanner(ctx, w, h) {
  const cx = w / 2;
  const cy = h * 0.35;
  ctx.save();
  // backdrop
  ctx.fillStyle = lapBannerNew ? 'rgba(80, 40, 100, 0.78)' : 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, cy - 70, w, 150);
  ctx.strokeStyle = lapBannerNew ? '#ff66ff' : '#ffd23c';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, cy - 70, w, 150);
  // sub label
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = lapBannerNew ? '#ff66ff' : '#ffd23c';
  ctx.textAlign = 'center';
  ctx.fillText(lapBannerSub, cx, cy - 30);
  // big time
  ctx.font = 'bold 84px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(lapBannerText, cx, cy + 40);
  ctx.restore();
}

// ── reset ────────────────────────────────────────────────────
function _resetCar() {
  car.x  = track.startPos.x;
  car.y  = track.startPos.y;
  car.angle = track.startPos.angle;
  car.vx = car.vy = car.speed = 0;
  car.gear = 1;
  car.rpm  = 1000;
  car.steerAngle = 0;
  car.offTrack = false;
  car.boostMeter = 0;
  car.boostTimer = 0;
  car.boosting = false;
  car.lastWallHit = null;
  if (skidBuf) skidBuf.reset();
  // Re-create timing so the new lap starts cleanly when the line is crossed.
  timing = createTiming();
  lapBannerTimer = 0;
  pendingResults = null;
}

function _onResize() {
  if (!renderer || !camera3d) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera3d.aspect = window.innerWidth / window.innerHeight;
  camera3d.updateProjectionMatrix();
}
