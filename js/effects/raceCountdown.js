// Race-start countdown overlay — MagicRings bg + center "3 / 2 / 1 / START!".
// Two-slot crossfade — incoming digit fades in while outgoing fades out (no hard cut).
// API:
//   showRaceCountdown()                — mount overlay, start MagicRings.
//   updateRaceCountdown(secondsLeft)   — sync displayed digit to remaining time.
//   hideRaceCountdown()                — dispose MagicRings + remove DOM.
//   showFreeRoomIntro(durationMs)      — same effect with "FREE ROOM" label, auto-dismiss.

import { createMagicRings } from './magicRings.js';

let _root = null;
let _rings = null;
let _slotA = null;
let _slotB = null;
let _activeSlot = 'A';
let _lastLabel = null;
let _flashTimer = null;

function _ensureRoot() {
  if (_root) return _root;
  _root = document.createElement('div');
  _root.id = 'race-countdown-root';
  _root.innerHTML = `
    <div class="rc-rings" id="rc-rings"></div>
    <div class="rc-stack">
      <span class="rc-slot rc-slot-a"></span>
      <span class="rc-slot rc-slot-b"></span>
    </div>
  `;
  document.body.appendChild(_root);
  _slotA = _root.querySelector('.rc-slot-a');
  _slotB = _root.querySelector('.rc-slot-b');
  _activeSlot = 'A';

  const ringsEl = _root.querySelector('#rc-rings');
  // Pulse-driven 링: blur 0 (성능), pulse()/flash() 로 박자 동기화.
  _rings = createMagicRings(ringsEl, {
    color: '#ff2100',
    colorTwo: '#ffe900',
    speed: 2.6,
    ringCount: 6,
    attenuation: 9,
    lineThickness: 3.5,
    baseRadius: 0.07,
    radiusStep: 0.045,
    scaleRate: 0.08,
    opacity: 1,
    blur: 0,
    noiseAmount: 0,
    rotation: 180,
    ringGap: 1.7,
    fadeIn: 0.35,
    fadeOut: 0.5,
    followMouse: false,
    mouseInfluence: 0,
    hoverScale: 1,
    parallax: 0,
    clickBurst: false,
  });
  return _root;
}

function _showLabel(label, variant /* 'pop' | 'go' | 'free' */) {
  const incoming = _activeSlot === 'A' ? _slotB : _slotA;
  const outgoing = _activeSlot === 'A' ? _slotA : _slotB;
  _activeSlot = _activeSlot === 'A' ? 'B' : 'A';

  outgoing.classList.remove('rc-in-pop', 'rc-in-go', 'rc-in-free');
  outgoing.classList.add('rc-out');

  incoming.classList.remove('rc-out', 'rc-in-pop', 'rc-in-go', 'rc-in-free', 'rc-variant-go', 'rc-variant-free');
  incoming.textContent = label;
  if (variant === 'go')   incoming.classList.add('rc-variant-go');
  if (variant === 'free') incoming.classList.add('rc-variant-free');
  void incoming.offsetWidth;
  incoming.classList.add(
    variant === 'go'   ? 'rc-in-go'   :
    variant === 'free' ? 'rc-in-free' :
                         'rc-in-pop'
  );
}

export function showRaceCountdown() {
  _ensureRoot();
  _root.classList.remove('rc-hide');
  _lastLabel = null;
  if (_slotA) _slotA.textContent = '';
  if (_slotB) _slotB.textContent = '';
}

export function updateRaceCountdown(secondsLeft) {
  if (!_root) _ensureRoot();
  let label;
  if (secondsLeft > 3) label = 'READY';
  else if (secondsLeft > 0.35) label = String(Math.ceil(secondsLeft));
  else label = 'START!';

  if (label === _lastLabel) return;
  _lastLabel = label;

  _showLabel(label, label === 'START!' ? 'go' : 'pop');

  // 박자 동기화: 3/2/1 → pulse, START! → flash
  if (_rings) {
    if (label === '3' || label === '2' || label === '1') _rings.pulse(1);
    else if (label === 'START!') _rings.flash();
  }

  if (label === 'START!') {
    if (_flashTimer) clearTimeout(_flashTimer);
    _flashTimer = setTimeout(() => hideRaceCountdown(), 850);
  }
}

export function hideRaceCountdown() {
  if (_flashTimer) { clearTimeout(_flashTimer); _flashTimer = null; }
  if (!_root) return;
  _root.classList.add('rc-hide');
  setTimeout(() => {
    if (_rings) { _rings.dispose(); _rings = null; }
    if (_root) { _root.remove(); _root = null; }
    _slotA = _slotB = null;
    _activeSlot = 'A';
    _lastLabel = null;
  }, 500);
}

export function showFreeRoomIntro(durationMs = 1800) {
  _ensureRoot();
  _root.classList.remove('rc-hide');
  _lastLabel = 'FREE ROOM';
  _showLabel('FREE ROOM', 'free');
  if (_rings) _rings.flash();
  if (_flashTimer) clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => hideRaceCountdown(), durationMs);
}
