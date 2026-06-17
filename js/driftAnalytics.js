import { KART_TUNING as K } from '../kart-boost/config.js';

// ── 6단계 드리프트 상태 ────────────────────────────────────────
export const PHASE = {
  STRAIGHT:    'STRAIGHT',
  ENTRY:       'ENTRY',
  LOAD_SHIFT:  'LOAD_SHIFT',
  DRIFT_START: 'DRIFT_START',
  DRIFT_HOLD:  'DRIFT_HOLD',
  EXIT:        'EXIT',
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

  // ── 6단계 분류.
  const absSteer = Math.abs(car.steerAngle || 0);
  const absAy    = Math.abs(d.aY);
  let phase;
  if (car._recoverActive) {
    phase = PHASE.EXIT;
  } else if (car.drifting) {
    phase = (car.driftStateTime || 0) < (K.PHASE_DRIFT_START_WIN || 0.22)
          ? PHASE.DRIFT_START
          : PHASE.DRIFT_HOLD;
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
