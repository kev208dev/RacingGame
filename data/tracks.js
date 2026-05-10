// Procedural F1-inspired tracks built as smooth polar curves with localized
// "bumps" (Gaussian perturbations of the radius). The smoothness guarantees
// that the perpendicular wall offset never self-intersects, so the track is
// always drivable end-to-end.

function buildPolarCenterline({ baseR, bumps, segments = 220 }) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    let r = baseR;
    for (const b of bumps) {
      let da = a - b.angle;
      while (da >  Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      r += b.amp * Math.exp(-(da * da) / (b.width * b.width));
    }
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
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
  return { outer, inner };
}

function makeCircuit({
  id, name, length, difficulty, desc,
  baseR, bumps, width,
  segments = 220, startBackOffset = 130,
}) {
  const center = buildPolarCenterline({ baseR, bumps, segments });
  const { outer, inner } = offsetWalls(center, width);

  const N = center.length;
  const sc      = center[0];
  const scNext  = center[1];
  const sAngle  = Math.atan2(scNext.y - sc.y, scNext.x - sc.x);
  const halfW   = width * 0.55;
  const perpDx  = -Math.sin(sAngle);
  const perpDy  =  Math.cos(sAngle);

  // Spawn N segments behind the start line, exactly on the centerline so the
  // car always starts on the track regardless of curve geometry.
  const backSeg = Math.max(2, Math.round(startBackOffset / (2 * Math.PI * baseR / N)));
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
    });
  }

  return {
    id, name, length, difficulty, desc,
    width,
    outerBoundary: outer,
    innerBoundary: inner,
    centerLine: center.map(c => [c.x, c.y]),
    startLine,
    sectors,
    startPos,
    backgroundColor: '#4f554d',
    trackColor:      '#3a3a3a',
  };
}

// Bump shorthand: { a:angle, w:width, amp:radius-perturb }
const B = (a, w, amp) => ({ angle: a, width: w, amp });

export const TRACKS = [
  makeCircuit({
    id: 'spa', name: 'Spa-Francorchamps',
    length: '약 7 km', difficulty: '어려움',
    desc: '오뤼주, 라디용, 부스 스탑 시케인의 클래식 서킷',
    baseR: 3400, width: 130, segments: 240, startBackOffset: 150,
    bumps: [
      B(0.10, 0.18, -380),  // La Source
      B(0.80, 0.30,  500),  // Eau Rouge → Kemmel straight (long sweep out)
      B(2.00, 0.20, -350),  // Les Combes chicane
      B(2.60, 0.30,  280),  // sweep
      B(3.60, 0.35, -380),  // Pouhon
      B(4.50, 0.25,  300),  // Stavelot
      B(5.40, 0.20, -260),  // Bus Stop chicane
    ],
  }),
  makeCircuit({
    id: 'suzuka', name: 'Suzuka Circuit',
    length: '약 6 km', difficulty: '어려움',
    desc: '에세스, 스푼, 130R로 이어지는 8자형 테크니컬',
    baseR: 3100, width: 115, segments: 220, startBackOffset: 130,
    bumps: [
      B(0.40, 0.18, -260),  // T1
      B(0.85, 0.12,  220),  // S1
      B(1.10, 0.12, -200),  // S2
      B(1.40, 0.12,  220),  // S3
      B(2.20, 0.20, -300),  // Degner
      B(3.40, 0.30,  350),  // back stretch
      B(4.30, 0.25, -340),  // Spoon
      B(5.20, 0.18,  240),  // 130R
      B(5.80, 0.18, -240),  // Casio chicane
    ],
  }),
  makeCircuit({
    id: 'monaco', name: 'Circuit de Monaco',
    length: '약 4 km', difficulty: '매우 어려움',
    desc: '극도로 좁은 시가지 — 풀 코너와 Loews 헤어핀',
    baseR: 2500, width: 90, segments: 220, startBackOffset: 110,
    bumps: [
      B(0.40, 0.15, -220),  // Sainte Devote
      B(0.90, 0.20,  240),  // Massenet
      B(1.40, 0.18, -300),  // Loews
      B(2.00, 0.15,  220),  // tunnel approach
      B(2.80, 0.18, -260),  // Nouvelle chicane
      B(3.50, 0.15,  200),  // Tabac
      B(4.10, 0.15, -200),  // pool L
      B(4.50, 0.15,  200),  // pool R
      B(5.30, 0.20, -220),  // Rascasse
      B(5.80, 0.15,  180),
    ],
  }),
  makeCircuit({
    id: 'silverstone', name: 'Silverstone',
    length: '약 6 km', difficulty: '보통',
    desc: '매기츠/베킷츠 고속 에세스가 매력',
    baseR: 3300, width: 140, segments: 220, startBackOffset: 150,
    bumps: [
      B(0.30, 0.25,  300),  // Abbey/Village
      B(1.20, 0.18, -260),  // Loop
      B(1.90, 0.15,  240),  // Maggotts
      B(2.20, 0.15, -240),  // Becketts
      B(2.50, 0.15,  240),  // Chapel
      B(3.50, 0.30,  350),  // Hangar straight
      B(4.40, 0.20, -300),  // Stowe
      B(5.30, 0.20, -250),  // Vale/Club
    ],
  }),
  makeCircuit({
    id: 'monza', name: 'Autodromo di Monza',
    length: '약 6 km', difficulty: '보통',
    desc: '긴 직선 + 3개 시케인 — 슬립스트림의 성지',
    baseR: 3500, width: 145, segments: 220, startBackOffset: 160,
    bumps: [
      B(0.25, 0.15, -340),  // Variante del Rettifilo
      B(1.50, 0.40,  500),  // Curva Grande / long sweep
      B(3.00, 0.18, -340),  // Variante della Roggia
      B(3.80, 0.20, -260),  // Lesmo 1
      B(4.20, 0.18, -240),  // Lesmo 2
      B(5.10, 0.18, -300),  // Variante Ascari
      B(5.70, 0.30,  350),  // Curva Parabolica
    ],
  }),
  makeCircuit({
    id: 'interlagos', name: 'Autódromo José Carlos Pace',
    length: '약 5 km', difficulty: '어려움',
    desc: '세나의 S와 Junção, 짧고 응축된 흐름',
    baseR: 2900, width: 120, segments: 220, startBackOffset: 135,
    bumps: [
      B(0.40, 0.18, -280),  // Senna S in
      B(0.80, 0.18,  220),  // Senna S out
      B(1.80, 0.30,  300),  // back stretch
      B(2.80, 0.20, -300),  // Ferradura
      B(3.60, 0.20,  240),  // Junção
      B(4.40, 0.18, -250),  // Mergulho
      B(5.20, 0.20,  240),  // Pinheirinho
      B(5.80, 0.20, -220),
    ],
  }),
  makeCircuit({
    id: 'imola', name: 'Imola — A. E. Dino Ferrari',
    length: '약 5 km', difficulty: '어려움',
    desc: '탐부렐로, 토사, 리바차의 좁고 정밀한 테크니컬',
    baseR: 2800, width: 105, segments: 220, startBackOffset: 125,
    bumps: [
      B(0.35, 0.20,  240),  // Tamburello (now chicane)
      B(0.85, 0.18, -260),  // Villeneuve
      B(1.50, 0.20, -300),  // Tosa
      B(2.40, 0.25,  280),  // Piratella
      B(3.30, 0.18, -260),  // Acque Minerali
      B(4.10, 0.18, -240),  // Variante Alta
      B(4.80, 0.20, -260),  // Rivazza 1
      B(5.20, 0.18,  220),  // Rivazza 2
    ],
  }),
  makeCircuit({
    id: 'hungaroring', name: 'Hungaroring',
    length: '약 4 km', difficulty: '어려움',
    desc: '직선이 거의 없는 꼬임의 연속',
    baseR: 2600, width: 100, segments: 220, startBackOffset: 120,
    bumps: [
      B(0.30, 0.18, -220),  // T1
      B(0.80, 0.18,  220),
      B(1.30, 0.18, -220),  // T3 hairpin
      B(1.90, 0.18,  200),
      B(2.50, 0.18, -200),
      B(3.20, 0.20, -220),
      B(3.80, 0.18,  200),
      B(4.40, 0.18, -200),
      B(5.00, 0.18,  220),
      B(5.70, 0.18, -200),
    ],
  }),
  makeCircuit({
    id: 'bahrain', name: 'Bahrain International Circuit',
    length: '약 6 km', difficulty: '보통',
    desc: '빠른 직선과 느린 헤어핀이 교차',
    baseR: 3200, width: 130, segments: 220, startBackOffset: 145,
    bumps: [
      B(0.40, 0.20, -300),  // T1 hairpin sequence
      B(0.80, 0.18,  240),
      B(1.30, 0.18, -260),  // T4
      B(2.20, 0.30,  320),  // back stretch
      B(3.20, 0.25, -300),  // T8
      B(4.00, 0.20,  240),
      B(4.80, 0.20, -240),  // T11 chicane
      B(5.40, 0.18,  220),
      B(5.90, 0.18, -200),
    ],
  }),
  makeCircuit({
    id: 'singapore', name: 'Marina Bay Street Circuit',
    length: '약 5 km', difficulty: '어려움',
    desc: '시가지 야간 레이스 — 좁은 코너의 연속',
    baseR: 2700, width: 105, segments: 220, startBackOffset: 130,
    bumps: [
      B(0.30, 0.15, -240),
      B(0.70, 0.15,  220),
      B(1.20, 0.15, -240),
      B(1.70, 0.18,  220),
      B(2.30, 0.20, -260),
      B(3.00, 0.20,  280),
      B(3.70, 0.18, -240),
      B(4.30, 0.15,  200),
      B(4.80, 0.18, -240),
      B(5.40, 0.20,  240),
      B(5.90, 0.15, -200),
    ],
  }),
];
