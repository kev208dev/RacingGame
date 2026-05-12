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
  for (let pass = 0; pass < 3; pass++) {
    const nextPts = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      nextPts.push({
        x: a.x * 0.72 + b.x * 0.28,
        y: a.y * 0.72 + b.y * 0.28,
      });
      nextPts.push({
        x: a.x * 0.28 + b.x * 0.72,
        y: a.y * 0.28 + b.y * 0.72,
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

const TRACK_WIDTH_MULT = 1.28;

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
  const effectiveWidth = width * TRACK_WIDTH_MULT;
  const center = buildSourceCenterline(trace, sourceSize, scale);
  const { outer, inner } = offsetWalls(center, effectiveWidth);

  const N = center.length;
  const sc = center[0];
  const scNext = center[1];
  const sAngle = Math.atan2(scNext.y - sc.y, scNext.x - sc.x);
  const halfW = effectiveWidth * 0.58;
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
    width: effectiveWidth,
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
    id: 'albert_park',
    name: 'Albert Park Circuit',
    length: '5.278 km',
    difficulty: '보통',
    desc: 'Australian Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '호수 주변 고속 리듬 + 빠른 9-10번 코너',
    width: 136,
    scale: 2.75,
    startBackOffset: 160,
    sourceSize: { width: 1940, height: 1083 },
    theme: { accent: '#79b8ff', sector1: '#22c55e', sector2: '#facc15', map: '#f3f8ff' },
    info: {
      country: 'Australia',
      gpName: 'Australian Grand Prix',
      laps: 58,
      turns: 14,
      elevationChangeM: 8,
      firstGrandPrix: 1996,
      fastestLapRecord: '1:19.813',
      fastestLapDriver: 'Charles Leclerc',
      polePositionRecord: '1:15.096',
      polePositionDriver: 'Lando Norris',
      mostWinsDriver: 'Michael Schumacher',
      mostWinsCount: 4,
      iconicMomentTitle: "2002: Webber's Dream Debut",
      famousCorners: ['Turn 9-10', 'Turn 1'],
      sourceUrl: 'https://f1-circuits.com/circuits/albert-park-circuit',
    },
    trace: [
      [520, 850], [1340, 825], [1750, 700], [1620, 520], [1180, 520],
      [850, 180], [520, 145], [185, 230], [380, 420], [620, 560],
      [900, 720], [520, 850],
    ],
  }),
  makeOfficialCircuit({
    id: 'barcelona_catalunya',
    name: 'Circuit de Barcelona-Catalunya',
    length: '4.657 km',
    difficulty: '어려움',
    desc: 'Spanish Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '긴 메인 스트레이트 + Turn 3 고속 우코너',
    width: 132,
    scale: 2.7,
    startBackOffset: 170,
    sourceSize: { width: 1935, height: 1080 },
    theme: { accent: '#ef4444', sector1: '#facc15', sector2: '#22c55e', map: '#fff2f2' },
    info: {
      country: 'Spain',
      gpName: 'Spanish Grand Prix',
      laps: 66,
      turns: 14,
      elevationChangeM: 30,
      firstGrandPrix: 1991,
      fastestLapRecord: '1:16.330',
      fastestLapDriver: 'Max Verstappen',
      polePositionRecord: '1:12.272',
      polePositionDriver: 'Lewis Hamilton',
      mostWinsDriver: 'Lewis Hamilton/Michael Schumacher',
      mostWinsCount: 6,
      iconicMomentTitle: "2016: Verstappen's Maiden Win",
      famousCorners: ['Turn 3', 'Turn 10 (La Caixa)'],
      sourceUrl: 'https://f1-circuits.com/circuits/circuit-de-barcelona-catalunya',
    },
    trace: [
      [295, 790], [1810, 790], [1840, 395], [1540, 295], [1440, 460],
      [1660, 625], [1480, 710], [1060, 480], [955, 275], [825, 340],
      [735, 630], [520, 650], [260, 455], [295, 790],
    ],
  }),
  makeOfficialCircuit({
    id: 'cota',
    name: 'Circuit of the Americas',
    length: '5.513 km',
    difficulty: '어려움',
    desc: 'United States Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '가파른 Turn 1 + Maggotts/Becketts식 고속 연속 코너',
    width: 136,
    scale: 2.65,
    startBackOffset: 165,
    sourceSize: { width: 1935, height: 1080 },
    theme: { accent: '#3b82f6', sector1: '#ef4444', sector2: '#facc15', map: '#eff6ff' },
    info: {
      country: 'USA',
      gpName: 'United States Grand Prix',
      laps: 56,
      turns: 20,
      elevationChangeM: 41,
      firstGrandPrix: 2012,
      fastestLapRecord: '1:36.169',
      fastestLapDriver: 'Charles Leclerc',
      polePositionRecord: '1:32.029',
      polePositionDriver: 'Valtteri Bottas',
      mostWinsDriver: 'Lewis Hamilton',
      mostWinsCount: 5,
      iconicMomentTitle: '2015: Hamilton Clinches Third Title',
      famousCorners: ['Turn 1', 'Turns 3-6 (Maggotts/Becketts copy)'],
      sourceUrl: 'https://f1-circuits.com/circuits/circuit-of-the-americas',
    },
    trace: [
      [675, 1010], [615, 820], [760, 640], [1000, 470], [1220, 485],
      [1450, 415], [1840, 145], [1350, 235], [740, 255], [790, 450],
      [635, 360], [655, 620], [510, 650], [390, 430], [100, 500],
      [300, 740], [540, 1018], [675, 1010],
    ],
  }),
  makeOfficialCircuit({
    id: 'hungaroring',
    name: 'Hungaroring',
    length: '4.381 km',
    difficulty: '어려움',
    desc: 'Hungarian Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '좁고 비틀린 중저속 코너 + 추월이 어려운 흐름',
    width: 132,
    scale: 2.85,
    startBackOffset: 145,
    sourceSize: { width: 1935, height: 1080 },
    theme: { accent: '#22c55e', sector1: '#facc15', sector2: '#ef4444', map: '#f0fdf4' },
    info: {
      country: 'Hungary',
      gpName: 'Hungarian Grand Prix',
      laps: 70,
      turns: 14,
      elevationChangeM: 36,
      firstGrandPrix: 1986,
      fastestLapRecord: '1:16.627',
      fastestLapDriver: 'Lewis Hamilton',
      polePositionRecord: '1:13.447',
      polePositionDriver: 'Lewis Hamilton',
      mostWinsDriver: 'Lewis Hamilton',
      mostWinsCount: 8,
      iconicMomentTitle: "1997: Hill's Heartbreak",
      famousCorners: ['Turn 1', 'Turn 4'],
      sourceUrl: 'https://f1-circuits.com/circuits/hungaroring',
    },
    trace: [
      [615, 70], [725, 470], [860, 385], [1180, 330], [1480, 135],
      [1550, 390], [1400, 570], [1450, 700], [1225, 965], [800, 940],
      [730, 710], [650, 900], [615, 70],
    ],
  }),
];
