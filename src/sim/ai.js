// VELOCITYVERSE sim core: AI rivals. They drive the same Vehicle model through the same control channels as the
// player (road-wheel angle, throttle, brake): pure-pursuit steering toward the racing line, the reference speed
// profile for throttle and braking (scaled by a pace factor), and simple racecraft — follow, pick a side to pass,
// leave room alongside, and back off before a rear-end contact. Pace factors are tuned, not measured.
import { clamp, moveToward } from './units.js';
import { DriverInput } from './assists.js';

export const AI_LEVELS = { easy: 0.90, medium: 0.95, hard: 0.985 };

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export class AIDriver {
  constructor({ pace = 0.95, seed = 1 } = {}) {
    this.pace = pace;
    this.rand = mulberry32(seed);
    this.input = new DriverInput();
    this.assists = { autoThrottle: true, brakeAssist: true, steerAssist: true, guidance: 0, abs: true, tcs: true, esc: true, autoGears: true, speedScale: pace };
    this.raw = { steer: 0, throttle: 0, brake: 0, shiftUp: false, shiftDown: false };
    this.steering = { speedRef: 25, linearity: 1 };
    this.offset = 0; this.phase = this.rand() * 6.283; this.t = 0;
    this.stuck = 0; this.needsReset = false;
    this.p = { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 }; this.hint = -1;
  }

  // field: race entries with up-to-date { veh, s, d, u } (see RaceField). Returns the control record for veh.step.
  process(dt, veh, track, field) {
    this.t += dt;
    const L = track.length, hw = track.halfWidth, lim = hw - 1.3;
    const p = track.project(veh.x, veh.z, this.hint, this.p); this.hint = p.i;
    const u = Math.max(0, veh.forwardSpeed);
    // --- racecraft: nearest car ahead in my path, cars alongside ---
    const lineAt = (s) => track.lineOffset[sampleAt(track, s)];
    if (!this.init) { this.init = true; this.offset = p.d - lineAt(p.s); } // start from the grid slot, merge gradually
    let ahead = null, aheadDs = Infinity, push = 0, beaten = false;
    for (const o of field) {
      if (o.veh === veh) continue;
      let ds = o.s - p.s; if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      const lat = o.d - p.d;
      const hazard = Math.max(0, o.u) < u - 15 && Math.abs(lat) < 4.2 && ds < 70; // much slower car (spun, stopped)
      if (ds > 0 && (ds < 45 && Math.abs(lat) < 2.3 || hazard) && ds < aheadDs) { ahead = o; aheadDs = ds; }
      if (Math.abs(ds) < 5.6 && Math.abs(lat) < 3.0) { push += (lat > 0 ? -1 : 1) * (3.0 - Math.abs(lat)); if (ds > 0.8) beaten = true; }
    }
    let curvAhead = 0;
    for (let ds = 0; ds <= 80; ds += 10) curvAhead = Math.max(curvAhead, Math.abs(track.curv[sampleAt(track, p.s + ds)]));
    const straight = curvAhead < 0.0035;
    const brakingSoon = track.lineSpeedAt(p.s + 45) < u - 6;
    let want = ahead || push ? 0 : 0.25 * Math.sin(this.t * 0.31 + this.phase); // natural line variation when alone
    let paceMul = 1, extraBrake = 0;
    if (ahead) {
      const closing = u - Math.max(0, ahead.u), gap = aheadDs - 5.0;  // bumper-to-bumper gap, m
      const ttc = closing > 0.1 ? gap / closing : Infinity;
      if ((closing > 1.0 && gap < 30) || (gap < 12 && straight && closing > 0.2)) { // pass; otherwise follow in the tow
        const lineD = lineAt(p.s + aheadDs);
        const left = ahead.d - 2.9, right = ahead.d + 2.9, canL = left > -lim, canR = right < lim;
        let side = Math.sign(this.offset) || (track.curv[sampleAt(track, p.s + aheadDs + 40)] >= 0 ? 1 : -1);
        if (side > 0 && !canR) side = -1; else if (side < 0 && !canL) side = 1;
        if ((side > 0 && canR) || (side < 0 && canL)) want = (side > 0 ? right : left) - lineD;
      }
      if (ttc < 1.5) { extraBrake = clamp((1.5 - ttc) / 1.2, 0, 1); paceMul = 0.9; }  // time-to-contact braking
      else if (gap < 6 && closing > -0.3) paceMul = Math.min(paceMul, clamp(Math.max(0, ahead.u) / Math.max(u, 1), 0.85, 1)); // hold station
      if (gap < 1.0 && closing > 0) extraBrake = Math.max(extraBrake, 0.4);
    }
    if (push) { want += push * 1.4; if (beaten && brakingSoon) paceMul = Math.min(paceMul, 0.92); } // give room; tuck in behind
    paceMul *= 1 - 0.6 * (1 - veh.downScale);          // less downforce in dirty air → corner slower
    const offLine = Math.abs(p.d - lineAt(p.s)), kHere = Math.abs(track.curv[p.i]);
    paceMul *= 1 - Math.min(0.08, offLine * kHere * 1.6); // off the ideal line in a corner → tighter radius → slower
    if (Math.abs(p.d) > hw) paceMul *= 0.95;           // off the asphalt: less grip, rejoin carefully
    const myLine = lineAt(p.s + 8);
    want = clamp(want, -lim - myLine, lim - myLine); // keep the target on the asphalt
    this.offset = moveToward(this.offset, want, (ahead || push ? 3.0 : this.t < 8 ? 0.35 : 0.9) * dt);
    // --- steering: pure pursuit to the racing line shifted by the current offset ---
    const Ld = 6 + 0.42 * u;
    const k = sampleAt(track, p.s + Ld);
    const tx = track.lineX[k] + track.nx[k] * this.offset, tz = track.lineZ[k] + track.nz[k] * this.offset;
    const sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw);
    const rax = veh.x - sy * veh.b, raz = veh.z - cy * veh.b;
    const dx = tx - rax, dz = tz - raz, lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
    const delta = Math.atan((2 * veh.car.wheelbase * Math.sin(Math.atan2(lx, lz))) / Math.max(Math.hypot(lx, lz), 1));
    const ref = this.steering.speedRef;
    this.raw.steer = clamp(delta * (ref + u) / (ref * veh.car.steerLock), -1, 1);
    this.raw.brake = extraBrake; this.raw.throttle = 0;
    // Early cars need more reserve for transients than the steady-state line predicts.
    const historicalMargin = veh.car.history?.year <= 1954 ? .52 + .27 * track.world.surfaces.asphalt.mu : 1;
    this.assists.speedScale = this.pace * paceMul * historicalMargin * (Math.abs(this.offset) > 1.2 ? 0.97 : 1);
    // --- stuck detection (race control resets the car if it cannot get going for 4 s) ---
    this.stuck = u < 1.5 ? this.stuck + dt : 0;
    if (this.stuck > 4) { this.needsReset = true; this.stuck = 0; }
    return this.input.process(dt, this.raw, veh, track, this.assists, this.steering);
  }
}

function sampleAt(track, s) {
  let ss = s % track.length; if (ss < 0) ss += track.length;
  let lo = 0, hi = track.n - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (track.s[mid] <= ss) lo = mid; else hi = mid - 1; }
  return lo;
}
