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
      <div class="car-spec">
        최고속도: ${car.topSpeed}<br>
        0-100&nbsp;&nbsp;: ${car.acceleration}<br>
        핸들링&nbsp;&nbsp;: ${car.handling}
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

// ── mini car drawing ─────────────────────────────────────────
function _drawCarPreview(canvas, car) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const bw = 90, bh = 30;

  // body
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(cx - bw/2, cy - bh/2, bw, bh, 6);
  ctx.fill();

  // cockpit
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(cx - 12, cy - bh/2 + 4, 24, bh/2 - 2, 3);
  ctx.fill();

  // nose tip
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(cx + bw/2, cy - 8, 8, 16, 2);
  ctx.fill();

  // wheels
  ctx.fillStyle = '#111';
  [
    [cx - bw/2 + 2,  cy - bh/2 - 3],
    [cx + bw/2 - 14, cy - bh/2 - 3],
    [cx - bw/2 + 2,  cy + bh/2 - 5],
    [cx + bw/2 - 14, cy + bh/2 - 5],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.roundRect(x, y, 14, 8, 2);
    ctx.fill();
  });
}
