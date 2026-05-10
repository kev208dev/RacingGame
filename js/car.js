import * as THREE from 'three';
import { getPaintJob } from '../utils/storage.js';

// ── physics state ────────────────────────────────────────────
export function createCar(carData, startPos) {
  return {
    id:          carData.id,
    name:        carData.name,
    mass:        carData.mass,
    maxSpeed:    carData.maxSpeed,
    grip:        carData.grip,
    wheelbase:   carData.wheelbase,
    dragCoef:    carData.dragCoef,
    maxRpm:      carData.maxRpm,
    maxTorque:   carData.maxTorque,
    boostChargeRate: carData.boostChargeRate || 14,
    boostCost:   carData.boostCost || 38,
    boostDuration: carData.boostDuration || 1.45,
    boostSpeedMult: carData.boostSpeedMult || 1.23,
    boostAccelMult: carData.boostAccelMult || 1.35,
    flameScale:  carData.flameScale || 1,
    color:       carData.color,
    bodyColor:   carData.color,
    x: startPos.x, y: startPos.y, angle: startPos.angle,
    vx: 0, vy: 0, speed: 0,
    engineOn: true,
    parkingBrake: false,
    rpm: 1000, gear: 1, steerAngle: 0,
    offTrack: false,
    transmission: 'auto',     // 'auto' | 'manual'
    revLimitTimer: 0,
    sideSpeed: 0,
    drifting: false,
    boostMeter: 0,            // 0..100
    boostTimer: 0,
    boostPower: 0,
    boosting: false,
    lastWallHit: null,
    _acc: 0, _shiftTimer: 0,
    _prevFwdSpeed: 0,
  };
}

// ── 3D mesh ──────────────────────────────────────────────────
// Hierarchy:
//   root (rotation.y = car.angle, position = world)
//     ├── body  (rotation.x = roll, rotation.z = pitch)  → tilts on suspension
//     └── wheelGroups[] (steer + spin)                   → stay flat on ground
export function createCar3D(carData) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hex   = parseInt(carData.color.replace('#', ''), 16);
  const bodyM = new THREE.MeshPhongMaterial({ color: hex, shininess: 120 });
  const paintJob = getPaintJob(carData.id);
  if (paintJob) {
    const paintTexture = new THREE.TextureLoader().load(paintJob);
    paintTexture.colorSpace = THREE.SRGBColorSpace;
    paintTexture.wrapS = THREE.RepeatWrapping;
    paintTexture.wrapT = THREE.RepeatWrapping;
    paintTexture.repeat.set(1.15, 1.0);
    bodyM.map = paintTexture;
    bodyM.color.setHex(0xffffff);
    bodyM.emissive.setHex(0x111111);
  }
  const black = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const dark  = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x5599cc, transparent: true, opacity: 0.7, shininess: 200 });
  const tire  = new THREE.MeshPhongMaterial({ color: paintJob ? 0x2b1f34 : 0x1a1a1a, shininess: 20 });
  const rim   = new THREE.MeshPhongMaterial({ color: 0xb6b6b6, shininess: 160 });
  const white = new THREE.MeshPhongMaterial({ color: 0xeeeeee });
  const carbon = new THREE.MeshPhongMaterial({ color: 0x07090c, shininess: 90 });
  const accent = new THREE.MeshPhongMaterial({ color: 0xffd84a, shininess: 130 });
  if (paintJob) {
    accent.color.setHex(0xffffff);
    accent.map = bodyM.map;
  }
  const paintPanelMat = paintJob
    ? new THREE.MeshPhongMaterial({ color: 0xffffff, map: bodyM.map, shininess: 160, emissive: 0x181818 })
    : bodyM;
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff7a18, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // ── body ──
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(26, 4.5, 12), bodyM);
  bodyMesh.position.set(0, 5, 0);
  bodyMesh.castShadow = true;
  body.add(bodyMesh);
  if (paintJob) {
    const hoodPaint = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 13.5), paintPanelMat);
    hoodPaint.position.set(4, 7.45, 0);
    hoodPaint.castShadow = true;
    body.add(hoodPaint);
    const sidePaintL = new THREE.Mesh(new THREE.BoxGeometry(22, 5.2, 0.5), paintPanelMat);
    sidePaintL.position.set(0, 5.3, 8.45);
    body.add(sidePaintL);
    const sidePaintR = sidePaintL.clone();
    sidePaintR.position.z = -8.45;
    body.add(sidePaintR);
  }

  // low carbon floor and sculpted splitter make the silhouettes less boxy
  const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 16), carbon);
  floor.position.set(0, 2.2, 0);
  floor.castShadow = true;
  body.add(floor);

  // nose
  const nose = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 8), bodyM);
  nose.position.set(14, 3.5, 0);
  nose.castShadow = true;
  body.add(nose);

  const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(7, 0.22, 1.2), accent);
  noseStripe.position.set(14.5, 4.85, 0);
  body.add(noseStripe);

  // side pods
  for (const side of [-1, 1]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 3), bodyM);
    sp.position.set(-1, 4.5, side * 7.5);
    sp.castShadow = true;
    body.add(sp);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 0.6), carbon);
    intake.position.set(3, 5.2, side * 9.3);
    intake.castShadow = true;
    body.add(intake);
  }

  // cockpit surround
  const surround = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 8), bodyM);
  surround.position.set(1, 7, 0);
  surround.castShadow = true;
  body.add(surround);

  // windscreen
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.5, 6.5), glass);
  ws.position.set(5.8, 7.8, 0);
  ws.rotation.z = -0.45;
  body.add(ws);

  // cockpit interior
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 7), black);
  cockpit.position.set(1, 7.8, 0);
  body.add(cockpit);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 24, Math.PI * 1.25), carbon);
  halo.position.set(2.0, 10.3, 0);
  halo.rotation.set(Math.PI / 2, 0, -0.45);
  body.add(halo);

  for (const side of [-1, 1]) {
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 4.5), carbon);
    mirrorArm.position.set(5.5, 8.2, side * 5.5);
    body.add(mirrorArm);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.35), bodyM);
    mirror.position.set(5.5, 8.4, side * 7.8);
    body.add(mirror);
  }

  // rear diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 13), dark);
  diffuser.position.set(-12, 3.5, 0);
  body.add(diffuser);

  for (const side of [-1, 1]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12), carbon);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-15.1, 5.0, side * 2.4);
    body.add(exhaust);

    const flame = new THREE.Group();
    flame.name = 'boostflame';
    flame.position.set(-17.2, 5.0, side * 2.4);
    flame.visible = false;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.05, 6.2, 18), flameMat.clone());
    outer.rotation.z = Math.PI / 2;
    outer.position.x = -2.6;
    outer.name = 'flameouter';
    flame.add(outer);
    const innerMat = flameMat.clone();
    innerMat.color.setHex(0xfff2a0);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.7, 16), innerMat);
    inner.rotation.z = Math.PI / 2;
    inner.position.x = -1.6;
    inner.name = 'flameinner';
    flame.add(inner);
    const glowMat = flameMat.clone();
    glowMat.color.setHex(0xff3b19);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), glowMat);
    glow.position.x = -0.25;
    glow.name = 'flameglow';
    flame.add(glow);
    body.add(flame);
  }

  // ── front wing ──
  const fw = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 18), bodyM);
  fw.position.set(16, 2, 0);
  fw.castShadow = true;
  body.add(fw);
  const fwFlap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 20), carbon);
  fwFlap.position.set(18.1, 2.8, 0);
  body.add(fwFlap);
  for (const s of [-1, 1]) {
    const fwEnd = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 0.8), bodyM);
    fwEnd.position.set(16, 2, s * 9);
    body.add(fwEnd);
  }

  // ── rear wing ──
  const rw = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 17), bodyM);
  rw.position.set(-13, 12, 0);
  rw.castShadow = true;
  body.add(rw);
  const rwFlap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 18), carbon);
  rwFlap.position.set(-15.1, 13.8, 0);
  rwFlap.castShadow = true;
  body.add(rwFlap);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 1.2), dark);
    p.position.set(-13, 9, s * 6);
    body.add(p);
  }

  if (carData.category === 'Prototype') {
    body.scale.set(1.1, 0.82, 1.18);
    rw.position.y += 1.5;
    rwFlap.position.y += 1.5;
  } else if (carData.category === 'Lightweight') {
    body.scale.set(0.86, 0.78, 0.82);
    floor.scale.set(0.9, 0.9, 0.82);
    rw.position.y -= 1.2;
    rw.scale.set(0.72, 0.75, 0.72);
    rwFlap.scale.set(0.72, 0.7, 0.72);
  } else if (carData.category === 'Heavyweight') {
    body.scale.set(1.22, 1.08, 1.18);
    floor.scale.set(1.22, 1, 1.2);
    rw.scale.set(1.08, 1.1, 1.08);
    rwFlap.scale.set(1.08, 1, 1.08);
  } else if (carData.category === 'Formula') {
    body.scale.set(1.0, 0.74, 0.92);
    rw.position.y += 2.8;
    rwFlap.position.y += 2.8;
    fw.scale.set(1.15, 0.8, 1.15);
    fwFlap.scale.set(1.15, 0.8, 1.15);
  } else if (carData.category === 'Road Car') {
    surround.scale.set(1.25, 0.9, 0.9);
    ws.rotation.z = -0.25;
    fw.scale.z = 0.7;
    fwFlap.visible = false;
    rw.scale.set(0.75, 0.8, 0.75);
    rwFlap.scale.set(0.65, 0.7, 0.65);
  }

  // ── brake lights (part of body, lights with the chassis) ──
  const brakeMat = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x550000 });
  for (const s of [-1, 1]) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 2), brakeMat);
    bl.position.set(-14, 5.5, s * 4);
    bl.name = 'brakelight';
    body.add(bl);
  }

  // ── wheels (stay flat on ground; not part of `body`) ──
  // Cylinder default axis is Y. Pre-rotate the geometry so the wheel axle lies
  // along Z (sideways across the car).
  const wheelGeo = new THREE.CylinderGeometry(5, 5, 3.8, 24);
  const rimGeo   = new THREE.CylinderGeometry(2.8, 2.8, 4.0, 12);
  const hubGeo   = new THREE.CylinderGeometry(1.2, 1.2, 4.1, 8);
  wheelGeo.rotateX(Math.PI / 2);
  rimGeo.rotateX(Math.PI / 2);
  hubGeo.rotateX(Math.PI / 2);

  const wheelPositions = [
    [ 12, 5,  9],  // FL
    [ 12, 5, -9],  // FR
    [-10, 5,  9],  // RL
    [-10, 5, -9],  // RR
  ];

  const wheelGroups = [];
  for (const [wx, wy, wz] of wheelPositions) {
    const wg = new THREE.Group();           // steering pivot
    wg.position.set(wx, wy, wz);

    const spinGroup = new THREE.Group();    // rolling rotation (axle = Z)

    const tireMesh = new THREE.Mesh(wheelGeo, tire);
    tireMesh.castShadow = true;
    spinGroup.add(tireMesh);

    const rimMesh = new THREE.Mesh(rimGeo, rim);
    spinGroup.add(rimMesh);
    if (paintJob) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.28, 8, 18), accent);
      ring.rotation.x = Math.PI / 2;
      spinGroup.add(ring);
    }

    const hubMesh = new THREE.Mesh(hubGeo, white);
    spinGroup.add(hubMesh);

    wg.add(spinGroup);
    wg.spinGroup = spinGroup;
    root.add(wg);
    wheelGroups.push(wg);
  }
  root.wheelGroups = wheelGroups;
  root.body        = body;
  root.castShadow  = true;

  // smoothed suspension state
  root._roll  = 0;
  root._pitch = 0;

  return root;
}

// ── per-frame mesh sync ──────────────────────────────────────
export function updateCar3D(mesh3d, car, input) {
  // 2D y → 3D -z mapping
  mesh3d.position.set(car.x, 0, -car.y);
  mesh3d.rotation.y = car.angle;

  // wheel spin (around the wheel axle = Z in spinGroup local frame)
  const spinRate = car.speed * 0.05;
  for (const wg of (mesh3d.wheelGroups || [])) {
    if (wg.spinGroup) wg.spinGroup.rotation.z -= spinRate;
  }

  // front-wheel steer
  if (mesh3d.wheelGroups) {
    mesh3d.wheelGroups[0].rotation.y = car.steerAngle * 1.2;  // FL
    mesh3d.wheelGroups[1].rotation.y = car.steerAngle * 1.2;  // FR
  }

  // ── suspension (visual only) ──
  if (mesh3d.body) {
    // Pitch: nose dives on brake, lifts on throttle.
    const throttle = input ? (input.throttle || 0) : 0;
    const brake    = input ? (input.brake    || 0) : 0;
    const pitchTarget = throttle * 0.018 - brake * 0.030;
    mesh3d._pitch += (pitchTarget - mesh3d._pitch) * 0.12;
    mesh3d.body.rotation.z = mesh3d._pitch;

    // Roll: body leans opposite the turn (centrifugal effect).
    // car.steerAngle is negative for D (right turn), so -steerAngle is positive
    // → rotation.x positive → top of body tilts toward +Z (= car's left side).
    const speedClamp = Math.min(car.speed, 280);
    const rollTarget = -car.steerAngle * speedClamp * 0.0009;
    mesh3d._roll += (rollTarget - mesh3d._roll) * 0.10;
    mesh3d.body.rotation.x = mesh3d._roll;
  }

  // brake lights
  const braking = input && (input.brake > 0);
  mesh3d.traverse(c => {
    if (c.name === 'brakelight' && c.material) {
      c.material.emissive.setHex(braking ? 0xff2222 : 0x441111);
    }
    if (c.name === 'boostflame') {
      const on = !!car.boosting;
      c.visible = on;
      const power = car.boostPower ?? (on ? 1 : 0);
      const base = 1.55 * (car.flameScale || 1) * (0.45 + power * 0.75);
      const flicker = 0.88 + Math.random() * 0.22;
      c.scale.set(base * flicker, base * (0.92 + Math.random() * 0.12), base * (0.88 + Math.random() * 0.18));
      c.children.forEach(part => {
        if (!part.material) return;
        const inner = part.name === 'flameinner';
        const glow = part.name === 'flameglow';
        part.material.opacity = on
          ? (inner ? 0.82 : glow ? 0.22 : 0.48) * (0.55 + power * 0.45)
          : 0;
      });
    }
  });
}
