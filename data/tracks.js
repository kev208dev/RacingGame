// Five 2025 calendar-style F1 circuit traces.
// The coordinates below are hand-traced from the supplied calendar image and
// intentionally keep the same left/right orientation. No mirroring is applied.

function buildTraceCenterline(trace, scale = 70, targetStep = 34) {
  const controls = trace.map(([x, y]) => ({
    x: (x - 50) * scale,
    y: (y - 50) * scale,
  }));
  const out = [];
  for (let i = 0; i < controls.length; i++) {
    const a = controls[i];
    const b = controls[(i + 1) % controls.length];
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

function makeCalendarCircuit({
  id, name, length, difficulty, desc, character, trace, width,
  scale = 70, startBackOffset = 130, theme = {},
}) {
  const center = buildTraceCenterline(trace, scale);
  const { outer, inner } = offsetWalls(center, width);

  const N = center.length;
  const sc = center[0];
  const scNext = center[1];
  const sAngle = Math.atan2(scNext.y - sc.y, scNext.x - sc.x);
  const halfW = width * 0.58;
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

function avgStep(center) {
  let total = 0;
  for (let i = 0; i < center.length; i++) {
    const a = center[i];
    const b = center[(i + 1) % center.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total / center.length;
}

export const TRACKS = [
  makeCalendarCircuit({
    id: 'australia',
    name: 'Australia Melbourne',
    length: '5.3 km',
    difficulty: '보통',
    desc: '캘린더 이미지의 멜버른 실루엣을 그대로 추적한 흐름',
    character: '좌측 꺾임 + 우측 긴 리듬 변화',
    width: 116,
    scale: 76,
    startBackOffset: 150,
    theme: { accent: '#79b8ff', sector1: '#79b8ff', sector2: '#ffd166', map: '#f4f7ff' },
    trace: [
      [17, 52], [24, 36], [38, 33], [48, 43], [60, 33], [74, 37],
      [85, 49], [76, 61], [63, 59], [54, 73], [39, 71], [30, 61],
    ],
  }),
  makeCalendarCircuit({
    id: 'japan',
    name: 'Japan Suzuka',
    length: '5.8 km',
    difficulty: '어려움',
    desc: '캘린더 이미지의 스즈카 방향 그대로, S자와 우상단 헤어핀 유지',
    character: '연속 S자 + 긴 우상단 루프',
    width: 108,
    scale: 78,
    startBackOffset: 145,
    theme: { accent: '#e63946', sector1: '#ff6b6b', sector2: '#2ec4b6', map: '#fff3f3' },
    trace: [
      [15, 79], [42, 79], [50, 68], [41, 57], [53, 45], [48, 34],
      [60, 23], [76, 26], [87, 16], [72, 11], [58, 23], [52, 39],
      [38, 36], [27, 47], [22, 64],
    ],
  }),
  makeCalendarCircuit({
    id: 'monaco',
    name: 'Monaco Monte Carlo',
    length: '3.3 km',
    difficulty: '매우 어려움',
    desc: '캘린더 이미지의 모나코 윤곽처럼 좁고 복잡한 시가지',
    character: '헤어핀 + 벽 압박 + 짧은 가속',
    width: 82,
    scale: 62,
    startBackOffset: 100,
    theme: { background: '#50545a', accent: '#f4a261', sector1: '#ffd166', sector2: '#ef476f', map: '#fff4e8' },
    trace: [
      [18, 64], [25, 39], [42, 38], [56, 28], [78, 18], [88, 29],
      [75, 42], [85, 55], [76, 74], [59, 82], [46, 65], [31, 79],
      [18, 72],
    ],
  }),
  makeCalendarCircuit({
    id: 'belgium',
    name: 'Belgium Spa-Francorchamps',
    length: '7.0 km',
    difficulty: '어려움',
    desc: '캘린더 이미지의 스파 실루엣 방향 그대로 긴 흐름을 반영',
    character: '긴 고속 구간 + 큰 고저 리듬',
    width: 122,
    scale: 82,
    startBackOffset: 170,
    theme: { accent: '#ffd166', sector1: '#2ec4b6', sector2: '#79b8ff', map: '#f2f5f7' },
    trace: [
      [12, 72], [22, 58], [35, 52], [47, 47], [55, 34], [66, 24],
      [78, 18], [87, 25], [75, 35], [64, 47], [73, 61], [63, 75],
      [47, 72], [38, 82], [27, 76],
    ],
  }),
  makeCalendarCircuit({
    id: 'singapore',
    name: 'Singapore Marina Bay',
    length: '4.9 km',
    difficulty: '어려움',
    desc: '캘린더 이미지의 싱가포르 각진 시가지 형태를 그대로 추적',
    character: '직각 코너 + 짧은 탈출 가속 반복',
    width: 92,
    scale: 72,
    startBackOffset: 130,
    theme: { background: '#45484d', accent: '#c77dff', sector1: '#79b8ff', sector2: '#c77dff', map: '#edf2ff' },
    trace: [
      [18, 61], [26, 38], [38, 43], [44, 25], [62, 26], [69, 38],
      [78, 36], [80, 18], [88, 35], [83, 55], [69, 61], [63, 79],
      [48, 72], [37, 84], [26, 75],
    ],
  }),
];
