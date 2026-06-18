// KartRider 원작형 주행 메커니즘. 코어는 kart-boost/ 모듈이 담당.
// 이 파일은 wrapper: kart drift → collision → gear/RPM/HUD 보조.

import { clamp } from '../utils/math.js';
import {
  stepKartDrift,
  initKartState,
  MIN_DRIFT_SPEED as KART_MIN_DRIFT_SPEED,
  DOUBLE_DRIFT_MIN_SPEED as KART_DOUBLE_DRIFT_MIN_SPEED,
} from '../kart-boost/index.js';
import { updateAnalytics } from './driftAnalytics.js';

export const TOP_SPEED_MULT = 1.0; // kart 모델은 car.maxSpeed 자체를 cruise cap으로 사용
export const KMH_PER_UNIT   = 1;
export const MIN_DRIFT_SPEED = KART_MIN_DRIFT_SPEED;
export const DOUBLE_DRIFT_MIN_SPEED = KART_DOUBLE_DRIFT_MIN_SPEED;

// ─── 위치 리스폰: 가장 가까운 centerLine 세그먼트 한가운데로 스냅 ───
// 벽 끼임 해제용. 타이머/랩 안 건드림.
export function respawnAtCenter(car, track) {
  const cl = track?.centerLine || [];
  if (!cl.length) return;
  let best = { d2: Infinity, px: car.x, py: car.y, ex: 1, ey: 0 };
  for (let i = 0; i < cl.length; i++) {
    const [x1, y1] = cl[i];
    const [x2, y2] = cl[(i + 1) % cl.length];
    const ex = x2 - x1, ey = y2 - y1;
    const len2 = ex * ex + ey * ey || 1;
    const t = Math.max(0, Math.min(1, ((car.x - x1) * ex + (car.y - y1) * ey) / len2));
    const px = x1 + ex * t, py = y1 + ey * t;
    const d2 = (car.x - px) ** 2 + (car.y - py) ** 2;
    if (d2 < best.d2) best = { d2, px, py, ex, ey };
  }
  car.x = best.px;
  car.y = best.py;
  car.angle = Math.atan2(best.ey, best.ex);
  car.vx = 0; car.vy = 0; car.speed = 0;
  car.steerAngle = 0;
  car.drifting = false;
  car.driftState = 'idle';
  car.driftStateTime = 0;
  car.driftAngle = 0;
  car.boostSustainTimer = 0;
  car.boostCapDecayTimer = 0;
  car.boosting = false;
  car.boostPower = 0;
  car.boostFireFx = 0;
  car.boostMeter = 0;
  car.boostStock = 0;
  car.offTrack = false;
  car.wallRiding = false;
  car.lastWallHit = null;
  car._driftDir = 0;
  car.slipBeta = 0;
}

const WALL_RIDE_TURN_MIN = 0.105;
const WALL_RIDE_EXTRA    = 3;        // 7→3 — 가드레일 폭 좁힘
const WALL_RIDE_MIN_SPEED = 58;
const COLLISION_EDGE_GRACE = 6;      // 24→6 — 가드레일(half+6) 바로 앞에서 막음
const OFF_ROAD_GRACE       = 6;      // 18→6 — 노면 밖 즉시 차단

const SHIFT_UP_RPM   = 0.92;
const SHIFT_DOWN_RPM = 0.32;
const GEAR_TOP   = [0, 48, 82, 120, 162, 208, 258, 305, 355];

export function updatePhysics(car, input, dt, track) {
  if (dt <= 0) return;
  if (dt > 0.05) dt = 0.05;

  if (!car._kartInited) {
    initKartState(car);
    car._kartInited = true;
  }

  // ─── 1. KartRider 주행: 마찰 분리 + 드리프트 상태머신 + 부스트 폭발 ───
  // track 인자로 surface(빙판) 판정.
  stepKartDrift(car, input, dt, track);

  // ─── 2. 수동 기어 입력 (HUD 보조) ───
  if (input.gearUp) {
    car.transmission = 'manual';
    if (car.gear < 8) car.gear += 1;
  }
  if (input.gearDown) {
    car.transmission = 'manual';
    if (car.gear > 1) car.gear -= 1;
  }

  // ─── 3. 충돌 (4-corner wall) ───
  _moveWithCollisionSubsteps(car, dt, track);
  car.speed = Math.hypot(car.vx, car.vy);

  // ─── 4. RPM / 기어 (HUD/사운드 보조) ───
  const maxCruise = Math.max(120, car.maxSpeed || 180);
  const sNorm = clamp(car.speed / maxCruise, 0, 1.4);
  if (car.transmission !== 'manual') {
    car.gear = clamp(Math.ceil(sNorm * 6) + 1, 1, 8);
  } else {
    car.gear = clamp(car.gear || 1, 1, 8);
  }
  car.rpm = clamp(1000 + sNorm * ((car.maxRpm || 8000) - 1000), 800, (car.maxRpm || 8000) * 1.05);

  // ─── 5. DRS off (kart 부스트가 대체) ───
  car.drsActive    = false;
  car.drsAvailable = false;
  car.drsPower     = (car.drsPower || 0) * Math.exp(-6 * dt);
  car.superBoostMeter = 100;

  // ─── 6. 차량동역학 관측 (β, r, a_y, 축하중, phase 분류) ───
  updateAnalytics(car, dt, input);
}

// ───────────────────────────────────────────────────────────────
//  Collision (upstream 그대로)
// ───────────────────────────────────────────────────────────────

// OBB sample points (car-local). 모서리 4 + 측면 중점 4 = 8 → 어느 부위가 닿아도 잡힘.
const CAR_HALF_LEN = 11;
const CAR_HALF_WID = 8;
const CAR_CORNERS = [
  [ CAR_HALF_LEN,  CAR_HALF_WID], // front-right
  [ CAR_HALF_LEN, -CAR_HALF_WID], // front-left
  [-CAR_HALF_LEN,  CAR_HALF_WID], // rear-right
  [-CAR_HALF_LEN, -CAR_HALF_WID], // rear-left
  [ CAR_HALF_LEN,  0],            // front-mid (nose)
  [-CAR_HALF_LEN,  0],            // rear-mid (tail)
  [ 0,  CAR_HALF_WID],            // right-mid (side)
  [ 0, -CAR_HALF_WID],            // left-mid (side)
];

// 충돌 튜닝 — 수평면(XZ)만, 차 평평 유지, vN/vT 분해.
const RESTITUTION       = 0.30;
const WALL_FRICTION     = 0.15;
const WALL_FRICTION_HARD = 0.30;
const HEADON_COS        = 0.819;
const GLANCE_COS        = 0.5;
const DEPEN_EPS         = 2.0;        // 0.6→2.0 — 확실히 벽 밖으로 분리해 재충돌 차단
const DEPEN_ITERS       = 6;          // 4→6
const MIN_BOUNCE_VN     = 18;         // vIntoWall 이하 = 미세 접촉 → 마찰 없이 vN만 제거(끼임/데드스톱 차단)

const _trackCollisionCaches = new WeakMap();

function _moveWithCollisionSubsteps(car, dt, track) {
  // 매 substep마다 'live' vx/vy 사용 — 튕긴 후엔 즉시 새 방향으로 이동.
  const totalDist = Math.hypot(car.vx, car.vy) * dt;
  const steps = Math.max(1, Math.min(8, Math.ceil(totalDist / 4)));
  const subDt = dt / steps;
  for (let i = 0; i < steps; i++) {
    const nextX = car.x + car.vx * subDt;
    const nextY = car.y + car.vy * subDt;
    _resolveCollision(car, nextX, nextY, track);
  }
}

function _resolveCollision(car, nextX, nextY, track) {
  let fx = nextX, fy = nextY;
  const a  = car.angle;
  const ca = Math.cos(a), sa = Math.sin(a);
  const halfTrack = (track.width || 100) / 2;
  const maxDist = Math.max(18, halfTrack + COLLISION_EDGE_GRACE);
  const wallRideLimit = maxDist + WALL_RIDE_EXTRA;
  const offRoadLimit = halfTrack + OFF_ROAD_GRACE;

  let collided = false;
  let rideTouch = false;
  let rideCollisions = 0;
  let hardCollisions = 0;
  let rideSide = 0;
  let aggrNx  = 0, aggrNy = 0;

  // 완전 디펜에트레이션: 4회 반복까지 침투 0 + epsilon 까지 밀어냄. 끼임 방지.
  for (let iter = 0; iter < DEPEN_ITERS; iter++) {
    let pushX = 0, pushY = 0, pushCount = 0;
    let anyOff = false;

    for (const [lx, lz] of CAR_CORNERS) {
      const cx = fx + lx * ca + lz * sa;
      const cy = fy + lx * sa - lz * ca;
      const hit = _closestCenterlineSegment(cx, cy, track.centerLine || [], car._collisionSegmentHint);
      if (!hit) continue;
      car._collisionSegmentHint = hit.index;

      const rideable = _isWallRideCorner(car, hit, maxDist);
      if (rideable && hit.dist > maxDist - 2 && hit.dist <= wallRideLimit + 2) {
        rideTouch = true;
        rideSide += _wallRideSide(car, hit);
      }

      const activeLimit = rideable ? wallRideLimit : maxDist;
      const invalidSurface = hit.dist > offRoadLimit && !_isPointOnRoad(cx, cy, track);
      if (hit.dist <= activeLimit && !invalidSurface) continue;

      anyOff = true;
      const softRideHit = rideable && hit.dist <= wallRideLimit + 8;
      // 침투 + 충분한 ε 으로 한번에 벽 밖으로.
      const excess = Math.max(0, hit.dist - activeLimit) + (invalidSurface ? 2.4 : (softRideHit ? 0.25 : DEPEN_EPS));
      // hit.dx/dy = (corner - segPt). dx,dy 방향 = wall outward. push 방향 = -outward = inward.
      const nxOut = hit.dx / (hit.dist || 1);
      const nyOut = hit.dy / (hit.dist || 1);
      pushX -= nxOut * excess;
      pushY -= nyOut * excess;
      aggrNx -= nxOut;       // inward 누적 (벽이 차에 가하는 법선 방향)
      aggrNy -= nyOut;
      if (softRideHit) rideCollisions++;
      else hardCollisions++;
      pushCount++;
    }

    if (!anyOff) break;
    fx += pushX / Math.max(1, pushCount);
    fy += pushY / Math.max(1, pushCount);
    collided = true;
  }

  if (collided) {
    const wallRiding = rideCollisions > 0 && hardCollisions === 0;
    car.x = fx;
    car.y = fy;
    car.offTrack = !wallRiding;
    car.wallRiding = wallRiding;
    car.wallRideSide = Math.sign(rideSide) || car.wallRideSide || 0;

    const nl = Math.hypot(aggrNx, aggrNy) || 1;
    // n = 벽 안쪽(차 쪽) 방향.
    const nx = aggrNx / nl;
    const ny = aggrNy / nl;
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      // 분해: vN(법선) + vT(접선).
      const vn = car.vx * nx + car.vy * ny;        // dot(v, n_inward)
      const vIntoWall = -vn;
      if (vIntoWall > 0) {
        const vNx = vn * nx, vNy = vn * ny;
        const vTx = car.vx - vNx, vTy = car.vy - vNy;

        if (vIntoWall < MIN_BOUNCE_VN) {
          // 미세 접촉(throttle로 벽에 살짝 닿음 등) → 마찰 ❌, vN만 제거.
          // 접선 그대로 → 벽 따라 미끄러짐, 끼임/데드스톱 차단.
          car.vx = vTx;
          car.vy = vTy;
        } else {
          // 실 충돌: 법선 반사 + 접선 마찰.
          const speed = Math.hypot(car.vx, car.vy) || 1;
          const cosI = vIntoWall / speed;
          const headOn = cosI >= HEADON_COS;
          const glance = cosI <= GLANCE_COS;

          const vN_newX = nx * vIntoWall * RESTITUTION;
          const vN_newY = ny * vIntoWall * RESTITUTION;

          let fricT;
          if (wallRiding || glance) fricT = WALL_FRICTION;
          else if (headOn)          fricT = WALL_FRICTION_HARD;
          else                       fricT = (WALL_FRICTION + WALL_FRICTION_HARD) * 0.5;

          car.vx = vN_newX + vTx * (1 - fricT);
          car.vy = vN_newY + vTy * (1 - fricT);

          if (headOn && !wallRiding) car.boostMeter = 0;
        }
      }
    }

    car.lastWallHit = wallRiding ? null : {
      x: fx, y: fy, nx, ny,
      impactSpeed: Math.hypot(car.vx, car.vy),
      totalSpeed: car.speed,
      time: performance.now(),
    };
  } else {
    car.offTrack = false;
    car.wallRiding = rideTouch;
    if (rideTouch) car.wallRideSide = Math.sign(rideSide) || car.wallRideSide || 0;
    car.x = fx;
    car.y = fy;
  }
}

function _closestCenterlineSegment(x, y, centerLine, hintIndex = null) {
  const cache = _getCollisionCache(centerLine);
  const segments = cache.segments;
  if (!segments.length) return null;

  let best = null;
  let bestD2 = Infinity;
  const scanSegment = (seg) => {
    const t  = clamp(((x - seg.x1) * seg.ex + (y - seg.y1) * seg.ey) / seg.len2, 0, 1);
    const px = seg.x1 + t * seg.ex, py = seg.y1 + t * seg.ey;
    const ddx = x - px, ddy = y - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = {
        px, py, dx: ddx, dy: ddy,
        dist: Math.sqrt(d2),
        tx: seg.tx, ty: seg.ty,
        straightness: seg.straightness,
        localTurn: seg.localTurn,
        index: seg.index,
      };
    }
  };

  const hinted = Number.isFinite(hintIndex);
  if (hinted) {
    const radius = 14;
    for (let off = -radius; off <= radius; off++) {
      const idx = (hintIndex + off + segments.length) % segments.length;
      scanSegment(segments[idx]);
    }
  } else {
    for (const seg of segments) scanSegment(seg);
  }

  if (hinted) {
    const maxExpected = 260;
    if (!best || bestD2 > maxExpected * maxExpected) {
      best = null;
      bestD2 = Infinity;
      for (const seg of segments) scanSegment(seg);
    }
  }

  return best;
}

function _getCollisionCache(centerLine) {
  if (!centerLine?.length) return { segments: [] };
  let cache = _trackCollisionCaches.get(centerLine);
  if (cache) return cache;

  const segments = [];
  for (let i = 0; i < centerLine.length; i++) {
    const [x1, y1] = centerLine[i];
    const [x2, y2] = centerLine[(i + 1) % centerLine.length];
    const ex = x2 - x1, ey = y2 - y1;
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-6) continue;
    const len = Math.sqrt(len2) || 1;
    const prev = centerLine[(i - 4 + centerLine.length) % centerLine.length];
    const next = centerLine[(i + 5) % centerLine.length];
    const vx = next[0] - prev[0];
    const vy = next[1] - prev[1];
    const vl = Math.hypot(vx, vy) || 1;
    segments.push({
      index: i,
      x1, y1, ex, ey, len2,
      tx: ex / len,
      ty: ey / len,
      straightness: Math.abs((ex / len) * (vx / vl) + (ey / len) * (vy / vl)),
      localTurn: _localTurnMax(centerLine, i, 4),
    });
  }
  cache = { segments };
  _trackCollisionCaches.set(centerLine, cache);
  return cache;
}

function _isPointOnRoad(x, y, track) {
  const outer = track?.outerBoundary;
  const inner = track?.innerBoundary;
  if (!outer?.length || !inner?.length) return true;
  return _pointInPoly(x, y, outer) && !_pointInPoly(x, y, inner);
}

function _pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function _isWallRideCorner(car, hit, maxDist) {
  if (!hit || hit.localTurn < WALL_RIDE_TURN_MIN || hit.dist < maxDist - 5) return false;
  const speed = Math.hypot(car.vx || 0, car.vy || 0);
  if (speed < WALL_RIDE_MIN_SPEED) return false;
  const tangentAlign = Math.abs(((car.vx || 0) * hit.tx + (car.vy || 0) * hit.ty) / speed);
  return tangentAlign > 0.42;
}

function _wallRideSide(car, hit) {
  const sideX = -Math.sin(car.angle || 0);
  const sideY = Math.cos(car.angle || 0);
  return Math.sign((hit.dx || 0) * sideX + (hit.dy || 0) * sideY) || 0;
}

function _turnAmount(points, i) {
  const N = points.length;
  if (N < 4) return 0;
  const [px, py] = points[(i - 1 + N) % N];
  const [cx, cy] = points[i];
  const [nx, ny] = points[(i + 1) % N];
  const ax = cx - px;
  const ay = cy - py;
  const bx = nx - cx;
  const by = ny - cy;
  const al = Math.hypot(ax, ay) || 1;
  const bl = Math.hypot(bx, by) || 1;
  const dot = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl)));
  return Math.acos(dot);
}

function _localTurnMax(points, i, radius) {
  let maxTurn = 0;
  for (let off = -radius; off <= radius; off++) {
    maxTurn = Math.max(maxTurn, _turnAmount(points, (i + off + points.length) % points.length));
  }
  return maxTurn;
}
