import { formatTime } from '../utils/math.js';
import {
  fetchLeaderboard,
  getPlayerProfile,
  setPlayerName,
  submitLeaderboard,
  subscribeLeaderboard,
} from '../utils/leaderboard.js';

let unsubscribeLeaderboard = null;
let renderToken = 0;

export function initResults(data, car, track, retryCb, menuCb) {
  cleanupLeaderboard();
  const token = ++renderToken;

  const titleEl   = document.getElementById('res-title');
  const timeEl    = document.getElementById('res-time');
  const sectorsEl = document.getElementById('res-sectors');
  const listEl    = document.getElementById('leaderboard-list');
  const statusEl  = document.getElementById('leaderboard-status');
  const subtitleEl = document.getElementById('leaderboard-subtitle');
  const nameEl    = document.getElementById('leaderboard-name');
  const saveNameBtn = document.getElementById('btn-save-name');

  if (titleEl) {
    titleEl.textContent = data.isNew ? '🏆 신기록!' : '랩 완주';
    titleEl.className   = 'results-title' + (data.isNew ? ' new' : '');
  }
  if (timeEl) timeEl.textContent = formatTime(data.lapMs);

  if (sectorsEl) {
    sectorsEl.innerHTML = '';
    const labels = ['섹터 1', '섹터 2', '섹터 3'];
    (data.sectors || []).forEach((t, i) => {
      const best = data.sectorBest?.[i] || null;
      const row = document.createElement('div');
      row.className = 'sector-row';
      row.innerHTML = `
        <span class="sector-label">${labels[i] || `섹터 ${i + 1}`}</span>
        <span class="sector-time${t !== null ? ' best' : ''}">
          ${t !== null ? formatTime(t) : '--:--.---'}
        </span>
        <span class="sector-best">BEST ${best ? formatTime(best) : '--:--.---'}</span>
      `;
      sectorsEl.appendChild(row);
    });
  }

  if (subtitleEl) subtitleEl.textContent = car && track ? `${track.name} 전체 랭킹 / ${car.name}` : '--';
  if (nameEl) nameEl.value = getPlayerProfile().name;
  _renderLeaderboard(listEl, null);
  _setStatus(statusEl, '기록을 서버에 업로드 중...');

  if (car && track) {
    _syncLeaderboard({ data, car, track, token, listEl, statusEl });
    unsubscribeLeaderboard = subscribeLeaderboard(payload => {
      if (token !== renderToken) return;
      if (payload.trackId !== track.id) return;
      _renderLeaderboard(listEl, payload.leaderboard);
      _setStatus(statusEl, '실시간 갱신됨');
    });
  } else {
    _setStatus(statusEl, '차량/트랙 정보가 없어 온라인 랭킹을 불러오지 못했습니다.');
  }

  if (saveNameBtn) {
    saveNameBtn.onclick = async () => {
      const profile = setPlayerName(nameEl?.value || '');
      if (nameEl) nameEl.value = profile.name;
      const playerNameEl = document.getElementById('player-name');
      if (playerNameEl) playerNameEl.value = profile.name;
      _setStatus(statusEl, '이름 저장됨. 현재 기록에 반영 중...');
      try {
        const result = await submitLeaderboard(car, track, data);
        if (token !== renderToken) return;
        _renderLeaderboard(listEl, result.leaderboard);
        _setStatus(statusEl, result.rank ? `${profile.name} 님 현재 ${result.rank}위` : '이름 저장됨');
      } catch {
        _setStatus(statusEl, '이름은 이 브라우저에 저장됐지만 서버 연결은 실패했습니다.');
      }
    };
  }

  const retryBtn = document.getElementById('btn-retry');
  const menuBtn  = document.getElementById('btn-to-menu');
  if (retryBtn) retryBtn.onclick = () => { cleanupLeaderboard(); if (retryCb) retryCb(); };
  if (menuBtn)  menuBtn.onclick  = () => { cleanupLeaderboard(); if (menuCb)  menuCb();  };
}

function cleanupLeaderboard() {
  renderToken++;
  if (unsubscribeLeaderboard) {
    unsubscribeLeaderboard();
    unsubscribeLeaderboard = null;
  }
}

async function _syncLeaderboard({ data, car, track, token, listEl, statusEl }) {
  try {
    const result = await submitLeaderboard(car, track, data);
    if (token !== renderToken) return;
    _renderLeaderboard(listEl, result.leaderboard);
    if (result.improved && result.rank) {
      _setStatus(statusEl, `서버 신기록 등록 완료. 현재 ${result.rank}위`);
    } else if (result.rank) {
      _setStatus(statusEl, `내 최고 기록 기준 현재 ${result.rank}위`);
    } else {
      _setStatus(statusEl, '기록은 저장됐지만 TOP 10에는 아직 들지 못했습니다.');
    }
  } catch {
    try {
      const fallback = await fetchLeaderboard('', track.id, 10);
      if (token !== renderToken) return;
      _renderLeaderboard(listEl, fallback.leaderboard);
      _setStatus(statusEl, '랭킹은 불러왔지만 이번 기록 업로드는 실패했습니다.');
    } catch {
      if (token !== renderToken) return;
      _renderLeaderboard(listEl, []);
      _setStatus(statusEl, '서버에 연결할 수 없습니다. `npm start`로 실행해야 온라인 랭킹이 작동합니다.');
    }
  }
}

function _renderLeaderboard(listEl, rows) {
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!rows) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = '랭킹을 불러오는 중...';
    listEl.appendChild(li);
    return;
  }

  if (rows.length === 0) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = '아직 등록된 기록이 없습니다.';
    listEl.appendChild(li);
    return;
  }

  const me = getPlayerProfile().id;
  rows.forEach(row => {
    const li = document.createElement('li');
    li.className = 'leaderboard-row' + (row.playerId === me ? ' mine' : '');

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = row.rank === 1 ? '♛ 1' : String(row.rank);

    const name = document.createElement('span');
    name.className = 'leaderboard-driver';
    name.textContent = row.playerName || 'Driver';

    const time = document.createElement('span');
    time.className = 'leaderboard-time';
    time.textContent = formatTime(row.lapMs);

    li.append(rank, name, time);
    listEl.appendChild(li);
  });
}

function _setStatus(statusEl, text) {
  if (statusEl) statusEl.textContent = text;
}
