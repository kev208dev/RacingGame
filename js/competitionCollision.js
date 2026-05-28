export function handleCarCollision(carA, carB, collisionInfo = {}) {
  if (!carA || !carB) return false;
  const strength = Number(collisionInfo.strength || 1);
  applyCollisionImpulse(carA, carB, strength);
  return true;
}

export function applyCollisionImpulse(carA, carB, strength = 1) {
  const dx = (carA.x || 0) - (carB.x || 0);
  const dy = (carA.y || 0) - (carB.y || 0);
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const impulse = Math.max(0.2, Math.min(2.5, strength));
  carA.vx = (carA.vx || 0) * 0.82 + nx * impulse * 12;
  carA.vy = (carA.vy || 0) * 0.82 + ny * impulse * 12;
  carB.vx = (carB.vx || 0) * 0.88 - nx * impulse * 8;
  carB.vy = (carB.vy || 0) * 0.88 - ny * impulse * 8;
  carA.angle = (carA.angle || 0) + (Math.random() - 0.5) * 0.05 * impulse;
  carB.angle = (carB.angle || 0) - (Math.random() - 0.5) * 0.04 * impulse;
}

export function checkOpponentCollision(playerCar, opponents = [], mode = 'timeTrial') {
  if (mode === 'timeTrial' || !playerCar || !Array.isArray(opponents)) return false;
  for (const opponent of opponents) {
    const dx = (playerCar.x || 0) - (opponent.x || 0);
    const dy = (playerCar.y || 0) - (opponent.y || 0);
    const dist = Math.hypot(dx, dy);
    if (dist < Number(opponent.collisionRadius || 18)) {
      return handleCarCollision(playerCar, opponent, { strength: (18 - dist) / 18 + 0.4 });
    }
  }
  return false;
}
