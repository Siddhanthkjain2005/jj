// VELOCITYVERSE sim core: driver input processing and assists.
// Every assist works through a documented control channel and never moves the car directly:
//   steerAssist  → limits the commanded road-wheel angle to the front tires' grip window (slip-angle limiter)
//   guidance     → blends the steering command toward a pure-pursuit angle for the racing line
//   brakeAssist  → adds brake input when speed exceeds the reference speed profile ahead
//   autoThrottle → sets throttle from the reference speed profile (player keeps steering)
//   ABS / TCS / ESC → per-wheel brake torque and engine torque modulation inside Vehicle (see vehicle.js)
//   autoGears    → gear selection
import { clamp, moveToward } from './units.js';

export const ASSIST_PRESETS = {
  rookie: { id: 'rookie', label: 'Rookie', autoThrottle: true, brakeAssist: true, steerAssist: true, guidance: 0.35, abs: true, tcs: true, esc: true, autoGears: true, showLine: true },
  racer: { id: 'racer', label: 'Racer', autoThrottle: false, brakeAssist: false, steerAssist: true, guidance: 0, abs: true, tcs: true, esc: true, autoGears: true, showLine: true },
  pro: { id: 'pro', label: 'Pro', autoThrottle: false, brakeAssist: false, steerAssist: false, guidance: 0, abs: false, tcs: false, esc: false, autoGears: false, showLine: false },
};

// Assist class used to keep personal bests and future leaderboards fair.
export function assistClass(a) {
  return (a.autoThrottle || a.brakeAssist || a.guidance > 0) ? 'assisted' : 'standard';
}

export class DriverInput {
  constructor() {
    this.steerCommand = 0;
    this.reverseMode = false;
    this.brakeHold = 0;
    this.out = {
      steerAngle: 0, throttle: 0, brake: 0, autoGears: true, shiftUp: false, shiftDown: false,
      gearRequest: 'D', abs: true, tcs: true, esc: true, assistBraking: false, guidanceDelta: 0, steerLimited: false,
    };
    this._p = { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 };
    this.hint = -1;
  }

  // raw: { steer [-1,1], throttle [0,1], brake [0,1], shiftUp, shiftDown }
  // steering: { speedRef (m/s), linearity }
  process(dt, raw, veh, track, a, steering) {
    const o = this.out, car = veh.car;
    const u = veh.forwardSpeed, vl = veh.lateralSpeed;
    o.autoGears = a.autoGears; o.abs = a.abs; o.tcs = a.tcs; o.esc = a.esc;
    o.shiftUp = !!raw.shiftUp; o.shiftDown = !!raw.shiftDown;

    // Steering: speed-scaled road-wheel angle from the player's input
    const st = clamp(raw.steer, -1, 1);
    const lin = raw.digitalSteer && a.steerAssist ? 1.5 : (steering.linearity || 1);
    const shaped = Math.sign(st) * Math.pow(Math.abs(st), lin);
    const speedRef = steering.speedRef || 25;
    let delta = shaped * car.steerLock * speedRef / (speedRef + Math.max(0, Math.abs(u)));

    const p = track.project(veh.x, veh.z, this.hint, this._p);
    this.hint = p.i;

    // Guidance: pure pursuit toward the racing line, blended with the player's command
    o.guidanceDelta = 0;
    if (a.guidance > 0 && u > 2) {
      const look = 6 + 0.45 * u;
      const tgt = this._linePoint(track, p.s + look);
      const sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw);
      const rax = veh.x - sy * veh.b, raz = veh.z - cy * veh.b; // rear axle
      const dx = tgt.x - rax, dz = tgt.z - raz;
      const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
      const Ld = Math.hypot(lx, lz);
      const alpha = Math.atan2(lx, lz);
      const dPP = Math.atan((2 * car.wheelbase * Math.sin(alpha)) / Math.max(Ld, 1));
      const blended = delta + a.guidance * (dPP - delta);
      o.guidanceDelta = blended - delta;
      delta = blended;
    }

    // Assisted steering stays within a conservative steady-state grip budget.
    // A digital key must not request a hairpin wheel angle at straight-line speed.
    // Loads, aero and surface friction come from this car/world, not track location.
    o.steerLimited = false;
    if (a.steerAssist && u > 3) {
      let gripForce = 0;
      for (const w of veh.wheels) {
        const mu = car.tire.mu * clamp(1 - car.tire.loadSens * (w.load / car.tire.nominalLoad - 1), 0.6, 1.15);
        gripForce += mu * w.load * w.surfMu;
      }
      const latBudget = 0.82 * gripForce / car.mass;
      const gripAngle = Math.atan(car.wheelbase * latBudget / (u * u)) + car.tire.peakAngle * (raw.digitalSteer ? 0.30 : 0.65);
      const betaF = Math.atan2(vl + veh.r * veh.a, u);
      const slipLimit = car.tire.peakAngle * 0.85;
      const limited = clamp(clamp(delta, -gripAngle, gripAngle), betaF - slipLimit, betaF + slipLimit);
      o.steerLimited = Math.abs(limited - delta) > 1e-6;
      delta = limited;
      // If the rear is sliding, oppose sideslip rather than following its direction.
      // Positive body sideslip needs positive steering to produce a restoring yaw.
      const beta = Math.atan2(vl, u);
      const recovery = clamp(beta * 0.55, -car.tire.peakAngle * 0.6, car.tire.peakAngle * 0.6);
      const slide = clamp((Math.abs(beta) - 0.10) / 0.12, 0, 0.8);
      delta = delta * (1 - slide) + recovery * slide;
      // Slew in simulation time, so a slow rendering frame cannot jump to full lock.
      const rate = 0.35 + 1.2 / (1 + u / 15);
      this.steerCommand = moveToward(this.steerCommand, delta, rate * dt);
    } else this.steerCommand = delta;
    o.steerAngle = clamp(this.steerCommand, -car.steerLock, car.steerLock);

    // Reverse handling with automatic gears: hold brake at standstill to reverse
    let thr = clamp(raw.throttle, 0, 1), brk = clamp(raw.brake, 0, 1);
    if (a.autoGears) {
      if (!this.reverseMode) {
        if (Math.abs(u) < 0.8 && brk > 0.5 && thr < 0.05) this.brakeHold += dt; else this.brakeHold = 0;
        if (this.brakeHold > 0.4) { this.reverseMode = true; this.brakeHold = 0; }
      } else if (Math.abs(u) < 0.8 && thr > 0.3) this.reverseMode = false;
    } else this.reverseMode = false;
    o.gearRequest = this.reverseMode ? 'R' : 'D';
    if (this.reverseMode) { o.throttle = brk; o.brake = thr; o.assistBraking = false; return o; }

    // Brake assist and auto-throttle from the reference speed profile
    o.assistBraking = false;
    let assistBrake = 0;
    const vRef = track.lineSpeedAt(p.s + Math.max(0, u) * 0.25) * 0.97 * (a.speedScale || 1);
    if (a.brakeAssist && u > vRef + 0.8) { assistBrake = clamp((u - vRef) / 5, 0, 1); o.assistBraking = assistBrake > 0.02; }
    if (a.autoThrottle) {
      thr = brk > 0.05 || o.assistBraking ? 0 : clamp((vRef - u) / 2, 0, 1);
      if (u < 4) thr = Math.max(thr, brk > 0.05 ? 0 : 0.6);
    } else if (o.assistBraking) thr = 0;
    o.throttle = thr;
    o.brake = Math.max(brk, assistBrake);
    return o;
  }

  _linePoint(track, s) {
    let ss = s % track.length; if (ss < 0) ss += track.length;
    let lo = 0, hi = track.n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (track.s[mid] <= ss) lo = mid; else hi = mid - 1; }
    const j = (lo + 1) % track.n;
    const segLen = (j === 0) ? (track.length - track.s[lo]) : (track.s[j] - track.s[lo]);
    const t = segLen > 0 ? (ss - track.s[lo]) / segLen : 0;
    return { x: track.lineX[lo] + (track.lineX[j] - track.lineX[lo]) * t, z: track.lineZ[lo] + (track.lineZ[j] - track.lineZ[lo]) * t };
  }
}
