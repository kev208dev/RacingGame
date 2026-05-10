// ─────────────────────────────────────────────────────────────────────
//  Visual juice: tire smoke, skid marks, sparks, speed lines, screen
//  shake, FOV pump. All effects are cheap (small geometry pools, no
//  per-frame allocation).
// ─────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

// ── tire smoke (3D billboards) ────────────────────────────────────────
export function createSmokePool(scene, count = 80) {
  const geo = new THREE.PlaneGeometry(8, 8);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xeeeeee, transparent: true, opacity: 0.0,
    depthWrite: false,
  });
  const pool = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    scene.add(m);
    pool.push({
      mesh: m,
      age:  0,
      life: 0,
      vx: 0, vy: 0, vz: 0,
      scale: 1,
    });
  }
  return pool;
}

export function spawnSmoke(pool, x, y, z, color = 0xeeeeee) {
  for (const p of pool) {
    if (p.life <= 0) {
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(x, y, z);
      p.scale = 1.0;
      p.mesh.scale.set(p.scale, p.scale, p.scale);
      p.mesh.material.opacity = 0.55;
      p.mesh.visible = true;
      p.age = 0;
      p.life = 0.7 + Math.random() * 0.3;       // sec
      p.vx = (Math.random() - 0.5) * 6;
      p.vy = 4 + Math.random() * 4;
      p.vz = (Math.random() - 0.5) * 6;
      return;
    }
  }
}

export function updateSmoke(pool, dt) {
  for (const p of pool) {
    if (p.life <= 0) continue;
    p.age += dt;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    const t = p.age / (p.age + p.life);     // 0..1
    p.scale = 1.0 + t * 4.0;
    p.mesh.scale.set(p.scale, p.scale, p.scale);
    p.mesh.material.opacity = Math.max(0, 0.55 * (1 - t));
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy *= Math.pow(0.4, dt);
  }
}

// ── skid marks (single buffered geometry that grows) ─────────────────
export function createSkidBuffer(scene, capSegments = 400) {
  // Each segment is two triangles (quad) → 6 vertices, 18 floats.
  const positions = new Float32Array(capSegments * 6 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x101010, transparent: true, opacity: 0.65,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  scene.add(mesh);

  return {
    mesh,
    positions,
    capSegments,
    head: 0,        // next segment slot
    count: 0,       // segments currently filled
    reset() {
      this.head = 0;
      this.count = 0;
      geo.setDrawRange(0, 0);
    },
    appendQuad(ax, az, bx, bz, halfWidth = 1.4) {
      // Compute perpendicular for the quad cross-section.
      const dx = bx - ax, dz = bz - az;
      const dl = Math.hypot(dx, dz) || 1;
      const px =  dz / dl * halfWidth;
      const pz = -dx / dl * halfWidth;
      const i = this.head * 18;
      const arr = positions;
      // tri 1: A-pl, A-pr, B-pr
      arr[i+0]  = ax - px; arr[i+1]  = 0.05; arr[i+2]  = az - pz;
      arr[i+3]  = ax + px; arr[i+4]  = 0.05; arr[i+5]  = az + pz;
      arr[i+6]  = bx + px; arr[i+7]  = 0.05; arr[i+8]  = bz + pz;
      // tri 2: A-pl, B-pr, B-pl
      arr[i+9]  = ax - px; arr[i+10] = 0.05; arr[i+11] = az - pz;
      arr[i+12] = bx + px; arr[i+13] = 0.05; arr[i+14] = bz + pz;
      arr[i+15] = bx - px; arr[i+16] = 0.05; arr[i+17] = bz - pz;

      this.head = (this.head + 1) % this.capSegments;
      if (this.count < this.capSegments) this.count++;
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, this.count * 6);
    },
  };
}

// ── sparks (small short-lived emissive boxes) ────────────────────────
export function createSparkPool(scene, count = 40) {
  const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
  const pool = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    scene.add(m);
    pool.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  return pool;
}

export function spawnSparks(pool, x, y, z, count = 14) {
  let emitted = 0;
  for (const p of pool) {
    if (emitted >= count) break;
    if (p.life > 0) continue;
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
    p.mesh.material.color.setHSL(
      0.10 + Math.random() * 0.05, 1.0, 0.55 + Math.random() * 0.2
    );
    p.life = 0.30 + Math.random() * 0.25;
    const sp = 30 + Math.random() * 60;
    const a  = Math.random() * Math.PI * 2;
    p.vx = Math.cos(a) * sp;
    p.vz = Math.sin(a) * sp;
    p.vy = 25 + Math.random() * 25;
    emitted++;
  }
}

export function updateSparks(pool, dt) {
  for (const p of pool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 200 * dt;             // gravity
    const s = Math.max(0.2, p.life * 2);
    p.mesh.scale.set(s, s, s);
  }
}

// ── screen shake (camera offset) ─────────────────────────────────────
export function makeShake() {
  return { amount: 0, decay: 6.0 };
}
export function triggerShake(state, amount) {
  state.amount = Math.max(state.amount, amount);
}
export function tickShake(state, dt) {
  state.amount *= Math.exp(-state.decay * dt);
  if (state.amount < 0.05) { state.amount = 0; return { x: 0, y: 0 }; }
  return {
    x: (Math.random() - 0.5) * state.amount * 2,
    y: (Math.random() - 0.5) * state.amount * 2,
  };
}

// ── speed lines (Canvas-2D overlay, drawn on the HUD canvas) ─────────
export function makeSpeedLines(count = 60) {
  const arr = new Array(count);
  for (let i = 0; i < count; i++) {
    arr[i] = { x: 0, y: 0, vx: 0, vy: 0, len: 0, alpha: 0, life: 0 };
  }
  return arr;
}

export function drawSpeedLines(ctx, lines, kmh, w, h, dt, cameraMode = 'chase') {
  if (cameraMode === 'high') {
    for (const p of lines) p.life = 0;
    return;
  }
  // Activate above 60 km/h so the player feels speed sooner.
  if (kmh < 105) {
    for (const p of lines) p.life = 0;
    return;
  }
  const intensity = Math.min(1, (kmh - 105) / 240);
  const cx = w * 0.5, cy = h * 0.62;
  const speedScale = 900 + intensity * 1700;
  const spawnRate  = 45 + intensity * 115;

  // Spawn fresh particles
  let toSpawn = spawnRate * dt;
  for (const p of lines) {
    if (p.life > 0) continue;
    if (toSpawn <= 0) break;
    const a   = Math.random() * Math.PI * 2;
    const r0  = 60 + Math.random() * 220;
    p.x = cx + Math.cos(a) * r0;
    p.y = cy + Math.sin(a) * r0;
    p.vx = Math.cos(a) * speedScale;
    p.vy = Math.sin(a) * speedScale;
    p.len = 18 + Math.random() * 26;
    p.alpha = 0.08 + Math.random() * 0.14;
    p.life  = 0.28;
    toSpawn -= 1;
  }

  // Update + draw
  ctx.save();
  ctx.lineCap = 'round';
  for (const p of lines) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -100 || p.x > w + 100 || p.y < -100 || p.y > h + 100) {
      p.life = 0; continue;
    }
    const dx = p.vx, dy = p.vy;
    const dl = Math.hypot(dx, dy) || 1;
    const tx = -dx / dl * p.len;
    const ty = -dy / dl * p.len;
    ctx.strokeStyle = `rgba(190,220,255,${p.alpha * intensity})`;
    ctx.lineWidth = 0.8 + intensity * 0.8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + tx, p.y + ty);
    ctx.stroke();
  }
  ctx.restore();
}

// ── FOV pump (camera lerps from base FOV up to base+boost) ───────────
export function updateFovPump(camera, kmh, maxKmh, boostActive, dt) {
  const baseFov  = 62;
  const speedFovBoost = 20;
  const boostFov = 86;
  const t = Math.min(1, kmh / maxKmh);
  // Quadratic so the pump kicks in harder at high speed.
  let target = baseFov + (t * t) * speedFovBoost;
  if (boostActive) target = Math.max(target, boostFov);
  const k = 1 - Math.exp(-4.6 * dt);
  camera.fov += (target - camera.fov) * k;
  camera.updateProjectionMatrix();
}
