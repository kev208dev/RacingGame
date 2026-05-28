const KEY = 'racing_sandbox';
const RECORD_RESET_ID = 'clear-race-records-2026-05-27';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('Local race data could not be saved:', error);
    return false;
  }
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

export function getBestSectors(trackId) {
  const d = load();
  return d?.sectorBest?.[trackId] ?? [null, null, null];
}

export function saveBestSectors(trackId, sectors, meta = {}) {
  const d = load();
  if (!d.sectorBest) d.sectorBest = {};
  const prev = d.sectorBest[trackId] ?? [null, null, null];
  const next = [...prev];
  let changed = false;
  for (let i = 0; i < 3; i++) {
    const value = sectors?.[i];
    if (value && (!next[i] || value < next[i])) {
      next[i] = value;
      changed = true;
    }
  }
  if (changed) {
    d.sectorBest[trackId] = next;
    d.sectorBestMeta = d.sectorBestMeta || {};
    d.sectorBestMeta[trackId] = { ...d.sectorBestMeta[trackId], ...meta, updatedAt: Date.now() };
    save(d);
  }
  return changed;
}

export function getBestGhost(trackId) {
  const d = load();
  return d?.ghosts?.[trackId] ?? null;
}

export function saveBestGhost(trackId, ghost) {
  if (!ghost?.path?.length) return;
  const d = load();
  const prev = d?.ghosts?.[trackId];
  if (prev?.lapMs && ghost.lapMs >= prev.lapMs) return;
  if (!d.ghosts) d.ghosts = {};
  d.ghosts[trackId] = {
    lapMs: ghost.lapMs,
    carId: ghost.carId,
    carName: ghost.carName,
    skin: ghost.skin || null,
    path: ghost.path.slice(0, 900),
    savedAt: Date.now(),
  };
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

export function clearRaceRecordsOnce() {
  const d = load();
  const migrations = Array.isArray(d.migrations) ? d.migrations : [];
  if (migrations.includes(RECORD_RESET_ID)) return false;

  delete d.laps;
  delete d.history;
  delete d.sectorBest;
  delete d.sectorBestMeta;
  delete d.ghosts;
  d.migrations = [...migrations, RECORD_RESET_ID];
  return save(d);
}
