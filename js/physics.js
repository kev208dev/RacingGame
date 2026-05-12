import { clamp } from '../utils/math.js';

export const TOP_SPEED_MULT = 2.02;
export const KMH_PER_UNIT = 1;
const ACCEL_MULT = 2.35;
const BRAKE_MULT = 1.9;
const DRAG_MULT = 1 / (TOP_SPEED_MULT * TOP_SPEED_MULT);
const DRS_MIN_SPEED = 110;

// Per-gear "top speed" — speed at which RPM hits maxRpm in that gear.
const GEAR_TOP = [0, 48, 82, 120, 162, 208, 258, 305, 355];
// Acceleration multiplier per gear (low gears = more torque).
const GEAR_ACCEL = [0, 1.12, 1.02, 0.92, 0.80, 0.68, 0.57, 0.48, 0.40];

const SHIFT_UP_RPM   = 0.92; // ratio of maxRpm to auto-upshift
const SHIFT_DOWN_RPM = 0.32; // ratio of maxRpm to auto-downshift
const REV_LIMIT_TIME = 0.08; // sec the throttle is starved on hitting limiter

export function updatePhysics(car, input, dt, track) {
  if (dt <= 0) return;
  if (dt > 0.05) dt = 0.05;

  // ── transmission mode toggle ──
  if (input.autoToggle) {
    car.transmission = (car.transmission === 'manual') ? 'auto' : 'manual';
  }

  // ── boost state machine ──
  _updateDrs(car, input, track, dt);
  _updateBoost(car, input, dt);

  // ── derived car limits (boost-modulated) ──
  const boostPower = clamp(car.boostPower || 0, 0, 1);
  const drsPower = clamp(car.drsPower || 0, 0, 1);
  const maxSpeed  = car.maxSpeed * TOP_SPEED_MULT
    * (1 + ((car.boostSpeedMult || 1.23) - 1) * boostPower)
    * (1 + 0.28 * drsPower);
  const massFactor = Math.pow(1200 / Math.max(650, car.mass || 1200), 0.28);
  const baseAccel = (40 + car.maxTorque * 0.105) * massFactor * ACCEL_MULT
    * (1 + ((car.boostAccelMult || 1.35) - 1) * boostPower)
    * (1 + 0.38 * drsPower);
  const brakeRate = baseAccel * BRAKE_MULT * Math.pow(1250 / Math.max(700, car.mass || 1250), 0.1);
  const reverseTop = maxSpeed * 0.30;
  const driftActive = car.drifting === true;
  const turnPower = input.handbrake
    ? (driftActive ? 4.20 : 3.40)
    : 1.62;

  car.gear = clamp(car.gear || 1, 1, 8);
  const accelRate = baseAccel * GEAR_ACCEL[car.gear];

  // ── steering ── (negate so D = right turn)
  const speedRatio  = clamp(car.speed / maxSpeed, 0, 1);
  const baseWheel   = 0.82 - speedRatio * 0.22;
  const handbrakeBonus = input.handbrake ? 0.30 : 0;
  const maxWheel    = baseWheel + handbrakeBonus;
  const targetWheel = -input.steer * maxWheel;
  car.steerAngle += (targetWheel - car.steerAngle) * Math.min(dt * 6.8, 1);

  const fwdX     = Math.cos(car.angle);
  const fwdY     = Math.sin(car.angle);
  const fwdSpeed = car.vx * fwdX + car.vy * fwdY;

  // ── shift inputs (Q up / E down; auto-switch to manual on use) ──
  if (input.gearUp) {
    car.transmission = 'manual';
    if (car.gear < 8) car.gear += 1;
  }
  if (input.gearDown) {
    car.transmission = 'manual';
    if (car.gear > 1) {
      const newTop = _gearTop(car.gear - 1);
      if ((car.speed / newTop) < 1.05) car.gear -= 1;
    }
  }

  // ── rev-limiter timer ──
  car.revLimitTimer = Math.max(0, (car.revLimitTimer || 0) - dt);
  const revLimited = car.revLimitTimer > 0;

  // ── throttle / brake / reverse ──
  if (input.throttle > 0 && !revLimited) {
    car.vx += fwdX * accelRate * input.throttle * dt;
    car.vy += fwdY * accelRate * input.throttle * dt;
  }
  if (input.brake > 0) {
    if (fwdSpeed > 1.0) {
      const sp  = Math.hypot(car.vx, car.vy);
      const dec = brakeRate * input.brake * dt;
      const k   = Math.min(dec / sp, 1);
      car.vx -= car.vx * k;
      car.vy -= car.vy * k;
    } else if (input.throttle === 0) {
      if (fwdSpeed > -reverseTop) {
        car.vx -= fwdX * baseAccel * 0.34 * input.brake * dt;
        car.vy -= fwdY * baseAccel * 0.34 * input.brake * dt;
      }
    }
  }

  // ── yaw ──
  car.speed = Math.hypot(car.vx, car.vy);
  if (car.speed > 0.5) {
    const dirSign  = fwdSpeed >= 0 ? 1 : -1;
    const turnGain = (0.46 + speedRatio * 0.58) * turnPower;
    car.angle += car.steerAngle * turnGain * dirSign * dt;
  }

  // ── lateral grip + drift detection ──
  car.speed = Math.hypot(car.vx, car.vy);
  let sSpeed = 0;
  if (car.speed > 0.2) {
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const sx = -fy,                  sy =  fx;
    const fSpeed = car.vx * fx + car.vy * fy;
    sSpeed = car.vx * sx + car.vy * sy;
    // Looser grip while handbraking → bigger drift.
    const decay  = input.handbrake ? 0.05 : (4.4 + car.grip * 1.25);
    const sNew   = sSpeed * Math.exp(-decay * dt);
    car.vx = fx * fSpeed + sx * sNew;
    car.vy = fy * fSpeed + sy * sNew;
  }
  car.sideSpeed = sSpeed;
  car.drifting  = (input.handbrake && Math.abs(sSpeed) > 2.5 && car.speed > 16);
  if (car.drifting) {
    const driftIntensity = clamp(Math.abs(sSpeed) / 45, 0.25, 1.15);
    car.boostMeter = Math.min(100, (car.boostMeter || 0) + dt * (car.boostChargeRate || 14) * 0.48 * driftIntensity);
  }

  // ── drag + rolling ──
  car.speed = Math.hypot(car.vx, car.vy);
  if (car.speed > 0.05) {
    const dragDec = car.speed * car.speed * 0.00265 * DRAG_MULT + 1.05;
    const k       = Math.min((dragDec * dt) / car.speed, 1);
    car.vx -= car.vx * k;
    car.vy -= car.vy * k;
  } else {
    car.vx = 0; car.vy = 0;
  }

  // ── top-speed cap ──
  car.speed = Math.hypot(car.vx, car.vy);
  if (car.speed > maxSpeed) {
    const k = maxSpeed / car.speed;
    car.vx *= k; car.vy *= k;
    car.speed = maxSpeed;
  }

  // ── RPM from gear band ──
  const gearTop  = _gearTop(car.gear);
  const sNorm    = car.speed / gearTop;
  car.rpm = clamp(1000 + sNorm * (car.maxRpm - 1000), 800, car.maxRpm * 1.10);

  // ── auto-shift OR manual rev limiter ──
  const upRpm   = car.maxRpm * SHIFT_UP_RPM;
  const downRpm = car.maxRpm * SHIFT_DOWN_RPM;
  if (car.transmission !== 'manual') {
    if (car.rpm > upRpm   && car.gear < 8) car.gear += 1;
    if (car.rpm < downRpm && car.gear > 1) car.gear -= 1;
  } else {
    if (car.rpm >= car.maxRpm * 1.02) {
      car.revLimitTimer = REV_LIMIT_TIME;
      car.rpm = car.maxRpm;
    }
  }

  // ── move + 4-corner wall collision ──
  const nextX = car.x + car.vx * dt;
  const nextY = car.y + car.vy * dt;
  _resolveCollision(car, nextX, nextY, track);
  car.speed = Math.hypot(car.vx, car.vy);
}

// Car corners (mesh-local x, z) — match wheel positions in car.js so the
// hitbox actually covers what the player sees on screen.
const CAR_CORNERS = [
  [ 14,  12],  // FL
  [ 14, -12],  // FR
  [-12,  12],  // RL
  [-12, -12],  // RR
];

function _resolveCollision(car, nextX, nextY, track) {
  let fx = nextX, fy = nextY;
  const a  = car.angle;
  const ca = Math.cos(a), sa = Math.sin(a);
  const halfTrack = (track.width || 100) / 2;
  const guardrailOffset = halfTrack + 18;
  const maxDist = Math.max(18, guardrailOffset - 4);

  let collided = false;
  let aggrNx  = 0, aggrNy = 0;

  for (let iter = 0; iter < 2; iter++) {
    let pushX = 0, pushY = 0, pushCount = 0;
    let anyOff = false;

    for (const [lx, lz] of CAR_CORNERS) {
      const cx = fx + lx * ca + lz * sa;
      const cy = fy + lx * sa - lz * ca;
      const hit = _closestCenterlineSegment(cx, cy, track.centerLine || []);
      if (!hit || hit.dist <= maxDist) continue;

      anyOff = true;
      const excess = hit.dist - maxDist + 0.8;
      const nx = hit.dx / (hit.dist || 1);
      const ny = hit.dy / (hit.dist || 1);
      pushX -= nx * excess;
      pushY -= ny * excess;
      aggrNx -= nx;
      aggrNy -= ny;
      pushCount++;
    }

    if (!anyOff) break;
    fx += pushX / Math.max(1, pushCount);
    fy += pushY / Math.max(1, pushCount);
    collided = true;
  }

  if (collided) {
    car.x = fx;
    car.y = fy;
    car.offTrack = true;

    // reflect the wall-normal component of velocity
    const nl = Math.hypot(aggrNx, aggrNy) || 1;
    const nx = aggrNx / nl;
    const ny = aggrNy / nl;
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      const vn = car.vx * nx + car.vy * ny;
      if (vn < 0) {
        car.vx -= vn * nx * 1.12;
        car.vy -= vn * ny * 1.12;
      }
    }
    // friction along the wall slide
    car.vx *= 0.70;
    car.vy *= 0.70;

    car.lastWallHit = {
      x: fx, y: fy, nx, ny,
      impactSpeed: car.speed,
      totalSpeed: car.speed,
      time: performance.now(),
    };
  } else {
    car.offTrack = false;
    car.x = fx;
    car.y = fy;
  }
}

function _updateBoost(car, input, dt) {
  car.boostMeter = clamp(car.boostMeter || 0, 0, 100);
  car.boostTimer = Math.max(0, (car.boostTimer || 0) - dt);

  const cost = car.boostCost || 38;
  if (input.boostJust && car.boostMeter >= cost && car.boostTimer <= 0) {
    car.boostTimer = car.boostDuration || 1.45;
    car._boostDrainPerSec = cost / Math.max(0.25, car.boostTimer);
  }
  if (car.boostTimer > 0) {
    car.boostMeter = Math.max(0, car.boostMeter - (car._boostDrainPerSec || cost) * dt);
    if (car.boostMeter <= 0) car.boostTimer = 0;
  }
  car.boosting = car.boostTimer > 0;
  const target = car.boosting ? 1 : 0;
  const response = car.boosting ? 5.5 : 3.2;
  car.boostPower = (car.boostPower || 0) + (target - (car.boostPower || 0)) * (1 - Math.exp(-response * dt));
}

function _updateDrs(car, input, track, dt) {
  car.superBoostMeter = clamp(car.superBoostMeter ?? 100, 0, 100);
  car.drsTimer = Math.max(0, (car.drsTimer || 0) - dt);
  car.drsTapTimer = Math.max(0, (car.drsTapTimer || 0) - dt);

  const hit = _closestCenterlineSegment(car.x, car.y, track.centerLine || []);
  let available = false;
  if (hit && car.speed > DRS_MIN_SPEED && !car.drifting && !car.offTrack) {
    const fwdX = Math.cos(car.angle);
    const fwdY = Math.sin(car.angle);
    const headingAlign = Math.abs(fwdX * hit.tx + fwdY * hit.ty);
    available = hit.straightness > 0.965 && headingAlign > 0.82 && hit.dist < (track.width || 100) * 0.40;
  }

  if (available && input.boostJust && car.superBoostMeter > 8) {
    if (input.boostDouble || car.drsTapTimer > 0) {
      car.drsTimer = 2.6;
      car.drsTapTimer = 0;
    } else {
      car.drsTapTimer = 0.48;
    }
  }

  if (!available) {
    car.drsTimer = 0;
    car.drsTapTimer = 0;
    car.superBoostMeter = Math.min(100, car.superBoostMeter + dt * 18);
  }

  let active = available && car.drsTimer > 0 && car.superBoostMeter > 0;
  if (active) {
    car.superBoostMeter = Math.max(0, car.superBoostMeter - 42 * dt);
    if (car.superBoostMeter <= 0) {
      car.drsTimer = 0;
      active = false;
    }
  }
  car.drsAvailable = available;
  car.drsActive = active;
  const target = active ? 1 : 0;
  car.drsPower = (car.drsPower || 0) + (target - (car.drsPower || 0)) * (1 - Math.exp(-(active ? 5.0 : 5.8) * dt));
}

function _gearTop(gear) {
  return (GEAR_TOP[gear] || GEAR_TOP[1]) * TOP_SPEED_MULT;
}

function _closestCenterlineSegment(x, y, centerLine) {
  let best = null;
  let bestD2 = Infinity;
  for (let i = 0; i < centerLine.length; i++) {
    const [x1, y1] = centerLine[i];
    const [x2, y2] = centerLine[(i + 1) % centerLine.length];
    const ex = x2 - x1, ey = y2 - y1;
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-6) continue;
    const t  = clamp(((x - x1) * ex + (y - y1) * ey) / len2, 0, 1);
    const px = x1 + t * ex, py = y1 + t * ey;
    const ddx = x - px, ddy = y - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      const len = Math.sqrt(len2) || 1;
      const prev = centerLine[(i - 4 + centerLine.length) % centerLine.length];
      const next = centerLine[(i + 5) % centerLine.length];
      const vx = next[0] - prev[0];
      const vy = next[1] - prev[1];
      const vl = Math.hypot(vx, vy) || 1;
      const straightness = Math.abs((ex / len) * (vx / vl) + (ey / len) * (vy / vl));
      best = { px, py, dx: ddx, dy: ddy, dist: Math.sqrt(d2), tx: ex / len, ty: ey / len, straightness };
    }
  }
  return best;
}
