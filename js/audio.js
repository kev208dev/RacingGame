// Minimal Web Audio: only event sounds (lap ding, wall thud).
// Continuous engine hum has been removed per user request.
let ctx = null;

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
}

// Engine functions kept as no-ops so existing imports still work.
export function startEngine() {}
export function stopEngine() {}
export function updateEngineSound() {}

export function resumeContext() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// Short celebratory chord on lap complete.
export function playLapDing(isNewBest = false) {
  try {
    init();
    const now = ctx.currentTime;
    const notes = isNewBest ? [880, 1108, 1318, 1760] : [659, 880, 988];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const start = now + i * 0.07;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.10, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, start + 0.55);
      o.start(start);
      o.stop(start + 0.6);
    });
  } catch (e) {}
}

// Brief impact thud on wall hits.
export function playWallThud(magnitude = 1) {
  try {
    init();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(140 * (0.7 + Math.random() * 0.4), now);
    o.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.05 * Math.min(2, magnitude), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    o.connect(g); g.connect(ctx.destination);
    o.start(now); o.stop(now + 0.32);
  } catch (e) {}
}
