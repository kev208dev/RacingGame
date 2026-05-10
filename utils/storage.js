const KEY = 'racing_sandbox';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getBestLap(carId, trackId) {
  const d = load();
  return d?.laps?.[carId]?.[trackId] ?? null;
}

export function saveBestLap(carId, trackId, ms) {
  const d = load();
  if (!d.laps) d.laps = {};
  if (!d.laps[carId]) d.laps[carId] = {};
  const prev = d.laps[carId][trackId];
  if (!prev || ms < prev) {
    d.laps[carId][trackId] = ms;
    save(d);
    return true;
  }
  return false;
}

export function getLapHistory(carId, trackId) {
  const d = load();
  return d?.history?.[carId]?.[trackId] ?? [];
}

export function addLapHistory(carId, trackId, lapData) {
  const d = load();
  if (!d.history) d.history = {};
  if (!d.history[carId]) d.history[carId] = {};
  if (!d.history[carId][trackId]) d.history[carId][trackId] = [];
  d.history[carId][trackId].unshift(lapData);
  if (d.history[carId][trackId].length > 20) d.history[carId][trackId].pop();
  save(d);
}

export function getSettings() {
  const d = load();
  return d.settings ?? {};
}

export function saveSettings(s) {
  const d = load();
  d.settings = { ...d.settings, ...s };
  save(d);
}
