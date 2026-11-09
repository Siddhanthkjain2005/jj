// VELOCITYVERSE sim core: race rules — lap timing from fixed simulation steps, sector splits, ordered
// checkpoints, track-limit validation, wrong-way detection and ghost recording. Lap times are interpolated to
// the exact line crossing inside a step, so they do not depend on the rendering frame rate.

export const SECTORS = 3;
export const CHECKPOINTS = 12;

export class RaceSession {
  constructor(track, mode, opts = {}) {
    this.track = track;
    this.mode = mode;               // 'practice' | 'timetrial' | 'race'
    this.targetLaps = mode === 'practice' ? Infinity : (opts.laps || 3); // 'timetrial' | 'race'
    this.L = track.length;
    this.lineS = track.def.lineS;
    this._p = { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 };
    this.reset();
  }

  reset() {
    this.hint = -1;
    this.lastSRel = null;
    this.lapStart = null;      // sim time at the start of the current timed lap (null during out-lap)
    this.laps = [];
    this.cpNext = 1;
    this.sectorNext = 1;
    this.sectorSplits = [];
    this.invalid = false;
    this.invalidReason = '';
    this.cutSteps = 0;
    this.wrongWayTime = 0;
    this.wrongWay = false;
    this.finished = false;
    this.ghost = [];
    this.lastLap = null;
    this.bestLap = null;
    this.events = [];
    this.sRel = 0;
  }

  currentLapTime(simTime) { return this.lapStart === null ? 0 : simTime - this.lapStart; }

  invalidate(reason) {
    if (this.lapStart !== null && !this.invalid) { this.invalid = true; this.invalidReason = reason; this.events.push({ type: 'invalid', reason }); }
  }

  update(dt, simTime, veh, assistCls) {
    const L = this.L;
    const p = this.track.project(veh.x, veh.z, this.hint, this._p);
    this.hint = p.i;
    let sRel = (p.s - this.lineS) % L; if (sRel < 0) sRel += L;
    this.sRel = sRel;

    // Direction along the track
    const along = veh.vx * this.track.tx[p.i] + veh.vz * this.track.tz[p.i];
    if (along < -2) this.wrongWayTime += dt; else this.wrongWayTime = Math.max(0, this.wrongWayTime - 2 * dt);
    this.wrongWay = this.wrongWayTime > 0.8;

    if (this.lastSRel !== null) {
      const prev = this.lastSRel;
      if (prev > L - 80 && sRel < 80) {
        // forward crossing: interpolate the crossing time inside this step
        const frac = (L - prev) / ((sRel + L) - prev);
        const tCross = simTime - dt + dt * frac;
        this._onLine(tCross, assistCls);
      } else if (prev < 80 && sRel > L - 80) {
        this.invalidate('reversed over the line');
        this.cpNext = 1; this.sectorNext = 1;
      } else if (this.lapStart !== null) {
        // ordered checkpoints and sector splits
        const cpS = (this.cpNext * L) / CHECKPOINTS;
        if (this.cpNext < CHECKPOINTS && prev < cpS && sRel >= cpS && sRel - prev < 60) this.cpNext++;
        const secS = (this.sectorNext * L) / SECTORS;
        if (this.sectorNext < SECTORS && prev < secS && sRel >= secS && sRel - prev < 60) {
          const frac = (secS - prev) / (sRel - prev);
          this.sectorSplits.push(simTime - dt + dt * frac - this.lapStart);
          this.sectorNext++;
        }
      }
    }
    this.lastSRel = sRel;

    // Track limits: all four wheels beyond asphalt + curb for 5 consecutive steps
    const allOff = veh.wheels.every(w => w.offTrack);
    this.cutSteps = allOff ? this.cutSteps + 1 : 0;
    if (this.cutSteps === 5) this.invalidate('track limits');

    // Ghost samples at 30 Hz during timed laps
    if (this.lapStart !== null && (veh.steps % 4) === 0) {
      this.ghost.push(simTime - this.lapStart, sRel, veh.x, veh.z, veh.yaw, veh.steerAngle);
    }
  }

  _onLine(tCross, assistCls) {
    if (this.lapStart !== null) {
      const time = tCross - this.lapStart;
      const valid = !this.invalid && this.cpNext >= CHECKPOINTS;
      const splits = this.sectorSplits.slice();
      const sectors = [];
      let prev = 0;
      for (let k = 0; k < SECTORS - 1; k++) { const sp = splits[k]; sectors.push(sp !== undefined ? sp - prev : NaN); prev = sp !== undefined ? sp : prev; }
      sectors.push(time - prev);
      const lap = { n: this.laps.length + 1, time, sectors, valid, reason: valid ? '' : (this.invalidReason || 'missed checkpoint'), assist: assistCls, ghost: valid ? Float32Array.from(this.ghost) : null };
      this.laps.push(lap);
      this.lastLap = lap;
      if (valid && (!this.bestLap || time < this.bestLap.time)) this.bestLap = lap;
      this.events.push({ type: 'lap', lap });
      if (this.laps.length >= this.targetLaps) this.finished = true;
    } else {
      this.events.push({ type: 'start' });
    }
    this.lapStart = tCross;
    this.cpNext = 1; this.sectorNext = 1; this.sectorSplits = [];
    this.invalid = false; this.invalidReason = ''; this.cutSteps = 0;
    this.ghost = [];
  }
}

// Ghost playback helpers. Ghost layout: [t, sRel, x, z, yaw, steer] repeated.
export const GHOST_STRIDE = 6;

export function ghostPoseAt(ghost, t, out) {
  const n = ghost.length / GHOST_STRIDE;
  if (n < 2) return null;
  if (t <= ghost[0]) t = ghost[0];
  let lo = 0, hi = n - 1;
  if (t >= ghost[hi * GHOST_STRIDE]) { lo = hi - 1; t = ghost[hi * GHOST_STRIDE]; }
  else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ghost[mid * GHOST_STRIDE] <= t) lo = mid; else hi = mid; }
  const a = lo * GHOST_STRIDE, b = (lo + 1) * GHOST_STRIDE;
  const span = ghost[b] - ghost[a];
  const k = span > 0 ? (t - ghost[a]) / span : 0;
  out.x = ghost[a + 2] + (ghost[b + 2] - ghost[a + 2]) * k;
  out.z = ghost[a + 3] + (ghost[b + 3] - ghost[a + 3]) * k;
  let dy = ghost[b + 4] - ghost[a + 4];
  if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  out.yaw = ghost[a + 4] + dy * k;
  out.steer = ghost[a + 5] + (ghost[b + 5] - ghost[a + 5]) * k;
  return out;
}

// Time the ghost took to reach track position sRel (for the live delta).
export function ghostTimeAtS(ghost, sRel) {
  const n = ghost.length / GHOST_STRIDE;
  if (n < 2) return null;
  let lo = 0, hi = n - 1;
  if (sRel <= ghost[1]) return ghost[0];
  if (sRel >= ghost[hi * GHOST_STRIDE + 1]) return null;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ghost[mid * GHOST_STRIDE + 1] <= sRel) lo = mid; else hi = mid; }
  const a = lo * GHOST_STRIDE, b = hi * GHOST_STRIDE;
  const span = ghost[b + 1] - ghost[a + 1];
  const k = span > 0 ? (sRel - ghost[a + 1]) / span : 0;
  return ghost[a] + (ghost[b] - ghost[a]) * k;
}

// Race positions for a field of cars (player + AI). Laps count forward crossings of the start/finish line,
// interpolated inside the step like RaceSession. Cars start on the grid behind the line (lap −1 → the first
// crossing starts lap 1). Gaps come from the times each car reached the same distance (every 25 m).
const GAP_CP = 25;
export class RaceField {
  constructor(track, laps) {
    this.track = track; this.laps = laps; this.L = track.length; this.lineS = track.def.lineS;
    this.entries = []; this.finishOrder = []; this.order = [];
  }
  add(veh, info) {
    const e = { veh, ...info, hint: -1, p: { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 }, s: 0, d: 0, u: 0, sRel: 0, lastSRel: null,
      lap: -1, lapStart: null, lapTimes: [], best: Infinity, finished: false, finishTime: null, progress: 0, cp: [], cp0: null, pos: 0, gap: 0, interval: 0, lapped: 0 };
    this.entries.push(e);
    this._project(e);
    e.lastSRel = e.sRel;
    if (e.sRel < this.L / 2) e.lap = 0; // already past the line at the start
    e.progress = e.lap * this.L + e.sRel;
    e.cp0 = Math.floor((e.progress + this.L) / GAP_CP);
    return e;
  }
  _project(e) {
    const p = this.track.project(e.veh.x, e.veh.z, e.hint, e.p); e.hint = p.i;
    e.s = p.s; e.d = p.d; e.u = e.veh.forwardSpeed;
    let sRel = (p.s - this.lineS) % this.L; if (sRel < 0) sRel += this.L;
    e.sRel = sRel;
  }
  update(dt, simTime) {
    const L = this.L;
    for (const e of this.entries) {
      this._project(e);
      const prev = e.lastSRel, sRel = e.sRel;
      if (prev > L - 80 && sRel < 80) {
        const tC = simTime - dt + dt * ((L - prev) / ((sRel + L) - prev));
        e.lap++;
        if (e.lapStart !== null && !e.finished) { const lt = tC - e.lapStart; e.lapTimes.push(lt); if (lt < e.best) e.best = lt; }
        e.lapStart = tC;
        if (e.lap >= this.laps && !e.finished) { e.finished = true; e.finishTime = tC; this.finishOrder.push(e); }
      } else if (prev < 80 && sRel > L - 80) e.lap--; // reversed over the line
      e.lastSRel = sRel;
      e.progress = e.lap * L + sRel;
      const k = Math.floor((e.progress + L) / GAP_CP);
      while (e.cp.length <= k) e.cp.push(e.cp.length > e.cp0 ? simTime : null);
    }
    const order = this.entries.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    order.forEach((e, i) => { e.pos = i + 1; });
    const lead = order[0];
    for (let i = 0; i < order.length; i++) {
      const e = order[i];
      e.gap = i === 0 ? 0 : this._gap(e, lead);
      e.interval = i === 0 ? 0 : this._gap(e, order[i - 1]);
      e.lapped = Math.max(0, Math.floor((lead.progress - e.progress) / L));
    }
    this.order = order;
  }
  // time gap from car e back to car a (a ahead): when e last reached a distance that a also reached in-race
  _gap(e, a) {
    if (e.finished && a.finished) return e.finishTime - a.finishTime;
    const k = e.cp.length - 1;
    if (k >= 0 && e.cp[k] !== null && a.cp[k] !== undefined && a.cp[k] !== null) return Math.max(0, e.cp[k] - a.cp[k]);
    return Math.max(0, (a.progress - e.progress) / Math.max(e.u, 15)); // early in the race: distance ÷ speed
  }
  get leader() { return this.order[0]; }
}
