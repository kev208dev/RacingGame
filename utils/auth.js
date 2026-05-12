import { getSupabase } from './supabaseClient.js';

let currentUser = null;
const listeners = new Set();
const AUTH_REDIRECT_URL = 'https://kev208dev.github.io/RacingGame/';
const EMAIL_COOLDOWN_KEY = 'racing_auth_email_cooldown_until';
const EMAIL_COOLDOWN_MS = 90 * 1000;
const EMAIL_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;

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
  if (!clean) throw new Error('email-required');
  const cooldownUntil = Number(localStorage.getItem(EMAIL_COOLDOWN_KEY) || 0);
  if (cooldownUntil > Date.now()) {
    const error = new Error('email-cooldown');
    error.code = 'email-cooldown';
    error.retryAfterMs = cooldownUntil - Date.now();
    throw error;
  }
  const { error } = await getSupabase().auth.signInWithOtp({
    email: clean,
    options: {
      emailRedirectTo: getRedirectUrl(),
      shouldCreateUser: true,
    },
  });
  if (error) {
    if (isEmailRateLimitError(error)) {
      localStorage.setItem(EMAIL_COOLDOWN_KEY, String(Date.now() + EMAIL_LIMIT_COOLDOWN_MS));
      const next = new Error('email-rate-limited');
      next.code = 'email-rate-limited';
      next.retryAfterMs = EMAIL_LIMIT_COOLDOWN_MS;
      throw next;
    }
    throw error;
  }
  localStorage.setItem(EMAIL_COOLDOWN_KEY, String(Date.now() + EMAIL_COOLDOWN_MS));
}

export async function signInWithGoogle() {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectUrl(),
    },
  });
  if (error) throw error;
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

function isEmailRateLimitError(error) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.status || ''}`.toLowerCase();
  return text.includes('rate') || text.includes('exceed') || text.includes('too many');
}
