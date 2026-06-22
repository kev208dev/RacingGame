// 실시간 튜닝 패널 — 주행 중 드리프트 상수 즉시 조절. 로직 ❌, 값만.
// 토글: F4. 조작: ↑↓ 선택, ←→ (또는 -/=) 증감. 변경 시 콘솔에 'NAME = value' 출력.

import { KART_TUNING as K } from '../kart-boost/config.js';

let _panelOn = false;
let _selected = 0;

const ITEMS = [
  { name: 'DRIFT_SLIP_GAIN',
    get: () => K.DRIFT_SLIP_GAIN,
    set: v => { K.DRIFT_SLIP_GAIN = v; },
    step: 0.1, min: 0.5, max: 3.0, fmt: 3 },
  { name: 'DRIFT_ARC_GRIP',
    get: () => K.DRIFT_ARC_GRIP,
    set: v => { K.DRIFT_ARC_GRIP = v; },
    step: 0.05, min: 0.0, max: 1.0, fmt: 3 },
  { name: 'COUNTER_STEER_RECOVERY_RATE',
    get: () => K.COUNTER_STEER_RECOVERY_RATE,
    set: v => { K.COUNTER_STEER_RECOVERY_RATE = v; },
    step: 1.0, min: 1, max: 30, fmt: 2 },
  // STEER_SMOOTH 바뀌면 실제 작동값 STEER_ENGAGE 도 1/SMOOTH 로 자동 갱신.
  { name: 'STEER_SMOOTH',
    get: () => K.STEER_SMOOTH,
    set: v => { K.STEER_SMOOTH = v; K.STEER_ENGAGE = 1 / Math.max(0.02, v); },
    step: 0.02, min: 0.05, max: 0.5, fmt: 3 },
  // DRIFT_ENTRY_KICK alias = DRIFT_ENTRY_YAW (실제 적용 값)
  { name: 'DRIFT_ENTRY_KICK',
    get: () => K.DRIFT_ENTRY_YAW,
    set: v => { K.DRIFT_ENTRY_YAW = v; K.DRIFT_ENTRY_KICK = v; },
    step: 0.05, min: 0.0, max: 1.0, fmt: 3 },
  // MAX_SLIP_ANGLE 는 라디안. UI는 도(°) 단위.
  { name: 'MAX_SLIP_ANGLE_DEG',
    get: () => K.MAX_SLIP_ANGLE * 180 / Math.PI,
    set: v => { K.MAX_SLIP_ANGLE = v * Math.PI / 180; },
    step: 5, min: 15, max: 90, fmt: 1 },
  { name: 'DRIFT_ENTRY_DECEL_KBASE',
    get: () => K.DRIFT_KBASE,
    set: v => { K.DRIFT_KBASE = v; },
    step: 1, min: 0, max: 30, fmt: 1 },
  // MAX_SPEED = maxSpeed × CRUISE_MUL × V_BOOST_MUL. 여기서는 CRUISE_MUL 조절.
  { name: 'MAX_SPEED_MUL_CRUISE',
    get: () => K.CRUISE_MUL,
    set: v => { K.CRUISE_MUL = v; },
    step: 0.05, min: 0.3, max: 2.0, fmt: 3 },
];

function _adjust(dir) {
  const it = ITEMS[_selected];
  const cur = it.get();
  let v = cur + dir * it.step;
  v = Math.max(it.min, Math.min(it.max, v));
  v = Math.round(v * 10000) / 10000;
  it.set(v);
  console.log(`${it.name} = ${v}`);
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.code === 'F4') {
      _panelOn = !_panelOn;
      e.preventDefault();
      return;
    }
    if (!_panelOn) return;
    if (e.code === 'ArrowUp' || e.code === 'BracketLeft') {
      _selected = (_selected - 1 + ITEMS.length) % ITEMS.length;
      e.preventDefault();
    } else if (e.code === 'ArrowDown' || e.code === 'BracketRight') {
      _selected = (_selected + 1) % ITEMS.length;
      e.preventDefault();
    } else if (e.code === 'ArrowLeft' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
      _adjust(-1);
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'Equal' || e.code === 'NumpadAdd') {
      _adjust(1);
      e.preventDefault();
    }
  }, true);
}

export function isTunePanelOn() { return _panelOn; }

export function drawTunePanel(ctx, w) {
  if (!_panelOn) return;
  const pw = 360;
  const pad = 12;
  const rowH = 22;
  const headerH = 40;
  const ph = headerH + ITEMS.length * rowH + 10;
  const x = w - pw - 16;
  const y = 100;
  ctx.save();
  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(x, y, pw, ph);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
  // 헤더
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'left';
  ctx.fillText('TUNE PANEL  (F4 close)', x + pad, y + 18);
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('↑↓ select   ←→ or -/= adjust', x + pad, y + 32);
  // 항목
  ctx.font = '12px monospace';
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    const val = it.get();
    const sel = (i === _selected);
    const ry = y + headerH + i * rowH;
    if (sel) {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
      ctx.fillRect(x + 4, ry - 14, pw - 8, rowH - 2);
    }
    ctx.fillStyle = sel ? '#ffffff' : 'rgba(255,255,255,0.78)';
    const prefix = sel ? '▶ ' : '  ';
    const label = it.name.padEnd(28).slice(0, 28);
    const valStr = val.toFixed(it.fmt || 3);
    ctx.fillText(`${prefix}${label} = ${valStr}`, x + pad, ry);
  }
  ctx.restore();
}
