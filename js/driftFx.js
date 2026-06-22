// KartRider 드리프트 화면 연출 — 차체 squash + 게이지 tier 스파크.
// 물리/카메라/충돌 안 건드림. 차 모델 메시 scale + sparkPool 재사용만.
//
// 사용:
//   const driftFxState = makeDriftFxState();
//   // 매 프레임:
//   applyDriftBodyFx(driftFxState, carMesh, car, dt);
//   emitDriftSparks(driftFxState, car, sparkPool, dt);

import { spawnSparks, spawnDriftSmoke3D, DRIFT_SMOKE_TUNING } from './effects.js';
import { KART_CAMERA as KC } from '../kart-boost/config.js';

function _lerpColor(c0, c1, t) {
  const r0 = (c0 >> 16) & 0xff, g0 = (c0 >> 8) & 0xff, b0 = c0 & 0xff;
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return (r << 16) | (g << 8) | b;
}

// ─── 튜닝 한 곳 ────────────────────────────────────────────────
export const DRIFT_FX_CONFIG = {
  // 켜고끄기 (각 효과 개별)
  ENABLE_BODY_SQUASH: true,
  ENABLE_SPARKS:      false,  // KartRider식: 스파크 ❌ — 흰 연기로 교체
  ENABLE_SMOKE:       true,   // 카트라이더식 흰 연기
  ENABLE_SKID:        true,
  ENABLE_FLAME:       true,
  ENABLE_TRAIL:       false,
  ENABLE_BLOOM:       false,

  // ── 마찰 긁힘 dust ── 뒷타이어 접지점에서 슬립 속도 비례로 방출.
  SMOKE_REAR_OFFSET:    -7.6,   // 차 로컬 X (뒤)
  SMOKE_SIDE_OFFSET:    8.0,    // 차 로컬 Z (양옆)
  SMOKE_Y:              0.05,   // ground level
  SMOKE_RATE_PEAK:      120,    // /s 캡
  SMOKE_BETA_REF:       Math.PI * 0.35,
  SMOKE_PER_BURST:      1,
  SMOKE_BACK_SPEED:     4,      // 살짝 뒤
  SMOKE_OUT_SPEED:      2,      // 살짝 바깥
  // 슬립 → dust 변환 (마찰). 바닥 붙어 피어오름.
  SCRAPE_MIN:        14,
  SCRAPE_TO_RATE:    1.6,
  SCRAPE_TO_SPEED:   0.25,      // 0.35→0.25 — 흩어짐 줄임
  DUST_UP:           3,         // 7→3 — 공중 부유 ❌ 바닥 부근만
  DUST_LIFE:         0.85,      // 0.42→0.85 — 부드럽게 페이드

  // ── 차체 squash ──
  BOOST_STRETCH_Z:   0.18,   // 부스트 펄스 정점에서 +18% 길어짐 (앞뒤)
  BOOST_SQUASH_Y:    0.08,   // 동시에 -8% 눌림 (위아래)
  DRIFT_LEAN_BONUS:  0,      // 드리프트 추가 롤 ❌ — yaw만 변경
  BODY_FX_RESPONSE:  10.0,   // 페이드 응답 (높을수록 빠릿)

  // ── 스파크 (게이지 tier로 색 변화) ──
  SPARK_REAR_OFFSET:    -7.6,  // 차 로컬 X (뒤쪽)
  SPARK_SIDE_OFFSET:    7.2,   // 차 로컬 Z (양옆)
  SPARK_Y:              1.2,
  SPARK_PER_BURST:      3,
  SPARK_RATE_MIN:       18,    // /s — 드리프트 시작 시
  SPARK_RATE_MAX:       95,    // /s — 게이지 풀충전 시
  SPARK_MIN_GAUGE:      4,     // 이하 미발사
  // tier 임계값
  SPARK_TIER_T1:        40,    // 이하: tier 0
  SPARK_TIER_T2:        70,    // 이하: tier 1, 초과: tier 2
  // tier별 HSL 범위 (h, s, l ranges + jitter)
  SPARK_TIER_COLORS: [
    { h: 0.13, hJit: 0.04, s: 1.0, l: 0.70 },  // 0: 흰/노랑
    { h: 0.07, hJit: 0.03, s: 1.0, l: 0.58 },  // 1: 주황
    { h: 0.66, hJit: 0.10, s: 1.0, l: 0.62 },  // 2: 파랑/보라
  ],
};

// ─── 상태 객체 ─────────────────────────────────────────────────
export function makeDriftFxState() {
  return {
    sparkTimer:  0,
    smokeTimer:  0,
    bodyStretch: 0,
    bodyLean:    0,
    _origScale:  null,
  };
}

// ─── 차체 squash/stretch + 추가 롤 ─────────────────────────────
export function applyDriftBodyFx(state, carMesh, car, dt) {
  if (!DRIFT_FX_CONFIG.ENABLE_BODY_SQUASH) return;
  const body = carMesh?.body;
  if (!body) return;

  if (!state._origScale) {
    state._origScale = { x: body.scale.x, y: body.scale.y, z: body.scale.z };
  }

  // 부스트 펄스: boostFireFx가 1→0으로 감소하는 동안 squash 적용
  const fireFx = Math.min(1, car.boostFireFx || 0);
  const k = 1 - Math.exp(-DRIFT_FX_CONFIG.BODY_FX_RESPONSE * dt);
  state.bodyStretch += (fireFx - state.bodyStretch) * k;

  const stretchZ = 1 + state.bodyStretch * DRIFT_FX_CONFIG.BOOST_STRETCH_Z;
  const squashY  = 1 - state.bodyStretch * DRIFT_FX_CONFIG.BOOST_SQUASH_Y;
  body.scale.x = state._origScale.x;
  body.scale.y = state._origScale.y * squashY;
  body.scale.z = state._origScale.z * stretchZ;

  // 드리프트 중 추가 롤 (기존 car.js의 driftLean 위에 더해짐)
  const target = car.drifting
    ? -Math.sign(car.sideSpeed || car.steerAngle || 1) * DRIFT_FX_CONFIG.DRIFT_LEAN_BONUS
    : 0;
  state.bodyLean += (target - state.bodyLean) * k;
  body.rotation.x += state.bodyLean;
}

// ─── 게이지 tier 스파크 ────────────────────────────────────────
export function emitDriftSparks(state, car, sparkPool, dt) {
  if (!DRIFT_FX_CONFIG.ENABLE_SPARKS) return;
  if (!car.drifting || !sparkPool) {
    state.sparkTimer = Math.max(0, state.sparkTimer - dt);
    return;
  }
  const gauge = Math.max(0, Math.min(100, car.boostMeter || 0));
  if (gauge < DRIFT_FX_CONFIG.SPARK_MIN_GAUGE) return;

  // gauge 비례 spawn rate
  const t = gauge / 100;
  const rate = DRIFT_FX_CONFIG.SPARK_RATE_MIN
    + (DRIFT_FX_CONFIG.SPARK_RATE_MAX - DRIFT_FX_CONFIG.SPARK_RATE_MIN) * t;

  // tier 결정
  const tier = gauge < DRIFT_FX_CONFIG.SPARK_TIER_T1 ? 0
             : gauge < DRIFT_FX_CONFIG.SPARK_TIER_T2 ? 1 : 2;
  const tierColor = DRIFT_FX_CONFIG.SPARK_TIER_COLORS[tier];

  state.sparkTimer -= dt;
  while (state.sparkTimer <= 0) {
    state.sparkTimer += 1 / rate;
    _emitOneBurst(car, sparkPool, tierColor);
  }
}

function _emitOneBurst(car, sparkPool, tierColor) {
  const a  = car.angle || 0;
  const cs = Math.cos(a), sn = Math.sin(a);
  const rx = DRIFT_FX_CONFIG.SPARK_REAR_OFFSET;
  const ry = DRIFT_FX_CONFIG.SPARK_SIDE_OFFSET;

  for (const sideSign of [-1, 1]) {
    // 차 로컬 (rx, 0, sideSign*ry) → 월드 2D
    const wx = car.x + rx * cs - sideSign * ry * sn;
    const wy = car.y + rx * sn + sideSign * ry * cs;
    // 3D 좌표: (wx, SPARK_Y, -wy)
    spawnSparks(sparkPool, wx, DRIFT_FX_CONFIG.SPARK_Y, -wy, DRIFT_FX_CONFIG.SPARK_PER_BURST);
    // 색상 재칠 (spawnSparks가 HSL 랜덤하므로 직접 덮어씀)
    _recolorLatest(sparkPool, DRIFT_FX_CONFIG.SPARK_PER_BURST, tierColor);
  }
}

// ─── 타이어 긁힘 dust ─────────────────────────────────────
// 슬립 속도(scrapeSpeed) 비례로 방출. 슬립 0 → dust 0. 직진/접지 시 안 남.
// 방향 = 슬립 반대 (고무가 흙을 미는 방향).
export function emitDriftSmoke(state, car, smokePool, dt, maxCruise = 240) {
  if (!DRIFT_FX_CONFIG.ENABLE_SMOKE) return;
  if (!smokePool) return;
  if (car.iceSurface) { state.smokeTimer = 0; return; }
  // scrapeSpeed = 횡슬립 크기 (vL = sideSpeed). 단순화: 양 뒷바퀴 공통.
  const scrape = Math.abs(car.sideSpeed || 0);
  const minScr = DRIFT_FX_CONFIG.SCRAPE_MIN;
  if (scrape < minScr) { state.smokeTimer = 0; return; }
  // rate ∝ (scrape - MIN), cap at PEAK
  const rate = Math.min(
    DRIFT_FX_CONFIG.SMOKE_RATE_PEAK,
    DRIFT_FX_CONFIG.SCRAPE_TO_RATE * (scrape - minScr)
  );
  state.smokeTimer -= dt;
  while (state.smokeTimer <= 0) {
    state.smokeTimer += (1 / Math.max(5, rate)) * (0.7 + Math.random() * 0.6);
    for (const sideSign of [-1, 1]) {
      _emitDustBurst(car, smokePool, scrape, sideSign);
    }
  }
}

// 한 뒷바퀴 접지점 dust burst — 슬립 반대 방향으로 튕김.
function _emitDustBurst(car, smokePool, scrape, sideSign) {
  const a  = car.angle || 0;
  const cs = Math.cos(a), sn = Math.sin(a);
  const rx = DRIFT_FX_CONFIG.SMOKE_REAR_OFFSET;
  const ry = DRIFT_FX_CONFIG.SMOKE_SIDE_OFFSET;
  // 뒷바퀴 접지점 (월드 → 3D)
  const wx = car.x + rx * cs - sideSign * ry * sn;
  const wy = car.y + rx * sn + sideSign * ry * cs;
  const w3y = DRIFT_FX_CONFIG.SMOKE_Y;
  const w3z = -wy;

  // 슬립 방향 derivation (driftPhysics 좌표계: rgt = (-sn, cs))
  // vL > 0 → 차가 rgt 방향으로 미끄러짐. 흙은 -rgt 방향으로 튕김.
  // world 2D dust dir = -sign(vL) × (-sn, cs) = sign(vL) × (sn, -cs)
  // 3D (x,_,-y): sign(vL) × (sn, 0, cs)
  const vL = car.sideSpeed || 0;
  const slipSign = Math.sign(vL) || 1;
  const dirX = slipSign * sn;
  const dirZ = slipSign * cs;

  // 주동력 = scrape (긁힘 세기). 랜덤은 ±소량 변주만.
  const baseSpeed = DRIFT_FX_CONFIG.SCRAPE_TO_SPEED * scrape;
  const back = DRIFT_FX_CONFIG.SMOKE_BACK_SPEED;
  const out  = DRIFT_FX_CONFIG.SMOKE_OUT_SPEED;

  const vx = dirX * baseSpeed
           + (-cs) * back
           + (-sn) * out * sideSign
           + (Math.random() - 0.5) * 1.2;
  const vz = dirZ * baseSpeed
           +   sn  * back
           + (-cs) * out * sideSign
           + (Math.random() - 0.5) * 1.2;
  const vy = DRIFT_FX_CONFIG.DUST_UP
           + 0.08 * baseSpeed
           + (Math.random() - 0.2) * 1.5;

  // 크기/opacity = scrape 비례 (강할수록 폭발적)
  const sNorm = Math.min(1, scrape / 60);
  const sizeMul = 0.55 + sNorm * 1.20;          // 0.55~1.75
  const opMul   = 0.55 + sNorm * 0.55;          // 0.55~1.10
  spawnDriftSmoke3D(smokePool, wx, w3y, w3z, vx, vy, vz, {
    wStart: DRIFT_SMOKE_TUNING.SHEET_W_START * sizeMul,
    wEnd:   DRIFT_SMOKE_TUNING.SHEET_W_END   * sizeMul,
    hStart: DRIFT_SMOKE_TUNING.SHEET_H_START * sizeMul,
    hEnd:   DRIFT_SMOKE_TUNING.SHEET_H_END   * sizeMul,
    opacity: DRIFT_SMOKE_TUNING.SMOKE_OPACITY * opMul,
    life: DRIFT_FX_CONFIG.DUST_LIFE,
    lifeJit: 0.10,
    posRand: 0.6,    // 접지점 ±0.6 — 자연 변주
    scaleRand: 0.20, // 각 입자 ±20%
  });
}

// 방금 spawn된 스파크의 색만 tier로 덮어씀.
function _recolorLatest(sparkPool, count, tierColor) {
  let touched = 0;
  // spawnSparks는 풀의 앞쪽부터 비어있는 슬롯 채움. 최근 spawn된 건
  // life가 거의 최대값에 가까운 슬롯들 → 그 중 count개 색 갱신.
  let maxLife = 0;
  for (const p of sparkPool) if (p.life > maxLife) maxLife = p.life;
  if (maxLife <= 0) return;
  for (const p of sparkPool) {
    if (touched >= count) break;
    if (p.life < maxLife - 0.02) continue;
    const jit = (Math.random() - 0.5) * 2 * (tierColor.hJit || 0);
    p.mesh.material.color.setHSL(tierColor.h + jit, tierColor.s, tierColor.l);
    touched++;
  }
}
