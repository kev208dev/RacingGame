export async function shareScore(score) {
  const text = `I scored ${Number(score || 0).toLocaleString()} in Racing Sandbox 3D. Can you beat me?`;
  const url = window.location.href;
  if (navigator.share) {
    await navigator.share({ title: 'Racing Sandbox 3D', text, url });
    return true;
  }
  await navigator.clipboard?.writeText(`${text} ${url}`);
  alert('Share link copied');
  return false;
}

export async function shareResult(result) {
  if (!result?.finishTime && !result?.score) {
    return { ok: false, message: 'No result to share yet' };
  }
  const modeName = modeLabel(result.mode);
  const formattedTime = result.formattedTime || formatMs(result.finishTime || result.lapMs);
  const url = 'https://racinggame.fly.dev';
  const text = `I finished ${modeName} in ${formattedTime} on Racing Sandbox 3D. Can you beat me? ${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Racing Sandbox 3D', text, url });
      return { ok: true, message: 'Shared' };
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, message: 'Share text copied' };
    }
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, message: 'Share canceled' };
  }
  window.prompt('Copy your result', text);
  return { ok: true, message: 'Share text ready' };
}

function modeLabel(mode) {
  if (mode === 'ranked') return '경쟁모드';
  if (mode === 'friendly') return '친선전';
  return '기록깨기 모드';
}

function formatMs(ms) {
  const n = Math.max(0, Math.round(Number(ms || 0)));
  const minutes = Math.floor(n / 60000);
  const seconds = Math.floor((n % 60000) / 1000);
  const millis = n % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
