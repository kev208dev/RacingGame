import { CAR_DATA } from '../data/cars.js';
import { clearPaintJob, getPaintJob, savePaintJob } from '../utils/storage.js';
import { getCurrentUser, isLoggedIn, onAuthChange, sendMagicLink, signOut } from '../utils/auth.js';
import { isCarUnlocked, unlockProgressText, unlockText } from '../utils/unlocks.js';

let selectedIndex    = 0;
let selectedCategory = 'All';
let onSelect         = null;
let authUnsub        = null;

const CATEGORIES = ['All', 'GT3', 'Lightweight', 'Prototype', 'Road Car', 'Heavyweight', 'Formula'];

export function initCarSelect(cb) {
  onSelect         = cb;
  selectedIndex    = 0;
  selectedCategory = 'All';
  if (!authUnsub) authUnsub = onAuthChange(() => _render());
  _render();
}

// ── helpers ─────────────────────────────────────────────────
function _filtered() {
  return CAR_DATA.filter(c =>
    selectedCategory === 'All' || c.category === selectedCategory
  );
}

function _render() {
  _wireAuthPanel();
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
      <span class="car-badge">${locked ? 'TIME LOCK' : car.category}</span>
      <div class="car-tags">
        <span>${car.driveType}</span>
        <span>${car.power} hp</span>
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
      lock.innerHTML = `
        <b>${unlockText(car)}</b>
        <span>${unlockProgressText(car)}</span>
      `;
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
  return !isCarUnlocked(car);
}

function _wireAuthPanel() {
  const email = document.getElementById('auth-email');
  const login = document.getElementById('btn-auth-login');
  const logout = document.getElementById('btn-auth-logout');
  const status = document.getElementById('auth-status');
  const user = getCurrentUser();
  if (status) status.textContent = user ? `${user.email} 로그인됨` : '로그인은 랭킹 계정용';
  if (email) email.classList.toggle('hidden', !!user);
  if (login) {
    login.classList.toggle('hidden', !!user);
    login.onclick = async () => {
      if (status) status.textContent = '로그인 메일 보내는 중...';
      try {
        await sendMagicLink(email?.value || '');
        if (status) status.textContent = '메일의 로그인 링크를 확인하세요.';
      } catch {
        if (status) status.textContent = '로그인 메일 전송 실패';
      }
    };
  }
  if (logout) {
    logout.classList.toggle('hidden', !user);
    logout.onclick = async () => {
      await signOut();
      _render();
    };
  }
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

  const cx = w / 2, cy = h / 2 + 4;
  const paint = car._skipPaint ? null : getPaintJob(car.id);
  const isFormula = car.category !== 'Road Car' && car.category !== 'Heavyweight';
  const isLight = car.category === 'Lightweight';
  const isHeavy = car.category === 'Heavyweight';
  const bw = isLight ? 84 : isHeavy ? 116 : isFormula ? 104 : 92;
  const bh = isLight ? 20 : isHeavy ? 42 : isFormula ? 24 : 34;

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
  if (paint) {
    const img = new Image();
    img.onload = () => {
      _drawCarPreview(canvas, { ...car, _skipPaint: true });
      const ctx2 = canvas.getContext('2d');
      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.rotate(-0.08);
      ctx2.globalAlpha = 0.92;
      ctx2.globalCompositeOperation = 'source-over';
      ctx2.drawImage(img, -bw / 2 - 6, -bh / 2 - 8, bw + 28, bh + 20);
      ctx2.globalAlpha = 1;
      ctx2.strokeStyle = '#ffffff';
      ctx2.lineWidth = 2;
      ctx2.strokeRect(-bw / 2 - 2, -bh / 2 - 4, bw + 20, bh + 12);
      ctx2.restore();
    };
    if (!car._skipPaint) img.src = paint;
  }

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
  const wheelW = isHeavy ? 24 : isLight ? 14 : 18;
  const wheelH = isHeavy ? 14 : isLight ? 8 : 10;
  [
    [cx - bw/2 + 4,  cy - bh/2 - 5],
    [cx + bw/2 - 20, cy - bh/2 - 5],
    [cx - bw/2 + 4,  cy + bh/2 - 5],
    [cx + bw/2 - 20, cy + bh/2 - 5],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.roundRect(x, y, wheelW, wheelH, 4);
    ctx.fill();
  });
  ctx.restore();
}
