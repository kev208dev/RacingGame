import { CAR_DATA } from '../data/cars.js';
import { MISSIONS } from '../data/missions.js';
import { getCurrentUser, onAuthChange } from './auth.js';
import { getSupabase } from './supabaseClient.js';
import { getPlayerProfile, setLeaderboardIdentity, setPlayerName } from './leaderboard.js';
import { safeNickname, validateNickname } from './nicknameFilter.js';

const TABLE = 'player_profiles';
const DEFAULT_OWNED = ['apex_gt3', 'feather_sprint'];
const DEFAULT_THEME = '#2ec4b6';
const SUPER_ACCOUNT_EMAILS = new Set([
  'kev208dev@gmail.com',
  'kev208ev@gmail.com',
]);
const ALL_CAR_IDS = CAR_DATA.map(car => car.id);

let profile = null;
let loading = false;
let authUnsub = null;
const listeners = new Set();

export function initProfile() {
  if (authUnsub) return;
  authUnsub = onAuthChange(async user => {
    if (!user) {
      profile = null;
      setLeaderboardIdentity(null);
      notify();
      return;
    }
    loading = true;
    notify();
    try {
      profile = await ensureProfile(user);
      setPlayerName(profile.nickname);
      setLeaderboardIdentity({ id: profile.user_id, name: profile.nickname, themeColor: profile.theme_color });
    } catch (error) {
      console.warn('Profile load failed:', error);
      profile = null;
      setLeaderboardIdentity(null);
    } finally {
      loading = false;
      notify();
    }
  });
}

export function getProfile() {
  return profile;
}

export function isProfileLoading() {
  return loading;
}

export function onProfileChange(listener) {
  listeners.add(listener);
  listener(profile);
  return () => listeners.delete(listener);
}

export function getDisplayProfile() {
  if (profile) {
    return {
      id: profile.user_id,
      name: profile.nickname,
      themeColor: profile.theme_color || DEFAULT_THEME,
    };
  }
  const local = getPlayerProfile();
  return { id: local.id, name: local.name, themeColor: DEFAULT_THEME };
}

export function isOwned(carId) {
  if (isSuperAccount()) return ALL_CAR_IDS.includes(carId);
  if (!getCurrentUser()) return DEFAULT_OWNED.includes(carId);
  return !!profile?.owned_car_ids?.includes(carId);
}

export async function updateProfileSettings({ nickname, themeColor }) {
  if (!profile) throw new Error('login-required');
  const cleanName = validateNickname(nickname, profile.nickname);
  const cleanColor = normalizeColor(themeColor) || profile.theme_color || DEFAULT_THEME;
  const next = { nickname: cleanName, theme_color: cleanColor };
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(next)
    .eq('user_id', profile.user_id)
    .select('*')
    .single();
  if (error) throw error;
  profile = normalizeProfile(data);
  setPlayerName(profile.nickname);
  setLeaderboardIdentity({ id: profile.user_id, name: profile.nickname });
  notify();
  return profile;
}

export async function purchaseCar(car) {
  if (!profile) throw new Error('login-required');
  if (isOwned(car.id)) return profile;
  const price = Number(car.price || 0);
  if (price <= 0) return addOwnedCar(car.id);
  if ((profile.coins || 0) < price) throw new Error('not-enough-coins');
  const nextOwned = unique([...(profile.owned_car_ids || []), car.id]);
  const nextCoins = Math.max(0, (profile.coins || 0) - price);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ coins: nextCoins, owned_car_ids: nextOwned })
    .eq('user_id', profile.user_id)
    .select('*')
    .single();
  if (error) throw error;
  profile = normalizeProfile(data);
  notify();
  return profile;
}

export async function claimStarterCar(carId) {
  if (!profile) throw new Error('login-required');
  if (profile.starter_claimed) return profile;
  const car = CAR_DATA.find(item => item.id === carId);
  if (!car) throw new Error('unknown-car');
  const nextOwned = unique([...(profile.owned_car_ids || []), car.id]);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ owned_car_ids: nextOwned, starter_claimed: true })
    .eq('user_id', profile.user_id)
    .select('*')
    .single();
  if (error) throw error;
  profile = normalizeProfile(data);
  notify();
  return profile;
}

export async function awardMissions(trackId, lapMs) {
  if (!profile) return [];
  const completed = new Set(profile.completed_missions || []);
  const rewards = MISSIONS.filter(mission =>
    mission.trackId === trackId &&
    lapMs <= mission.lapMs &&
    !completed.has(mission.id)
  );
  if (!rewards.length) return [];
  const rewardCoins = rewards.reduce((sum, mission) => sum + mission.reward, 0);
  const nextCompleted = unique([...(profile.completed_missions || []), ...rewards.map(m => m.id)]);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({
      coins: (profile.coins || 0) + rewardCoins,
      completed_missions: nextCompleted,
    })
    .eq('user_id', profile.user_id)
    .select('*')
    .single();
  if (error) throw error;
  profile = normalizeProfile(data);
  notify();
  return rewards;
}

export function rollStarterCar() {
  const pool = CAR_DATA.filter(car => (car.starterWeight || 0) > 0 && !isOwned(car.id));
  const fallback = CAR_DATA.find(car => !isOwned(car.id)) || CAR_DATA[0];
  if (!pool.length) return fallback;
  const total = pool.reduce((sum, car) => sum + car.starterWeight, 0);
  let ticket = Math.random() * total;
  for (const car of pool) {
    ticket -= car.starterWeight;
    if (ticket <= 0) return car;
  }
  return pool[pool.length - 1];
}

async function addOwnedCar(carId) {
  const nextOwned = unique([...(profile.owned_car_ids || []), carId]);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ owned_car_ids: nextOwned })
    .eq('user_id', profile.user_id)
    .select('*')
    .single();
  if (error) throw error;
  profile = normalizeProfile(data);
  notify();
  return profile;
}

async function ensureProfile(user) {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const normalized = normalizeProfile(data);
    if (isSuperAccount(user) && !ALL_CAR_IDS.every(id => normalized.owned_car_ids.includes(id))) {
      await getSupabase()
        .from(TABLE)
        .update({ owned_car_ids: ALL_CAR_IDS, starter_claimed: true })
        .eq('user_id', user.id);
      return { ...normalized, owned_car_ids: ALL_CAR_IDS, starter_claimed: true };
    }
    return normalized;
  }

  const local = getPlayerProfile();
  const nickname = safeNickname(
    user.user_metadata?.name || local.name,
    `Driver-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const { data: created, error: createError } = await getSupabase()
    .from(TABLE)
    .insert({
      user_id: user.id,
      nickname,
      theme_color: DEFAULT_THEME,
      coins: 0,
      owned_car_ids: isSuperAccount(user) ? ALL_CAR_IDS : DEFAULT_OWNED,
      completed_missions: [],
      starter_claimed: isSuperAccount(user),
    })
    .select('*')
    .single();
  if (createError) throw createError;
  return normalizeProfile(created);
}

function normalizeProfile(row) {
  const owned = Array.isArray(row.owned_car_ids) ? row.owned_car_ids : DEFAULT_OWNED;
  return {
    ...row,
    nickname: safeNickname(row.nickname, 'Driver'),
    theme_color: normalizeColor(row.theme_color) || DEFAULT_THEME,
    coins: Number(row.coins || 0),
    owned_car_ids: isSuperAccount() ? ALL_CAR_IDS : owned,
    completed_missions: Array.isArray(row.completed_missions) ? row.completed_missions : [],
    starter_claimed: isSuperAccount() || !!row.starter_claimed,
  };
}

function isSuperAccount(user = getCurrentUser()) {
  const email = String(user?.email || '').trim().toLowerCase();
  return SUPER_ACCOUNT_EMAILS.has(email);
}

function normalizeColor(value) {
  const text = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : null;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function notify() {
  for (const fn of listeners) fn(profile);
}
