import { segmentsIntersect } from '../utils/math.js';

export function createTiming(bestSectors = [null, null, null]) {
  return {
    lapStart:      null,
    currentLap:    0,
    bestLap:       null,
    sectorTimes:   [null, null, null],
    sectorBest:    [...bestSectors],
    lapTimes:      [],
    lastSector:    0,
    prevPos:       null,
    started:       false,
    _sectorPassed: [false, false, false],
  };
}

export function updateTiming(timing, car, track, now) {
  const cur = [car.x, car.y];
  if (!timing.prevPos) { timing.prevPos = cur; return null; }

  const prev = timing.prevPos;
  timing.prevPos = cur;

  let event = null;

  const sl = track.startLine;
  const startCrossed = segmentsIntersect(
    prev, cur,
    [sl.x1, sl.y1], [sl.x2, sl.y2]
  );

  if (startCrossed && !car.offTrack) {
    if (!timing.started) {
      // first crossing — start lap
      timing.started   = true;
      timing.lapStart  = now;
      timing.currentLap = 0;
      timing.lastSector = 0;
      timing.sectorTimes = [null, null, null];
      timing._sectorPassed = [false, false, false];
      event = { type: 'lapStart' };
    } else {
      // complete lap
      const lapMs = now - timing.lapStart;
      const sectorsOk = timing._sectorPassed.slice(0, track.sectors.length).every(Boolean);
      if (!sectorsOk || lapMs < 15000) return event;
      const isNew = !timing.bestLap || lapMs < timing.bestLap;
      if (isNew) timing.bestLap = lapMs;
      timing.lapTimes.push(lapMs);
      timing.currentLap = lapMs;

      const sectors = [...timing.sectorTimes];
      timing.lapStart  = now;
      timing.sectorTimes = [null, null, null];
      timing._sectorPassed = [false, false, false];
      timing.lastSector = 0;

      event = { type: 'lapComplete', lapMs, isNew, sectors, sectorBest: [...timing.sectorBest] };
    }
  }

  // sector check
  for (let i = 0; i < track.sectors.length; i++) {
    if (timing._sectorPassed[i]) continue;
    const sc = track.sectors[i].checkLine;
    const crossed = segmentsIntersect(
      prev, cur,
      [sc.x1, sc.y1], [sc.x2, sc.y2]
    );
    if (crossed && timing.started) {
      timing.sectorTimes[i] = now - timing.lapStart - (i === 0 ? 0 : (timing.sectorTimes.slice(0,i).reduce((a,b)=>a+(b||0),0)));
      const isNewBest = !timing.sectorBest[i] || timing.sectorTimes[i] < timing.sectorBest[i];
      if (isNewBest) timing.sectorBest[i] = timing.sectorTimes[i];
      timing._sectorPassed[i] = true;
      timing.lastSector = i + 1;
      if (!event) event = { type: 'sector', id: i + 1 };
    }
  }

  return event;
}
