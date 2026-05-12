import { getSupabase } from './supabaseClient.js';

let currentUser = null;
const listeners = new Set();
const AUTH_REDIRECT_URL = 'https://kev208dev.github.io/RacingGame/';
const COOLDOWN_KEY = 'racing_magiclink_cooldown';
const COOLDOWN_SECONDS = 60;

export function getMagicLinkCooldownRemaining(email) {
  try {
    const map = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}');
    const key = String(email || '').trim().toLowerCase();
    const until = Number(map[key] || 0);
    const remain = Math.ceil((until - Date.now()) / 1000);
    return remain > 0 ? remain : 0;
  } catch {
    return 0;
  }
}

function setMagicLinkCooldown(email, seconds = COOLDOWN_SECONDS) {
  try {
    const map = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}');
    const key = String(email || '').trim().toLowerCase();
    if (!key) return;
    map[key] = Date.now() + seconds * 1000;
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(map));
  } catch {}
}

export async function initAuth() {
  const { data } = await getSupabase().auth.getUser();
  currentUser = data?.user || null;
  notify();

  getSupabase().auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    notify();
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!currentUser;
}

export function onAuthChange(listener) {
  listeners.add(listener);
  listener(currentUser);
  return () => listeners.delete(listener);
}

export async function sendMagicLink(email) {
  const clean = String(email || '').trim();
  if (!clean) {
    const err = new Error('이메일 주소를 입력하세요.');
    err.code = 'email-required';
    throw err;
  }
  const remain = getMagicLinkCooldownRemaining(clean);
  if (remain > 0) {
    const err = new Error(`이메일 발송 대기 중입니다. ${remain}초 후 다시 시도하세요.`);
    err.code = 'rate-limited';
    err.retryAfter = remain;
    throw err;
  }
  const { error } = await getSupabase().auth.signInWithOtp({
    email: clean,
    options: {
      emailRedirectTo: getRedirectUrl(),
      shouldCreateUser: true,
    },
  });
  if (error) {
    const status = error.status || 0;
    const raw = String(error.message || '').toLowerCase();
    const isRateLimit =
      status === 429 ||
      raw.includes('rate limit') ||
      raw.includes('rate_limit') ||
      raw.includes('over_email_send_rate_limit') ||
      raw.includes('for security purposes') ||
      raw.includes('email_send_rate');
    if (isRateLimit) {
      const seconds = _extractRetrySeconds(error.message) || COOLDOWN_SECONDS;
      setMagicLinkCooldown(clean, seconds);
      const wrapped = new Error(`이메일 발송 한도에 도달했습니다. ${seconds}초 후 다시 시도하세요.`);
      wrapped.code = 'rate-limited';
      wrapped.retryAfter = seconds;
      throw wrapped;
    }
    throw error;
  }
  setMagicLinkCooldown(clean, COOLDOWN_SECONDS);
}

function _extractRetrySeconds(message) {
  const text = String(message || '');
  const m = text.match(/(\d+)\s*seconds?/i);
  return m ? Math.min(600, Number(m[1])) : 0;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

function notify() {
  for (const fn of listeners) fn(currentUser);
}

function getRedirectUrl() {
  const base = new URL('./', window.location.href).href;
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return isLocal ? AUTH_REDIRECT_URL : base;
}
