import { TRACKS } from '../data/tracks.js';

let selectedIndex = 0;
let onSelect      = null;
let onBack        = null;

export function initTrackSelect(cb, backCb) {
  onSelect      = cb;
  onBack        = backCb;
  selectedIndex = 0;
  _render();
}

// ── render ───────────────────────────────────────────────────
function _render() {
  const grid = document.getElementById('track-grid');
  if (!grid) return;
  grid.innerHTML = '';

  TRACKS.forEach((track, i) => {
    const card = document.createElement('div');
    card.className = 'track-card' + (i === selectedIndex ? ' selected' : '');

    // mini-map canvas
    const cv = document.createElement('canvas');
    cv.className = 'track-map';
    cv.width  = 320;
    cv.height = 190;
    _drawMiniMap(cv, track);
    card.appendChild(cv);

    // info
    const info = document.createElement('div');
    info.className = 'track-info';
    info.innerHTML = `
      <h3>${track.name}</h3>
      <span>${track.length}</span>
      <span>난이도: ${track.difficulty}</span>
      ${track.desc ? `<span class="desc">${track.desc}</span>` : ''}
    `;
    card.appendChild(info);

    if (i === selectedIndex) {
      const badge = document.createElement('span');
      badge.className = 'track-selected-badge';
      badge.textContent = '✓ 선택됨';
      card.appendChild(badge);
    }

    card.addEventListener('click', () => { selectedIndex = i; _render(); });
    grid.appendChild(card);
  });

  // ── buttons ──
  const backBtn  = document.getElementById('btn-back-car');
  const startBtn = document.getElementById('btn-start-game');
  if (backBtn)  backBtn.onclick  = () => { if (onBack)   onBack(); };
  if (startBtn) startBtn.onclick = () => { if (onSelect) onSelect(TRACKS[selectedIndex]); };
}

// ── mini map drawing ─────────────────────────────────────────
function _drawMiniMap(canvas, track) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = track.backgroundColor || '#2d5a1b';
  ctx.fillRect(0, 0, w, h);

  const pts  = track.outerBoundary;
  const xs   = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad  = 16;
  const scale = Math.min((w - pad*2) / (maxX - minX), (h - pad*2) / (maxY - minY));
  const offX  = pad + (w - pad*2 - (maxX - minX) * scale) / 2 - minX * scale;
  const offY  = pad + (h - pad*2 - (maxY - minY) * scale) / 2 - minY * scale;
  const tp    = ([x, y]) => [x * scale + offX, y * scale + offY];

  // track surface (evenodd)
  ctx.beginPath();
  ctx.moveTo(...tp(track.outerBoundary[0]));
  for (const p of track.outerBoundary) ctx.lineTo(...tp(p));
  ctx.closePath();
  ctx.moveTo(...tp(track.innerBoundary[0]));
  for (const p of track.innerBoundary) ctx.lineTo(...tp(p));
  ctx.closePath();
  ctx.fillStyle = track.trackColor || '#3e3e3e';
  ctx.fill('evenodd');

  // outer edge
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(...tp(track.outerBoundary[0]));
  for (const p of track.outerBoundary) ctx.lineTo(...tp(p));
  ctx.closePath();
  ctx.stroke();

  // start line
  if (track.startLine) {
    const sl = track.startLine;
    const [sx1, sy1] = tp([sl.x1, sl.y1]);
    const [sx2, sy2] = tp([sl.x2, sl.y2]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }
}
