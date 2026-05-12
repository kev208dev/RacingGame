// Official f1-circuits.com based traces.
// Coordinates are hand-traced from each linked circuit hero map in its original
// image orientation. No mirroring or reshaping is applied.

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
    id,
    name,
    length,
    difficulty,
    desc,
    character,
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
    sourceSize,
    ...info,
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
  makeOfficialCircuit({
    id: 'autodromo_hermanos_rodriguez',
    name: 'Autodromo Hermanos Rodriguez',
    length: '4.304 km',
    difficulty: '보통',
    desc: 'Mexico City Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '긴 메인 스트레이트 + Foro Sol 스타디움 섹션',
    width: 138,
    scale: 3.0,
    startBackOffset: 150,
    sourceSize: { width: 1940, height: 1082 },
    theme: { accent: '#d71920', sector1: '#22c55e', sector2: '#facc15', map: '#fff5f5' },
    info: {
      country: 'Mexico',
      gpName: 'Mexico City Grand Prix',
      laps: 71,
      turns: 17,
      elevationChangeM: 0,
      firstGrandPrix: 1963,
      fastestLapRecord: '1:17.774',
      fastestLapDriver: 'Valtteri Bottas',
      polePositionRecord: '1:14.758',
      polePositionDriver: 'Daniel Ricciardo',
      mostWinsDriver: 'Max Verstappen',
      mostWinsCount: 5,
      iconicMomentTitle: '1970: Unsafe Crowds Halt Race',
      famousCorners: ['Foro Sol (Stadium Section)', 'Peraltada'],
      sourceUrl: 'https://f1-circuits.com/circuits/autodromo-hermanos-rodriguez',
    },
    trace: [
      [320, 110], [1580, 110], [1710, 250], [1600, 560], [1460, 900],
      [1365, 780], [1310, 595], [1080, 505], [760, 430], [420, 405],
      [240, 260], [320, 110],
    ],
  }),
  makeOfficialCircuit({
    id: 'pacifica_sweep',
    name: 'Pacifica Sweep GP',
    length: '5.840 km',
    difficulty: '보통',
    desc: '1번 트랙처럼 넓고 읽기 쉬운 고속 밸런스 서킷',
    character: '긴 직선 2개 + 크게 말리는 중속 코너 + 안정적인 탈출 구간',
    width: 152,
    scale: 2.85,
    startBackOffset: 190,
    sourceSize: { width: 1940, height: 1083 },
    theme: { accent: '#14b8a6', sector1: '#3b82f6', sector2: '#facc15', map: '#f0fdfa' },
    info: {
      country: 'Fantasy',
      gpName: 'Pacifica Speed Trial',
      laps: 48,
      turns: 11,
      elevationChangeM: 18,
      firstGrandPrix: 2026,
      fastestLapRecord: 'No record',
      fastestLapDriver: 'Open',
      polePositionRecord: 'No record',
      polePositionDriver: 'Open',
      mostWinsDriver: 'Open',
      mostWinsCount: 0,
      iconicMomentTitle: 'High-Speed Rhythm Course',
      famousCorners: ['Harbor Bend', 'Backstretch Kink'],
    },
    trace: [
      [245, 250], [1510, 245], [1740, 395], [1650, 610], [1390, 720],
      [1665, 850], [880, 915], [420, 805], [235, 560], [390, 390],
      [245, 250],
    ],
  }),
  makeOfficialCircuit({
    id: 'pylon_p_loop',
    name: 'Pylon P-Loop',
    length: '4.920 km',
    difficulty: '어려움',
    desc: 'P자 도로 형태의 브레이킹/재가속 집중 코스',
    character: '긴 세로 스템 + 둥근 P 루프 + 안쪽 타이트 섹션',
    width: 142,
    scale: 2.95,
    startBackOffset: 210,
    sourceSize: { width: 1935, height: 1080 },
    theme: { accent: '#f97316', sector1: '#22c55e', sector2: '#f43f5e', map: '#fff7ed' },
    info: {
      country: 'Fantasy',
      gpName: 'Pylon Technical Cup',
      laps: 62,
      turns: 16,
      elevationChangeM: 22,
      firstGrandPrix: 2026,
      fastestLapRecord: 'No record',
      fastestLapDriver: 'Open',
      polePositionRecord: 'No record',
      polePositionDriver: 'Open',
      mostWinsDriver: 'Open',
      mostWinsCount: 0,
      iconicMomentTitle: 'P-Shaped Brake Test',
      famousCorners: ['P Loop', 'Stem Hairpin'],
    },
    trace: [
      [420, 930], [420, 210], [1110, 205], [1510, 360], [1545, 585],
      [1320, 735], [940, 720], [720, 595], [720, 780], [1180, 815],
      [1395, 940], [1015, 1010], [650, 985], [420, 930],
    ],
  }),
  makeOfficialCircuit({
    id: 'sky_spiral',
    name: 'Sky Spiral Climb',
    length: '6.180 km',
    difficulty: '매우 어려움',
    desc: '상승 램프처럼 감기는 한 바퀴 스파이럴 코스',
    character: '오르막 루프형 중반부 + 고속 하강 직선 + 큰 리듬 코너',
    width: 138,
    scale: 2.9,
    startBackOffset: 205,
    sourceSize: { width: 1935, height: 1080 },
    theme: { accent: '#8b5cf6', sector1: '#38bdf8', sector2: '#facc15', map: '#f5f3ff' },
    info: {
      country: 'Fantasy',
      gpName: 'Skyline Hillclimb GP',
      laps: 44,
      turns: 19,
      elevationChangeM: 86,
      firstGrandPrix: 2026,
      fastestLapRecord: 'No record',
      fastestLapDriver: 'Open',
      polePositionRecord: 'No record',
      polePositionDriver: 'Open',
      mostWinsDriver: 'Open',
      mostWinsCount: 0,
      iconicMomentTitle: 'One-Lap Spiral Climb',
      famousCorners: ['Sky Loop', 'Drop Straight'],
      roadProfile: { type: 'climb', height: 34, roughness: 0.04 },
    },
    trace: [
      [285, 845], [520, 260], [900, 150], [1310, 245], [1605, 560],
      [1490, 835], [1130, 940], [790, 795], [820, 555], [1075, 455],
      [1280, 575], [1190, 720], [930, 720], [690, 590], [570, 760],
      [455, 965], [285, 845],
    ],
  }),
  makeOfficialCircuit({
    id: 'rumble_ridge',
    name: 'Rumble Ridge Complex',
    length: '5.420 km',
    difficulty: '매우 어려움',
    desc: '울퉁불퉁한 능선 위 테크니컬 코너 러시',
    character: '짧은 직선 + 연속 S코너 + 거친 노면 리듬',
    width: 148,
    scale: 2.85,
    startBackOffset: 185,
    sourceSize: { width: 1935, height: 1080 },
    theme: { accent: '#eab308', sector1: '#ef4444', sector2: '#22c55e', map: '#fefce8' },
    info: {
      country: 'Fantasy',
      gpName: 'Rumble Ridge Rally GP',
      laps: 55,
      turns: 23,
      elevationChangeM: 54,
      firstGrandPrix: 2026,
      fastestLapRecord: 'No record',
      fastestLapDriver: 'Open',
      polePositionRecord: 'No record',
      polePositionDriver: 'Open',
      mostWinsDriver: 'Open',
      mostWinsCount: 0,
      iconicMomentTitle: 'Bumpy Technical Gauntlet',
      famousCorners: ['Rumble Esses', 'Ridge Switchback'],
      roadProfile: { type: 'rumble', height: 8, roughness: 1.25 },
    },
    trace: [
      [360, 230], [620, 185], [790, 340], [1030, 235], [1300, 290],
      [1510, 470], [1370, 640], [1545, 800], [1190, 930], [965, 790],
      [760, 935], [565, 780], [350, 870], [245, 650], [430, 520],
      [305, 360], [360, 230],
    ],
  }),
];
