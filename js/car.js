import * as THREE from 'three';

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
  const black = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const dark  = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x5599cc, transparent: true, opacity: 0.7, shininess: 200 });
  const tire  = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 20 });
  const rim   = new THREE.MeshPhongMaterial({ color: 0xb6b6b6, shininess: 160 });
  const white = new THREE.MeshPhongMaterial({ color: 0xeeeeee });

  // ── body ──
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(26, 4.5, 12), bodyM);
  bodyMesh.position.set(0, 5, 0);
  bodyMesh.castShadow = true;
  body.add(bodyMesh);

  // nose
  const nose = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 8), bodyM);
  nose.position.set(14, 3.5, 0);
  nose.castShadow = true;
  body.add(nose);

  // side pods
  for (const side of [-1, 1]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 3), bodyM);
    sp.position.set(-1, 4.5, side * 7.5);
    sp.castShadow = true;
    body.add(sp);
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

  // rear diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 13), dark);
  diffuser.position.set(-12, 3.5, 0);
  body.add(diffuser);

  // ── front wing ──
  const fw = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 18), bodyM);
  fw.position.set(16, 2, 0);
  fw.castShadow = true;
  body.add(fw);
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
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 1.2), dark);
    p.position.set(-13, 9, s * 6);
    body.add(p);
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
  });
}
