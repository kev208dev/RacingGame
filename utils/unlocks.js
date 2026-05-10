import { TRACKS } from '../data/tracks.js';
import { formatTime } from './math.js';

export function isCarUnlocked(car) {
  const req = car?.unlock;
  if (!req) return true;
  if (req.allTracks) {
    return req.allTracks.every(goal => {
      const best = bestAnyCar(goal.trackId);
      return best && best <= goal.lapMs;
    });
  }
  const best = bestAnyCar(req.trackId);
  return !!best && best <= req.lapMs;
}

export function unlockText(car) {
  const req = car?.unlock;
  if (!req) return '기본 차량';
  if (req.allTracks) {
    return `모든 챌린지 클리어`;
  }
  const track = TRACKS.find(t => t.id === req.trackId);
  return `${track?.name || req.trackId} ${formatTime(req.lapMs)} 이내`;
}

export function unlockProgressText(car) {
  const req = car?.unlock;
  if (!req) return '바로 사용 가능';
  if (req.allTracks) {
    const done = req.allTracks.filter(goal => {
      const best = bestAnyCar(goal.trackId);
      return best && best <= goal.lapMs;
    }).length;
    return `${done}/${req.allTracks.length} 챌린지 완료`;
  }
  const best = bestAnyCar(req.trackId);
  return best ? `현재 최고 ${formatTime(best)}` : '아직 기록 없음';
}

function bestAnyCar(trackId) {
  const raw = localStorage.getItem('racing_sandbox');
  let data = null;
  try { data = JSON.parse(raw) || {}; } catch { data = {}; }
  const laps = data.laps || {};
  let best = null;
  for (const byTrack of Object.values(laps)) {
    const lap = byTrack?.[trackId];
    if (lap && (!best || lap < best)) best = lap;
  }
  return best;
}
