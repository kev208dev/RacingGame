let onSelect = null;
let onBack = null;

export const gameModes = [
  {
    id: 'ranked',
    title: '경쟁모드',
    description: '임의의 상대와 매칭되어 실시간 레이스를 진행합니다. 결과는 경쟁 랭킹과 레이팅에 반영됩니다.',
    affectsRating: true,
    leaderboardType: 'ranked',
  },
  {
    id: 'timeTrial',
    title: '기록깨기 모드',
    description: '혼자 달리며 몇 초 안에 완주했는지 측정합니다. Today / All-time 기록 랭킹에 반영됩니다.',
    affectsRating: false,
    leaderboardType: 'time',
  },
  {
    id: 'friendly',
    title: '친선전',
    description: '방을 만들고 친구와 함께 달립니다. 경기 방식은 경쟁모드와 비슷하지만 레이팅에는 반영되지 않습니다.',
    affectsRating: false,
    leaderboardType: 'friendly',
  },
];

export function initModeSelect(cb, backCb) {
  onSelect = cb;
  onBack = backCb;
  renderGameModeCards();
  _wire();
}

export function renderGameModeCards() {
  const grid = document.getElementById('game-mode-grid') || document.querySelector('#screen-modeselect .mode-grid');
  const header = document.querySelector('#screen-modeselect .screen-header h1');
  const subtitle = document.querySelector('#screen-modeselect .screen-header .subtitle');
  if (header) header.textContent = '게임 모드 선택';
  if (subtitle) subtitle.textContent = '경쟁, 기록 도전, 친구와 함께 달리는 방식을 선택하세요.';
  if (!grid) return;
  grid.id = 'game-mode-grid';
  grid.classList.add('game-mode-grid');
  grid.innerHTML = gameModes.map(mode => `
    <button class="mode-card game-mode-card" data-mode-id="${mode.id}" type="button">
      <b>${mode.title}</b>
      <span>${mode.description}</span>
      <em>${mode.affectsRating ? 'Rating enabled' : mode.leaderboardType === 'time' ? 'Time leaderboard' : 'Friendly room'}</em>
    </button>
  `).join('');
}

function _wire() {
  const back = document.getElementById('btn-back-mode-skin');
  document.querySelectorAll('[data-mode-id]').forEach(card => {
    card.onclick = () => onSelect?.(card.dataset.modeId);
  });
  if (back) back.onclick = () => onBack?.();
}
