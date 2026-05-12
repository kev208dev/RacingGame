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
    superBoostMeter: 100,
    drsAvailable: false,
    drsActive: false,
    drsTimer: 0,
    drsTapTimer: 0,
    drsPower: 0,
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
    const childName = child.name.toLowerCase();
    const isWheelGroup = child.isGroup && childName.includes('wheel') && !childName.includes('_pivot');
    if (isWheelGroup) {
      child.spinPivot = child.userData.spinPivot || child.children.find(c => c.isGroup && c.name.toLowerCase().includes('_pivot'));
      child.baseY = child.userData.baseY ?? child.position.y;
      child.sideSign = child.position.x < 0 ? 1 : -1;
      child.axleSign = child.position.z > 0 ? 1 : -1;
      wheelGroups.push(child);
    }
  });

  root.wheelGroups = wheelGroups;
  root.body        = model;
  root.castShadow  = true;
  root._lastWheelTime = performance.now();

  return root;
}

// ── per-frame mesh sync ──────────────────────────────────────
export function updateCar3D(mesh3d, car, input) {
  // 2D y → 3D -z mapping
  mesh3d.position.set(car.x, 0, -car.y);
  mesh3d.rotation.y = car.angle;

  const speedSign = Math.sign(car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle)) || 1;
  const speed = car.speed;
  const speedN = Math.min(1, speed / 210);

  const now = performance.now();
  const wheelDt = Math.min(0.05, Math.max(0, (now - (mesh3d._lastWheelTime || now)) / 1000));
  mesh3d._lastWheelTime = now;
  const spinRate = speed * 2.2 * wheelDt * speedSign;
  for (const wg of (mesh3d.wheelGroups || [])) {
    if (wg.spinPivot) wg.spinPivot.rotation.y += spinRate;
  }


  const throttle = input ? (input.throttle || 0) : 0;
  const brake    = input ? (input.brake    || 0) : 0;

  const a = car.angle;
  const ca = Math.cos(a), sa = Math.sin(a);

  if (!mesh3d._susState) {
    const initY = (mesh3d.wheelGroups?.[0]?.position?.y) ?? 0.48;
    mesh3d._susState = {
      wheels: {
        fl: { y: initY }, fr: { y: initY },
        rl: { y: initY }, rr: { y: initY },
      },
      pitch: 0, roll: 0,
    };
  }

  const sus = mesh3d._susState;
  const baseRef = mesh3d.wheelGroups?.[0]?.baseY ?? mesh3d.wheelGroups?.[0]?.position?.y ?? 0.48;

  const corners = [
    { key: 'fl', lx: 12, lz: 9 },
    { key: 'fr', lx: 12, lz: -9 },
    { key: 'rl', lx: -10, lz: 9 },
    { key: 'rr', lx: -10, lz: -9 },
  ];

  for (const c of corners) {
    const w = sus.wheels[c.key];
    if (!w) continue;
    const wx = car.x + c.lx * ca + c.lz * sa;
    const wy = car.y + c.lx * sa - c.lz * ca;
    const roadH = Math.sin(wx * 0.003 + wy * 0.005) * 0.04
                + Math.sin(wx * 0.009 - wy * 0.007) * 0.02;
    const brakeDive = brake * (c.lx > 0 ? -0.42 : 0.16);
    const accelSquat = throttle * (c.lx > 0 ? 0.10 : -0.30);
    const turnSide = Math.sign(car.steerAngle || 0);
    const outsideSide = -turnSide;
    const wheelSide = c.lz > 0 ? 1 : -1;
    const turnLoad = Math.abs(car.steerAngle || 0) * speedN * 0.34;
    const cornerLoad = wheelSide === outsideSide ? -turnLoad : 0;
    const driftPress = car.drifting && wheelSide === outsideSide ? (c.lx < 0 ? -0.34 : -0.18) : 0;
    const targetY = baseRef + roadH + brakeDive + accelSquat + cornerLoad + driftPress;
    w.y += (targetY - w.y) * 0.22;
  }

  const fAvg = (sus.wheels.fl.y + sus.wheels.fr.y) / 2;
  const rAvg = (sus.wheels.rl.y + sus.wheels.rr.y) / 2;
  const lAvg = (sus.wheels.fl.y + sus.wheels.rl.y) / 2;
  const rAvg2 = (sus.wheels.fr.y + sus.wheels.rr.y) / 2;

  if (mesh3d.body) {
    const avgY = (fAvg + rAvg) / 2;
    const driftDrop = car.drifting ? 0.22 : 0;
    mesh3d.body.position.y = avgY - baseRef - driftDrop;
    const targetPitch = (rAvg - fAvg) * 0.02 + throttle * 0.018 - brake * 0.048;
    const driftLean = car.drifting ? -Math.sign(car.sideSpeed || car.steerAngle || 1) * 0.045 : 0;
    const targetRoll = (rAvg2 - lAvg) * 0.02 - car.steerAngle * speed * 0.00062 + driftLean;
    mesh3d.body.rotation.z += (targetPitch - mesh3d.body.rotation.z) * 0.20;
    mesh3d.body.rotation.x += (targetRoll - mesh3d.body.rotation.x) * 0.20;
  }

  for (const wg of (mesh3d.wheelGroups || [])) {
    // Keep tires planted. Suspension now moves only the body so the wheels do
    // not visibly bounce into/out of the road surface.
    wg.position.y = wg.baseY ?? baseRef;
  }

  // front-wheel steer
  if (mesh3d.wheelGroups) {
    const frontWheels = mesh3d.wheelGroups.filter(w => w.position.z > 0);
    for (const wg of frontWheels) wg.rotation.y = car.steerAngle * 0.9;
  }

  // brake lights
  const braking = input && (input.brake > 0);
  mesh3d.traverse(c => {
    if (c.name === 'brakelight' && c.material) {
      c.material.emissive.setHex(braking ? 0xff2222 : 0x441111);
    }
    if (c.name === 'boostflame') {
      const on = !!car.boosting || !!car.drsActive;
      c.visible = on;
      const power = Math.max(car.boostPower || 0, car.drsPower || 0);
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
