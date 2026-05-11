import { CAR_DATA } from '../data/cars.js';
import { clearPaintJob, getPaintJob, savePaintJob } from '../utils/storage.js';
import { isCarUnlocked, unlockProgressText, unlockText } from '../utils/unlocks.js';
import { getProfile, onProfileChange, purchaseCar } from '../utils/profile.js';

let selectedIndex    = 0;
let selectedCategory = 'All';
let onSelect         = null;
let profileUnsub     = null;

const CATEGORIES = ['All', 'GT3', 'Lightweight', 'Prototype', 'Road Car', 'Heavyweight', 'Formula'];

export function initCarSelect(cb) {
  onSelect         = cb;
  selectedIndex    = 0;
  selectedCategory = 'All';
  if (!profileUnsub) profileUnsub = onProfileChange(() => _render());
  _render();
}

// ── helpers ─────────────────────────────────────────────────
function _filtered() {
  return CAR_DATA.filter(c =>
    selectedCategory === 'All' || c.category === selectedCategory
  );
}

function _render() {
  _wirePaintPanel();
  if (_isLocked(CAR_DATA[selectedIndex])) {
    const firstOpen = CAR_DATA.findIndex(car => !_isLocked(car));
    if (firstOpen >= 0) selectedIndex = firstOpen;
  }

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
    const locked = _isLocked(car);
    card.className = 'car-card' + (idx === selectedIndex ? ' selected' : '') + (locked ? ' locked' : '');

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
      <span class="car-badge">${locked ? 'SHOP' : car.rarity || car.category}</span>
      <div class="car-tags">
        <span>${car.driveType}</span>
        <span>${car.power} hp</span>
        <span>${locked ? `${Number(car.price || 0).toLocaleString()} C` : 'OWNED'}</span>
        ${getPaintJob(car.id) ? '<span>PHOTO PAINT</span>' : ''}
      </div>
      <div class="car-spec">
        ${_statRow('속도', car.maxSpeed / 340)}
        ${_statRow('가속', (5.0 - parseFloat(car.acceleration)) / 2.2)}
        ${_statRow('그립', car.grip / 2.2)}
        ${_statRow('부스트', ((car.boostChargeRate || 12) / Math.max(1, car.boostCost || 40)) * 1.35)}
      </div>
    `);

    if (locked) {
      const lock = document.createElement('div');
      lock.className = 'car-lock';
      const profile = getProfile();
      const price = Number(car.price || 0);
      const canBuy = !!profile && (profile.coins || 0) >= price;
      lock.innerHTML = `
        <b>${unlockText(car)}</b>
        <span>${unlockProgressText(car)}</span>
        <button class="btn-secondary btn-small car-buy" type="button">${canBuy ? '구매' : '잠김'}</button>
      `;
      const buy = lock.querySelector('.car-buy');
      buy.disabled = !canBuy;
      buy.addEventListener('click', async event => {
        event.stopPropagation();
        try {
          buy.textContent = '구매 중...';
          await purchaseCar(car);
          selectedIndex = idx;
          _render();
        } catch (error) {
          buy.textContent = error?.message === 'login-required' ? '로그인 필요' : '코인 부족';
          setTimeout(() => _render(), 900);
        }
      });
      card.appendChild(lock);
    }

    card.addEventListener('click', () => {
      if (locked) {
        const descEl = document.getElementById('car-desc');
        if (descEl) descEl.textContent = `${car.name} 잠금해제 조건: ${unlockText(car)}. ${unlockProgressText(car)}.`;
        return;
      }
      selectedIndex = idx;
      _render();
    });
    grid.appendChild(card);
  });

  // ── description ──
  const descEl = document.getElementById('car-desc');
  const selCar = CAR_DATA[selectedIndex];
  if (descEl && selCar) descEl.textContent = selCar.description;

  // ── confirm button ──
  const btn = document.getElementById('btn-to-track');
  if (btn) btn.onclick = () => {
    const car = CAR_DATA[selectedIndex];
    if (_isLocked(car)) return;
    if (onSelect) onSelect(car);
  };
}

function _isLocked(car) {
  return !car || !isCarUnlocked(car);
}

function _wirePaintPanel() {
  const input = document.getElementById('paint-upload');
  const upload = document.getElementById('btn-paint-upload');
  const clear = document.getElementById('btn-paint-clear');
  const status = document.getElementById('paint-status');
  const car = CAR_DATA[selectedIndex];
  if (!input || !upload || !clear || !car) return;

  upload.onclick = () => input.click();
  clear.onclick = () => {
    clearPaintJob(car.id);
    if (status) status.textContent = `${car.name} 도색을 지웠습니다.`;
    _render();
  };
  input.onchange = async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      if (status) status.textContent = '이미지 파일만 사용할 수 있습니다.';
      return;
    }
    const dataUrl = await _fileToDataUrl(file);
    const color = await _averageImageColor(dataUrl);
    savePaintJob(car.id, dataUrl, color);
    if (status) status.textContent = `${car.name}에 사진 도색을 적용했습니다.`;
    _render();
  };
}

function _averageImageColor(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = 16;
      cv.height = 16;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 20) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (!n) return resolve('#eeeeee');
      const hex = v => Math.max(0, Math.min(255, Math.round(v / n))).toString(16).padStart(2, '0');
      resolve(`#${hex(r)}${hex(g)}${hex(b)}`);
    };
    img.onerror = () => resolve('#eeeeee');
    img.src = dataUrl;
  });
}

function _fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  const cx = w / 2, cy = h / 2 + 7;
  const paint = car._skipPaint ? null : getPaintJob(car.id);
  const isLight = car.category === 'Lightweight';
  const isHeavy = car.category === 'Heavyweight';
  const isFormula = car.category === 'Formula';
  const bw = isLight ? 96 : isHeavy ? 124 : isFormula ? 118 : 110;
  const bh = isLight ? 28 : isHeavy ? 38 : isFormula ? 26 : 34;

  const grad = ctx.createLinearGradient(16, 8, w - 12, h - 4);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 10);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.06);
  ctx.translate(-cx, -cy);

  const bodyGrad = ctx.createLinearGradient(cx - bw / 2, cy - bh, cx + bw / 2, cy + bh);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.22, car.color);
  bodyGrad.addColorStop(1, '#11151b');

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bh / 2 + 9, bw * 0.48, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // sports-car silhouette
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, cy + bh * 0.22);
  ctx.bezierCurveTo(cx - bw * 0.42, cy - bh * 0.28, cx - bw * 0.24, cy - bh * 0.62, cx - bw * 0.02, cy - bh * 0.62);
  ctx.bezierCurveTo(cx + bw * 0.22, cy - bh * 0.62, cx + bw * 0.36, cy - bh * 0.2, cx + bw / 2, cy + bh * 0.15);
  ctx.bezierCurveTo(cx + bw * 0.42, cy + bh * 0.48, cx - bw * 0.38, cy + bh * 0.48, cx - bw / 2, cy + bh * 0.22);
  ctx.closePath();
  ctx.fill();

  if (paint) {
    const img = new Image();
    img.onload = () => {
      _drawCarPreview(canvas, { ...car, _skipPaint: true });
      const ctx2 = canvas.getContext('2d');
      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.rotate(-0.06);
      ctx2.globalAlpha = 0.86;
      ctx2.globalCompositeOperation = 'source-over';
      ctx2.drawImage(img, -bw / 2, -bh / 2 - 8, bw, bh + 20);
      ctx2.globalAlpha = 1;
      ctx2.restore();
    };
    if (!car._skipPaint) img.src = paint;
  }

  // glass canopy
  const glass = ctx.createLinearGradient(cx - 18, cy - bh, cx + 34, cy);
  glass.addColorStop(0, 'rgba(150,210,255,0.78)');
  glass.addColorStop(1, 'rgba(3,8,16,0.84)');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy - bh * 0.28, isFormula ? 22 : 28, isFormula ? 8 : 11, -0.02, 0, Math.PI * 2);
  ctx.fill();

  // aero / stripe
  ctx.strokeStyle = isFormula ? '#f7f7f7' : '#ffd84a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.42, cy + bh * 0.02);
  ctx.bezierCurveTo(cx - bw * 0.1, cy - bh * 0.18, cx + bw * 0.18, cy - bh * 0.1, cx + bw * 0.42, cy + bh * 0.02);
  ctx.stroke();

  ctx.fillStyle = '#0a0d10';
  ctx.beginPath();
  ctx.roundRect(cx - bw * 0.54, cy + bh * 0.12, 18, 5, 3);
  ctx.roundRect(cx + bw * 0.36, cy + bh * 0.08, 24, 5, 3);
  ctx.fill();
  if (isFormula) {
    ctx.fillRect(cx + bw / 2 - 2, cy - 13, 25, 5);
    ctx.fillRect(cx - bw / 2 - 16, cy - 12, 24, 5);
  }

  // wheels
  const wheelR = isHeavy ? 13 : isLight ? 9 : 11;
  [
    [cx - bw * 0.34, cy + bh * 0.36],
    [cx + bw * 0.34, cy + bh * 0.36],
  ].forEach(([x, y]) => {
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(x, y, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = car.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#b8c0c8';
    ctx.beginPath();
    ctx.arc(x, y, wheelR * 0.38, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
