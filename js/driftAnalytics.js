import { KART_TUNING as K } from '../kart-boost/config.js';

// ── 드리프트 phase 라벨 ────────────────────────────────────────
// 카트라이더식 3-phase (BURST → SUSTAIN → ALIGN) + 비드리프트 표시용 보조 라벨.
export const PHASE = {
  STRAIGHT:    'STRAIGHT',
  ENTRY:       'ENTRY',
  LOAD_SHIFT:  'LOAD_SHIFT',
  BURST:       'BURST',     // 진입 직후 yaw 킥 + slip build (~BURST_TIME)
  SUSTAIN:     'SUSTAIN',   // 드리프트 키 hold + 게이지 충전 中
  ALIGN:       'ALIGN',     // release 후 slip 정렬 + 부스터 발사
};

// 매 프레임 호출. 거동 변경 ❌(관측만) — 단, K.FRICTION_TRIGGER true 면 마찰원 초과 시 drift 진입 가능.
export function updateAnalytics(car, dt, input) {
  if (!car._dyn) {
    car._dyn = {
      phase: PHASE.STRAIGHT,
      phaseTime: 0,
      beta: 0, yawRate: 0, aX: 0, aY: 0,
      Nfront: 0, Nrear: 0, NlatInner: 0, NlatOuter: 0,
      Fmax_rear: 0, FreqRear: 0, frictionCircleOver: false,
      vPrev: car.speed || 0,
      yawPrev: car.angle || 0,
    };
  }
  const d = car._dyn;
  if (dt <= 0) return;

  // ── sideslip β (signed): velocity와 차체방향의 각.
  const fwdX = Math.cos(car.angle), fwdY = Math.sin(car.angle);
  const vF = car.vx * fwdX + car.vy * fwdY;
  const vL = -car.vx * fwdY + car.vy * fwdX;
  d.beta = Math.atan2(vL, Math.max(1e-3, Math.abs(vF))) * (vF >= 0 ? 1 : -1);

  // ── yaw rate r = dθ/dt (wrap 보정).
  let dTh = car.angle - d.yawPrev;
  while (dTh >  Math.PI) dTh -= Math.PI * 2;
  while (dTh < -Math.PI) dTh += Math.PI * 2;
  d.yawRate = dTh / dt;
  d.yawPrev = car.angle;

  // ── 종/횡 가속.
  const v = car.speed || 0;
  d.aX = (v - d.vPrev) / dt;
  d.vPrev = v;
  d.aY = v * d.yawRate;   // 곡선 추적 中 ≈ centripetal accel.

  // ── 하중이동 (정적 50/50 + Δ).
  const m = K.MASS || 1000;
  const h = K.CG_HEIGHT || 0.40;
  const L = K.WHEELBASE || 2.6;
  const T = K.TRACK || 1.5;
  const g = 9.81;
  const Nstatic = m * g * 0.5;
  const dWlong = m * d.aX * h / Math.max(0.1, L);
  const dWlat  = m * d.aY * h / Math.max(0.1, T);
  d.Nfront = Math.max(0, Nstatic - dWlong);
  d.Nrear  = Math.max(0, Nstatic + dWlong);
  d.NlatInner = -dWlat;
  d.NlatOuter =  dWlat;

  // ── 마찰원 = 후륜 한계.
  const mu = K.MU || 1.0;
  d.Fmax_rear = mu * d.Nrear;
  const rearBias = K.REAR_GRIP_BIAS ?? 0.55;
  d.FreqRear = Math.abs(m * d.aY) * rearBias;
  d.frictionCircleOver = d.FreqRear > d.Fmax_rear * (K.FRICTION_OVER_MARGIN || 1.0);

  // ── phase 분류 (BURST/SUSTAIN/ALIGN + 보조 라벨) ──
  const absSteer = Math.abs(car.steerAngle || 0);
  const absAy    = Math.abs(d.aY);
  let phase;
  if (car.drifting) {
    // BURST = 진입 직후 ~BURST_TIME — yaw kick + slip build. 이후 SUSTAIN.
    phase = (car.driftStateTime || 0) < (K.BURST_TIME || 0.18)
          ? PHASE.BURST
          : PHASE.SUSTAIN;
  } else if (car._recoverActive) {
    // 드리프트 종료 직후 → ALIGN (slip 정렬 + release boost 발사 직후).
    phase = PHASE.ALIGN;
  } else if (absSteer < (K.PHASE_ENTRY_STEER || 0.06) && absAy < (K.PHASE_TURN_AY || 40)) {
    phase = PHASE.STRAIGHT;
  } else if (absAy > (K.PHASE_TURN_AY || 40)) {
    phase = PHASE.LOAD_SHIFT;
  } else {
    phase = PHASE.ENTRY;
  }
  if (phase !== d.phase) {
    d.phase = phase;
    d.phaseTime = 0;
  } else {
    d.phaseTime += dt;
  }
  car.phase = phase;
  car.phaseTime = d.phaseTime;
  // 외부 접근용 alias.
  car.beta    = d.beta;
  car.yawRate = d.yawRate;
  car.aLat    = d.aY;
  car.aLong   = d.aX;
  car.axleLoads = { front: d.Nfront, rear: d.Nrear, inner: d.NlatInner, outer: d.NlatOuter };
  car.frictionCircleOver = d.frictionCircleOver;
}
