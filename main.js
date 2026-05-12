import { initCarSelect }   from './screens/carSelect.js';
import { initTrackSelect }  from './screens/trackSelect.js';
import { TRACKS }           from './data/tracks.js';
import { initGame, updateGame, stopGame } from './screens/game.js';
import { initResults }      from './screens/results.js';
import { initAuth }         from './utils/auth.js';
import { getCurrentUser, onAuthChange, sendMagicLink, signOut } from './utils/auth.js';
import { clearFrameKeys }   from './utils/input.js';
import { formatTime }       from './utils/math.js';
import { CAR_DATA }         from './data/cars.js';
import {
  fetchLeaderboard,
  getPlayerProfile,
  subscribeLeaderboard,
} from './utils/leaderboard.js';
import {
  claimStarterCar,
  getProfile,
  initProfile,
  isProfileLoading,
  onProfileChange,
  rollStarterCar,
  updateProfileSettings,
} from './utils/profile.js';
import { nicknameRejectMessage } from './utils/nicknameFilter.js';

let currentScreen = 'carSelect';
let selectedCar   = null;
let selectedTrack = null;
let lastTime      = 0;

// ── screen helpers ──────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function hideScreens() {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
}

// ── transitions ─────────────────────────────────────────────
function goToCarSelect() {
  currentScreen = 'carSelect';
  showScreen('screen-carselect');
  initCarSelect((car) => {
    selectedCar = car;
    goToTrackSelect();
  });
}

function goToTrackSelect() {
  currentScreen = 'trackSelect';
  showScreen('screen-trackselect');
  initTrackSelect(
    (track) => { selectedTrack = track; goToGame(); },
    ()      => { goToCarSelect(); }
  );
}

function goToGame() {
  currentScreen = 'game';
  hideScreens();
  initGame(
    selectedCar, selectedTrack,
    (lapData) => { goToResults(lapData); },
    ()        => { goToCarSelect(); }
  );
}

function goToResults(lapData) {
  currentScreen = 'results';
  stopGame();
  showScreen('screen-results');
  initResults(
    lapData,
    selectedCar,
    selectedTrack,
    () => { goToGame(); },       // retry
    () => { goToCarSelect(); }   // menu
  );
}

// ── game loop ────────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (currentScreen === 'game') {
    updateGame(dt, timestamp);
  }

  clearFrameKeys();
  requestAnimationFrame(gameLoop);
}

// ── help button (always visible, opens controls modal) ──────
function _wireHelpButton() {
  const btn   = document.getElementById('btn-help');
  const overlay = document.getElementById('help-overlay');
  const close = document.getElementById('btn-help-close');
  if (!btn || !overlay) return;
  const open  = () => overlay.classList.remove('hidden');
  const hide  = () => overlay.classList.add('hidden');
  btn.addEventListener('click', open);
  close && close.addEventListener('click', hide);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) hide();
  });
  // ESC closes if open (but only when overlay is the topmost UI)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      hide();
      e.stopPropagation();
    }
  }, true);
}
_wireHelpButton();

function _wireGlobalLeaderboard() {
  const openBtn = document.getElementById('btn-open-leaderboard');
  const overlay = document.getElementById('leaderboard-overlay');
  const closeBtn = document.getElementById('btn-leaderboard-close');
  const refreshBtn = document.getElementById('btn-leaderboard-refresh');
  const trackFilter = document.getElementById('leaderboard-track-filter');
  if (!openBtn || !overlay) return;

  if (trackFilter) {
    trackFilter.innerHTML = TRACKS.map((track, idx) =>
      `<option value="${track.id}"${idx === 0 ? ' selected' : ''}>${track.name}</option>`
    ).join('');
    trackFilter.addEventListener('change', () => _loadGlobalLeaderboard());
  }

  const open = () => {
    overlay.classList.remove('hidden');
    _loadGlobalLeaderboard();
  };
  const close = () => overlay.classList.add('hidden');

  openBtn.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  refreshBtn && refreshBtn.addEventListener('click', () => _loadGlobalLeaderboard());
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  subscribeLeaderboard(() => {
    if (!overlay.classList.contains('hidden')) _loadGlobalLeaderboard('실시간 갱신됨');
    _loadHomeLeaderboard('실시간 갱신됨');
  });
}

async function _loadGlobalLeaderboard(statusText = '서버 연결 중...') {
  const list = document.getElementById('global-leaderboard-list');
  const status = document.getElementById('global-leaderboard-status');
  const trackFilter = document.getElementById('leaderboard-track-filter');
  if (!list || !status) return;
  const trackId = trackFilter?.value || TRACKS[0]?.id || '';
  const trackName = TRACKS.find(t => t.id === trackId)?.name || '선택 맵';

  status.textContent = `${trackName} ${statusText}`;
  list.innerHTML = '<li class="leaderboard-empty">랭킹을 불러오는 중...</li>';

  try {
    const result = await fetchLeaderboard('', trackId, 20);
    _renderGlobalLeaderboard(result.leaderboard || []);
    status.textContent = result.leaderboard?.length ? `${trackName} TOP 20` : `${trackName} 등록된 기록이 없습니다.`;
  } catch {
    list.innerHTML = '<li class="leaderboard-empty">서버에 연결할 수 없습니다.</li>';
    status.textContent = '온라인 랭킹 서버를 확인하세요.';
  }
}

function _wireHomeLeaderboard() {
  const trackFilter = document.getElementById('home-leaderboard-track');
  if (!trackFilter) return;
  trackFilter.innerHTML = TRACKS.map((track, idx) =>
    `<option value="${track.id}"${idx === 0 ? ' selected' : ''}>${track.name}</option>`
  ).join('');
  trackFilter.addEventListener('change', () => _loadHomeLeaderboard());
  _loadHomeLeaderboard();
}

async function _loadHomeLeaderboard(statusText = '서버 연결 중...') {
  const list = document.getElementById('home-leaderboard-list');
  const status = document.getElementById('home-leaderboard-status');
  const trackFilter = document.getElementById('home-leaderboard-track');
  if (!list || !status || !trackFilter) return;
  const trackId = trackFilter.value || TRACKS[0]?.id || '';
  status.textContent = statusText;
  list.innerHTML = '<li class="leaderboard-empty">랭킹을 불러오는 중...</li>';
  try {
    const result = await fetchLeaderboard('', trackId, 8);
    _renderLeaderboardInto(list, result.leaderboard || []);
    status.textContent = result.leaderboard?.length ? '맵별 TOP 8' : '아직 기록 없음';
  } catch {
    list.innerHTML = '<li class="leaderboard-empty">서버에 연결할 수 없습니다.</li>';
    status.textContent = 'Supabase 연결 확인 필요';
  }
}

function _renderGlobalLeaderboard(rows) {
  const list = document.getElementById('global-leaderboard-list');
  if (!list) return;
  _renderLeaderboardInto(list, rows);
}

function _renderLeaderboardInto(list, rows) {
  list.innerHTML = '';

  if (rows.length === 0) {
    list.innerHTML = '<li class="leaderboard-empty">아직 등록된 기록이 없습니다.</li>';
    return;
  }

  const me = getPlayerProfile().id;
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'global-leaderboard-row' + (row.playerId === me ? ' mine' : '');
    li.style.setProperty('--player-theme', _themeColor(row.playerThemeColor));

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = row.rank === 1 ? '♛ 1' : String(row.rank);

    const main = document.createElement('span');
    main.className = 'global-leaderboard-main';
    main.textContent = row.playerName || 'Driver';

    const meta = document.createElement('span');
    meta.className = 'global-leaderboard-meta';
    meta.textContent = `${row.trackName || row.trackId} / ${row.carName || row.carId}`;

    const time = document.createElement('span');
    time.className = 'leaderboard-time';
    time.textContent = formatTime(row.lapMs);

    li.append(rank, main, meta, time);
    list.appendChild(li);
  }
}

function _themeColor(value) {
  const text = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : '#2ec4b6';
}

function _wireProfilePanel() {
  const openBtn = document.getElementById('btn-profile-open');
  const panel = document.getElementById('profile-panel');
  const closeBtn = document.getElementById('btn-profile-close');
  const email = document.getElementById('auth-email');
  const login = document.getElementById('btn-auth-login');
  const logout = document.getElementById('btn-auth-logout');
  const status = document.getElementById('auth-status');
  const nickname = document.getElementById('profile-nickname');
  const theme = document.getElementById('profile-theme');
  const save = document.getElementById('btn-profile-save');
  if (!openBtn || !panel) return;

  openBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
  closeBtn?.addEventListener('click', () => panel.classList.add('hidden'));
  login && (login.onclick = async () => {
    if (status) status.textContent = '로그인 메일 보내는 중...';
    try {
      await sendMagicLink(email?.value || '');
      if (status) status.textContent = '메일의 로그인 링크를 확인하세요.';
    } catch (error) {
      if (status) status.textContent = `전송 실패: ${error?.message || 'Supabase 설정을 확인하세요.'}`;
    }
  });
  logout && (logout.onclick = async () => {
    await signOut();
    panel.classList.add('hidden');
  });
  save && (save.onclick = async () => {
    try {
      await updateProfileSettings({ nickname: nickname?.value, themeColor: theme?.value });
      if (status) status.textContent = '프로필 저장 완료';
    } catch (error) {
      if (!status) return;
      status.textContent = error?.code === 'bad-nickname'
        ? nicknameRejectMessage()
        : '로그인 후 프로필을 저장할 수 있습니다.';
    }
  });

  onAuthChange(_renderProfilePanel);
  onProfileChange(profile => {
    _renderProfilePanel();
    if (profile && !profile.starter_claimed) _openStarterRoulette();
  });
}

function _renderProfilePanel() {
  const user = getCurrentUser();
  const profile = getProfile();
  const local = getPlayerProfile();
  const name = profile?.nickname || local.name;
  const color = profile?.theme_color || '#2ec4b6';
  const coins = profile?.coins || 0;
  const ownedCount = profile?.owned_car_ids?.length || 2;
  const chipName = document.getElementById('profile-chip-name');
  const chipCoins = document.getElementById('profile-chip-coins');
  const dot = document.getElementById('profile-dot');
  const nickname = document.getElementById('profile-nickname');
  const theme = document.getElementById('profile-theme');
  const coinsEl = document.getElementById('profile-coins');
  const note = document.getElementById('profile-note');
  const email = document.getElementById('auth-email');
  const login = document.getElementById('btn-auth-login');
  const logout = document.getElementById('btn-auth-logout');
  const status = document.getElementById('auth-status');

  if (chipName) chipName.textContent = user ? name : 'Guest';
  if (chipCoins) chipCoins.textContent = user ? coins.toLocaleString() : 'login';
  if (dot) dot.style.background = color;
  if (nickname) {
    nickname.value = name;
    nickname.disabled = !user || isProfileLoading();
  }
  if (theme) {
    theme.value = color;
    theme.disabled = !user || isProfileLoading();
  }
  if (coinsEl) coinsEl.textContent = coins.toLocaleString();
  if (note) note.textContent = user
    ? `${ownedCount}/${CAR_DATA.length}대 소유 · 미션 클리어로 코인을 모아 구매하세요.`
    : '게스트는 기본 차량만 사용할 수 있습니다.';
  if (email) email.classList.toggle('hidden', !!user);
  if (login) login.classList.toggle('hidden', !!user);
  if (logout) logout.classList.toggle('hidden', !user);
  if (status) status.textContent = user ? `${user.email} 로그인됨` : '로그인하면 코인과 차량을 저장합니다.';
}

function _wireStarterRoulette() {
  const spin = document.getElementById('btn-roulette-spin');
  if (!spin) return;
  spin.onclick = async () => {
    const profile = getProfile();
    if (!profile || profile.starter_claimed) return _closeStarterRoulette();
    const car = rollStarterCar();
    const reels = [
      document.getElementById('roulette-reel-1'),
      document.getElementById('roulette-reel-2'),
      document.getElementById('roulette-reel-3'),
    ];
    const result = document.getElementById('roulette-result');
    const names = CAR_DATA.map(item => item.name);
    spin.disabled = true;
    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      reels.forEach((reel, i) => {
        if (reel) reel.textContent = names[(ticks + i * 3) % names.length];
      });
      if (ticks > 26) {
        clearInterval(interval);
        reels.forEach(reel => { if (reel) reel.textContent = car.name; });
        if (result) result.textContent = `JACKPOT! ${car.name} 획득`;
        claimStarterCar(car.id).finally(() => {
          setTimeout(_closeStarterRoulette, 1200);
          spin.disabled = false;
        });
      }
    }, 70);
  };
}

function _openStarterRoulette() {
  const overlay = document.getElementById('starter-roulette-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function _closeStarterRoulette() {
  const overlay = document.getElementById('starter-roulette-overlay');
  if (overlay) overlay.classList.add('hidden');
}

_wireProfilePanel();
_wireStarterRoulette();
_wireHomeLeaderboard();
_wireGlobalLeaderboard();
await initAuth();
initProfile();

// ── start ────────────────────────────────────────────────────
goToCarSelect();
requestAnimationFrame(gameLoop);
