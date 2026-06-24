import { TRACK_DEFAULTS } from './circuits_v2_defaults.js';

const CAR_WIDTH_DEFAULT = 16;

function _polyArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function _centerlineTangent(centerline, i) {
  const N = centerline.length;
  const [px, py] = centerline[(i - 1 + N) % N];
  const [nx, ny] = centerline[(i + 1) % N];
  const tx = nx - px;
  const ty = ny - py;
  const l = Math.hypot(tx, ty) || 1;
  return [tx / l, ty / l];
}

function _rightPerp(tx, ty) {
  return [ty, -tx];
}

function _buildEdges(centerline, halfWidth) {
  const N = centerline.length;
  const leftEdge = new Array(N);
  const rightEdge = new Array(N);
  for (let i = 0; i < N; i++) {
    const [tx, ty] = _centerlineTangent(centerline, i);
    const [px, py] = _rightPerp(tx, ty);
    const [cx, cy] = centerline[i];
    const hw = halfWidth[i];
    rightEdge[i] = [cx + px * hw, cy + py * hw];
    leftEdge[i] = [cx - px * hw, cy - py * hw];
  }
  return { leftEdge, rightEdge };
}

function _segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1x = bx - ax;
  const r1y = by - ay;
  const r2x = dx - cx;
  const r2y = dy - cy;
  const denom = r1x * r2y - r1y * r2x;
  if (Math.abs(denom) < 1e-9) return false;
  const ux = ((cx - ax) * r2y - (cy - ay) * r2x) / denom;
  const uy = ((cx - ax) * r1y - (cy - ay) * r1x) / denom;
  return ux > 0.002 && ux < 0.998 && uy > 0.002 && uy < 0.998;
}

function _findEdgeViolators(spec, hwMin, hwMax) {
  const N = spec.centerline.length;
  const left = spec.leftEdge;
  const right = spec.rightEdge;
  const height = spec.height;
  const hasOverpass = !!spec.overpass;
  const carHmin = spec.overpass ? (spec.overpass.carHeightMin || 6) : 0;
  const violators = new Set();

  for (let i = 0; i < N; i++) {
    const hw = spec.halfWidth[i];
    if (hw < hwMin) violators.add(i);
    else if (hw > hwMax) violators.add(i);
  }

  const testPoly = (poly) => {
    for (let i = 0; i < N; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % N];
      for (let j = i + 2; j < N; j++) {
        const sep = Math.min(j - i, N - (j - i));
        if (sep < 3) continue;
        const c = poly[j];
        const d = poly[(j + 1) % N];
        if (!_segSegIntersect(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) continue;
        if (hasOverpass && Math.abs(height[i] - height[j]) >= carHmin) continue;
        violators.add(i);
        violators.add(j);
      }
    }
  };
  testPoly(left);
  testPoly(right);

  for (let i = 0; i < N; i++) {
    const a = left[i];
    const b = left[(i + 1) % N];
    for (let j = 0; j < N; j++) {
      const diff = Math.abs(i - j);
      const sep = Math.min(diff, N - diff);
      if (sep < 3) continue;
      const c = right[j];
      const d = right[(j + 1) % N];
      if (!_segSegIntersect(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) continue;
      if (hasOverpass && Math.abs(height[i] - height[j]) >= carHmin) continue;
      violators.add(i);
      violators.add(j);
    }
  }

  return [...violators];
}

function _validateAndAdjust(spec) {
  const carW = spec.CAR_WIDTH || CAR_WIDTH_DEFAULT;
  const hwMin = (7 * carW) / 2;
  const hwMax = (18 * carW) / 2;
  const N = spec.centerline.length;
  let adjusted = 0;
  let clampedRange = 0;

  for (let i = 0; i < N; i++) {
    const v = spec.halfWidth[i];
    if (v < hwMin) {
      spec.halfWidth[i] = hwMin;
      clampedRange++;
    } else if (v > hwMax) {
      spec.halfWidth[i] = hwMax;
      clampedRange++;
    }
  }
  if (clampedRange > 0) {
    const rebuilt = _buildEdges(spec.centerline, spec.halfWidth);
    spec.leftEdge = rebuilt.leftEdge;
    spec.rightEdge = rebuilt.rightEdge;
    adjusted += clampedRange;
  }

  let iters = 0;
  let crossFix = 0;
  while (iters < 8) {
    const offenders = _findEdgeViolators(spec, hwMin, hwMax);
    if (!offenders.length) break;
    for (const idx of offenders) {
      const shrunk = spec.halfWidth[idx] * 0.9;
      spec.halfWidth[idx] = Math.max(hwMin, shrunk);
      crossFix++;
    }
    const sm = spec.halfWidth.slice();
    for (let i = 0; i < N; i++) {
      sm[i] = 0.6 * spec.halfWidth[i] + 0.2 * spec.halfWidth[(i - 1 + N) % N] + 0.2 * spec.halfWidth[(i + 1) % N];
    }
    spec.halfWidth = sm;
    const rebuilt2 = _buildEdges(spec.centerline, spec.halfWidth);
    spec.leftEdge = rebuilt2.leftEdge;
    spec.rightEdge = rebuilt2.rightEdge;
    iters++;
  }
  adjusted += crossFix;

  const finalCheck = _findEdgeViolators(spec, hwMin, hwMax);
  spec._audit = {
    clampedRange,
    crossFix,
    iters,
    pass: finalCheck.length === 0,
    remaining: finalCheck.length,
  };
  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    const status = spec._audit.pass ? 'PASS' : `FAIL(${finalCheck.length})`;
    console.log(`[circuits_v2] ${spec.id}: ${status} clamped=${clampedRange} crossFix=${crossFix} iters=${iters}`);
  }
  return spec;
}

function _estimateTargetTimeMs(lengthKm, difficulty) {
  const t = String(difficulty || '').toLowerCase();
  let mult = 1;
  if (t.includes('very') || t.includes('expert') || t.includes('매우')) mult = 1.32;
  else if (t.includes('hard') || t.includes('어려')) mult = 1.18;
  return Math.round(lengthKm * 13500 * mult);
}

export function adaptCircuitV2(spec) {
  const centerLine = spec.centerline;
  const N = centerLine.length;
  const halfWidth = spec.halfWidth;
  const height = spec.height;
  const leftEdge = spec.leftEdge;
  const rightEdge = spec.rightEdge;

  const areaL = Math.abs(_polyArea(leftEdge));
  const areaR = Math.abs(_polyArea(rightEdge));
  let outerBoundary;
  let innerBoundary;
  if (areaL >= areaR) {
    outerBoundary = leftEdge;
    innerBoundary = rightEdge;
  } else {
    outerBoundary = rightEdge;
    innerBoundary = leftEdge;
  }

  const sc = centerLine[0];
  const scN = centerLine[1];
  const sAngle = Math.atan2(scN[1] - sc[1], scN[0] - sc[0]);
  const startPos = { x: sc[0], y: sc[1], angle: sAngle };

  const startLine = {
    x1: leftEdge[0][0], y1: leftEdge[0][1],
    x2: rightEdge[0][0], y2: rightEdge[0][1],
    tx: Math.cos(sAngle), ty: Math.sin(sAngle),
  };

  const sectors = [];
  for (let s = 1; s <= 2; s++) {
    const idx = Math.floor((s * N / 3) % N);
    const c = centerLine[idx];
    const cN = centerLine[(idx + 1) % N];
    const a = Math.atan2(cN[1] - c[1], cN[0] - c[0]);
    sectors.push({
      id: s,
      checkLine: {
        x1: leftEdge[idx][0], y1: leftEdge[idx][1],
        x2: rightEdge[idx][0], y2: rightEdge[idx][1],
        tx: Math.cos(a), ty: Math.sin(a),
      },
      color: s === 1 ? '#2ec4b6' : '#c77dff',
    });
  }

  let approxLen = 0;
  for (let i = 0; i < N; i++) {
    const a = centerLine[i];
    const b = centerLine[(i + 1) % N];
    approxLen += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const lengthKm = Math.round(approxLen / 100) / 10;

  let avgHalf = 0;
  for (const h of halfWidth) avgHalf += h;
  avgHalf /= N;
  const width = Math.round(avgHalf * 2);

  const xs = centerLine.map(p => p[0]);
  const ys = centerLine.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const targetTime = _estimateTargetTimeMs(lengthKm, spec.difficulty);

  const out = {
    id: spec.id,
    name: spec.name,
    nameKo: spec.nameKo || spec.name,
    length: `${lengthKm} km`,
    difficulty: spec.difficulty || 'Normal',
    desc: spec.note || '',
    character: spec.character || 'flow',
    width,
    widthMul: spec.widthMul || 1,
    halfWidth,
    height,
    leftEdge,
    rightEdge,
    overpass: spec.overpass || null,
    CAR_WIDTH: spec.CAR_WIDTH || CAR_WIDTH_DEFAULT,
    targetTime,
    silverTime: Math.round(targetTime * 0.92),
    goldTime: Math.round(targetTime * 0.84),
    outerBoundary,
    innerBoundary,
    centerLine,
    boostPads: [],
    startLine,
    sectors,
    startPos,
    backgroundColor: TRACK_DEFAULTS.backgroundColor,
    trackColor: TRACK_DEFAULTS.trackColor,
    accentColor: TRACK_DEFAULTS.accentColor,
    mapColor: TRACK_DEFAULTS.mapColor,
    sourceSize: { width: Math.round(maxX - minX + 200), height: Math.round(maxY - minY + 200) },
    theme: { minimal: true, noDesertWalls: true },
  };
  return out;
}

function _buildPinchFlow() {
  const N = 256;
  const centerline = new Array(N);
  const halfWidth = new Array(N);
  const height = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 1400 * Math.cos(t) + 180 * Math.sin(3 * t);
    const y = 1050 * Math.sin(t) + 140 * Math.cos(3 * t);
    centerline[i] = [x, y];
    halfWidth[i] = 110 + 30 * Math.cos(4 * t);
    height[i] = 0;
  }
  const { leftEdge, rightEdge } = _buildEdges(centerline, halfWidth);
  const spec = {
    id: 'pinch_flow',
    name: 'Pinch Flow',
    nameKo: '핀치 플로우',
    difficulty: 'Normal',
    character: 'flow',
    widthMul: 1,
    note: '가변폭. 핀치 4구간 ↔ 와이드 4구간 교대.',
    centerline,
    halfWidth,
    height,
    leftEdge,
    rightEdge,
    overpass: null,
    CAR_WIDTH: CAR_WIDTH_DEFAULT,
  };
  return _validateAndAdjust(spec);
}

function _wrapDelta(d, N) {
  let r = d;
  if (r > N / 2) r -= N;
  else if (r < -N / 2) r += N;
  return r;
}

function _buildCanyonTight() {
  const N = 288;
  const centerline = new Array(N);
  const halfWidth = new Array(N);
  const height = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = 1250 + 260 * Math.sin(3 * t) - 130 * Math.cos(5 * t);
    centerline[i] = [r * Math.cos(t), r * Math.sin(t)];
    halfWidth[i] = 82 + 6 * Math.sin(7 * t);
    height[i] = 0;
  }
  const { leftEdge, rightEdge } = _buildEdges(centerline, halfWidth);
  const spec = {
    id: 'canyon_tight',
    name: 'Canyon Tight',
    nameKo: '캐년 타이트',
    difficulty: 'Hard',
    character: 'tight',
    widthMul: 0.7,
    note: '협곡 타이트. 좁고 굴곡 많은 트랙.',
    centerline,
    halfWidth,
    height,
    leftEdge,
    rightEdge,
    overpass: null,
    CAR_WIDTH: CAR_WIDTH_DEFAULT,
  };
  return _validateAndAdjust(spec);
}

function _buildGauntletVar() {
  const N = 296;
  const centerline = new Array(N);
  const halfWidth = new Array(N);
  const height = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 1500 * Math.cos(t) + 260 * Math.cos(3 * t);
    const y = 1180 * Math.sin(t) + 200 * Math.sin(3 * t);
    centerline[i] = [x, y];
    halfWidth[i] = 105 + 30 * Math.sin(3 * t);
    height[i] = 0;
  }
  const { leftEdge, rightEdge } = _buildEdges(centerline, halfWidth);
  const spec = {
    id: 'gauntlet_var',
    name: 'Gauntlet',
    nameKo: '건틀릿',
    difficulty: 'Very Hard',
    character: 'mixed',
    widthMul: 1.1,
    note: '폭 격변. 와이드↔핀치 교차 반복.',
    centerline,
    halfWidth,
    height,
    leftEdge,
    rightEdge,
    overpass: null,
    CAR_WIDTH: CAR_WIDTH_DEFAULT,
  };
  return _validateAndAdjust(spec);
}

function _buildSpeedwayS() {
  const N = 240;
  const centerline = new Array(N);
  const halfWidth = new Array(N);
  const height = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 1750 * Math.cos(t);
    const y = 850 * Math.sin(t) + 130 * Math.sin(3 * t);
    centerline[i] = [x, y];
    halfWidth[i] = 120 + 20 * Math.cos(2 * t);
    height[i] = 0;
  }
  const { leftEdge, rightEdge } = _buildEdges(centerline, halfWidth);
  const spec = {
    id: 'speedway_s',
    name: 'Speedway S',
    nameKo: '스피드웨이 S',
    difficulty: 'Easy',
    character: 'speed',
    widthMul: 1.5,
    note: '하이스피드 오벌 + S 시케인. 풀스로틀.',
    centerline,
    halfWidth,
    height,
    leftEdge,
    rightEdge,
    overpass: null,
    CAR_WIDTH: CAR_WIDTH_DEFAULT,
  };
  return _validateAndAdjust(spec);
}

function _buildPLoop() {
  const N = 256;
  const centerline = new Array(N);
  const halfWidth = new Array(N);
  const height = new Array(N);
  const bridgeHeight = 46;
  const baseHW = 90;
  const bridgeCenter = N / 4;
  const bridgeHalf = N / 8;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2 + Math.PI / 2;
    const x = 1150 * Math.sin(t);
    const y = 580 * Math.sin(2 * t);
    centerline[i] = [x, y];
    halfWidth[i] = baseHW;
    const di = _wrapDelta(i - bridgeCenter, N);
    const absDi = Math.abs(di);
    if (absDi < bridgeHalf) {
      const u = absDi / bridgeHalf;
      height[i] = bridgeHeight * 0.5 * (1 + Math.cos(Math.PI * u));
    } else {
      height[i] = 0;
    }
  }
  const { leftEdge, rightEdge } = _buildEdges(centerline, halfWidth);
  const spec = {
    id: 'p_loop',
    name: 'Possum Loop',
    nameKo: '포섬 루프',
    difficulty: 'Hard',
    character: 'overpass',
    widthMul: 1,
    note: '오버패스. 2D 자기교차 = 다리/하부 입체교차.',
    centerline,
    halfWidth,
    height,
    leftEdge,
    rightEdge,
    overpass: { bridgeHeight, carHeightMin: 6 },
    CAR_WIDTH: CAR_WIDTH_DEFAULT,
  };
  return _validateAndAdjust(spec);
}

export const CIRCUITS_V2_SPECS = [
  _buildPinchFlow(),
  _buildCanyonTight(),
  _buildGauntletVar(),
  _buildSpeedwayS(),
  _buildPLoop(),
];

export const CIRCUITS_V2_TRACKS = CIRCUITS_V2_SPECS.map(adaptCircuitV2);
