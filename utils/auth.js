import { getSupabase } from './supabaseClient.js';

let currentUser = null;
const listeners = new Set();

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
      emailRedirectTo: window.location.origin + window.location.pathname,
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
