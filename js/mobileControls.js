export const MOBILE_DOUBLE_DRIFT_COOLDOWN_MS = 1500;
export const MOBILE_BOOST_COOLDOWN_MS = 3000;

const state = {
  initialized: false,
  visible: false,
  activePointerId: null,
  steer: 0,
  drift: false,
  doubleDriftJust: false,
  boostJust: false,
  lastDoubleAt: -Infinity,
  lastBoostAt: -Infinity,
};

let root = null;
let joystick = null;
let knob = null;
let driftBtn = null;
let doubleBtn = null;
let boostBtn = null;

export function initMobileControls() {
  if (state.initialized || typeof document === 'undefined') return;
  root = document.getElementById('mobile-controls');
  joystick = document.getElementById('mobile-joystick');
  knob = document.getElementById('mobile-joystick-knob');
  driftBtn = document.getElementById('mobile-drift');
  doubleBtn = document.getElementById('mobile-double-drift');
  boostBtn = document.getElementById('mobile-boost');
  if (!root || !joystick || !knob) return;

  joystick.addEventListener('pointerdown', onJoystickDown);
  joystick.addEventListener('pointermove', onJoystickMove);
  joystick.addEventListener('pointerup', resetJoystick);
  joystick.addEventListener('pointercancel', resetJoystick);

  bindHoldButton(driftBtn, value => {
    state.drift = value;
    driftBtn?.classList.toggle('active', value);
  });
  doubleBtn?.addEventListener('pointerdown', event => {
    event.preventDefault();
    triggerDoubleDrift();
  });
  boostBtn?.addEventListener('pointerdown', event => {
    event.preventDefault();
    triggerBoost();
  });

  state.initialized = true;
}

export function setMobileControlsVisible(visible) {
  initMobileControls();
  state.visible = !!visible && isTouchLikeDevice();
  root?.classList.toggle('visible', state.visible);
  root?.classList.toggle('hidden', !state.visible);
  root?.setAttribute('aria-hidden', state.visible ? 'false' : 'true');
  if (!state.visible) {
    state.drift = false;
    state.steer = 0;
    resetKnob();
  }
}

export function getMobileInput() {
  initMobileControls();
  tickCooldownButtons();
  const input = {
    active: state.visible,
    steer: state.steer,
    throttle: state.visible ? 1 : 0,
    drift: state.visible && state.drift,
    doubleDriftJust: state.visible && state.doubleDriftJust,
    boostJust: state.visible && state.boostJust,
  };
  state.doubleDriftJust = false;
  state.boostJust = false;
  return input;
}

function isTouchLikeDevice() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

function onJoystickDown(event) {
  event.preventDefault();
  state.activePointerId = event.pointerId;
  joystick.setPointerCapture?.(event.pointerId);
  updateJoystick(event);
}

function onJoystickMove(event) {
  if (state.activePointerId !== event.pointerId) return;
  event.preventDefault();
  updateJoystick(event);
}

function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const radius = rect.width * 0.36;
  const dx = clamp(event.clientX - cx, -radius, radius);
  const dy = clamp(event.clientY - cy, -radius, radius);
  state.steer = clamp(dx / radius, -1, 1);
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function resetJoystick(event) {
  if (event && state.activePointerId !== event.pointerId) return;
  state.activePointerId = null;
  state.steer = 0;
  resetKnob();
}

function resetKnob() {
  if (knob) knob.style.transform = 'translate(-50%, -50%)';
}

function bindHoldButton(button, setter) {
  if (!button) return;
  const down = event => {
    event.preventDefault();
    setter(true);
  };
  const up = event => {
    event.preventDefault();
    setter(false);
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
}

function triggerDoubleDrift() {
  const now = performance.now();
  if (!state.drift || now - state.lastDoubleAt < MOBILE_DOUBLE_DRIFT_COOLDOWN_MS) return;
  state.doubleDriftJust = true;
  state.lastDoubleAt = now;
  pulse(doubleBtn);
}

function triggerBoost() {
  const now = performance.now();
  if (now - state.lastBoostAt < MOBILE_BOOST_COOLDOWN_MS) return;
  state.boostJust = true;
  state.lastBoostAt = now;
  pulse(boostBtn);
}

function tickCooldownButtons() {
  const now = performance.now();
  doubleBtn?.classList.toggle('cooldown', now - state.lastDoubleAt < MOBILE_DOUBLE_DRIFT_COOLDOWN_MS);
  boostBtn?.classList.toggle('cooldown', now - state.lastBoostAt < MOBILE_BOOST_COOLDOWN_MS);
}

function pulse(button) {
  if (!button) return;
  button.classList.add('active');
  setTimeout(() => button.classList.remove('active'), 180);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
