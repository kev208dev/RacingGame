// Five F1-inspired circuits with intentionally different silhouettes.
// The paths are closed Catmull-Rom splines through hand-shaped control points,
// then widened into inner/outer track walls.

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3),
  };
}

function buildSplineCenterline(points, segments = 240, mirrorX = true) {
  const controls = points.map(([x, y]) => ({ x: mirrorX ? -x : x, y }));
  const out = [];
  const per = Math.max(8, Math.floor(segments / controls.length));
  for (let i = 0; i < controls.length; i++) {
    const p0 = controls[(i - 1 + controls.length) % controls.length];
    const p1 = controls[i];
    const p2 = controls[(i + 1) % controls.length];
    const p3 = controls[(i + 2) % controls.length];
    for (let j = 0; j < per; j++) {
      out.push(catmull(p0, p1, p2, p3, j / per));
    }
  }
  return out;
}

function offsetWalls(center, width) {
  const N = center.length;
  const outer = [];
  const inner = [];
  for (let i = 0; i < N; i++) {
    const c     = center[i];
    const cNext = center[(i + 1) % N];
    const cPrev = center[(i - 1 + N) % N];
    const tx = cNext.x - cPrev.x;
    const ty = cNext.y - cPrev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx =  ty / tl;
    const ny = -tx / tl;
    outer.push([c.x + nx * width / 2, c.y + ny * width / 2]);
    inner.push([c.x - nx * width / 2, c.y - ny * width / 2]);
  }
  return Math.abs(_polyArea(outer)) >= Math.abs(_polyArea(inner))
    ? { outer, inner }
    : { outer: inner, inner: outer };
}

function _polyArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function makeCircuit({
  id, name, length, difficulty, desc, character, points, width,
  segments = 240, startBackOffset = 130, theme = {}, mirrorX = true,
}) {
  const center = buildSplineCenterline(points, segments, mirrorX);
  const { outer, inner } = offsetWalls(center, width);

  const N = center.length;
  const sc      = center[0];
  const scNext  = center[1];
  const sAngle  = Math.atan2(scNext.y - sc.y, scNext.x - sc.x);
  const halfW   = width * 0.58;
  const perpDx  = -Math.sin(sAngle);
  const perpDy  =  Math.cos(sAngle);
  const approxStep = _avgStep(center);
  const backSeg = Math.max(3, Math.round(startBackOffset / approxStep));
  const spawnIdx = (N - backSeg) % N;
  const spawn  = center[spawnIdx];
  const spawnN = center[(spawnIdx + 1) % N];
  const spawnAngle = Math.atan2(spawnN.y - spawn.y, spawnN.x - spawn.x);

  const startPos = { x: spawn.x, y: spawn.y, angle: spawnAngle };
  const startLine = {
    x1: sc.x + perpDx * halfW, y1: sc.y + perpDy * halfW,
    x2: sc.x - perpDx * halfW, y2: sc.y - perpDy * halfW,
  };

  const sectors = [];
  for (let s = 1; s <= 2; s++) {
    const idx = Math.floor((s * N / 3) % N);
    const c   = center[idx];
    const cN  = center[(idx + 1) % N];
    const a   = Math.atan2(cN.y - c.y, cN.x - c.x);
    const px  = -Math.sin(a);
    const py  =  Math.cos(a);
    sectors.push({
      id: s,
      checkLine: {
        x1: c.x + px * halfW, y1: c.y + py * halfW,
        x2: c.x - px * halfW, y2: c.y - py * halfW,
      },
      color: s === 1 ? (theme.sector1 || '#2ec4b6') : (theme.sector2 || '#c77dff'),
    });
  }

  return {
    id, name, length, difficulty, desc, character,
    width,
    outerBoundary: outer,
    innerBoundary: inner,
    centerLine: center.map(c => [c.x, c.y]),
    startLine,
    sectors,
    startPos,
    backgroundColor: theme.background || '#4f554d',
    trackColor: theme.track || '#303235',
    accentColor: theme.accent || '#ffd166',
    mapColor: theme.map || '#e7edf3',
  };
}

function _avgStep(center) {
  let total = 0;
  for (let i = 0; i < center.length; i++) {
    const a = center[i];
    const b = center[(i + 1) % center.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total / center.length;
}

export const TRACKS = [
  makeCircuit({
    id: 'spa',
    name: 'Spa-Francorchamps',
    length: '7.0 km',
    difficulty: '어려움',
    desc: '초고속 오르막, 긴 직선, 큰 리듬 변화',
    character: '긴 고속 구간 + 급격한 리듬 변화',
    width: 132,
    startBackOffset: 170,
    theme: { accent: '#ffd166', sector1: '#2ec4b6', sector2: '#79b8ff', map: '#f2f5f7' },
    points: [
      [-3600, -900], [-2600, -1900], [-900, -1720], [-260, -220],
      [680, -2550], [2500, -2180], [3740, -760], [2080, 220],
      [3300, 1500], [1080, 2350], [-900, 1820], [-2440, 2300],
      [-3780, 820],
    ],
  }),
  makeCircuit({
    id: 'suzuka',
    name: 'Suzuka Circuit',
    length: '5.8 km',
    difficulty: '어려움',
    desc: 'S자 리듬과 고속 130R 느낌의 테크니컬 코스',
    character: '연속 S자 + 빠른 후반부',
    width: 116,
    startBackOffset: 145,
    theme: { accent: '#e63946', sector1: '#ff6b6b', sector2: '#2ec4b6', map: '#f6f0df' },
    points: [
      [-3000, -720], [-2040, -1780], [-620, -1570], [240, -820],
      [1480, -1450], [3340, -900], [3560, 360], [2040, 1320],
      [520, 780], [-340, 1740], [-1760, 1320], [-3180, 260],
    ],
  }),
  makeCircuit({
    id: 'monaco',
    name: 'Circuit de Monaco',
    length: '3.3 km',
    difficulty: '매우 어려움',
    desc: '좁고 느린 시가지, 헤어핀과 벽 압박',
    character: '저속 헤어핀 + 좁은 벽 코스',
    width: 84,
    startBackOffset: 105,
    theme: { background: '#50545a', accent: '#f4a261', sector1: '#ffd166', sector2: '#ef476f', map: '#f9f2e7' },
    points: [
      [-1660, -1160], [-620, -1660], [520, -1500], [1180, -900],
      [460, -380], [1720, 80], [1480, 940], [620, 1320],
      [-160, 820], [-980, 1480], [-1780, 900], [-1320, 100],
      [-2160, -360],
    ],
  }),
  makeCircuit({
    id: 'monza',
    name: 'Autodromo di Monza',
    length: '5.8 km',
    difficulty: '보통',
    desc: '긴 직선과 큰 제동, 최고속 싸움',
    character: '초고속 직선 + 시케인 브레이킹',
    width: 148,
    startBackOffset: 180,
    theme: { background: '#4d5548', accent: '#37c777', sector1: '#37c777', sector2: '#ffd166', map: '#eef7ed' },
    points: [
      [-3960, -1160], [1900, -1360], [3720, -480], [3240, 620],
      [1220, 1040], [3420, 1840], [0, 2180], [-3560, 1180],
      [-3880, 120],
    ],
  }),
  makeCircuit({
    id: 'singapore',
    name: 'Marina Bay Street Circuit',
    length: '4.9 km',
    difficulty: '어려움',
    desc: '도시형 직각 코너, 부스트 회복과 탈출 가속이 중요',
    character: '각진 시가지 + 짧은 가속 구간 반복',
    width: 98,
    startBackOffset: 130,
    theme: { background: '#45484d', accent: '#c77dff', sector1: '#79b8ff', sector2: '#c77dff', map: '#edf2ff' },
    points: [
      [-2520, -1420], [-900, -1520], [-660, -660], [780, -920],
      [2240, -500], [2320, 420], [960, 520], [1320, 1520],
      [120, 1740], [-520, 820], [-1880, 120], [-2520, 820],
      [-3200, -20],
    ],
  }),
];
