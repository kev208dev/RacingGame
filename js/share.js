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
