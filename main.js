import { initCarSelect }   from './screens/carSelect.js';
import { initTrackSelect }  from './screens/trackSelect.js';
import { initGame, updateGame, stopGame } from './screens/game.js';
import { initResults }      from './screens/results.js';
import { clearFrameKeys }   from './utils/input.js';

let currentScreen = 'carSelect';
let selectedCar   = null;
let selectedTrack = null;
let lastTime      = 0;

// ── screen helpers ──────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function hideScreens() {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
}

// ── transitions ─────────────────────────────────────────────
function goToCarSelect() {
  currentScreen = 'carSelect';
  showScreen('screen-carselect');
  initCarSelect((car) => {
    selectedCar = car;
    goToTrackSelect();
  });
}

function goToTrackSelect() {
  currentScreen = 'trackSelect';
  showScreen('screen-trackselect');
  initTrackSelect(
    (track) => { selectedTrack = track; goToGame(); },
    ()      => { goToCarSelect(); }
  );
}

function goToGame() {
  currentScreen = 'game';
  hideScreens();
  initGame(
    selectedCar, selectedTrack,
    (lapData) => { goToResults(lapData); },
    ()        => { goToCarSelect(); }
  );
}

function goToResults(lapData) {
  currentScreen = 'results';
  stopGame();
  showScreen('screen-results');
  initResults(
    lapData,
    selectedCar,
    selectedTrack,
    () => { goToGame(); },       // retry
    () => { goToCarSelect(); }   // menu
  );
}

// ── game loop ────────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (currentScreen === 'game') {
    updateGame(dt, timestamp);
  }

  clearFrameKeys();
  requestAnimationFrame(gameLoop);
}

// ── help button (always visible, opens controls modal) ──────
function _wireHelpButton() {
  const btn   = document.getElementById('btn-help');
  const overlay = document.getElementById('help-overlay');
  const close = document.getElementById('btn-help-close');
  if (!btn || !overlay) return;
  const open  = () => overlay.classList.remove('hidden');
  const hide  = () => overlay.classList.add('hidden');
  btn.addEventListener('click', open);
  close && close.addEventListener('click', hide);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) hide();
  });
  // ESC closes if open (but only when overlay is the topmost UI)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      hide();
      e.stopPropagation();
    }
  }, true);
}
_wireHelpButton();

// ── start ────────────────────────────────────────────────────
goToCarSelect();
requestAnimationFrame(gameLoop);
