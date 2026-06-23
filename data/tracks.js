// Official f1-circuits.com based traces.
// Coordinates are hand-traced from each linked circuit hero map in its original
// image orientation. No mirroring or reshaping is applied.

import { CIRCUITS_V2_TRACKS } from './circuits_v2.js';

function buildSourceCenterline(trace, sourceSize, scale = 3.1, targetStep = 34) {
  const points = trace.slice();
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) points.pop();

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const controls = points.map(([x, y]) => ({
    x: (x - cx) * scale,
    y: (y - cy) * scale,
  }));

  const rounded = roundControls(controls);
  const out = [];
  for (let i = 0; i < rounded.length; i++) {
    const a = rounded[i];
    const b = rounded[(i + 1) % rounded.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(2, Math.ceil(len / targetStep));
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }
  }

  return out;
}

function roundControls(controls) {
  if (controls.length < 4) return controls;
  let pts = controls;
  for (let pass = 0; pass < 2; pass++) {
    const nextPts = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      nextPts.push({
        x: a.x * 0.78 + b.x * 0.22,
        y: a.y * 0.78 + b.y * 0.22,
      });
      nextPts.push({
        x: a.x * 0.22 + b.x * 0.78,
        y: a.y * 0.22 + b.y * 0.78,
      });
    }
    pts = nextPts;
  }
  return pts;
}

function offsetWalls(center, width) {
  const N = center.length;
  const outer = [];
  const inner = [];
  for (let i = 0; i < N; i++) {
    const c = center[i];
    const cNext = center[(i + 1) % N];
    const cPrev = center[(i - 1 + N) % N];
    const tx = cNext.x - cPrev.x;
    const ty = cNext.y - cPrev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = ty / tl;
    const ny = -tx / tl;
    outer.push([c.x + nx * width / 2, c.y + ny * width / 2]);
    inner.push([c.x - nx * width / 2, c.y - ny * width / 2]);
  }
  return Math.abs(polyArea(outer)) >= Math.abs(polyArea(inner))
    ? { outer, inner }
    : { outer: inner, inner: outer };
}

function polyArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function _computeBoostPads(center, count = 3) {
  const N = center.length;
  if (N < 10) return [];
  const r = Math.min(6, Math.floor(N / 12));
  const turns = Array.from({ length: N }, (_, i) => {
    let t = 0;
    for (let off = -r; off <= r; off++) {
      const a = center[(i + off - 1 + N) % N];
      const b = center[(i + off + N) % N];
      const c = center[(i + off + 1 + N) % N];
      const ax = b.x - a.x, ay = b.y - a.y;
      const bx = c.x - b.x, by = c.y - b.y;
      const al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
      t += 1 - Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl)));
    }
    return t;
  });
  const minSep = Math.floor(N / (count + 1));
  const pads = [], used = new Uint8Array(N);
  for (let k = 0; k < count; k++) {
    let best = -1, bestT = Infinity;
    for (let i = 0; i < N; i++) {
      if (!used[i] && turns[i] < bestT) { bestT = turns[i]; best = i; }
    }
    if (best < 0) break;
    for (let j = -minSep; j <= minSep; j++) used[(best + j + N) % N] = 1;
    const c = center[best], cN = center[(best + 1) % N];
    pads.push({ x: c.x, y: c.y, angle: Math.atan2(cN.y - c.y, cN.x - c.x), radius: 48, segmentIndex: best });
  }
  return pads;
}

function makeOfficialCircuit({
  id,
  name,
  length,
  difficulty,
  desc,
  character,
  sourceSize,
  trace,
  width,
  scale = 3.1,
  startBackOffset = 130,
  theme = {},
  info = {},
}) {
  const center = buildSourceCenterline(trace, sourceSize, scale);
  const raceWidth = Math.round(width * 1.30);
  const { outer, inner } = offsetWalls(center, raceWidth);

  const N = center.length;
  const sc = center[0];
  const scNext = center[1];
  const sAngle = Math.atan2(scNext.y - sc.y, scNext.x - sc.x);
  const halfW = raceWidth * 0.58;
  const perpDx = -Math.sin(sAngle);
  const perpDy = Math.cos(sAngle);
  const approxStep = avgStep(center);
  const backSeg = Math.max(3, Math.round(startBackOffset / approxStep));
  const spawnIdx = (N - backSeg) % N;
  const spawn = center[spawnIdx];
  const spawnN = center[(spawnIdx + 1) % N];
  const spawnAngle = Math.atan2(spawnN.y - spawn.y, spawnN.x - spawn.x);

  const startPos = { x: spawn.x, y: spawn.y, angle: spawnAngle };
  const startLine = {
    x1: sc.x + perpDx * halfW, y1: sc.y + perpDy * halfW,
    x2: sc.x - perpDx * halfW, y2: sc.y - perpDy * halfW,
    tx: Math.cos(sAngle), ty: Math.sin(sAngle),
  };

  const sectors = [];
  for (let s = 1; s <= 2; s++) {
    const idx = Math.floor((s * N / 3) % N);
    const c = center[idx];
    const cN = center[(idx + 1) % N];
    const a = Math.atan2(cN.y - c.y, cN.x - c.x);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    sectors.push({
      id: s,
      checkLine: {
        x1: c.x + px * halfW, y1: c.y + py * halfW,
        x2: c.x - px * halfW, y2: c.y - py * halfW,
        tx: Math.cos(a), ty: Math.sin(a),
      },
      color: s === 1 ? (theme.sector1 || '#2ec4b6') : (theme.sector2 || '#c77dff'),
    });
  }

  return {
    id,
    name,
    length,
    difficulty,
    desc,
    character,
    width: raceWidth,
    targetTime: info.targetTime || estimateTargetTimeMs(length, difficulty),
    silverTime: info.silverTime || Math.round((info.targetTime || estimateTargetTimeMs(length, difficulty)) * 0.92),
    goldTime: info.goldTime || Math.round((info.targetTime || estimateTargetTimeMs(length, difficulty)) * 0.84),
    outerBoundary: outer,
    innerBoundary: inner,
    centerLine: center.map(c => [c.x, c.y]),
    boostPads: _computeBoostPads(center, 3),
    startLine,
    sectors,
    startPos,
    backgroundColor: theme.background || '#4f554d',
    trackColor: theme.track || '#303235',
    accentColor: theme.accent || '#ffd166',
    mapColor: theme.map || '#e7edf3',
    sourceSize,
    ...info,
  };
}

function estimateTargetTimeMs(length, difficulty = '') {
  const km = Number.parseFloat(String(length).replace(/[^\d.]/g, '')) || 4.5;
  const difficultyText = String(difficulty).toLowerCase();
  const difficultyMult = difficultyText.includes('hard') || difficultyText.includes('어려')
    ? 1.18
    : difficultyText.includes('very') || difficultyText.includes('expert') || difficultyText.includes('매우')
      ? 1.32
      : 1;
  return Math.round(km * 13500 * difficultyMult);
}

function avgStep(center) {
  let total = 0;
  for (let i = 0; i < center.length; i++) {
    const a = center[i];
    const b = center[(i + 1) % center.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total / center.length;
}

// ─── 절차적 트랙 (센터라인 폴리곤 필렛 + 압출) ─────────────────
// 다각형 꼭짓점을 CORNER_RADIUS 호로 필렛 → 닫힌 부드러운 경로 → 도로 압출은 기존 시스템(offsetWalls).
// Hermanos Rodriguez와 동일 패턴(centerLine 폴리라인). 모듈 피스 스냅 ❌.
const NEON_APEX = {
  GRID_UNIT:      200,   // 전체 크기 (verts에 곱해짐)
  ROAD_WIDTH:     160,   // 매우 넓게 (카트 5~6대, 드리프트 공간 충분)
  CORNER_RADIUS:  220,   // 넉넉한 스윕 코너
  SAMPLE_STEP:    24,    // 12→24 — 점 수 절반, 메시·콜라이더 부담 ↓
};

// 다각형의 각 꼭짓점을 호로 필렛. 90° 코너 전제 시 offset = R / tan(45°) = R.
// 반환: 부드러운 closed centerline 점 배열.
function _filletPolygon(verts, radius, step) {
  const N = verts.length;
  // 각 꼭짓점에서 tangent_in/out + arc center 계산.
  const tan = new Array(N);
  for (let i = 0; i < N; i++) {
    const prev = verts[(i - 1 + N) % N];
    const cur  = verts[i];
    const next = verts[(i + 1) % N];
    const v1x = cur.x - prev.x, v1y = cur.y - prev.y;
    const v2x = next.x - cur.x, v2y = next.y - cur.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const u1x = v1x / l1, u1y = v1y / l1;
    const u2x = v2x / l2, u2y = v2y / l2;
    const cross = u1x * u2y - u1y * u2x;
    const dot   = u1x * u2x + u1y * u2y;
    const turn  = Math.atan2(cross, dot);     // 부호 있음 (+CCW, −CW)
    const absT  = Math.abs(turn);
    // 직선 꼭짓점(absT≈0) — offset 0, 호 없음.
    const offset = absT < 1e-3
      ? 0
      : radius / Math.tan((Math.PI - absT) / 2);
    const tInX  = cur.x - u1x * offset;
    const tInY  = cur.y - u1y * offset;
    const tOutX = cur.x + u2x * offset;
    const tOutY = cur.y + u2y * offset;
    const sign  = Math.sign(cross) || 1;
    // arc center: tIn에서 u1의 (안쪽)수직 방향으로 R.
    const perpX = -u1y * sign;
    const perpY =  u1x * sign;
    const cx = tInX + perpX * radius;
    const cy = tInY + perpY * radius;
    tan[i] = { tInX, tInY, tOutX, tOutY, cx, cy, sign, absT };
  }
  // emit: 각 꼭짓점의 (tOut → 다음 꼭짓점 tIn) 직선 + 다음 꼭짓점 arc.
  const pts = [];
  for (let i = 0; i < N; i++) {
    const cur  = tan[i];
    const nxt  = tan[(i + 1) % N];
    // straight from cur.tOut → nxt.tIn
    const sx = cur.tOutX, sy = cur.tOutY;
    const ex = nxt.tInX,  ey = nxt.tInY;
    const slen = Math.hypot(ex - sx, ey - sy);
    const sn = Math.max(1, Math.round(slen / step));
    for (let j = 0; j < sn; j++) {
      const t = j / sn;
      pts.push({ x: sx + (ex - sx) * t, y: sy + (ey - sy) * t });
    }
    // arc at next vertex (absT 작으면 skip)
    if (nxt.absT > 1e-3) {
      const a0 = Math.atan2(nxt.tInY - nxt.cy, nxt.tInX - nxt.cx);
      const dir = nxt.sign;
      const arcLen = radius * nxt.absT;
      const nA = Math.max(6, Math.round(arcLen / step));
      for (let j = 0; j < nA; j++) {
        const a = a0 + dir * nxt.absT * (j / nA);
        pts.push({
          x: nxt.cx + radius * Math.cos(a),
          y: nxt.cy + radius * Math.sin(a),
        });
      }
    }
  }
  return pts;
}

function makeNeonApexTrack() {
  // 새 사양: 20 꼭짓점 grid (각 좌표 × GRID_UNIT), START/FINISH (2, 12) × GRID_UNIT.
  // 좌측 긴 직선 (V0(2,14)→V1(2,2)) 위에 START.
  const G = NEON_APEX.GRID_UNIT;
  const verts = [
    { x:  2, y: 14 }, { x:  2, y:  2 }, { x:  6, y:  2 }, { x:  6, y:  7 },
    { x:  9, y:  7 }, { x:  9, y:  2 }, { x: 13, y:  2 }, { x: 13, y:  7 },
    { x: 16, y:  7 }, { x: 16, y:  2 }, { x: 22, y:  2 }, { x: 22, y: 14 },
    { x: 16, y: 14 }, { x: 16, y:  9 }, { x: 13, y:  9 }, { x: 13, y: 14 },
    { x:  9, y: 14 }, { x:  9, y:  9 }, { x:  6, y:  9 }, { x:  6, y: 14 },
  ].map(p => ({ x: p.x * G, y: p.y * G }));
  const startAbs = { x: 2 * G, y: 12 * G };

  const width = NEON_APEX.ROAD_WIDTH;
  const filleted = _filletPolygon(verts, NEON_APEX.CORNER_RADIUS, NEON_APEX.SAMPLE_STEP);

  // 원점 중심화 (다른 트랙들과 일관). startAbs도 같은 변환.
  const xs = filleted.map(p => p.x);
  const ys = filleted.map(p => p.y);
  const ox = (Math.min(...xs) + Math.max(...xs)) / 2;
  const oy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const center = filleted.map(p => ({ x: p.x - ox, y: p.y - oy }));
  const startCentered = { x: startAbs.x - ox, y: startAbs.y - oy };

  // START 위치 = (80,240)에 가장 가까운 centerline index.
  let startIdx = 0, bestD2 = Infinity;
  for (let i = 0; i < center.length; i++) {
    const dx = center[i].x - startCentered.x;
    const dy = center[i].y - startCentered.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; startIdx = i; }
  }
  // centerLine 회전 — startIdx를 0번으로.
  const rotated = center.slice(startIdx).concat(center.slice(0, startIdx));

  const { outer, inner } = offsetWalls(rotated, width);

  const N = rotated.length;
  const sc = rotated[0];
  const scNext = rotated[1];
  const sAngle = Math.atan2(scNext.y - sc.y, scNext.x - sc.x);
  const halfW = width * 0.58;
  const perpDx = -Math.sin(sAngle);
  const perpDy = Math.cos(sAngle);
  // spawn = START 라인 직전 (살짝 뒤쪽)
  const approxStep = avgStep(rotated);
  const backSeg = Math.max(3, Math.round(60 / approxStep));
  const spawnIdx = (N - backSeg) % N;
  const spawn = rotated[spawnIdx];
  const spawnN = rotated[(spawnIdx + 1) % N];
  const spawnAngle = Math.atan2(spawnN.y - spawn.y, spawnN.x - spawn.x);

  const startPos = { x: spawn.x, y: spawn.y, angle: spawnAngle };
  const startLine = {
    x1: sc.x + perpDx * halfW, y1: sc.y + perpDy * halfW,
    x2: sc.x - perpDx * halfW, y2: sc.y - perpDy * halfW,
    tx: Math.cos(sAngle), ty: Math.sin(sAngle),
  };
  const sectors = [];
  for (let s = 1; s <= 2; s++) {
    const idx = Math.floor((s * N / 3) % N);
    const c = rotated[idx];
    const cN = rotated[(idx + 1) % N];
    const a = Math.atan2(cN.y - c.y, cN.x - c.x);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    sectors.push({
      id: s,
      checkLine: {
        x1: c.x + px * halfW, y1: c.y + py * halfW,
        x2: c.x - px * halfW, y2: c.y - py * halfW,
        tx: Math.cos(a), ty: Math.sin(a),
      },
      color: s === 1 ? '#2ec4b6' : '#c77dff',
    });
  }
  // 추정 길이: 직선합 + 코너 호(각 πR/2)
  const approxLen = Math.round((rotated.length * approxStep) / 100) / 10;
  const targetTime = estimateTargetTimeMs(`${approxLen} km`, 'Normal');

  return {
    id: 'neon_apex',
    name: 'Neon Apex',
    length: `${approxLen} km`,
    difficulty: 'Normal',
    desc: 'PC 카트라이더식 와이드 도로 + 라운드 90° 12 코너 닫힌 루프.',
    character: 'flow',
    width,
    targetTime,
    silverTime: Math.round(targetTime * 0.92),
    goldTime: Math.round(targetTime * 0.84),
    outerBoundary: outer,
    innerBoundary: inner,
    centerLine: rotated.map(c => [c.x, c.y]),
    boostPads: _computeBoostPads(rotated, 4),
    startLine,
    sectors,
    startPos,
    backgroundColor: '#1a2030',
    trackColor: '#303542',
    accentColor: '#ffd166',
    mapColor: '#e7edf3',
    sourceSize: { width: 720, height: 520 },
    theme: { noDesertWalls: true, minimal: true },   // 사암 벽 ❌, props(피라미드/박스/스탠드) ❌
  };
}

export const TRACKS = [
  ...CIRCUITS_V2_TRACKS,
  makeNeonApexTrack(),
];

