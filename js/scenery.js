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
  const matFrame = new THREE.MeshLambertMaterial({ color: 0xbec5c9 });
  const matSeats = new THREE.MeshLambertMaterial({ color: 0x656b72 });
  const matRoof  = new THREE.MeshLambertMaterial({ color: 0xd8d6c6 });
  const crowdMats = [
    new THREE.MeshBasicMaterial({ color: 0xe54b4b }),
    new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }),
    new THREE.MeshBasicMaterial({ color: 0x3e8cff }),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }),
    new THREE.MeshBasicMaterial({ color: 0x202226 }),
  ];
  for (let i = 0; i < 7; i++) {
    const w = 112, h = 2.8 + i * 1.8, d = 5.2;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matSeats);
    step.position.set(0, h / 2, -i * d);
    step.castShadow = true;
    step.receiveShadow = true;
    g.add(step);
    for (let j = -24; j <= 24; j += 4) {
      if (Math.random() < 0.18) continue;
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crowdMats[Math.floor(Math.random() * crowdMats.length)]);
      p.position.set(j * 2.1, h + 0.8, -i * d - 1.2);
      g.add(p);
    }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(124, 1.5, 45), matRoof);
  roof.position.set(0, 23, -17);
  roof.rotation.x = -0.12;
  g.add(roof);
  for (let x = -54; x <= 54; x += 18) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 23, 0.9), matFrame);
    post.position.set(x, 11.5, -4);
    g.add(post);
  }
  return g;
}

function makeCatchFence(length = 36) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0xb8c0c6 });
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xdfe5e8, transparent: true, opacity: 0.45 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(length, 2.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x9fa5a9 }));
  base.position.y = 1.1;
  g.add(base);
  for (let x = -length / 2; x <= length / 2; x += 6) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 10, 0.35), postMat);
    post.position.set(x, 6, 0);
    g.add(post);
  }
  for (let y = 4; y <= 11; y += 1.8) {
    const wire = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.18), wireMat);
    wire.position.y = y;
    g.add(wire);
  }
  return g;
}

function makeSponsorBridge(labelColor = 0xffd500) {
  const g = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: labelColor });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const pylonMat = new THREE.MeshLambertMaterial({ color: 0xb7bdc2 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(118, 10, 7), yellow);
  beam.position.y = 32;
  beam.castShadow = true;
  g.add(beam);
  for (const x of [-54, 54]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(4, 32, 4), pylonMat);
    post.position.set(x, 16, 0);
    g.add(post);
  }
  for (const x of [-26, 0, 26]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 7.3), black);
    mark.position.set(x, 33, 0);
    g.add(mark);
  }
  return g;
}

function makePitWall(length = 150) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, 4.5, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xd9d9d6 })
  );
  wall.position.y = 2.25;
  wall.receiveShadow = true;
  g.add(wall);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.7, 1.8),
    new THREE.MeshLambertMaterial({ color: 0x20252a })
  );
  rail.position.y = 5.0;
  g.add(rail);
  return g;
}

function makeCityBlock(seed = 0) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x65707a });
  const glass = new THREE.MeshLambertMaterial({ color: 0x98b5c8, transparent: true, opacity: 0.72 });
  for (let i = 0; i < 5; i++) {
    const h = 40 + ((seed + i * 17) % 50);
    const b = new THREE.Mesh(new THREE.BoxGeometry(24, h, 22), i % 2 ? mat : glass);
    b.position.set((i - 2) * 28, h / 2, (i % 2) * 18);
    b.castShadow = true;
    g.add(b);
  }
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

  // ── catch fencing close to the wall, plus fewer trees away from the circuit ──
  for (let i = 0; i < cl.length; i++) {
    const [cx, cy] = cl[i];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - cx, ty = ny - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const px =  ty / tl;            // outward perpendicular
    const py = -tx / tl;
    if (i % 6 === 0) {
      const side = i % 12 === 0 ? 1 : -1;
      const off = trackW / 2 + 8;
      const sx = cx + side * px * off;
      const sy = cy + side * py * off;
      const fence = makeCatchFence(32);
      fence.position.set(sx, 0, -sy);
      fence.rotation.y = Math.atan2(ty, tx);
      propsGroup.add(fence);
    }
    // Trees set farther back so the scene no longer reads as pure grassland.
    if (i % 9 === 0 && Math.random() < 0.55) {
      const off = trackW / 2 + 72 + Math.random() * 70;
      const sx = cx + px * off;
      const sy = cy + py * off;
      const t = makeTree(0.7 + Math.random() * 0.7);
      t.position.set(sx, 0, -sy);
      t.rotation.y = Math.random() * Math.PI * 2;
      propsGroup.add(t);
    }
    if (i % 18 === 0 && Math.random() < 0.35) {
      const off = trackW / 2 + 84 + Math.random() * 50;
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
  for (let i = 0; i < cl.length; i += 24) {
    const [cx, cy] = cl[i];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - cx, ty = ny - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const px =  ty / tl;
    const py = -tx / tl;
    const off = trackW / 2 + 24;
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
        const sideOff = side * (trackW / 2 + 54);
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

    const pitWall = makePitWall(190);
    const pitWallX = sp.x + fwdX * 12 + perpX * (trackW / 2 + 7) * -1;
    const pitWallY = sp.y + fwdY * 12 + perpY * (trackW / 2 + 7) * -1;
    pitWall.position.set(pitWallX, 0, -pitWallY);
    pitWall.rotation.y = sa;
    propsGroup.add(pitWall);

    const bridge = makeSponsorBridge(track.id === 'suzuka' ? 0xffd200 : 0xf1c400);
    const bridgeX = sp.x + fwdX * 120;
    const bridgeY = sp.y + fwdY * 120;
    bridge.position.set(bridgeX, 0, -bridgeY);
    bridge.rotation.y = sa;
    propsGroup.add(bridge);

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

  // ── distant city/paddock skyline like modern street and grand prix venues ──
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4;
    const r = 4300 + (i % 3) * 330;
    const block = makeCityBlock(i * 23);
    block.position.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
    block.rotation.y = -a + Math.PI / 2;
    propsGroup.add(block);
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
