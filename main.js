import { initCarSelect }   from './screens/carSelect.js';
import { initTrackSelect }  from './screens/trackSelect.js';
import { TRACKS }           from './data/tracks.js';
import { initGame, updateGame, stopGame } from './screens/game.js';
import { initResults }      from './screens/results.js';
import { initAuth }         from './utils/auth.js';
import { clearFrameKeys }   from './utils/input.js';
import { formatTime }       from './utils/math.js';
import {
  fetchLeaderboard,
  getPlayerProfile,
  setPlayerName,
  subscribeLeaderboard,
} from './utils/leaderboard.js';

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

function _wirePlayerBar() {
  const input = document.getElementById('player-name');
  if (!input) return;
  input.value = getPlayerProfile().name;

  const save = () => {
    const profile = setPlayerName(input.value);
    input.value = profile.name;
    const resultsName = document.getElementById('leaderboard-name');
    if (resultsName) resultsName.value = profile.name;
  };

  input.addEventListener('change', save);
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      save();
      input.blur();
    }
  });
}

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

function _renderGlobalLeaderboard(rows) {
  const list = document.getElementById('global-leaderboard-list');
  if (!list) return;
  list.innerHTML = '';

  if (rows.length === 0) {
    list.innerHTML = '<li class="leaderboard-empty">아직 등록된 기록이 없습니다.</li>';
    return;
  }

  const me = getPlayerProfile().id;
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'global-leaderboard-row' + (row.playerId === me ? ' mine' : '');

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
_wirePlayerBar();
_wireGlobalLeaderboard();
initAuth();

// ── start ────────────────────────────────────────────────────
goToCarSelect();
requestAnimationFrame(gameLoop);
