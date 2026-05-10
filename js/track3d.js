import * as THREE from 'three';

export function getTrackGroup(track, scene) {
  const grp = _buildTrackGroup(track);
  scene.add(grp);
  return grp;
}

function _buildTrackGroup(track) {
  const grp = new THREE.Group();

  // ── ground (grass) — large enough to wrap any reasonable circuit ──
  const groundGeo = new THREE.PlaneGeometry(15000, 15000);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
  const ground    = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, -0.3, 0);
  ground.receiveShadow = true;
  grp.add(ground);

  // ── track surface ──
  // 2D shape (x, y) → after rotateX(-π/2), 3D (x, 0, -y).
  // Earcut needs outer CCW + holes CW; the generator emits both CCW so we
  // reverse the inner array here.
  const shape = new THREE.Shape();
  shape.moveTo(track.outerBoundary[0][0], track.outerBoundary[0][1]);
  for (let i = 1; i < track.outerBoundary.length; i++) {
    shape.lineTo(track.outerBoundary[i][0], track.outerBoundary[i][1]);
  }
  shape.closePath();

  const innerCW = [...track.innerBoundary].reverse();
  const hole = new THREE.Path();
  hole.moveTo(innerCW[0][0], innerCW[0][1]);
  for (let i = 1; i < innerCW.length; i++) hole.lineTo(innerCW[i][0], innerCW[i][1]);
  hole.closePath();
  shape.holes.push(hole);

  const trackGeo = new THREE.ShapeGeometry(shape, 8);
  trackGeo.rotateX(-Math.PI / 2);
  const trackMat = new THREE.MeshLambertMaterial({ color: 0x383838 });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  trackMesh.position.y = 0;
  trackMesh.receiveShadow = true;
  grp.add(trackMesh);

  // ── kerb stripes (alternating red/white) ──
  _addKerbStripes(grp, track.outerBoundary, 0.25, 5);
  _addKerbStripes(grp, track.innerBoundary, 0.25, 4);

  // ── guardrails (Armco-style, both sides) ──
  _addGuardrail(grp, track.outerBoundary, 4.5, 1.0, 0xd0d4da);
  _addGuardrail(grp, track.innerBoundary, 4.5, 1.0, 0xd0d4da);

  // ── start/finish line ──
  const sl = track.startLine;
  _addLine(grp, sl.x1, sl.y1, sl.x2, sl.y2, 0xffffff, 4.5, 0.3);

  // ── sector lines ──
  for (const s of track.sectors) {
    const sc = s.checkLine;
    _addLine(grp, sc.x1, sc.y1, sc.x2, sc.y2, 0xffee00, 2.0, 0.25);
  }

  // ── start grid markers ──
  _addStartGrid(grp, track.startPos);

  return grp;
}

// For a 2D segment (x1,y1)→(x2,y2), returns the Y rotation that aligns a
// box's local +X with the segment direction in the world's X-Z plane.
// World direction is (dx, 0, -dy); rotation.y = atan2(dy, dx) (NOT -dy).
function _segAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function _addKerbStripes(grp, boundary, yOffset, width) {
  const matA = new THREE.MeshLambertMaterial({ color: 0xcc1111 });
  const matB = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  for (let i = 0; i < boundary.length; i++) {
    const [x1, y1] = boundary[i];
    const [x2, y2] = boundary[(i + 1) % boundary.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.5) continue;
    const cx = (x1 + x2) / 2;
    const cz = -(y1 + y2) / 2;
    const geo = new THREE.BoxGeometry(len, 0.4, width);
    const mesh = new THREE.Mesh(geo, i % 2 === 0 ? matA : matB);
    mesh.position.set(cx, yOffset, cz);
    mesh.rotation.y = _segAngle(x1, y1, x2, y2);
    grp.add(mesh);
  }
}

function _addLine(grp, x1, y1, x2, y2, color, thickness, yOff) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const geo = new THREE.BoxGeometry(len, 0.18, thickness);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x1 + x2) / 2, yOff, -(y1 + y2) / 2);
  mesh.rotation.y = _segAngle(x1, y1, x2, y2);
  grp.add(mesh);
}

function _addGuardrail(grp, boundary, height, thickness, color) {
  const wallMat = new THREE.MeshLambertMaterial({ color });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xff3333 });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  for (let i = 0; i < boundary.length; i++) {
    const [x1, y1] = boundary[i];
    const [x2, y2] = boundary[(i + 1) % boundary.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.5) continue;
    const cx = (x1 + x2) / 2;
    const cz = -(y1 + y2) / 2;
    const ang = _segAngle(x1, y1, x2, y2);

    // wall body
    const wallGeo = new THREE.BoxGeometry(len, height, thickness);
    const wall    = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(cx, height / 2 + 0.3, cz);
    wall.rotation.y = ang;
    wall.castShadow = true;
    wall.receiveShadow = true;
    grp.add(wall);

    // red top stripe (visual hazard)
    const stripeGeo = new THREE.BoxGeometry(len, 0.9, thickness * 1.06);
    const stripe    = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(cx, height + 0.3, cz);
    stripe.rotation.y = ang;
    grp.add(stripe);

    // posts every 4 segments
    if (i % 4 === 0) {
      const postGeo = new THREE.BoxGeometry(0.7, height + 1.1, thickness * 1.5);
      const post    = new THREE.Mesh(postGeo, postMat);
      post.position.set(x1, (height + 1.1) / 2, -y1);
      post.rotation.y = ang;
      grp.add(post);
    }
  }
}

function _addStartGrid(grp, startPos) {
  const a = startPos.angle;
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 4; i++) {
    const offset = i * 24;
    const x = startPos.x - cosA * offset;
    const z = -(startPos.y - sinA * offset);
    const geo = new THREE.BoxGeometry(14, 0.18, 6);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.2, z);
    mesh.rotation.y = a;
    grp.add(mesh);
  }
}
