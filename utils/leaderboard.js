import { getSupabase } from './supabaseClient.js';
import { safeNickname } from './nicknameFilter.js';

const API_BASE = '';
const PROFILE_KEY = 'racing_player_profile';
const TABLE = 'leaderboard_records';

let channel = null;
const listeners = new Set();
let identityOverride = null;

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
  if (identityOverride?.id && identityOverride?.name) return identityOverride;
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
  const nextName = safeNickname(name, profile.name || 'Driver');
  profile.name = nextName || profile.name;
  saveProfile(profile);
  return profile;
}

export function setLeaderboardIdentity(identity) {
  identityOverride = identity?.id && identity?.name
    ? { id: identity.id, name: safeNickname(identity.name, 'Driver') }
    : null;
}

export async function fetchLeaderboard(carId, trackId, limit = 10) {
  try {
    return await fetchSupabaseLeaderboard(carId, trackId, limit);
  } catch (error) {
    console.warn('Supabase leaderboard fetch failed, trying local server API.', error);
  }

  const params = new URLSearchParams({ carId, trackId, limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/leaderboard?${params}`);
  if (!res.ok) throw new Error('leaderboard-fetch-failed');
  return res.json();
}

export async function submitLeaderboard(car, track, lapData) {
  const profile = getPlayerProfile();
  try {
    return await submitSupabaseLeaderboard(profile, car, track, lapData);
  } catch (error) {
    console.warn('Supabase leaderboard submit failed, trying local server API.', error);
  }

  const res = await fetch(`${API_BASE}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: profile.id,
      playerName: safeNickname(profile.name, 'Driver'),
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

  if (!channel) {
    channel = getSupabase()
      .channel('public:leaderboard_records')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, async payload => {
        const row = payload.new || payload.old || {};
        const carId = row.car_id || '';
        const trackId = row.track_id || '';
        try {
          const result = await fetchLeaderboard('', trackId, 20);
          for (const fn of listeners) {
            fn({ carId, trackId, leaderboard: result.leaderboard || [] });
          }
        } catch {}
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Supabase realtime leaderboard channel status:', status);
        }
      });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      getSupabase().removeChannel(channel);
      channel = null;
    }
  };
}

async function fetchSupabaseLeaderboard(carId, trackId, limit = 10) {
  let query = getSupabase()
    .from(TABLE)
    .select('player_id,player_name,car_id,car_name,track_id,track_name,lap_ms,sectors,created_at,updated_at')
    .order('lap_ms', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit) || 10, 50)));

  if (carId) query = query.eq('car_id', carId);
  if (trackId) query = query.eq('track_id', trackId);

  const { data, error } = await query;
  if (error) throw error;

  return { leaderboard: toLeaderboardRows(data || []) };
}

async function submitSupabaseLeaderboard(profile, car, track, lapData) {
  const client = getSupabase();
  const lapMs = Math.round(Number(lapData.lapMs));
  const now = Date.now();

  const { data: existing, error: existingError } = await client
    .from(TABLE)
    .select('lap_ms,created_at')
    .eq('player_id', profile.id)
    .eq('car_id', car.id)
    .eq('track_id', track.id)
    .maybeSingle();

  if (existingError) throw existingError;

  const improved = !existing || lapMs < existing.lap_ms;
  const { error } = await client
    .from(TABLE)
    .upsert({
      player_id: profile.id,
      player_name: safeNickname(profile.name, 'Driver'),
      car_id: car.id,
      car_name: car.name,
      track_id: track.id,
      track_name: track.name,
      lap_ms: lapMs,
      sectors: lapData.sectors || [],
      created_at: existing?.created_at || now,
      updated_at: now,
    }, { onConflict: 'player_id,car_id,track_id' });

  if (error) throw error;

  const result = await fetchSupabaseLeaderboard('', track.id, 20);
  const rank = result.leaderboard.find(row => row.playerId === profile.id && row.carId === car.id)?.rank ?? null;
  return {
    accepted: true,
    improved,
    rank,
    leaderboard: result.leaderboard,
  };
}

function toLeaderboardRows(rows) {
  return rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    playerName: row.player_name,
    carId: row.car_id,
    carName: row.car_name,
    trackId: row.track_id,
    trackName: row.track_name,
    lapMs: row.lap_ms,
    sectors: row.sectors || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
