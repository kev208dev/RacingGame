import { getSupabase } from './supabaseClient.js';

let currentUser = null;
const listeners = new Set();
const AUTH_REDIRECT_URL = 'https://kev208dev.github.io/RacingGame/';

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
  const { error } = await getSupabase().auth.signInWithOtp({
    email: clean,
    options: {
      emailRedirectTo: getRedirectUrl(),
      shouldCreateUser: true,
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
