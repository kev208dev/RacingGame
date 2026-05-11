import { clamp, pointInPolygon } from '../utils/math.js';

// 1 game-unit / sec  ==  1 km/h on the speedometer.
const SPEED_FACTOR = 1.0;
export const KMH_PER_UNIT = 1 / SPEED_FACTOR;

// Per-gear "top speed" — speed at which RPM hits maxRpm in that gear.
const GEAR_TOP = [0, 60, 105, 155, 215, 275, 340];
// Acceleration multiplier per gear (low gears = more torque).
const GEAR_ACCEL = [0, 1.06, 0.94, 0.82, 0.70, 0.58, 0.48];

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
  _updateBoost(car, input, dt);

  // ── derived car limits (boost-modulated) ──
  const boostPower = clamp(car.boostPower || 0, 0, 1);
  const maxSpeed  = car.maxSpeed * SPEED_FACTOR * (1 + ((car.boostSpeedMult || 1.23) - 1) * boostPower);
  const massFactor = Math.pow(1200 / Math.max(650, car.mass || 1200), 0.36);
  const baseAccel = (58 + car.maxTorque * 0.155) * massFactor * (1 + ((car.boostAccelMult || 1.35) - 1) * boostPower);
  const brakeRate = baseAccel * 1.28 * Math.pow(1250 / Math.max(700, car.mass || 1250), 0.1);
  const reverseTop = maxSpeed * 0.30;
  const turnPower = 1.82;

  car.gear = clamp(car.gear || 1, 1, 6);
  const accelRate = baseAccel * GEAR_ACCEL[car.gear];

  // ── steering ── (negate so D = right turn)
  const speedRatio  = clamp(car.speed / maxSpeed, 0, 1);
  const maxWheel    = 0.78 - speedRatio * 0.30;
  const targetWheel = -input.steer * maxWheel;
  car.steerAngle += (targetWheel - car.steerAngle) * Math.min(dt * 7.5, 1);

  const fwdX     = Math.cos(car.angle);
  const fwdY     = Math.sin(car.angle);
  const fwdSpeed = car.vx * fwdX + car.vy * fwdY;

  // ── shift inputs (E/Q always work; auto-switch to manual on use) ──
  if (input.gearUp) {
    car.transmission = 'manual';
    if (car.gear < 6) car.gear += 1;
  }
  if (input.gearDown) {
    car.transmission = 'manual';
    if (car.gear > 1) {
      const newTop = GEAR_TOP[car.gear - 1];
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
    const turnGain = (0.45 + speedRatio * 0.55) * turnPower;
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
    const decay  = input.handbrake ? 0.38 : (3.45 + car.grip * 1.05);
    const sNew   = sSpeed * Math.exp(-decay * dt);
    car.vx = fx * fSpeed + sx * sNew;
    car.vy = fy * fSpeed + sy * sNew;
  }
  car.sideSpeed = sSpeed;
  car.drifting  = (input.handbrake && Math.abs(sSpeed) > 6 && car.speed > 25);
  if (car.drifting) {
    const driftIntensity = clamp(Math.abs(sSpeed) / 45, 0.25, 1.15);
    car.boostMeter = Math.min(100, (car.boostMeter || 0) + dt * (car.boostChargeRate || 14) * 0.48 * driftIntensity);
  }

  // ── drag + rolling ──
  car.speed = Math.hypot(car.vx, car.vy);
  if (car.speed > 0.05) {
    const dragDec = car.speed * car.speed * 0.00265 + 1.05;
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
  const gearTop  = GEAR_TOP[car.gear];
  const sNorm    = car.speed / gearTop;
  car.rpm = clamp(1000 + sNorm * (car.maxRpm - 1000), 800, car.maxRpm * 1.10);

  // ── auto-shift OR manual rev limiter ──
  const upRpm   = car.maxRpm * SHIFT_UP_RPM;
  const downRpm = car.maxRpm * SHIFT_DOWN_RPM;
  if (car.transmission !== 'manual') {
    if (car.rpm > upRpm   && car.gear < 6) car.gear += 1;
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
  [ 12,  9],  // FL
  [ 12, -9],  // FR
  [-10,  9],  // RL
  [-10, -9],  // RR
];

// Iteratively push the car back onto the track until none of its 4 corners
// is on the wrong side of either boundary, or we give up after 3 tries.
function _resolveCollision(car, nextX, nextY, track) {
  let fx = nextX, fy = nextY;
  const a  = car.angle;
  const ca = Math.cos(a), sa = Math.sin(a);

  let collided = false;
  let aggrNx  = 0, aggrNy = 0;

  for (let iter = 0; iter < 3; iter++) {
    let bestPushDx = 0, bestPushDy = 0, bestMag = 0;
    let bestNx = 0,    bestNy = 0;
    let anyOff = false;

    for (const [lx, lz] of CAR_CORNERS) {
      const cx = fx + lx * ca + lz * sa;
      const cy = fy + lx * sa - lz * ca;
      const inOuter = pointInPolygon(cx, cy, track.outerBoundary);
      const inInner = pointInPolygon(cx, cy, track.innerBoundary);
      if (inOuter && !inInner) continue;       // this corner is fine
      anyOff = true;
      const wallBoundary = !inOuter ? track.outerBoundary : track.innerBoundary;
      const hit = _closestSegment(cx, cy, wallBoundary);
      if (!hit) continue;
      // inward normal — direction the corner needs to move
      const wnx = -hit.nx, wny = -hit.ny;
      const dist = Math.hypot(cx - hit.px, cy - hit.py);
      const pushDist = dist + 0.6;          // small buffer past edge
      const dx = wnx * pushDist;
      const dy = wny * pushDist;
      const mag = Math.hypot(dx, dy);
      if (mag > bestMag) {
        bestMag = mag;
        bestPushDx = dx; bestPushDy = dy;
        bestNx = wnx;    bestNy = wny;
      }
    }

    if (!anyOff) break;
    fx += bestPushDx;
    fy += bestPushDy;
    aggrNx = bestNx;
    aggrNy = bestNy;
    collided = true;
  }

  if (collided) {
    car.x = fx;
    car.y = fy;
    car.offTrack = true;

    // reflect the wall-normal component of velocity
    if (aggrNx || aggrNy) {
      const vn = car.vx * aggrNx + car.vy * aggrNy;
      if (vn < 0) {
        car.vx -= vn * aggrNx * 1.55;
        car.vy -= vn * aggrNy * 1.55;
      }
    }
    // friction along the wall slide
    car.vx *= 0.80;
    car.vy *= 0.80;

    car.lastWallHit = {
      x: fx, y: fy, nx: aggrNx, ny: aggrNy,
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
    car.boostMeter = Math.max(0, car.boostMeter - cost);
    car.boostTimer = car.boostDuration || 1.45;
  }
  car.boosting = car.boostTimer > 0;
  const target = car.boosting ? 1 : 0;
  const response = car.boosting ? 5.5 : 3.2;
  car.boostPower = (car.boostPower || 0) + (target - (car.boostPower || 0)) * (1 - Math.exp(-response * dt));
}

function _closestSegment(x, y, boundary) {
  let best = null;
  let bestD2 = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    const [x1, y1] = boundary[i];
    const [x2, y2] = boundary[(i + 1) % boundary.length];
    const ex = x2 - x1, ey = y2 - y1;
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-6) continue;
    const t  = clamp(((x - x1) * ex + (y - y1) * ey) / len2, 0, 1);
    const px = x1 + t * ex, py = y1 + t * ey;
    const ddx = x - px, ddy = y - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      const dlen = Math.sqrt(d2) || 1e-6;
      best = { px, py, nx: ddx / dlen, ny: ddy / dlen };
    }
  }
  return best;
}
