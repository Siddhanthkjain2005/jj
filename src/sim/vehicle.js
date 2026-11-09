// VELOCITYVERSE sim core: vehicle dynamics.
// One coherent model used by every player; assists only change the controls (steer angle, throttle, brake,
// gear) or apply documented brake/engine torques. Nothing here moves the car except forces and contacts.
//
// Model (Milestone 0 fidelity):
//  - Chassis: planar 3-DOF (x, z, yaw) plus heave, pitch and roll (6-DOF rigid body, ground at y = 0).
//  - Suspension: per-corner spring, asymmetric damper, bump stop, anti-roll bars. Roll centre at ground level.
//  - Tires: combined-slip normalized curve with load sensitivity and progressive post-peak loss;
//    relaxation-length transient slips integrated exactly (no 1/v singularity at low speed).
//  - Wheels: spin DOF integrated implicitly (linearized backward Euler) so stiff tire coupling stays stable.
//  - Drivetrain: torque curve, auto-clutch launch, 8-speed gearbox, losses, clutch-pack limited-slip diff.
//  - Aero: drag and downforce proportional to air density × speed², fixed balance; per-car drag and downforce
//    multipliers let traffic.js apply slipstream (less drag) and dirty air (less downforce) behind other cars.
//  - Contacts: curbs as road-height input; barriers as half-spaces with restitution and friction impulses.
import { clamp, moveToward, tableLookup, RADS_TO_RPM, G0 } from './units.js';

export const FL = 0, FR = 1, RL = 2, RR = 3;

function makeWheel(i) {
  return {
    i, omega: 0, spin: 0, kt: 0, at: 0, load: 0, comp: 0, compStatic: 0, travelRel: 0,
    road: 0, roadPrev: 0, surface: 'asphalt', surfMu: 1, surfRoll: 0, vLong: 0, vLat: 0,
    fx: 0, fy: 0, driveTorque: 0, brakeTorque: 0, absFactor: 1, slipNorm: 0,
    hint: -1, proj: { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 }, surf: { type: 'asphalt', height: 0, ridge: 0 },
    wx: 0, wz: 0, offTrack: false, brakeTemp: 120,
  };
}

export class Vehicle {
  constructor(car, world, track) {
    this.car = car; this.world = world; this.track = track;
    const c = car;
    this.a = c.wheelbase * (1 - c.frontWeight); // CG → front axle
    this.b = c.wheelbase * c.frontWeight;       // CG → rear axle
    this.cx = [-c.trackFront / 2, c.trackFront / 2, -c.trackRear / 2, c.trackRear / 2];
    this.cz = [this.a, this.a, -this.b, -this.b];
    this.wheels = [0, 1, 2, 3].map(makeWheel);
    // Body collision points (x right, z forward), m
    this.bodyPts = [[-0.98, 2.55], [0.98, 2.55], [-0.98, -2.15], [0.98, -2.15], [-0.98, 0.35], [0.98, 0.35], [0, 2.75]];
    this.bodyHints = this.bodyPts.map(() => -1);
    this._cf = { fx: 0, fy: 0, s: 0 };
    this._cf2 = { fx: 0, fy: 0, s: 0 };
    this._proj = { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 };
    this.guardTrips = 0;
    this.nanResets = 0;
    this.contacts = [];
    this.wheelSubsteps = 4; // wheel/tire substeps per chassis step (120 Hz chassis → 480 Hz wheels)
    this.carHits = [];      // car-to-car contacts this step (filled by traffic.js)
    this.carImpactCount = 0;
    this.reset(0, 0);
  }

  // Place the car at track distance s, lateral offset, at rest, in static equilibrium.
  reset(s, offset) {
    const p = this.track.pointAt(s, offset || 0, {});
    this.x = p.x; this.z = p.z; this.yaw = p.heading;
    this.vx = 0; this.vz = 0; this.r = 0;
    this.h = 0; this.hDot = 0; this.pitch = 0; this.pitchDot = 0; this.roll = 0; this.rollDot = 0;
    this.steerAngle = 0;
    this.gear = 1; this.shiftTimer = 0; this.rpm = this.car.engine.idleRpm; this.limiter = false; this.clutchSlip = false;
    this.tcsFactor = 1; this.escCut = 1; this.tcsActive = false; this.absActive = false; this.escActive = false;
    this.escBrake = [0, 0, 0, 0];
    this.time = 0; this.steps = 0;
    this.sumFf = 0; this.sumFr = 0;
    this.aLong = 0; this.aLat = 0; this.drag = 0; this.downF = 0; this.downR = 0;
    this.lastImpact = 0; this.impactCount = 0; this.collidingSteps = 0;
    this.dragScale = 1; this.downScale = 1; this.slip = 0; this.bottoming = 0; this.carHits.length = 0;
    const c = this.car, g = this.world.gravity;
    for (const w of this.wheels) {
      const front = w.i < 2;
      const staticLoad = c.mass * g * (front ? c.frontWeight : 1 - c.frontWeight) / 2;
      const k = front ? c.susp.kF : c.susp.kR;
      w.compStatic = staticLoad / k;
      w.comp = w.compStatic; w.load = staticLoad;
      w.omega = 0; w.spin = 0; w.kt = 0; w.at = 0; w.absFactor = 1; w.hint = -1;
      w.road = 0; w.roadPrev = 0; w.fx = 0; w.fy = 0; w.driveTorque = 0; w.brakeTorque = 0; w.brakeTemp = 120;
    }
    this.bodyHints.fill(-1);
    this.hint = -1;
    this._lastGood = null;
    this._saveGood();
  }

  gearRatio(g) {
    const gb = this.car.gearbox;
    if (g === 0) return 0;
    if (g < 0) return -gb.reverse * gb.final;
    return gb.ratios[g - 1] * gb.final;
  }

  _mu(N) {
    const t = this.car.tire;
    return t.mu * clamp(1 - t.loadSens * (N / t.nominalLoad - 1), 0.6, 1.15);
  }

  // Normalized combined-slip tire force. kappa: slip ratio, tanA: tan(slip angle).
  _combined(kappa, tanA, N, muEff, out) {
    const t = this.car.tire;
    const sx = kappa / t.peakSlip;
    const sy = tanA / Math.tan(t.peakAngle);
    const s = Math.sqrt(sx * sx + sy * sy);
    out.s = s;
    if (s < 1e-9 || N <= 0) { out.fx = 0; out.fy = 0; return out; }
    let f;
    if (s <= 1) f = s * (2 - s);
    else f = 1 - (1 - t.falloff) * (1 - Math.exp(-(s - 1) / t.falloffWidth));
    const F = muEff * N * f;
    out.fx = F * sx / s;
    out.fy = -F * sy / s; // lateral force opposes lateral slip (right-positive frame)
    return out;
  }

  _saveGood() {
    this._lastGood = [this.x, this.z, this.yaw, this.vx, this.vz, this.r];
  }

  _drivetrain(dt, ctl) {
    const c = this.car, eng = c.engine, gb = c.gearbox, w = this.wheels;
    const u = this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw);
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const shift = (dir) => {
      const ng = this.gear + dir;
      if (ng > gb.ratios.length) return;
      if (ng < -1) return;
      if (ng === -1 && Math.abs(u) > 1.0) return;
      if (this.gear === -1 && ng >= 0 && u < -1.0) return;
      this.gear = ng; this.shiftTimer = gb.shiftTime;
    };
    const wDriven = 0.5 * (w[RL].omega + w[RR].omega);
    let ratio = this.gearRatio(this.gear);
    let rpmLocked = Math.abs(wDriven * ratio) * RADS_TO_RPM;
    if (ctl.autoGears) {
      if (ctl.gearRequest === 'R' && this.gear !== -1 && Math.abs(u) < 1.0) { this.gear = -1; this.shiftTimer = gb.shiftTime; }
      else if (ctl.gearRequest === 'D' && this.gear <= 0 && u > -1.0) { this.gear = 1; this.shiftTimer = gb.shiftTime; }
      else if (this.gear >= 1 && this.shiftTimer <= 0) {
        if (rpmLocked > gb.autoUpRpm && this.gear < gb.ratios.length) shift(1);
        else if (this.gear > 1) {
          const rpmDown = rpmLocked * gb.ratios[this.gear - 2] / gb.ratios[this.gear - 1];
          if (rpmLocked < gb.autoDownRpm && rpmDown < gb.autoUpRpm - 500) shift(-1);
        }
      }
    } else {
      if (ctl.shiftUp && this.shiftTimer <= 0) shift(1);
      if (ctl.shiftDown && this.shiftTimer <= 0) {
        if (this.gear > 1) {
          const rpmDown = rpmLocked * gb.ratios[this.gear - 2] / gb.ratios[this.gear - 1];
          if (rpmDown < eng.limiterRpm + 300) shift(-1); // money-shift protection
        } else shift(-1);
      }
    }
    ratio = this.gearRatio(this.gear);
    rpmLocked = Math.abs(wDriven * ratio) * RADS_TO_RPM;

    let throttle = clamp(ctl.throttle, 0, 1) * this.tcsFactor * this.escCut;
    if (rpmLocked >= eng.limiterRpm) this.limiter = true;
    if (this.limiter) { if (rpmLocked < eng.limiterRpm - 200) this.limiter = false; else throttle = 0; }

    let wheelTorque = 0;
    if (this.gear === 0 || this.shiftTimer > 0) {
      const target = eng.idleRpm + clamp(ctl.throttle, 0, 1) * (eng.limiterRpm - eng.idleRpm) * 0.85;
      this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / 0.12));
      this.clutchSlip = true;
    } else {
      const slipTarget = eng.idleRpm + (eng.launchRpm - eng.idleRpm) * throttle;
      let rpmEff;
      if (rpmLocked < slipTarget && throttle > 0.01) { rpmEff = slipTarget; this.clutchSlip = true; }
      else if (rpmLocked < eng.idleRpm) { rpmEff = eng.idleRpm; this.clutchSlip = true; }
      else { rpmEff = rpmLocked; this.clutchSlip = false; }
      const Tcurve = tableLookup(eng.curve, rpmEff);
      const Tfric = eng.frictionBase + eng.frictionPerRpm * rpmEff;
      // Net engine torque: the full-load curve scaled by throttle, blending into closed-throttle engine
      // braking below 5% pedal so small openings still produce drive (continuous at 5%).
      let Te = throttle * Tcurve - Math.max(0, 1 - throttle / 0.05) * Tfric;
      if (this.clutchSlip && Te < 0) Te = 0; // a slipping clutch transmits no engine braking
      wheelTorque = Te * ratio * (Te > 0 ? gb.efficiency : 1);
      this.rpm = rpmEff;
      this.engineTorque = Te;
    }
    // Clutch-pack limited-slip differential: equal split plus a locking torque toward the slower wheel
    const wL = w[RL], wR = w[RR];
    const dw = wR.omega - wL.omega;
    const cap = c.diff.preload + (wheelTorque >= 0 ? c.diff.lockPower : c.diff.lockCoast) * Math.abs(wheelTorque);
    const Tlock = clamp(dw * c.wheelInertiaRear / dt * 0.25, -cap, cap);
    wL.driveTorque = 0.5 * wheelTorque + Tlock;
    wR.driveTorque = 0.5 * wheelTorque - Tlock;
    w[FL].driveTorque = 0; w[FR].driveTorque = 0;
    this.wheelTorque = wheelTorque;
  }

  _electronics(dt, ctl, u) {
    const t = this.car.tire, w = this.wheels;
    // ABS: release brake pressure on a wheel whose slip is past the peak; reapply otherwise
    this.absActive = false;
    for (const wh of w) {
      if (ctl.abs && ctl.brake > 0.05 && Math.abs(u) > 3 && wh.kt < -t.peakSlip * 1.15) { wh.absFactor -= 30 * dt; this.absActive = true; }
      else wh.absFactor += 10 * dt;
      wh.absFactor = clamp(wh.absFactor, ctl.abs ? 0.2 : 1, 1);
    }
    // TCS: cut engine torque when a driven wheel slips past the peak
    const kMax = Math.max(w[RL].kt, w[RR].kt);
    this.tcsActive = false;
    if (ctl.tcs && ctl.throttle > 0.05 && kMax > t.peakSlip * 1.15) { this.tcsFactor -= 10 * dt; this.tcsActive = true; }
    else this.tcsFactor += 4 * dt;
    this.tcsFactor = clamp(this.tcsFactor, ctl.tcs ? 0.08 : 1, 1);
    // ESC: compare yaw rate with a reference from steering; correct with single-wheel braking + torque cut
    this.escBrake[0] = this.escBrake[1] = this.escBrake[2] = this.escBrake[3] = 0;
    this.escActive = false; this.escCut = 1;
    if (ctl.esc && u > 8) {
      const L = this.car.wheelbase, K = 0.0011;
      const g = this.world.gravity;
      let rRef = u * this.steerAngle / (L + K * u * u);
      const rCap = (t.mu * g * 1.05) / u;
      rRef = clamp(rRef, -rCap, rCap);
      const r = this.r;
      // Yaw opposite to the requested turn is a slide too. Countersteering
      // must not disable ESC just because rRef changes sign.
      const over = Math.abs(r) - (r * rRef >= 0 ? Math.abs(rRef) : 0) - 0.08;
      if (over > 0) {
        const T = clamp(3000 * over, 0, 1800);
        this.escBrake[r > 0 ? FL : FR] = T; // brake the outer front wheel to oppose yaw
        this.escCut = clamp(1 - 2.5 * over, 0.3, 1);
        this.escActive = true;
      }
      // Understeer means the front tires need less demand; do not brake an
      // inner rear wheel to force more yaw while the front axle is saturated.
    }
  }

  step(dt, ctl) {
    const c = this.car, t = c.tire, w = this.wheels, world = this.world;
    const g = world.gravity, rho = world.airDensity, m = c.mass;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwdX = sy, fwdZ = cy, rgtX = cy, rgtZ = -sy;
    const u = this.vx * fwdX + this.vz * fwdZ;   // forward speed, m/s
    const vl = this.vx * rgtX + this.vz * rgtZ;  // lateral speed (right +), m/s
    const r = this.r;
    const speed = Math.hypot(this.vx, this.vz);

    this.steerAngle = moveToward(this.steerAngle, clamp(ctl.steerAngle, -c.steerLock, c.steerLock), c.steerRate * dt);
    this._electronics(dt, ctl, u);
    this._drivetrain(dt, ctl);

    // Contact patches: track projection, surface and road height (curbs)
    for (const wh of w) {
      wh.wx = this.x + rgtX * this.cx[wh.i] + fwdX * this.cz[wh.i];
      wh.wz = this.z + rgtZ * this.cx[wh.i] + fwdZ * this.cz[wh.i];
      this.track.project(wh.wx, wh.wz, wh.hint, wh.proj);
      wh.hint = wh.proj.i;
      this.track.surface(wh.proj, wh.surf);
      const sdef = world.surfaces[wh.surf.type];
      wh.surface = wh.surf.type; wh.surfMu = sdef.mu; wh.surfRoll = sdef.roll;
      // Curb ridges above ~40 Hz cannot be represented at 120 Hz; the tire envelopes them (band limit)
      const ridgeHz = Math.abs(u) / this.track.def.curbRidgePeriod;
      const band = clamp(1 - ridgeHz / 40, 0, 1);
      wh.roadPrev = this.steps === 0 ? wh.surf.height : wh.road;
      wh.road = wh.surf.height + wh.surf.ridge * band;
      wh.offTrack = Math.abs(wh.proj.d) > this.track.limitOffset(wh.proj);
    }

    // Suspension forces → normal loads
    const s = c.susp;
    const dCorner = [0, 0, 0, 0], F = [0, 0, 0, 0];
    for (const wh of w) {
      const i = wh.i, front = i < 2;
      const d = this.h + this.pitch * this.cz[i] + this.roll * this.cx[i] + wh.road;
      dCorner[i] = d;
      const comp = wh.compStatic + d;
      const rate = this.hDot + this.pitchDot * this.cz[i] + this.rollDot * this.cx[i] + (wh.road - wh.roadPrev) / dt;
      let f = 0;
      if (comp > 0) {
        f += (front ? s.kF : s.kR) * comp;
        if (comp > s.travel) f += s.bumpStopK * (comp - s.travel);
        f += (rate > 0 ? (front ? s.cBumpF : s.cBumpR) : (front ? s.cRebF : s.cRebR)) * rate;
      }
      F[i] = f;
      wh.comp = comp; wh.travelRel = comp - wh.compStatic;
    }
    this.bottoming = Math.max(0, w[0].comp - s.travel, w[1].comp - s.travel, w[2].comp - s.travel, w[3].comp - s.travel);
    const arbFront = s.arbF * (dCorner[FL] - dCorner[FR]);
    const arbRear = s.arbR * (dCorner[RL] - dCorner[RR]);
    F[FL] += arbFront; F[FR] -= arbFront; F[RL] += arbRear; F[RR] -= arbRear;
    for (const wh of w) wh.load = wh.comp > 0 ? Math.max(0, F[wh.i]) : 0;

    // Aerodynamics
    const q = 0.5 * rho * u * u;
    const down = c.aero.clA * q * this.downScale;
    this.downF = down * c.aero.balance; this.downR = down * (1 - c.aero.balance);
    const dragMag = 0.5 * rho * c.aero.cdA * speed * speed * this.dragScale;
    this.drag = dragMag;
    const dragX = speed > 1e-6 ? dragMag * this.vx / speed : 0;
    const dragZ = speed > 1e-6 ? dragMag * this.vz / speed : 0;

    // Tires and wheels. The wheel/tire subsystem is substepped (chassis velocities frozen within the step)
    // because wheel spin is the stiffest mode; forces are averaged over the substeps for the chassis.
    let sumFr = 0, sumFf = 0, Mz = 0;
    const R = c.wheelRadius;
    const bf = c.brakes.maxTorque * c.brakes.bias / 2, br = c.brakes.maxTorque * (1 - c.brakes.bias) / 2;
    const nSub = this.wheelSubsteps, dts = dt / nSub;
    const brakeCmd = clamp(ctl.brake, 0, 1);
    for (const wh of w) {
      const i = wh.i, front = i < 2;
      const steer = front ? this.steerAngle : 0;
      wh._sd = Math.sin(steer); wh._cd = Math.cos(steer);
      const pr = vl + r * this.cz[i];
      const pf = u - r * this.cx[i];
      wh.vLong = pr * wh._sd + pf * wh._cd;
      wh.vLat = pr * wh._cd - pf * wh._sd;
      wh.brakeTorque = brakeCmd * (front ? bf : br) * wh.absFactor + this.escBrake[i];
      wh._fxAcc = 0; wh._fyAcc = 0;
    }
    for (let sub = 0; sub < nSub; sub++) {
      for (const wh of w) {
        const front = wh.i < 2;
        const vLong = wh.vLong, vLat = wh.vLat;
        const vAbs = Math.abs(vLong);
        const kx = vAbs / t.relaxLong, ky = vAbs / t.relaxLat;
        const Ex = Math.exp(-kx * dts), gx = kx * dts < 1e-6 ? dts : (1 - Ex) / kx;
        const Ey = Math.exp(-ky * dts), gy = ky * dts < 1e-6 ? dts : (1 - Ey) / ky;
        wh.at = clamp(wh.at * Ey + (vLat / t.relaxLat) * gy, -4, 4);
        const N = wh.load;
        const muEff = this._mu(N) * wh.surfMu;
        const wLow = clamp(1 - vAbs / 4, 0, 1);
        const I = front ? c.wheelInertiaFront : c.wheelInertiaRear;
        const kOmega = R * gx / t.relaxLong;
        const cLong = t.lowSpeedLongDamp * wLow;
        const kPred = wh.kt * Ex + ((wh.omega * R - vLong) / t.relaxLong) * gx;
        this._combined(kPred, wh.at, N, muEff, this._cf);
        this._combined(kPred + 1e-4, wh.at, N, muEff, this._cf2);
        const slope = (this._cf2.fx - this._cf.fx) / 1e-4;
        const slopeLin = 2 * muEff * N / t.peakSlip;
        const slopeUsed = Math.max(slope, 0.25 * slopeLin);
        const Fx0 = this._cf.fx + cLong * (wh.omega * R - vLong);
        const dFdw = slopeUsed * kOmega + cLong * R;
        const Ieff = I + dts * R * dFdw;
        const Tfric = wh.brakeTorque + (t.rollRes + wh.surfRoll) * N * R;
        const wFree = wh.omega + dts * (wh.driveTorque - R * Fx0) / Ieff;
        const dwFric = dts * Tfric / Ieff;
        const wNew = Math.abs(wFree) <= dwFric ? 0 : wFree - Math.sign(wFree) * dwFric;
        wh.omega = wNew;
        wh.spin += wNew * dts;
        wh.kt = clamp(wh.kt * Ex + ((wNew * R - vLong) / t.relaxLong) * gx, -4, 4);
        this._combined(wh.kt, wh.at, N, muEff, this._cf);
        let fx = this._cf.fx + cLong * (wNew * R - vLong);
        let fy = this._cf.fy - t.lowSpeedLatDamp * wLow * vLat;
        const fmax = muEff * N * 1.02;
        const fm = Math.hypot(fx, fy);
        if (N <= 0) { fx = 0; fy = 0; }
        else if (fm > fmax) { const k = fmax / fm; fx *= k; fy *= k; }
        wh._fxAcc += fx; wh._fyAcc += fy; wh.slipNorm = this._cf.s;
      }
    }
    for (const wh of w) {
      const fx = wh._fxAcc / nSub, fy = wh._fyAcc / nSub;
      wh.fx = fx; wh.fy = fy;
      // Brake temperature (presentation only: drives the disc glow, never grip). Heat = brake torque × wheel
      // speed into an estimated 4 kJ/K corner thermal mass; cooling grows with airflow. All values estimated.
      const Pb = wh.brakeTorque * Math.abs(wh.omega);
      wh.brakeTemp += dt * (Pb - (20 + 6 * speed) * (wh.brakeTemp - 30)) / 4000;
      const Fr = fx * wh._sd + fy * wh._cd, Ff = fx * wh._cd - fy * wh._sd;
      sumFr += Fr; sumFf += Ff;
      Mz += this.cz[wh.i] * Fr - this.cx[wh.i] * Ff;
    }
    this.sumFf = sumFf; this.sumFr = sumFr;

    // Planar integration (semi-implicit Euler)
    const Fwx = fwdX * sumFf + rgtX * sumFr - dragX;
    const Fwz = fwdZ * sumFf + rgtZ * sumFr - dragZ;
    this.vx += (Fwx / m) * dt; this.vz += (Fwz / m) * dt;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.r += (Mz / c.yawInertia) * dt;
    if (Math.abs(this.r) > 8) { this.r = Math.sign(this.r) * 8; this.guardTrips++; }
    this.yaw += this.r * dt;
    if (this.yaw > Math.PI) this.yaw -= 2 * Math.PI; else if (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;

    // Vertical integration: heave (down +), pitch (nose down +), roll (right side down +)
    let sumN = 0, sumNz = 0, sumNx = 0;
    for (const wh of w) { sumN += wh.load; sumNz += wh.load * this.cz[wh.i]; sumNx += wh.load * this.cx[wh.i]; }
    const hdd = (m * g + down - sumN) / m;
    const pdd = (-sumFf * c.cgHeight + (this.downF * this.a - this.downR * this.b) - sumNz) / c.pitchInertia;
    const rdd = (-sumFr * c.cgHeight - sumNx) / c.rollInertia;
    this.hDot += hdd * dt; this.h += this.hDot * dt;
    this.pitchDot += pdd * dt; this.pitch += this.pitchDot * dt;
    this.rollDot += rdd * dt; this.roll += this.rollDot * dt;

    this._collide(dt);

    // Telemetry (from simulation state)
    const dragLong = dragX * fwdX + dragZ * fwdZ, dragLat = dragX * rgtX + dragZ * rgtZ;
    this.aLong = (sumFf - dragLong) / m; this.aLat = (sumFr - dragLat) / m;
    this.time += dt; this.steps++;

    const bad = !(Number.isFinite(this.x) && Number.isFinite(this.vx) && Number.isFinite(this.r) && Number.isFinite(this.h));
    if (bad) { // should never happen; counted so tests can assert zero
      this.nanResets++;
      [this.x, this.z, this.yaw] = this._lastGood;
      this.vx = this.vz = this.r = 0; this.h = this.hDot = this.pitch = this.pitchDot = this.roll = this.rollDot = 0;
      for (const wh of w) { wh.omega = 0; wh.kt = 0; wh.at = 0; }
    } else if ((this.steps & 15) === 0) this._saveGood();
  }

  _collide(dt) {
    // Barrier contact. All penetrating body points are gathered first and resolved as ONE contact at their
    // penetration-weighted centroid, so a flat impact does not get an artificial spin from processing order.
    const c = this.car;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwdX = sy, fwdZ = cy, rgtX = cy, rgtZ = -sy;
    const e = 0.25, muWall = 0.35, m = c.mass, Izz = c.yawInertia;
    let wSum = 0, rxA = 0, rzA = 0, nxA = 0, nzA = 0, maxPen = 0;
    this.contacts.length = 0;
    for (let k = 0; k < this.bodyPts.length; k++) {
      const bx = this.bodyPts[k][0], bz = this.bodyPts[k][1];
      const rx = rgtX * bx + fwdX * bz, rz = rgtZ * bx + fwdZ * bz;
      const pr = this.track.project(this.x + rx, this.z + rz, this.bodyHints[k], this._proj);
      this.bodyHints[k] = pr.i;
      const pen = Math.abs(pr.d) - this.track.barrierOffset(pr);
      if (pen <= 0) continue;
      const side = pr.d >= 0 ? 1 : -1;
      const wgt = pen + 1e-4;
      wSum += wgt; rxA += rx * wgt; rzA += rz * wgt;
      nxA += -side * pr.nx * wgt; nzA += -side * pr.nz * wgt; // normal points back toward the track
      if (pen > maxPen) maxPen = pen;
    }
    if (wSum === 0) { this.collidingSteps = 0; return; }
    const rx = rxA / wSum, rz = rzA / wSum;
    let nx = nxA, nz = nzA; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
    // Positional correction only (adds no velocity): removes penetration without injecting energy
    const corr = Math.min(Math.max(maxPen - 0.005, 0), 0.30);
    this.x += nx * corr; this.z += nz * corr;
    const vpx = this.vx + this.r * rz, vpz = this.vz - this.r * rx;
    const vn = vpx * nx + vpz * nz;
    if (vn < 0) {
      const rn = rz * nx - rx * nz;
      const j = -(1 + e) * vn / (1 / m + (rn * rn) / Izz);
      const tx = nz, tz = -nx;
      const vt = vpx * tx + vpz * tz;
      const rt = rz * tx - rx * tz;
      let jt = -vt / (1 / m + (rt * rt) / Izz);
      jt = clamp(jt, -muWall * j, muWall * j);
      this.vx += (j * nx + jt * tx) / m; this.vz += (j * nz + jt * tz) / m;
      this.r += (j * rn + jt * rt) / Izz;
      this.contacts.push({ x: this.x + rx, z: this.z + rz, speed: -vn, impulse: j });
      if (-vn > this.lastImpact) this.lastImpact = -vn;
    }
    if (this.collidingSteps === 0) this.impactCount++;
    this.collidingSteps++;
  }

  // Telemetry snapshot helpers
  get speed() { return Math.hypot(this.vx, this.vz); }
  get forwardSpeed() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }
  get lateralSpeed() { return this.vx * Math.cos(this.yaw) - this.vz * Math.sin(this.yaw); }
  kineticEnergy() { return 0.5 * this.car.mass * (this.vx * this.vx + this.vz * this.vz) + 0.5 * this.car.yawInertia * this.r * this.r; }
  gLong() { return this.aLong / G0; }
  gLat() { return this.aLat / G0; }
}
