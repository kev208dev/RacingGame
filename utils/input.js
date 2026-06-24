import { getMobileInput } from '../js/mobileControls.js';

export const keys = {};
const justPressed = {};
const justReleased = {};
const bufferedPress = {};
const PRESS_BUFFER_MS = 220;

const PREVENT_DEFAULT_CODES = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Enter', 'NumpadEnter',
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'Slash', 'Tab',
  'KeyR', 'KeyZ', 'KeyX', 'KeyC',
]);

window.addEventListener('keydown', e => {
  if (_isEditableTarget(e.target)) return;
  if (!keys[e.code]) {
    justPressed[e.code] = true;
    bufferedPress[e.code] = performance.now() + PRESS_BUFFER_MS;
  }
  keys[e.code] = true;
  if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
}, { capture: true });

window.addEventListener('keyup', e => {
  if (_isEditableTarget(e.target)) return;
  keys[e.code] = false;
  justReleased[e.code] = true;
  if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
}, { capture: true });

window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  for (const k in justPressed) delete justPressed[k];
  for (const k in justReleased) delete justReleased[k];
  for (const k in bufferedPress) delete bufferedPress[k];
});

export function wasJustPressed(code) {
  if (justPressed[code]) {
    delete bufferedPress[code];
    return true;
  }
  const until = bufferedPress[code] || 0;
  if (until > performance.now()) {
    delete bufferedPress[code];
    return true;
  }
  return false;
}

export function clearFrameKeys() {
  for (const k in justPressed)  delete justPressed[k];
  for (const k in justReleased) delete justReleased[k];
  const now = performance.now();
  for (const k in bufferedPress) {
    if (bufferedPress[k] <= now) delete bufferedPress[k];
  }
}

// ── Steering input smoothing (framerate-independent exponential damp) ──
// Maintains a single low-pass state so physics sub-steps at any rate read a
// stable, ramp-up steer signal instead of bang-bang {-1, 0, +1}. Call once per
// physics sub-step with that step's dt; reset on race init / respawn.
let _smoothedSteer = 0;
const STEER_HALF_LIFE = 0.06; // seconds — 60ms ≈ snappy but smoothed
export function smoothSteer(rawSteer, dt, halfLife = STEER_HALF_LIFE) {
  const k = 1 - Math.exp(-Math.LN2 * Math.max(0, dt) / Math.max(1e-4, halfLife));
  _smoothedSteer += (rawSteer - _smoothedSteer) * k;
  return _smoothedSteer;
}
export function resetSmoothedInput() { _smoothedSteer = 0; }

export function getInput() {
  const mobile = getMobileInput();

  // ── 기본 주행 ──
  //   가속: ↑ / W
  //   브레이크/후진: ↓ / S
  //   좌/우: ← → / A D
  const throttle = (keys['KeyW'] || keys['ArrowUp']   || mobile.throttle) ? 1 : 0;
  const brake    = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
  const keyboardSteer = ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0)
                      - ((keys['KeyA'] || keys['ArrowLeft'])  ? 1 : 0);
  const steer = Math.max(-1, Math.min(1, keyboardSteer + mobile.steer));

  // ── 드리프트: Shift 누른 채로 코너링 ──
  const handbrake     = !!keys['ShiftLeft'] || !!keys['ShiftRight'] || mobile.drift;
  const handbrakeJust = wasJustPressed('ShiftLeft') || wasJustPressed('ShiftRight');

  // ── 부스터: Spacebar 전용 ──
  const boost     = !!keys['Space'];
  const boostJust = wasJustPressed('Space') || mobile.boostJust;

  return {
    throttle, brake, steer,
    handbrake, handbrakeJust,
    boost, boostJust,
    boostDouble:  false,
    // 톡톡이는 kart 모듈이 steer prev/cur 변화로 자동 감지 — 명시 키 없음
    driftBurst:   mobile.doubleDriftJust || false,
    // 아이템 변경: Z / X
    itemPrev:     wasJustPressed('KeyZ'),
    itemNext:     wasJustPressed('KeyX'),
    // 시스템
    reset:        wasJustPressed('KeyR'),  // 위치 리스폰 (벽 끼임 해제)
    rearView:     !!keys['Slash'],         // 누른 동안 후방
    records:      !!keys['Tab'],           // 누른 동안 기록
    chatOpen:     wasJustPressed('Enter') || wasJustPressed('NumpadEnter'),
    cameraToggle: wasJustPressed('KeyC'),
    escape:       wasJustPressed('Escape'),
    autoToggle:   wasJustPressed('KeyT'),
    // 호환 (수동 기어 — Q만 유지; X는 itemNext 충돌)
    gearUp:       wasJustPressed('KeyQ'),
    gearDown:     false,
  };
}

function _isEditableTarget(target) {
  const tag = target?.tagName;
  return target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
