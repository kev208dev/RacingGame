const MOCK_SCORES = [
  { rank: 1, nickname: 'ApexRunner', score: 984200, time: '1:18.420' },
  { rank: 2, nickname: 'NeonLine', score: 942050, time: '1:22.995' },
  { rank: 3, nickname: 'DraftKing', score: 901770, time: '1:27.310' },
];

export async function submitScore(nickname, score) {
  const cleanName = String(nickname || 'Driver').trim().slice(0, 24) || 'Driver';
  console.log('submitScore placeholder', { nickname: cleanName, score });
  return { accepted: true, nickname: cleanName, score: Number(score || 0) };
}

export async function fetchLeaderboard(type = 'all-time') {
  console.log('fetchLeaderboard placeholder', type);
  return MOCK_SCORES;
}

export function renderLeaderboard(scores, target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  el.innerHTML = '';
  for (const row of scores || []) {
    const item = document.createElement('li');
    item.className = 'monetization-leaderboard-row';
    item.innerHTML = `
      <span>#${row.rank}</span>
      <b>${escapeHtml(row.nickname || row.playerName || 'Driver')}</b>
      <time>${escapeHtml(row.time || '')}</time>
      <strong>${Number(row.score || 0).toLocaleString()}</strong>
    `;
    el.appendChild(item);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
