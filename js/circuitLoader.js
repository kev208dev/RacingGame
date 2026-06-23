import { getTrackGroup } from './track3d.js';
import { TRACKS } from '../data/tracks.js';

const _state = {
  group: null,
  scene: null,
  track: null,
};

function _disposeMaterial(mat) {
  if (!mat) return;
  if (Array.isArray(mat)) {
    for (const m of mat) {
      if (m && typeof m.dispose === 'function') m.dispose();
    }
  } else if (typeof mat.dispose === 'function') {
    mat.dispose();
  }
}

function _disposeGroup(group) {
  if (!group) return;
  group.traverse(obj => {
    if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    if (obj.material) _disposeMaterial(obj.material);
  });
  if (group.parent) group.parent.remove(group);
}

export function disposeCircuit() {
  _disposeGroup(_state.group);
  _state.group = null;
  _state.scene = null;
  _state.track = null;
}

export function loadCircuit(id, scene) {
  const track = TRACKS.find(t => t.id === id) || TRACKS[0];
  if (_state.group) {
    _disposeGroup(_state.group);
    _state.group = null;
  }
  const group = getTrackGroup(track, scene);
  _state.group = group;
  _state.scene = scene;
  _state.track = track;
  return { track, group };
}

export function getCurrentCircuit() {
  return _state.track;
}
