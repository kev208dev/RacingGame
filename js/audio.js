let ctx = null;
let master = null;
let lastThudAt = 0;

// ── drift squeal ─────────────────────────────────────────────
let _driftNoise = null;
let _driftFilter = null;
let _driftGain = null;

function _ensureDriftNode() {
  if (_driftGain) return;
  const bufSize = Math.floor(ctx.sampleRate * 3);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  _driftNoise = ctx.createBufferSource();
  _driftNoise.buffer = buf;
  _driftNoise.loop = true;
  _driftFilter = ctx.createBiquadFilter();
  _driftFilter.type = 'bandpass';
  _driftFilter.frequency.value = 1600;
  _driftFilter.Q.value = 1.4;
  _driftGain = ctx.createGain();
  _driftGain.gain.value = 0;
  _driftNoise.connect(_driftFilter);
  _driftFilter.connect(_driftGain);
  _driftGain.connect(master);
  _driftNoise.start();
}

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.72;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -18;
  limiter.knee.value = 20;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.006;
  limiter.release.value = 0.18;
  master.connect(limiter);
  limiter.connect(ctx.destination);
}

// Engine stubs kept so existing imports still work.
export function startEngine() {}
export function stopEngine() {}
export function updateEngineSound() {}

export function resumeContext() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// Continuous tire squeal while drifting.
export function updateDriftSound(isDrifting, sideSpeedAbs = 0) {
  try {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    _ensureDriftNode();
    const intensity = Math.min(1, sideSpeedAbs / 38);
    const target    = isDrifting ? (0.07 + intensity * 0.13) : 0;
    const freq      = isDrifting ? (1300 + intensity * 900) : 1600;
    _driftGain.gain.setTargetAtTime(target, ctx.currentTime, isDrifting ? 0.06 : 0.12);
    _driftFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.18);
  } catch {}
}

// Whoosh on boost / DRS activation.
export function playBoostActivate(isDRS = false) {
  try {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = isDRS ? 600 : 1100;
    if (isDRS) {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, now);
      o.frequency.exponentialRampToValueAtTime(160, now + 0.14);
      o.frequency.exponentialRampToValueAtTime(110, now + 0.44);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.13, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.50);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(now); o.stop(now + 0.55);
    } else {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, now);
      o.frequency.exponentialRampToValueAtTime(420, now + 0.10);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.28);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(now); o.stop(now + 0.36);
    }
  } catch {}
}

// Beep for each start light (1–3 = red, 4 = green GO).
export function playStartBeep(lightNum) {
  try {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    if (lightNum >= 4) {
      // GO! — three quick high beeps
      [0, 0.11, 0.22].forEach(d => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 1320;
        g.gain.setValueAtTime(0.0001, now + d);
        g.gain.linearRampToValueAtTime(0.09, now + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.08);
        o.connect(g); g.connect(master);
        o.start(now + d); o.stop(now + d + 0.10);
      });
    } else {
      // Red light — short click beep
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 780;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      o.connect(g); g.connect(master);
      o.start(now); o.stop(now + 0.09);
    }
  } catch {}
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
      o.connect(g); g.connect(master);
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
    if (now - lastThudAt < 0.08) return;
    lastThudAt = now;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const level = 0.032 * Math.min(1.6, Math.max(0.4, magnitude));
    o.type = 'sine';
    o.frequency.setValueAtTime(118 * (0.82 + Math.random() * 0.22), now);
    o.frequency.exponentialRampToValueAtTime(46, now + 0.22);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.22);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(level, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    o.connect(filter); filter.connect(g); g.connect(master);
    o.start(now); o.stop(now + 0.28);
  } catch (e) {}
}
