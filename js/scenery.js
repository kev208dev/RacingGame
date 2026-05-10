// Background scenery — only BoxGeometry / CylinderGeometry, no asset loads.
// Placed close to the track edge for stronger speed sensation.

import * as THREE from 'three';
import { pointInPolygon } from '../utils/math.js';

// ── tree (cone leaf + cylinder trunk) ────────────────────────────────
function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunkH = 6 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7 * scale, 1.0 * scale, trunkH, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a3a20 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafColor = [0x2a6b2a, 0x366f2c, 0x3d7a30, 0x2f5c25][Math.floor(Math.random()*4)];
  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(4 * scale, 12 * scale, 6),
    new THREE.MeshLambertMaterial({ color: leafColor })
  );
  leaf.position.y = trunkH + 5 * scale;
  leaf.castShadow = true;
  g.add(leaf);
  return g;
}

// ── grandstand (3 stepped boxes) ─────────────────────────────────────
function makeGrandstand() {
  const g = new THREE.Group();
  const matFrame = new THREE.MeshLambertMaterial({ color: 0x9da8b8 });
  const matSeats = new THREE.MeshLambertMaterial({ color: 0x4f6072 });
  for (let i = 0; i < 4; i++) {
    const w = 80, h = 5 + i * 3.5, d = 5;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i === 3 ? matFrame : matSeats);
    step.position.set(0, h / 2, -i * d);
    step.castShadow = true;
    step.receiveShadow = true;
    g.add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(86, 1.5, 22), matFrame);
  roof.position.set(0, 19, -10);
  g.add(roof);
  return g;
}

// ── billboard (vertical signboard on a post) ─────────────────────────
function makeBillboard() {
  const g = new THREE.Group();
  const palette = [0xff5a2a, 0x2a90ff, 0xffce2a, 0x37c777, 0xe540a0, 0x9066ff];
  const c = palette[Math.floor(Math.random() * palette.length)];
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0x444444 })
  );
  post.position.y = 7;
  g.add(post);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(20, 7, 0.6),
    new THREE.MeshLambertMaterial({ color: c })
  );
  board.position.y = 14;
  board.castShadow = true;
  g.add(board);
  return g;
}

// ── pit garages (line of long boxes) ─────────────────────────────────
function makePitGarages() {
  const g = new THREE.Group();
  const matFrame = new THREE.MeshLambertMaterial({ color: 0xdadcdf });
  const matRoof  = new THREE.MeshLambertMaterial({ color: 0x88c0ff });
  for (let i = 0; i < 6; i++) {
    const u = new THREE.Mesh(new THREE.BoxGeometry(36, 11, 18), matFrame);
    u.position.set(i * 38, 5.5, 0);
    u.castShadow = true;
    u.receiveShadow = true;
    g.add(u);
    const r = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 20), matRoof);
    r.position.set(i * 38, 11.5, 0);
    g.add(r);
  }
  return g;
}

// ── distant mountain (low-poly cone with snow cap) ───────────────────
function makeMountain(h, baseR) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(baseR, h, 6),
    new THREE.MeshLambertMaterial({ color: 0x435562 })
  );
  m.position.y = h / 2;
  g.add(m);
  const snow = new THREE.Mesh(
    new THREE.ConeGeometry(baseR * 0.4, h * 0.35, 6),
    new THREE.MeshLambertMaterial({ color: 0xeeeeee })
  );
  snow.position.y = h * 0.55;
  g.add(snow);
  return g;
}

// ── flag pole ────────────────────────────────────────────────────────
function makeFlagPole() {
  const g = new THREE.Group();
  const colors = [0xff3c3c, 0x3cff64, 0x3c8eff, 0xffd23c, 0xe040ff];
  const flagCol = colors[Math.floor(Math.random()*colors.length)];
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 14, 6),
    new THREE.MeshLambertMaterial({ color: 0xeeeeee })
  );
  pole.position.y = 7;
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(7, 4, 0.2),
    new THREE.MeshLambertMaterial({ color: flagCol })
  );
  flag.position.set(3.5, 12, 0);
  flag.name = 'flag';
  g.add(flag);
  return g;
}

// ── tire stack ───────────────────────────────────────────────────────
function makeTireStack() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 12), mat);
    t.position.y = 0.6 + i * 1.3;
    g.add(t);
  }
  return g;
}

// ── marshal post (small wooden box) ──────────────────────────────────
function makeMarshalPost() {
  const g = new THREE.Group();
  const mat  = new THREE.MeshLambertMaterial({ color: 0xd4b06a });
  const matR = new THREE.MeshLambertMaterial({ color: 0xcc1818 });
  const box  = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), mat);
  box.position.y = 3;
  box.castShadow = true;
  g.add(box);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 5), matR);
  roof.position.y = 6.5;
  g.add(roof);
  return g;
}

// ── scatter rules ────────────────────────────────────────────────────
export function scatterProps(scene, track) {
  const propsGroup = new THREE.Group();
  scene.add(propsGroup);

  // ── distant mountain ring ──
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.21;
    const r = 6500;
    const mh = 600 + Math.random() * 300;
    const mr = 600 + Math.random() * 200;
    const m  = makeMountain(mh, mr);
    m.position.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
    propsGroup.add(m);
  }

  const cl = track.centerLine;
  const trackW = track.width || 100;
  if (!cl || cl.length === 0) return propsGroup;

  // ── trees densely placed just outside the wall (close-up speed cues) ──
  // Step along the centerline; offset perpendicular outward, stagger distance.
  for (let i = 0; i < cl.length; i++) {
    const [cx, cy] = cl[i];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - cx, ty = ny - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const px =  ty / tl;            // outward perpendicular
    const py = -tx / tl;
    // Trees on outer side
    if (i % 3 === 0 && Math.random() < 0.85) {
      const off = trackW / 2 + 18 + Math.random() * 22;
      const sx = cx + px * off;
      const sy = cy + py * off;
      const t = makeTree(0.7 + Math.random() * 0.7);
      t.position.set(sx, 0, -sy);
      t.rotation.y = Math.random() * Math.PI * 2;
      propsGroup.add(t);
    }
    // Trees on inner side, less dense
    if (i % 6 === 0 && Math.random() < 0.55) {
      const off = trackW / 2 + 18 + Math.random() * 28;
      const sx = cx - px * off;
      const sy = cy - py * off;
      // skip if it would land on the track (rare with offset >= halfWidth + 18)
      if (pointInPolygon(sx, sy, track.outerBoundary) && !pointInPolygon(sx, sy, track.innerBoundary)) continue;
      const t = makeTree(0.7 + Math.random() * 0.7);
      t.position.set(sx, 0, -sy);
      t.rotation.y = Math.random() * Math.PI * 2;
      propsGroup.add(t);
    }
  }

  // ── billboards at moderate intervals just outside the wall ──
  for (let i = 0; i < cl.length; i += 32) {
    const [cx, cy] = cl[i];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - cx, ty = ny - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const px =  ty / tl;
    const py = -tx / tl;
    const off = trackW / 2 + 14;
    const sx = cx + px * off;
    const sy = cy + py * off;
    const b = makeBillboard();
    b.position.set(sx, 0, -sy);
    b.rotation.y = Math.atan2(ty, tx) + Math.PI / 2;  // face the track
    propsGroup.add(b);
  }

  // ── tire stacks at every Nth point on the inside of corners ──
  for (let i = 0; i < cl.length; i += 14) {
    const [cx, cy] = cl[i];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - cx, ty = ny - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const px =  ty / tl, py = -tx / tl;
    if (Math.random() > 0.55) continue;
    const off = trackW / 2 + 8;
    const side = Math.random() < 0.5 ? -1 : 1;
    const sx = cx + side * px * off;
    const sy = cy + side * py * off;
    const stack = makeTireStack();
    stack.position.set(sx, 0, -sy);
    propsGroup.add(stack);
  }

  // ── grandstands ONLY clustered around start/finish ──
  if (track.startPos) {
    const sp = track.startPos;
    const sa = sp.angle;
    const fwdX = Math.cos(sa), fwdY = Math.sin(sa);
    const perpX = -Math.sin(sa), perpY = Math.cos(sa);
    // Two grandstands, one each side of the start line, set back from track.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const longOff = (k - 0.5) * 110;          // straddle start line
        const sideOff = side * (trackW / 2 + 38);
        const wx = sp.x + fwdX * longOff + perpX * sideOff;
        const wy = sp.y + fwdY * longOff + perpY * sideOff;
        const gs = makeGrandstand();
        gs.position.set(wx, 0, -wy);
        gs.rotation.y = sa + (side > 0 ? Math.PI : 0);
        propsGroup.add(gs);
      }
    }
    // Pit garages on the inner side of start
    const pits = makePitGarages();
    const pitsX = sp.x - fwdX * 100 + perpX * (trackW / 2 + 30) * -1;
    const pitsY = sp.y - fwdY * 100 + perpY * (trackW / 2 + 30) * -1;
    pits.position.set(pitsX, 0, -pitsY);
    pits.rotation.y = sa;
    propsGroup.add(pits);

    // Flag poles flanking the start line
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const lo = (k - 1.5) * 60;
        const so = side * (trackW / 2 + 18);
        const wx = sp.x + fwdX * lo + perpX * so;
        const wy = sp.y + fwdY * lo + perpY * so;
        const f = makeFlagPole();
        f.position.set(wx, 0, -wy);
        f.rotation.y = sa + (side > 0 ? Math.PI : 0);
        propsGroup.add(f);
      }
    }
  }

  // ── marshal posts every ~30 centerline points, on the outer side ──
  for (let i = 8; i < cl.length; i += 30) {
    const [cx, cy] = cl[i];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - cx, ty = ny - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const px =  ty / tl, py = -tx / tl;
    const off = trackW / 2 + 12;
    const sx = cx + px * off, sy = cy + py * off;
    const m = makeMarshalPost();
    m.position.set(sx, 0, -sy);
    m.rotation.y = Math.atan2(ty, tx);
    propsGroup.add(m);
  }

  return propsGroup;
}

// gentle flag flutter
export function updateScenery(propsGroup, time) {
  if (!propsGroup) return;
  propsGroup.traverse(c => {
    if (c.name === 'flag') {
      c.rotation.y = Math.sin(time * 0.004 + c.position.x * 0.01) * 0.35;
    }
  });
}
