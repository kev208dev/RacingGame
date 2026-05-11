import * as THREE from 'three';
import { createCarDesign } from './carDesigns.js';

const CAR_DESIGN_BY_ID = {
  apex_gt3: 'gt_silver',
  feather_sprint: 'classic_green',
  nitro_street: 'muscle_orange',
  lmp: 'cyber_black',
  titan_v12: 'buggy_yellow',
  shadow_rs: 'rally_blue',
  neon_wraith: 'hyper_purple',
  zero_f1: 'formula_red',
};

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
//     └── createCarDesign(type) child
export function createCar3D(carData = {}) {
  const root = new THREE.Group();
  const designType = carData.designType || CAR_DESIGN_BY_ID[carData.id] || 'formula_red';
  const model = createCarDesign(designType);
  model.rotation.y = Math.PI / 2;
  model.scale.set(5.2, 5.2, 5.2);
  root.add(model);

  const wheelGroups = [];
  model.traverse(child => {
    const isWheelGroup = child.isGroup && child.name.toLowerCase().includes('wheel');
    if (isWheelGroup) {
      child.spinGroup = child;
      child.baseY = child.position.y;
      child.sideSign = child.position.x < 0 ? 1 : -1;
      child.axleSign = child.position.z > 0 ? 1 : -1;
      wheelGroups.push(child);
    }
  });

  root.wheelGroups = wheelGroups;
  root.body        = model;
  root.castShadow  = true;
  root._roll       = 0;
  root._pitch      = 0;
  root._heave      = 0;

  return root;
}

// ── per-frame mesh sync ──────────────────────────────────────
export function updateCar3D(mesh3d, car, input) {
  // 2D y → 3D -z mapping
  mesh3d.position.set(car.x, 0, -car.y);
  mesh3d.rotation.y = car.angle;

  // wheel spin (around the wheel axle = Z in spinGroup local frame)
  const spinRate = car.speed * 0.05;
  const now = performance.now();
  const speedN = Math.min(1, car.speed / 210);
  for (const wg of (mesh3d.wheelGroups || [])) {
    if (wg.spinGroup) wg.spinGroup.rotation.z -= spinRate;
    const roadBuzz = Math.sin(now * 0.011 + wg.sideSign * 1.7 + wg.axleSign * 0.9) * 0.12 * speedN;
    const loadTransfer = (input?.brake || 0) * wg.axleSign * -0.18 + (input?.throttle || 0) * wg.axleSign * 0.08;
    wg.position.y = (wg.baseY || 5) + roadBuzz + loadTransfer;
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
    const pitchTarget = throttle * 0.012 - brake * 0.028 + (car.boostPower || 0) * 0.006;
    mesh3d._pitch += (pitchTarget - mesh3d._pitch) * 0.08;
    mesh3d.body.rotation.z = mesh3d._pitch;

    // Roll: body leans opposite the turn (centrifugal effect).
    // car.steerAngle is negative for D (right turn), so -steerAngle is positive
    // → rotation.x positive → top of body tilts toward +Z (= car's left side).
    const speedClamp = Math.min(car.speed, 280);
    const rollTarget = -car.steerAngle * speedClamp * 0.00105;
    mesh3d._roll += (rollTarget - mesh3d._roll) * 0.09;
    mesh3d.body.rotation.x = mesh3d._roll;
    const heaveTarget = Math.sin(now * 0.008) * 0.05 * speedN - brake * 0.04;
    mesh3d._heave += (heaveTarget - mesh3d._heave) * 0.06;
    mesh3d.body.position.y = mesh3d._heave;
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
      const base = 2.45 * (car.flameScale || 1) * (0.50 + power * 0.95);
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
