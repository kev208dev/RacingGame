import { CAR_DATA } from '../data/cars.js';

let selectedIndex    = 0;
let selectedCategory = 'All';
let onSelect         = null;

const CATEGORIES = ['All', 'GT3', 'Prototype', 'Road Car'];

export function initCarSelect(cb) {
  onSelect         = cb;
  selectedIndex    = 0;
  selectedCategory = 'All';
  _render();
}

// ── helpers ─────────────────────────────────────────────────
function _filtered() {
  return CAR_DATA.filter(c =>
    selectedCategory === 'All' || c.category === selectedCategory
  );
}

function _render() {
  // ── category tabs ──
  const tabsEl = document.getElementById('cat-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat === selectedCategory ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => { selectedCategory = cat; _render(); });
      tabsEl.appendChild(btn);
    });
  }

  // ── car grid ──
  const grid = document.getElementById('car-grid');
  if (!grid) return;
  grid.innerHTML = '';

  _filtered().forEach(car => {
    const idx  = CAR_DATA.indexOf(car);
    const card = document.createElement('div');
    card.className = 'car-card' + (idx === selectedIndex ? ' selected' : '');

    // mini preview canvas
    const previewDiv = document.createElement('div');
    previewDiv.className = 'car-preview';
    previewDiv.style.background = car.color + '22';
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 70;
    _drawCarPreview(cv, car);
    previewDiv.appendChild(cv);

    card.appendChild(previewDiv);
    card.insertAdjacentHTML('beforeend', `
      <div class="car-name">${car.name}</div>
      <span class="car-badge">${car.category}</span>
      <div class="car-tags">
        <span>${car.driveType}</span>
        <span>${car.power} hp</span>
      </div>
      <div class="car-spec">
        ${_statRow('속도', car.maxSpeed / 340)}
        ${_statRow('가속', (5.0 - parseFloat(car.acceleration)) / 2.2)}
        ${_statRow('그립', car.grip / 2.2)}
      </div>
    `);

    card.addEventListener('click', () => { selectedIndex = idx; _render(); });
    grid.appendChild(card);
  });

  // ── description ──
  const descEl = document.getElementById('car-desc');
  const selCar = CAR_DATA[selectedIndex];
  if (descEl && selCar) descEl.textContent = selCar.description;

  // ── confirm button ──
  const btn = document.getElementById('btn-to-track');
  if (btn) btn.onclick = () => { if (onSelect) onSelect(CAR_DATA[selectedIndex]); };
}

function _statRow(label, value) {
  const pct = Math.max(8, Math.min(100, Math.round(value * 100)));
  return `
    <div class="stat-row">
      <span>${label}</span>
      <b><i style="width:${pct}%"></i></b>
    </div>
  `;
}

// ── mini car drawing ─────────────────────────────────────────
function _drawCarPreview(canvas, car) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2 + 4;
  const isFormula = car.category !== 'Road Car';
  const bw = isFormula ? 104 : 92;
  const bh = isFormula ? 24 : 34;

  const grad = ctx.createLinearGradient(16, 8, w - 12, h - 4);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 10);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.08);
  ctx.translate(-cx, -cy);

  // body
  ctx.fillStyle = car.color;
  ctx.beginPath();
  if (isFormula) {
    ctx.roundRect(cx - bw/2 + 10, cy - bh/2, bw - 18, bh, 9);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + bw/2 - 10, cy - 9);
    ctx.lineTo(cx + bw/2 + 20, cy);
    ctx.lineTo(cx + bw/2 - 10, cy + 9);
    ctx.closePath();
  } else {
    ctx.roundRect(cx - bw/2, cy - bh/2, bw, bh, 9);
  }
  ctx.fill();

  // cockpit
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(cx - 4, cy - bh/2 + 3, 28, isFormula ? 14 : 18, 5);
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.fillRect(cx - bw/2 - 12, cy - 2, 20, 4);
  if (isFormula) {
    ctx.fillRect(cx + bw/2 - 2, cy - 14, 26, 5);
    ctx.fillRect(cx + bw/2 - 2, cy + 9, 26, 5);
    ctx.fillRect(cx - bw/2 - 18, cy - 16, 22, 6);
    ctx.fillRect(cx - bw/2 - 18, cy + 10, 22, 6);
  }

  ctx.strokeStyle = '#ffd84a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - bw/2 + 14, cy);
  ctx.lineTo(cx + bw/2 + (isFormula ? 14 : -8), cy);
  ctx.stroke();

  // wheels
  ctx.fillStyle = '#111';
  [
    [cx - bw/2 + 4,  cy - bh/2 - 5],
    [cx + bw/2 - 20, cy - bh/2 - 5],
    [cx - bw/2 + 4,  cy + bh/2 - 5],
    [cx + bw/2 - 20, cy + bh/2 - 5],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.roundRect(x, y, 18, 10, 4);
    ctx.fill();
  });
  ctx.restore();
}
