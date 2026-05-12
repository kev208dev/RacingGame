export const keys = {};
const justPressed = {};
const justReleased = {};
let lastShiftTapAt = 0;
let lastSpaceTapAt = 0;
const SHIFT_DOUBLE_TAP_MS = 360;
const SPACE_DOUBLE_TAP_MS = 320;

window.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    justPressed[e.code] = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      const now = performance.now();
      if (now - lastShiftTapAt <= SHIFT_DOUBLE_TAP_MS) {
        justPressed.ShiftDouble = true;
        lastShiftTapAt = 0;
      } else {
        lastShiftTapAt = now;
      }
    }
    if (e.code === 'Space') {
      const now = performance.now();
      if (now - lastSpaceTapAt <= SPACE_DOUBLE_TAP_MS) {
        justPressed.SpaceDouble = true;
        lastSpaceTapAt = 0;
      } else {
        lastSpaceTapAt = now;
      }
    }
  }
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
  justReleased[e.code] = true;
});

export function wasJustPressed(code) {
  return !!justPressed[code];
}

export function clearFrameKeys() {
  for (const k in justPressed)  delete justPressed[k];
  for (const k in justReleased) delete justReleased[k];
}

export function getInput() {
  const throttle = (keys['KeyW'] || keys['ArrowUp'])    ? 1 : 0;
  const brake    = (keys['KeyS'] || keys['ArrowDown'])  ? 1 : 0;
  const steer    = ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0)
                 - ((keys['KeyA'] || keys['ArrowLeft'])  ? 1 : 0);
  return {
    throttle,
    brake,
    steer,
    handbrake:    !!keys['Space'],
    handbrakeJust:   wasJustPressed('Space'),
    handbrakeDouble: wasJustPressed('SpaceDouble'),
    boost:        !!(keys['ShiftLeft'] || keys['ShiftRight']),
    boostJust:    wasJustPressed('ShiftLeft') || wasJustPressed('ShiftRight'),
    boostDouble:  wasJustPressed('ShiftDouble'),
    gearUp:       wasJustPressed('KeyQ'),
    gearDown:     wasJustPressed('KeyE'),
    autoToggle:   wasJustPressed('KeyT'),
    engineToggle: wasJustPressed('KeyJ'),
    parkingBrake: wasJustPressed('KeyP'),
    reset:        wasJustPressed('KeyR'),
    cameraToggle: wasJustPressed('KeyC'),
    escape:       wasJustPressed('Escape'),
  };
}
