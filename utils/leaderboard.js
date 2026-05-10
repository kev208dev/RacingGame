const API_BASE = '';
const PROFILE_KEY = 'racing_player_profile';

let stream = null;
const listeners = new Set();

function randomId() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `driver_${bytes[0].toString(36)}${bytes[1].toString(36)}`;
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null;
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getPlayerProfile() {
  let profile = loadProfile();
  if (!profile?.id) {
    profile = {
      id: randomId(),
      name: `Driver-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    saveProfile(profile);
  }
  return profile;
}

export function setPlayerName(name) {
  const profile = getPlayerProfile();
  const nextName = String(name || '').trim().slice(0, 24);
  profile.name = nextName || profile.name;
  saveProfile(profile);
  return profile;
}

export async function fetchLeaderboard(carId, trackId, limit = 10) {
  const params = new URLSearchParams({ carId, trackId, limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/leaderboard?${params}`);
  if (!res.ok) throw new Error('leaderboard-fetch-failed');
  return res.json();
}

export async function submitLeaderboard(car, track, lapData) {
  const profile = getPlayerProfile();
  const res = await fetch(`${API_BASE}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: profile.id,
      playerName: profile.name,
      carId: car.id,
      carName: car.name,
      trackId: track.id,
      trackName: track.name,
      lapMs: lapData.lapMs,
      sectors: lapData.sectors || [],
    }),
  });
  if (!res.ok) throw new Error('leaderboard-submit-failed');
  return res.json();
}

export function subscribeLeaderboard(listener) {
  listeners.add(listener);
  if (!stream && 'EventSource' in window) {
    stream = new EventSource(`${API_BASE}/api/leaderboard/stream`);
    stream.addEventListener('leaderboard', event => {
      try {
        const payload = JSON.parse(event.data);
        for (const fn of listeners) fn(payload);
      } catch {}
    });
    stream.onerror = () => {};
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stream) {
      stream.close();
      stream = null;
    }
  };
}
