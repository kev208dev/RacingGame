import * as THREE from 'three';

export function getTrackGroup(track, scene) {
  const grp = _buildTrackGroup(track);
  scene.add(grp);
  return grp;
}

function _buildTrackGroup(track) {
  const grp = new THREE.Group();

  const groundGeo = new THREE.PlaneGeometry(15000, 15000);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, _makeGroundMaterial());
  ground.position.y = -0.35;
  ground.receiveShadow = true;
  grp.add(ground);

  _addTrackRibbon(grp, track);
  _addRoadMarkings(grp, track);
  _addKerbStripes(grp, track);
  _addGuardrails(grp, track);

  const sl = track.startLine;
  _addFlatLine(grp, sl.x1, sl.y1, sl.x2, sl.y2, 0xffffff, 4.8, 0.24);

  for (const s of track.sectors || []) {
    const sc = s.checkLine;
    _addFlatLine(grp, sc.x1, sc.y1, sc.x2, sc.y2, 0xffee00, 2.2, 0.25);
  }

  _addStartGrid(grp, track.startPos);
  return grp;
}

function _addTrackRibbon(grp, track) {
  const cl = track.centerLine || [];
  const width = track.width || 100;
  if (cl.length < 3) return;

  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < cl.length; i++) {
    const [x, y] = cl[i];
    const [px, py] = cl[(i - 1 + cl.length) % cl.length];
    const [nx, ny] = cl[(i + 1) % cl.length];
    const tx = nx - px;
    const ty = ny - py;
    const tl = Math.hypot(tx, ty) || 1;
    const ox = (ty / tl) * width / 2;
    const oy = (-tx / tl) * width / 2;
    const crown = 0.08 + Math.sin(i * 0.17) * 0.015;

    verts.push(x + ox, crown, -(y + oy));
    verts.push(x - ox, crown, -(y - oy));
    uvs.push(0, i / 18, 1, i / 18);
  }

  for (let i = 0; i < cl.length; i++) {
    const a = i * 2;
    const b = ((i + 1) % cl.length) * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, _makeRoadMaterial());
  mesh.receiveShadow = true;
  grp.add(mesh);
}

function _makeRoadMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0x5f625c,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

function _makeGroundMaterial() {
  return new THREE.MeshLambertMaterial({ color: 0x293426 });
}

function _addRoadMarkings(grp, track) {
  const cl = track.centerLine || [];
  const stride = _visualStride(cl, 360);
  for (let i = 0; i < cl.length; i += stride) {
    const [x1, y1] = cl[i];
    const [x2, y2] = cl[(i + stride) % cl.length];
    const { len } = _segBasis(x1, y1, x2, y2);
    if (len < 1) continue;

    if (Math.floor(i / stride) % 3 === 0) {
      _addFlatLine(grp, x1, y1, x2, y2, 0xf0ece0, 2.0, 0.32);
    }
  }
}

function _addKerbStripes(grp, track) {
  const cl = track.centerLine || [];
  const half = (track.width || 100) / 2;
  const stride = 1;
  const matA = new THREE.MeshLambertMaterial({ color: 0xc91f1f });
  const matB = new THREE.MeshLambertMaterial({ color: 0xf3f3ee });

  for (let i = 0; i < cl.length; i += stride) {
    const [x1, y1] = cl[i];
    const [x2, y2] = cl[(i + stride) % cl.length];
    const { len, px, py, angle } = _segBasis(x1, y1, x2, y2);
    if (len < 1) continue;

    for (const side of [-1, 1]) {
      const off = half + 2.5;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.18, 5),
        Math.floor(i / stride) % 2 === 0 ? matA : matB
      );
      mesh.position.set(
        (x1 + x2) / 2 + side * px * off,
        0.18,
        -((y1 + y2) / 2 + side * py * off)
      );
      mesh.rotation.y = angle;
      grp.add(mesh);
    }
  }
}

function _addGuardrails(grp, track) {
  const cl = track.centerLine || [];
  const half = (track.width || 100) / 2;
  const stride = 1;
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xbec4c8 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xc91f1f });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x202225 });

  for (let i = 0; i < cl.length; i += stride) {
    const [x1, y1] = cl[i];
    const [x2, y2] = cl[(i + stride) % cl.length];
    const { len, px, py, angle } = _segBasis(x1, y1, x2, y2);
    if (len < 1) continue;

    for (const side of [-1, 1]) {
      const off = half + 18;
      const cx = (x1 + x2) / 2 + side * px * off;
      const cy = (y1 + y2) / 2 + side * py * off;

      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 4.2, 1.2), wallMat);
      wall.position.set(cx, 2.4, -cy);
      wall.rotation.y = angle;
      wall.castShadow = true;
      wall.receiveShadow = true;
      grp.add(wall);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 1.3), stripeMat);
      stripe.position.set(cx, 4.75, -cy);
      stripe.rotation.y = angle;
      grp.add(stripe);

      if (Math.floor(i / stride) % 3 === 0) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.4, 1.6), postMat);
        post.position.set(x1 + side * px * off, 2.7, -(y1 + side * py * off));
        post.rotation.y = angle;
        grp.add(post);
      }
    }
  }
}

function _addFlatLine(grp, x1, y1, x2, y2, color, thickness, yOff) {
  const { len, angle } = _segBasis(x1, y1, x2, y2);
  if (len < 0.5) return;
  const geo = new THREE.BoxGeometry(len, 0.08, thickness);
  const mat = new THREE.MeshBasicMaterial({ color, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x1 + x2) / 2, yOff, -(y1 + y2) / 2);
  mesh.rotation.y = angle;
  mesh.renderOrder = 3;
  grp.add(mesh);
}

function _addStartGrid(grp, startPos) {
  const a = startPos.angle;
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const offset = i * 24;
    const x = startPos.x - cosA * offset;
    const z = -(startPos.y - sinA * offset);
    const geo = new THREE.BoxGeometry(14, 0.08, 6);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.36, z);
    mesh.rotation.y = a;
    mesh.renderOrder = 4;
    grp.add(mesh);
  }
}

function _segBasis(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return {
    len,
    px: dy / len,
    py: -dx / len,
    angle: Math.atan2(dy, dx),
  };
}

function _visualStride(points, targetSegments) {
  return Math.max(1, Math.ceil((points?.length || 1) / targetSegments));
}
