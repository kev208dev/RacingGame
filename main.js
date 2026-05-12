import { initCarSelect }   from './screens/carSelect.js';
import { initTrackSelect }  from './screens/trackSelect.js';
import { TRACKS }           from './data/tracks.js';
import { initGame, updateGame, stopGame } from './screens/game.js';
import { initResults }      from './screens/results.js';
import { initAuth }         from './utils/auth.js';
import {
  getCurrentUser,
  getMagicLinkCooldownRemaining,
  onAuthChange,
  sendMagicLink,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updateUserPassword,
} from './utils/auth.js';
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

// ── toast notifications ─────────────────────────────────────
let toastTimer = null;
function showToast(message, kind = 'info', duration = 2400) {
  if (!message) return;
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'app-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove('toast-info', 'toast-success', 'toast-error');
  el.classList.add(`toast-${kind}`);
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

let loginCooldownInterval = null;
function _startMagicCooldownTicker(email) {
  const btn = document.getElementById('btn-auth-magic');
  if (!btn) return;
  if (loginCooldownInterval) clearInterval(loginCooldownInterval);
  const defaultLabel = '비밀번호 없이 이메일 링크로 로그인 (기존 계정)';
  const tick = () => {
    const remain = getMagicLinkCooldownRemaining(email);
    if (remain <= 0) {
      btn.disabled = false;
      btn.textContent = defaultLabel;
      clearInterval(loginCooldownInterval);
      loginCooldownInterval = null;
      return;
    }
    btn.disabled = true;
    btn.textContent = `이메일 링크 대기 ${remain}s`;
  };
  tick();
  loginCooldownInterval = setInterval(tick, 1000);
}

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

function _wireHomeLeaderboard() {
  const trackFilter = document.getElementById('home-leaderboard-track');
  if (!trackFilter) return;
  trackFilter.innerHTML = TRACKS.map((track, idx) =>
    `<option value="${track.id}"${idx === 0 ? ' selected' : ''}>${track.name}</option>`
  ).join('');
  trackFilter.addEventListener('change', () => _loadHomeLeaderboard());
  _loadHomeLeaderboard();
  subscribeLeaderboard(() => _loadHomeLeaderboard('실시간 갱신됨'));
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
    const result = await fetchLeaderboard('', trackId, 20);
    _renderLeaderboardInto(list, result.leaderboard || []);
    status.textContent = result.leaderboard?.length ? '맵별 TOP 20' : '아직 기록 없음';
  } catch {
    list.innerHTML = '<li class="leaderboard-empty">서버에 연결할 수 없습니다.</li>';
    status.textContent = 'Supabase 연결 확인 필요';
  }
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
    const color = row.themeColor || '#2ec4b6';
    li.style.setProperty('--theme-color', color);

    const dot = document.createElement('span');
    dot.className = 'leaderboard-theme-dot';
    dot.style.background = color;
    dot.title = color;

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

    li.append(dot, rank, main, meta, time);
    list.appendChild(li);
  }
}

function _wireProfilePanel() {
  const openBtn = document.getElementById('btn-profile-open');
  const panel = document.getElementById('profile-panel');
  const closeBtn = document.getElementById('btn-profile-close');
  const email = document.getElementById('auth-email');
  const password = document.getElementById('auth-password');
  const pwLogin = document.getElementById('btn-auth-password-login');
  const signupBtn = document.getElementById('btn-auth-signup');
  const magicBtn = document.getElementById('btn-auth-magic');
  const logout = document.getElementById('btn-auth-logout');
  const status = document.getElementById('auth-status');
  const nickname = document.getElementById('profile-nickname');
  const theme = document.getElementById('profile-theme');
  const save = document.getElementById('btn-profile-save');
  const newPw = document.getElementById('auth-new-password');
  const setPwBtn = document.getElementById('btn-set-password');
  const setPwStatus = document.getElementById('set-password-status');
  if (!openBtn || !panel) return;

  openBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
  closeBtn?.addEventListener('click', () => panel.classList.add('hidden'));
  email?.addEventListener('input', () => _startMagicCooldownTicker(email.value || ''));

  pwLogin && (pwLogin.onclick = async () => {
    const e = email?.value || '';
    const p = password?.value || '';
    if (status) status.textContent = '로그인 중...';
    try {
      await signInWithPassword(e, p);
      if (status) status.textContent = '로그인 완료';
      showToast('로그인 완료', 'success');
    } catch (error) {
      const msg = error?.message || '로그인에 실패했습니다.';
      if (status) status.textContent = msg;
      showToast(msg, 'error');
    }
  });

  signupBtn && (signupBtn.onclick = async () => {
    const e = email?.value || '';
    const p = password?.value || '';
    if (status) status.textContent = '회원가입 중...';
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(e, p);
      if (needsEmailConfirmation) {
        const text = '회원가입 완료. 이메일의 인증 링크를 확인하세요.';
        if (status) status.textContent = text;
        showToast(text, 'success');
      } else {
        if (status) status.textContent = '회원가입 완료';
        showToast('회원가입 완료', 'success');
      }
    } catch (error) {
      const msg = error?.message || '회원가입에 실패했습니다.';
      if (status) status.textContent = msg;
      showToast(msg, 'error');
    }
  });

  magicBtn && (magicBtn.onclick = async () => {
    const value = email?.value || '';
    if (status) status.textContent = '로그인 메일 보내는 중...';
    try {
      await sendMagicLink(value);
      if (status) status.textContent = '메일의 로그인 링크를 확인하세요. (받은편지함/스팸함 확인)';
      _startMagicCooldownTicker(value);
      showToast('로그인 메일을 발송했습니다.');
    } catch (error) {
      if (status) {
        if (error?.code === 'rate-limited') {
          status.textContent = error.message;
          _startMagicCooldownTicker(value);
          showToast('잠시 후 다시 시도해주세요.');
        } else if (error?.code === 'email-required') {
          status.textContent = '이메일 주소를 입력하세요.';
        } else {
          status.textContent = `전송 실패: ${error?.message || 'Supabase 설정을 확인하세요.'}`;
        }
      }
    }
  });

  logout && (logout.onclick = async () => {
    await signOut();
    if (password) password.value = '';
    if (newPw) newPw.value = '';
    panel.classList.add('hidden');
  });

  setPwBtn && (setPwBtn.onclick = async () => {
    const p = newPw?.value || '';
    if (setPwStatus) setPwStatus.textContent = '저장 중...';
    try {
      await updateUserPassword(p);
      if (newPw) newPw.value = '';
      if (setPwStatus) setPwStatus.textContent = '비밀번호 저장 완료';
      showToast('비밀번호 저장 완료', 'success');
    } catch (error) {
      const msg = error?.message || '저장 실패';
      if (setPwStatus) setPwStatus.textContent = msg;
      showToast(msg, 'error');
    }
  });
  save && (save.onclick = async () => {
    try {
      await updateProfileSettings({ nickname: nickname?.value, themeColor: theme?.value });
      if (status) status.textContent = '프로필 저장 완료';
      showToast('프로필 저장 완료', 'success');
    } catch (error) {
      const msg = error?.code === 'bad-nickname'
        ? nicknameRejectMessage()
        : '로그인 후 프로필을 저장할 수 있습니다.';
      if (status) status.textContent = msg;
      showToast(msg, 'error');
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
  const password = document.getElementById('auth-password');
  const pwLogin = document.getElementById('btn-auth-password-login');
  const signupBtn = document.getElementById('btn-auth-signup');
  const magicBtn = document.getElementById('btn-auth-magic');
  const logout = document.getElementById('btn-auth-logout');
  const status = document.getElementById('auth-status');
  const setPwSection = document.getElementById('set-password-section');

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

  // Login form (email + password + buttons) shown only when logged out.
  if (email) email.classList.toggle('hidden', !!user);
  if (password) password.classList.toggle('hidden', !!user);
  if (pwLogin) pwLogin.classList.toggle('hidden', !!user);
  if (signupBtn) signupBtn.classList.toggle('hidden', !!user);
  if (magicBtn) magicBtn.classList.toggle('hidden', !!user);
  if (logout) logout.classList.toggle('hidden', !user);

  // Set/change-password section only when logged in.
  if (setPwSection) setPwSection.classList.toggle('hidden', !user);

  if (status) status.textContent = user ? `${user.email} 로그인됨` : '로그인하면 코인과 차량을 저장합니다.';
  if (!user && email) _startMagicCooldownTicker(email.value || '');

  const saveNote = document.getElementById('main-save-note');
  if (saveNote) {
    if (user) {
      saveNote.classList.add('logged-in');
      saveNote.textContent = `${user.email} 인증 완료 · 자동차 잠금 해제와 코인이 자동 저장됩니다.`;
    } else {
      saveNote.classList.remove('logged-in');
      saveNote.textContent = '이메일 인증을 해야 자동차 잠금 해제와 코인을 저장할 수 있습니다.';
    }
  }
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
await initAuth();
initProfile();

// ── start ────────────────────────────────────────────────────
goToCarSelect();
requestAnimationFrame(gameLoop);
