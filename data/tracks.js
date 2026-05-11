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
    width: 118,
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
      [323, 83], [505, 83], [715, 84], [960, 84], [1230, 84], [1508, 84],
      [1668, 84], [1697, 178], [1766, 207], [1711, 241], [1688, 370],
      [1608, 575], [1518, 820], [1482, 871], [1518, 914], [1435, 1005],
      [1379, 965], [1378, 646], [1261, 566], [1218, 512], [1080, 512],
      [1017, 497], [984, 430], [826, 380], [641, 375], [421, 375],
      [398, 265], [360, 228], [330, 238], [303, 270], [225, 252],
      [192, 224], [224, 117], [323, 83],
    ],
  }),
  makeOfficialCircuit({
    id: 'albert_park',
    name: 'Albert Park Circuit',
    length: '5.278 km',
    difficulty: '보통',
    desc: 'Australian Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '호수 주변 고속 리듬 + 빠른 9-10번 코너',
    width: 116,
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
      [532, 850], [770, 846], [1016, 840], [1216, 834], [1342, 827],
      [1335, 725], [1462, 745], [1635, 790], [1745, 750], [1804, 632],
      [1695, 548], [1500, 530], [1200, 555], [1110, 500], [980, 360],
      [855, 180], [660, 96], [520, 145], [320, 210], [185, 230],
      [178, 285], [250, 360], [430, 420], [550, 540], [674, 590],
      [560, 750], [300, 780], [532, 850],
    ],
  }),
  makeOfficialCircuit({
    id: 'barcelona_catalunya',
    name: 'Circuit de Barcelona-Catalunya',
    length: '4.657 km',
    difficulty: '어려움',
    desc: 'Spanish Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '긴 메인 스트레이트 + Turn 3 고속 우코너',
    width: 94,
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
      [296, 790], [610, 790], [930, 789], [1245, 788], [1510, 787],
      [1815, 787], [1850, 760], [1840, 390], [1540, 293], [1468, 430],
      [1595, 510], [1678, 630], [1472, 545], [1045, 480], [955, 275],
      [850, 330], [760, 585], [535, 650], [260, 455], [296, 790],
    ],
  }),
  makeOfficialCircuit({
    id: 'cota',
    name: 'Circuit of the Americas',
    length: '5.513 km',
    difficulty: '어려움',
    desc: 'United States Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '가파른 Turn 1 + Maggotts/Becketts식 고속 연속 코너',
    width: 112,
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
      [676, 1010], [625, 820], [675, 720], [790, 640], [875, 555],
      [950, 470], [1085, 425], [1215, 486], [1322, 430], [1360, 368],
      [1418, 425], [1600, 420], [1840, 145], [1620, 190], [1350, 235],
      [742, 252], [790, 440], [826, 455], [760, 475], [705, 340],
      [620, 345], [660, 625], [590, 665], [490, 625], [390, 430],
      [100, 500], [300, 740], [540, 1018], [676, 1010],
    ],
  }),
  makeOfficialCircuit({
    id: 'hungaroring',
    name: 'Hungaroring',
    length: '4.381 km',
    difficulty: '어려움',
    desc: 'Hungarian Grand Prix 공식 페이지 맵 방향 그대로 적용',
    character: '좁고 비틀린 중저속 코너 + 추월이 어려운 흐름',
    width: 110,
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
      [615, 70], [710, 225], [735, 470], [808, 500], [870, 372],
      [1050, 330], [1340, 292], [1452, 128], [1570, 155], [1535, 420],
      [1395, 560], [1460, 700], [1225, 965], [800, 940], [815, 725],
      [740, 700], [675, 900], [620, 900], [615, 70],
    ],
  }),
];
