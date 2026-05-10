export const keys = {};
const justPressed = {};
const justReleased = {};

window.addEventListener('keydown', e => {
  if (!keys[e.code]) justPressed[e.code] = true;
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
    boost:        !!(keys['ShiftLeft'] || keys['ShiftRight']),
    boostJust:    wasJustPressed('ShiftLeft') || wasJustPressed('ShiftRight'),
    gearUp:       wasJustPressed('KeyE'),
    gearDown:     wasJustPressed('KeyQ'),
    autoToggle:   wasJustPressed('KeyT'),
    engineToggle: wasJustPressed('KeyJ'),
    parkingBrake: wasJustPressed('KeyP'),
    reset:        wasJustPressed('KeyR'),
    cameraToggle: wasJustPressed('KeyC'),
    escape:       wasJustPressed('Escape'),
  };
}
