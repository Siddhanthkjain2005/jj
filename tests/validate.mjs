// VELOCITYVERSE headless validation suite for the vehicle simulation.
// Run: node tests/validate.mjs   (writes tests/results/report.json and report.md, and tests/golden/*.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAR_VX1, WORLDS, TRACK_HARBOR } from '../src/sim/data.js';
import { Track } from '../src/sim/track.js';
import { Vehicle } from '../src/sim/vehicle.js';
import { DriverInput, ASSIST_PRESETS, assistClass } from '../src/sim/assists.js';
import { RaceSession, RaceField } from '../src/sim/race.js';
import { resolveCarContacts, applySlipstream, FOOTPRINT, WAKE } from '../src/sim/traffic.js';
import { AIDriver, AI_LEVELS } from '../src/sim/ai.js';
import { G0, DEG, clamp, RADS_TO_RPM, tableLookup } from '../src/sim/units.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DT = 1 / 120;
const results = [];
const log = (...a) => console.log(...a);
function record(name, pass, expected, measured, detects) {
  results.push({ name, pass: !!pass, expected, measured, detects });
  log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      expected: ${expected}\n      measured: ${measured}`);
}
const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : String(x);

// ---------- test tracks ----------
const RECT = (len, w, runoff, extra) => ({
  id: 'test', name: 'Test', start: { x: 0, z: 0, heading: 0 }, width: w, curbWidth: 1.2, curbHeight: 0.025, curbRidge: 0.008,
  curbRidgePeriod: 0.5, curbMaxRadius: 0, curbExtend: 0, runoffStraight: runoff, runoffCorner: runoff, lineS: 100, gridS: 0,
  extraCurbs: extra || [],
  segments: [['S', len], ['R', 300, 90], ['S', 600], ['R', 300, 90], ['S', len], ['R', 300, 90], ['S', 600], ['R', 300, 90]],
});
const TEST_PAD = RECT(6000, 40, 40);
const TEST_WALL = RECT(3000, 12, 2, [[400, 2400, 'R']]);
const SKIDPAD = { ...RECT(1, 16, 30), segments: [['R', 50, 360]] };

function makeSim(def, world = WORLDS.lumen_harbor, car = CAR_VX1) {
  const track = new Track(def, world, car);
  const veh = new Vehicle(car, world, track);
  return { track, veh };
}
const baseCtl = () => ({ steerAngle: 0, throttle: 0, brake: 0, autoGears: true, shiftUp: false, shiftDown: false, gearRequest: 'D', abs: true, tcs: true, esc: false });

// Pure pursuit toward a lateral offset of the centerline (or the racing line)
function makePursuit(track) {
  const p = { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 }; let hint = -1; const q = {};
  return function steer(veh, offset = 0, useLine = false, lookBase = 5, lookGain = 0.35) {
    track.project(veh.x, veh.z, hint, p); hint = p.i;
    const u = Math.max(0, veh.forwardSpeed);
    const Ld = lookBase + lookGain * u;
    let tx, tz;
    if (useLine) { const lp = linePoint(track, p.s + Ld); tx = lp.x; tz = lp.z; }
    else { track.pointAt(p.s + Ld, typeof offset === 'function' ? offset(p.s + Ld) : offset, q); tx = q.x; tz = q.z; }
    const sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw);
    const rax = veh.x - sy * veh.b, raz = veh.z - cy * veh.b;
    const dx = tx - rax, dz = tz - raz;
    const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
    const alpha = Math.atan2(lx, lz);
    return { delta: Math.atan((2 * veh.car.wheelbase * Math.sin(alpha)) / Math.max(Math.hypot(lx, lz), 1)), proj: p };
  };
}
function linePoint(track, s) {
  let ss = s % track.length; if (ss < 0) ss += track.length;
  let lo = 0, hi = track.n - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (track.s[mid] <= ss) lo = mid; else hi = mid - 1; }
  const j = (lo + 1) % track.n;
  const segLen = (j === 0) ? (track.length - track.s[lo]) : (track.s[j] - track.s[lo]);
  const t = segLen > 0 ? (ss - track.s[lo]) / segLen : 0;
  return { x: track.lineX[lo] + (track.lineX[j] - track.lineX[lo]) * t, z: track.lineZ[lo] + (track.lineZ[j] - track.lineZ[lo]) * t };
}
function speedHold(veh, vT, ctl, kp = 0.6) {
  const e = vT - veh.forwardSpeed;
  ctl.throttle = clamp(e * kp, 0, 1); ctl.brake = clamp(-e * 0.3, 0, 1);
}
function effMass(car) { return car.mass + (2 * car.wheelInertiaFront + 2 * car.wheelInertiaRear) / (car.wheelRadius ** 2); }
function muAt(car, N) { return car.tire.mu * clamp(1 - car.tire.loadSens * (N / car.tire.nominalLoad - 1), 0.6, 1.15); }

// ---------- 1. Acceleration ----------
function testAcceleration() {
  const { track, veh } = makeSim(TEST_PAD); veh.reset(50, 0);
  const ctl = baseCtl(); ctl.throttle = 1; const pursue = makePursuit(track);
  let t100 = NaN, t200 = NaN, t400m = NaN, vMax = 0, maxShiftDrop = 0, prevU = 0, s0 = 50, worstDrop = 0;
  for (let k = 0; k < 120 * 60; k++) {
    ctl.steerAngle = pursue(veh, 0).delta;
    veh.step(DT, ctl);
    const u = veh.forwardSpeed, t = veh.time;
    if (isNaN(t100) && u >= 100 / 3.6) t100 = t;
    if (isNaN(t200) && u >= 200 / 3.6) t200 = t;
    if (isNaN(t400m) && (pursue(veh, 0).proj.s - s0) >= 400) t400m = t;
    if (u < prevU) worstDrop = Math.max(worstDrop, prevU - u);
    vMax = Math.max(vMax, u); prevU = u;
  }
  // Analytic top speed: wheel power in top gear = drag + rolling resistance
  const c = CAR_VX1, rho = 1.225, g = 9.81;
  const ratio = c.gearbox.ratios[7] * c.gearbox.final;
  const pw = v => { const rpm = (v / c.wheelRadius) * ratio * RADS_TO_RPM; if (rpm > c.engine.limiterRpm) return 0; return tableLookup(c.engine.curve, rpm) * ratio * c.gearbox.efficiency / c.wheelRadius; };
  const res = v => 0.5 * rho * c.aero.cdA * v * v + c.tire.rollRes * (c.mass * g + 0.5 * rho * c.aero.clA * v * v);
  let lo = 30, hi = 95; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (pw(mid) > res(mid)) lo = mid; else hi = mid; }
  const vTopPred = lo;
  record('Acceleration: 0–100 km/h', t100 >= 2.3 && t100 <= 3.8, '2.3–3.8 s (fictional open-wheel target, traction-limited launch with TCS)', `${f(t100)} s`, 'Torque curve, gearing, launch clutch, TCS and wheel-spin stability errors');
  record('Acceleration: 0–200 km/h and 400 m', t200 >= 5.5 && t200 <= 10, '0–200 km/h in 5.5–10 s; 400 m time reported', `0–200: ${f(t200)} s, 400 m: ${f(t400m)} s`, 'Drag/power balance and shift logic');
  record('Acceleration: top speed vs power/drag balance', Math.abs(vMax - vTopPred) / vTopPred < 0.03, `within ±3% of analytic ${f(vTopPred * 3.6, 1)} km/h`, `${f(vMax * 3.6, 1)} km/h (${f(100 * (vMax - vTopPred) / vTopPred, 2)}%)`, 'Units errors in drag, efficiency, gear ratios or wheel radius');
  record('Acceleration: no speed loss during shifts', worstDrop < 0.25, 'speed drop per step < 0.25 m/s', `${f(worstDrop, 3)} m/s worst`, 'Torque spikes or reversed forces at gear changes');
  return { t100, t200, t400m, vMax };
}

// ---------- 2. Braking ----------
function brakeRun(world, vStart, abs, def = TEST_PAD) {
  const { track, veh } = makeSim(def, world); veh.reset(50, 0);
  const ctl = baseCtl(); ctl.abs = abs; const pursue = makePursuit(track);
  for (let k = 0; k < 120 * 40 && veh.forwardSpeed < vStart; k++) { ctl.steerAngle = pursue(veh, 0).delta; ctl.throttle = 1; veh.step(DT, ctl); }
  // settle at speed for 1 s
  for (let k = 0; k < 120; k++) { ctl.steerAngle = pursue(veh, 0).delta; speedHold(veh, vStart, ctl); veh.step(DT, ctl); }
  const v0 = veh.forwardSpeed; const sStart = pursue(veh, 0).proj.s; const tStart = veh.time;
  ctl.throttle = 0; ctl.brake = 1;
  let peakDecel = 0, lockSteps = 0, stopT = NaN, stopS = NaN;
  for (let k = 0; k < 120 * 20; k++) {
    ctl.steerAngle = pursue(veh, 0).delta;
    veh.step(DT, ctl);
    peakDecel = Math.max(peakDecel, -veh.aLong);
    if (veh.forwardSpeed > 3 && veh.wheels.some(w => w.omega === 0)) lockSteps++;
    if (isNaN(stopT) && veh.forwardSpeed < 0.05) { stopT = veh.time - tStart; stopS = pursue(veh, 0).proj.s - sStart; break; }
  }
  // hold brake 3 s, then release 5 s: the car must not creep or jitter
  let maxVHold = 0, maxVRelease = 0, rockBack = 0;
  for (let k = 0; k < 360; k++) { veh.step(DT, ctl); if (k < 60) rockBack = Math.max(rockBack, veh.speed); else maxVHold = Math.max(maxVHold, veh.speed); }
  ctl.brake = 0;
  for (let k = 0; k < 600; k++) { veh.step(DT, ctl); maxVRelease = Math.max(maxVRelease, veh.speed); }
  return { v0, stopT, stopS, peakDecel: peakDecel / G0, lockSteps, maxVHold, maxVRelease, rockBack, guard: veh.guardTrips + veh.nanResets };
}
function idealStop(world, v0, car = CAR_VX1) { // upper-bound deceleration: peak mu at average load, no transfer losses
  const m = car.mass, me = effMass(car), rho = world.airDensity, g = world.gravity;
  let v = v0, s = 0; const dt = 1e-3;
  while (v > 0.05) {
    const q = 0.5 * rho * v * v; const N = m * g + car.aero.clA * q;
    const a = (muAt(car, N / 4) * N + car.aero.cdA * q) / me;
    s += v * dt; v -= a * dt;
  }
  return s;
}
function testBraking() {
  const w = WORLDS.lumen_harbor;
  const on = brakeRun(w, 200 / 3.6, true), off = brakeRun(w, 200 / 3.6, false);
  const ideal = idealStop(w, on.v0);
  record('Braking: 200–0 km/h with ABS vs ideal', on.stopS >= ideal * 0.98 && on.stopS <= ideal * 1.30, `${f(ideal, 1)}–${f(ideal * 1.3, 1)} m (ideal = peak grip at average load, an upper bound on deceleration)`, `${f(on.stopS, 1)} m in ${f(on.stopT)} s, peak ${f(on.peakDecel)} g, locked-wheel steps above 3 m/s: ${on.lockSteps}`, 'Brake torque, bias, ABS and downforce errors');
  record('Braking: ABS off locks wheels and stops longer', off.lockSteps > 20 && off.stopS > on.stopS, 'lock-ups occur and distance exceeds the ABS run', `${f(off.stopS, 1)} m, locked-wheel steps: ${off.lockSteps}`, 'Missing lock-up or post-peak tire behaviour');
  record('Braking: no creep or jitter at standstill', on.maxVHold < 0.02 && on.maxVRelease < 0.02 && on.guard === 0, 'after a 0.5 s settle: speed < 0.02 m/s with brake held, and with brake released for 5 s', `held ${f(on.maxVHold, 4)} m/s, released ${f(on.maxVRelease, 4)} m/s; tire spring-back in the first 0.5 s peaks at ${f(on.rockBack, 3)} m/s; guard trips ${on.guard}`, 'Low-speed tire singularities and numerical creep');
  return { on, off, ideal };
}

// ---------- 3. Coast-down ----------
function coastRun(world, maxSeconds = 120) {
  const { track, veh } = makeSim(TEST_PAD, world); veh.reset(50, 0);
  const ctl = baseCtl(); const pursue = makePursuit(track);
  for (let k = 0; k < 120 * 60 && veh.forwardSpeed < 250 / 3.6; k++) { ctl.steerAngle = pursue(veh, 0).delta; ctl.throttle = 1; veh.step(DT, ctl); }
  ctl.throttle = 0; ctl.autoGears = false; veh.gear = 0; // neutral
  const samples = [];
  let prevU = veh.forwardSpeed, acc = 0, n = 0;
  for (let k = 0; k < 120 * maxSeconds && veh.forwardSpeed > 40 / 3.6; k++) {
    const pp = pursue(veh, 0); if (pp.proj.s > 5800) break;
    ctl.steerAngle = pp.delta;
    veh.step(DT, ctl);
    if ((k % 30) === 29) { const u = veh.forwardSpeed; samples.push([0.5 * (u + prevU), (u - prevU) / (30 * DT)]); prevU = u; }
  }
  // least squares a = A + B v²
  let s1 = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [v, a] of samples) { const x = v * v, y = -a; s1++; sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const B = (s1 * sxy - sx * sy) / (s1 * sxx - sx * sx), A = (sy - B * sx) / s1;
  return { A, B, samples: samples.length };
}
function testCoastDown() {
  const c = CAR_VX1, me = effMass(c), w = WORLDS.lumen_harbor;
  const r = coastRun(w);
  const crr = r.A * me / (c.mass * w.gravity);
  const cdA = 2 * me * r.B / w.airDensity - crr * c.aero.clA;
  record('Coast-down: recovered drag area', Math.abs(cdA - c.aero.cdA) / c.aero.cdA < 0.05, `CdA within ±5% of ${c.aero.cdA} m²`, `${f(cdA, 3)} m² from ${r.samples} samples`, 'Drag formula, density or mass errors');
  record('Coast-down: recovered rolling resistance', Math.abs(crr - c.tire.rollRes) / c.tire.rollRes < 0.10, `Crr within ±10% of ${c.tire.rollRes}`, `${f(crr, 4)}`, 'Rolling resistance or wheel-torque errors');
  const expA = c.tire.rollRes * 9.81 * c.mass / me;
  const vHi = coastDecel(WORLDS.test_vacuum, 250 / 3.6), vLo = coastDecel(WORLDS.test_vacuum, 25), air = coastDecel(w, 250 / 3.6);
  record('Coast-down in vacuum: no aerodynamic drag', Math.abs(vHi - expA) / expA < 0.15 && Math.abs(vLo - expA) / expA < 0.15 && Math.abs(vHi - vLo) < 0.02,
    `deceleration independent of speed and ≈ rolling resistance only (${f(expA, 3)} m/s²)`, `vacuum: ${f(vHi, 3)} m/s² at 250 km/h, ${f(vLo, 3)} m/s² at 90 km/h; with air at 250 km/h: ${f(air, 2)} m/s²`, 'Aero forces that ignore air density');
  return { cdA, crr, vacuum: { vHi, vLo }, air };
}

function coastDecel(world, vStart) { // mean deceleration over 6 s of coasting in neutral from vStart
  const { track, veh } = makeSim(TEST_PAD, world); veh.reset(50, 0);
  const ctl = baseCtl(); const pursue = makePursuit(track);
  for (let k = 0; k < 120 * 60 && veh.forwardSpeed < vStart; k++) { ctl.steerAngle = pursue(veh, 0).delta; ctl.throttle = 1; veh.step(DT, ctl); }
  ctl.throttle = 0; ctl.autoGears = false; veh.gear = 0;
  for (let k = 0; k < 60; k++) { ctl.steerAngle = pursue(veh, 0).delta; veh.step(DT, ctl); }
  const u0 = veh.forwardSpeed;
  for (let k = 0; k < 720; k++) { ctl.steerAngle = pursue(veh, 0).delta; veh.step(DT, ctl); }
  return (u0 - veh.forwardSpeed) / 6;
}

// ---------- 4. Constant radius ----------
function skidpad(world) {
  const { track, veh } = makeSim(SKIDPAD, world); veh.reset(0, 0);
  const ctl = baseCtl(); ctl.tcs = true; const pursue = makePursuit(track);
  let vT = 8; const rows = []; let maxLatSteady = 0, lostAt = NaN, win = [], ayF = 0;
  for (let k = 0; k < 120 * 200; k++) {
    const pp = pursue(veh, 0, false, 4, 0.25);
    ctl.steerAngle = pp.delta;
    speedHold(veh, vT, ctl, 0.8);
    veh.step(DT, ctl);
    vT += 0.12 * DT;
    const err = Math.abs(pp.proj.d);
    ayF += (veh.gLat() - ayF) * (DT / 0.5); // 0.5 s low-pass
    if ((k % 60) === 0) rows.push({ v: veh.forwardSpeed, ay: veh.aLat, delta: veh.steerAngle, beta: Math.atan2(veh.lateralSpeed, Math.max(veh.forwardSpeed, 0.1)), err });
    if (err < 2.0 && k > 600) maxLatSteady = Math.max(maxLatSteady, ayF);
    if (err > 2.5) { lostAt = veh.forwardSpeed; break; }
  }
  // understeer gradient from the linear range (steer vs lateral acceleration)
  const lin = rows.filter(r => r.ay > 0.2 * maxLatSteady * G0 && r.ay < 0.7 * maxLatSteady * G0);
  let K = NaN;
  if (lin.length > 3) {
    let s1 = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const r of lin) { s1++; sx += r.ay; sy += r.delta / DEG; sxx += r.ay * r.ay; sxy += r.ay * r.delta / DEG; }
    K = (s1 * sxy - sx * sy) / (s1 * sxx - sx * sx);
  }
  const maxBeta = Math.max(...rows.filter(r => r.err < 1).map(r => Math.abs(r.beta))) / DEG;
  return { maxLatSteady, lostAt, K, maxBeta, guard: veh.guardTrips + veh.nanResets };
}
function predictedLat(world, R = 50, car = CAR_VX1) {
  let v = 20;
  for (let i = 0; i < 50; i++) { const q = 0.5 * world.airDensity * v * v; const N = car.mass * world.gravity + car.aero.clA * q; const a = muAt(car, N / 4) * N / car.mass; v = Math.sqrt(a * R); }
  return (v * v / R) / G0;
}
function testSkidpad() {
  const w = WORLDS.lumen_harbor, r = skidpad(w), pred = predictedLat(w);
  record('Constant radius (R = 50 m): limit lateral acceleration', r.maxLatSteady >= 0.80 * pred && r.maxLatSteady <= 1.02 * pred, `${f(0.8 * pred)}–${f(1.02 * pred)} g (prediction ${f(pred)} g ignores load-transfer and drive-force losses)`, `${f(r.maxLatSteady)} g (0.5 s filtered, path error < 2 m); path lost at ${f(r.lostAt * 3.6, 1)} km/h`, 'Tire peak, load sensitivity and downforce coupling errors');
  record('Constant radius: stable understeer balance', r.K > -0.02 && r.maxBeta < 6 && r.guard === 0, 'understeer gradient ≥ −0.02 °/(m/s²); sideslip < 6° while on the path', `K = ${f(r.K, 3)} °/(m/s²), max sideslip ${f(r.maxBeta)}°`, 'Unstable oversteer from weight transfer or sign errors');
  const h = skidpad(WORLDS.halcyon_ring), predH = predictedLat(WORLDS.halcyon_ring);
  record('Worlds: lower gravity does not add grip (Halcyon Ring 0.7 g)', h.maxLatSteady < r.maxLatSteady, 'max lateral acceleration lower than on Earth-gravity Lumen Harbor', `${f(h.maxLatSteady)} g vs ${f(r.maxLatSteady)} g (prediction ${f(predH)} g)`, 'Grip that ignores normal load');
  return { lumen: r, pred, halcyon: h };
}

// ---------- 5. Slalom ----------
function testSlalom() {
  const { track, veh } = makeSim(TEST_PAD); veh.reset(50, 0);
  const ctl = baseCtl(); ctl.esc = false; const pursue = makePursuit(track);
  const v = 80 / 3.6;
  for (let k = 0; k < 120 * 30 && veh.forwardSpeed < v; k++) { ctl.steerAngle = pursue(veh, 0).delta; ctl.throttle = 1; veh.step(DT, ctl); }
  for (let k = 0; k < 240; k++) { ctl.steerAngle = pursue(veh, 0).delta; speedHold(veh, v, ctl); veh.step(DT, ctl); }
  const freq = 0.6, amp = 2.0 * DEG, cycles = 5, T = cycles / freq;
  let peakR = 0, peakAy = 0, lagSum = 0, lagN = 0, lastSteerPeak = -1;
  const t0 = veh.time; let prevR = 0, prevDR = 0;
  for (let k = 0; k < Math.round(T / DT); k++) {
    const t = veh.time - t0;
    ctl.steerAngle = amp * Math.sin(2 * Math.PI * freq * t);
    speedHold(veh, v, ctl); veh.step(DT, ctl);
    peakR = Math.max(peakR, Math.abs(veh.r)); peakAy = Math.max(peakAy, Math.abs(veh.gLat()));
    const ph = (t * freq) % 1;
    if (Math.abs(ph - 0.25) < DT * freq) lastSteerPeak = veh.time;
    const dR = veh.r - prevR;
    if (prevDR > 0 && dR <= 0 && veh.r > 0.02 && lastSteerPeak > 0 && t > 1 / freq) { lagSum += veh.time - lastSteerPeak; lagN++; }
    prevDR = dR; prevR = veh.r;
  }
  ctl.steerAngle = 0;
  let settle = NaN;
  for (let k = 0; k < 120 * 4; k++) { speedHold(veh, v, ctl); veh.step(DT, ctl); if (isNaN(settle) && Math.abs(veh.r) < 0.01) { settle = (k + 1) * DT; } if (!isNaN(settle) && Math.abs(veh.r) > 0.02) settle = NaN; }
  const lag = lagN ? lagSum / lagN : NaN;
  record('Slalom (80 km/h, 0.6 Hz, ±2°): bounded, settles', peakAy < 1.2 && settle < 2.0 && veh.guardTrips === 0, 'peak lateral < 1.2 g; yaw rate < 0.01 rad/s within 2 s after input stops', `peak ${f(peakAy)} g, peak yaw rate ${f(peakR, 3)} rad/s, settle ${f(settle)} s`, 'Under-damped yaw modes or divergence');
  record('Slalom: yaw response lag', lag > 0 && lag < 0.25, 'yaw-rate peak follows steer peak by 0–0.25 s', `${f(lag, 3)} s average over ${lagN} peaks`, 'Excess tire relaxation or missing transient response');
  return { peakAy, peakR, settle, lag };
}

// ---------- 6. Curb strike ----------
function curbRun(speed, onCurb) {
  const off = onCurb ? 5.8 : -5.8; // right wheels on the curb band [6, 7.2] m, or the same offset on the curb-free left side
  const { track, veh } = makeSim(TEST_WALL); veh.reset(300, off);
  veh.vx = Math.sin(veh.yaw) * speed; veh.vz = Math.cos(veh.yaw) * speed; // start at speed (test harness)
  for (const w of veh.wheels) w.omega = speed / veh.car.wheelRadius;
  const ctl = baseCtl(); const pursue = makePursuit(track);
  let maxComp = 0, maxLoad = 0, minLoad = Infinity, maxHeadErr = 0, maxR = 0, loadVar = 0, n = 0, curbSteps = 0;
  const static0 = veh.wheels[3].compStatic;
  for (let k = 0; k < 120 * 200; k++) {
    const pp = pursue(veh, off, false, 8, 0.6);
    if (pp.proj.s > 2300) break;
    ctl.steerAngle = pp.delta; speedHold(veh, speed, ctl); veh.step(DT, ctl);
    const s = pp.proj.s;
    if (s > 380 && s < 2300) {
      for (const w of veh.wheels) { maxComp = Math.max(maxComp, w.comp); maxLoad = Math.max(maxLoad, w.load); minLoad = Math.min(minLoad, w.load); if (w.surface === 'curb') curbSteps++; }
      const hdg = Math.atan2(track.tx[pp.proj.i], track.tz[pp.proj.i]);
      let e = veh.yaw - hdg; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      maxHeadErr = Math.max(maxHeadErr, Math.abs(e)); maxR = Math.max(maxR, Math.abs(veh.r));
      loadVar += (veh.wheels[3].load - veh.wheels[2].load) ** 2; n++;
    }
  }
  return { maxComp, maxLoad, minLoad, maxHeadErr: maxHeadErr / DEG, maxR, rmsDiff: Math.sqrt(loadVar / Math.max(1, n)), curbSteps, static0, guard: veh.guardTrips + veh.nanResets, travel: veh.car.susp.travel };
}
function testCurbs() {
  const fast = curbRun(150 / 3.6, true), fastRef = curbRun(150 / 3.6, false), slow = curbRun(15, true);
  const ok = r => r.maxComp < r.travel + 0.015 && r.minLoad >= 0 && r.maxLoad < 16000 && r.maxHeadErr < 4 && r.maxR < 0.3 && r.guard === 0;
  record('Curb strike at 150 km/h (right wheels on a 25 mm curb)', ok(fast) && fast.curbSteps > 100, `max compression < ${f((fast.travel + 0.015) * 1000, 0)} mm, loads 0–16 kN (≈4× an aero-loaded corner), heading error < 4°, yaw rate < 0.3 rad/s`, `comp ${f(fast.maxComp * 1000, 1)} mm, load ${f(fast.minLoad, 0)}–${f(fast.maxLoad, 0)} N, heading err ${f(fast.maxHeadErr)}°, yaw ${f(fast.maxR, 3)} rad/s, curb contact steps ${fast.curbSteps}`, 'Excessive impulses, bump-stop explosions, instability on curbs');
  record('Curb at 15 m/s with ridges (band-limited)', ok(slow) && slow.curbSteps > 100, 'same limits with ridge vibration active', `comp ${f(slow.maxComp * 1000, 1)} mm, load ${f(slow.minLoad, 0)}–${f(slow.maxLoad, 0)} N, heading err ${f(slow.maxHeadErr)}°`, 'Aliasing or resonance from curb ridges');
  record('Curb changes wheel loads measurably', fast.rmsDiff > fastRef.rmsDiff * 1.2, 'left/right rear load difference larger on the curb than on flat asphalt', `${f(fast.rmsDiff, 0)} N vs ${f(fastRef.rmsDiff, 0)} N`, 'Curbs that have no physical effect');
  return { fast, fastRef, slow };
}

// ---------- 7. Collisions and tunneling ----------
function wallRun(angleDeg, speed, startOffset) {
  const { track, veh } = makeSim(TEST_WALL); veh.reset(1000, startOffset);
  const hdg = veh.yaw;
  veh.yaw = hdg + angleDeg * DEG;
  veh.vx = Math.sin(veh.yaw) * speed; veh.vz = Math.cos(veh.yaw) * speed;
  const ctl = baseCtl();
  const p = { i: 0, t: 0, s: 0, d: 0, nx: 0, nz: 0, dist2: 0 };
  const KE0 = veh.kineticEnergy();
  let maxPen = 0, maxPenAfter = 0, firstContact = -1, maxR = 0, vnIn = NaN, vnOut = NaN, maxCgD = -Infinity;
  const nAt = () => { track.project(veh.x, veh.z, -1, p); return { nx: -Math.sign(p.d) * p.nx, nz: -Math.sign(p.d) * p.nz }; };
  for (let k = 0; k < 240; k++) {
    if (firstContact < 0) { const n = nAt(); vnIn = veh.vx * n.nx + veh.vz * n.nz; }
    veh.step(DT, ctl);
    let pen = 0;
    for (const [bx, bz] of veh.bodyPts) {
      const sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw);
      const px = veh.x + cy * bx + sy * bz, pz = veh.z - sy * bx + cy * bz;
      track.project(px, pz, -1, p);
      pen = Math.max(pen, Math.abs(p.d) - track.barrierOffset(p));
    }
    track.project(veh.x, veh.z, -1, p); maxCgD = Math.max(maxCgD, Math.abs(p.d) - track.barrierOffset(p));
    if (veh.contacts.length && firstContact < 0) firstContact = k;
    maxPen = Math.max(maxPen, pen);
    if (firstContact >= 0 && k > firstContact + 3) maxPenAfter = Math.max(maxPenAfter, pen);
    maxR = Math.max(maxR, Math.abs(veh.r));
  }
  const n = nAt(); vnOut = veh.vx * n.nx + veh.vz * n.nz;
  return { KE0, KE1: veh.kineticEnergy(), maxPen, maxPenAfter, maxR, vnIn, vnOut, maxCgD, contacted: firstContact >= 0, guard: veh.guardTrips + veh.nanResets };
}
function testCollisions() {
  const a = wallRun(30, 150 / 3.6, 0);
  record('Barrier impact 30° at 150 km/h', a.contacted && a.KE1 <= a.KE0 && a.maxPenAfter < 0.05 && Math.abs(a.vnOut) <= 0.3 * Math.abs(a.vnIn) + 1.0 && a.maxR < 6 && a.guard === 0,
    'no energy gain; penetration < 0.05 m from 4 steps after contact; outgoing normal speed ≤ 0.3 × incoming + 1 m/s; yaw rate < 6 rad/s',
    `KE ${f(a.KE0 / 1000, 0)} → ${f(a.KE1 / 1000, 0)} kJ; peak pen ${f(a.maxPen, 3)} m, later ${f(a.maxPenAfter, 3)} m; normal speed ${f(Math.abs(a.vnIn))} → ${f(Math.abs(a.vnOut))} m/s; yaw ${f(a.maxR)} rad/s`,
    'Excessive collision impulses, energy injection, sinking into walls');
  const b = wallRun(90, 90, 4);
  record('Tunneling: head-on at 90 m/s', b.contacted && b.maxCgD < 0 && b.maxPenAfter < 0.05 && b.guard === 0, 'car centre never passes the barrier; penetration < 0.05 m after resolution', `CG margin ${f(-b.maxCgD)} m inside; peak pen ${f(b.maxPen, 3)} m, later ${f(b.maxPenAfter, 3)} m`, 'Tunneling through thin geometry at high speed');
  return { a, b };
}

// ---------- 8. Low-speed stability ----------
function testLowSpeed() {
  const { track, veh } = makeSim(TEST_PAD); veh.reset(50, 0);
  const ctl = baseCtl(); const x0 = veh.x, z0 = veh.z, y0 = veh.yaw;
  let maxV = 0, maxR = 0;
  for (let k = 0; k < 120 * 60; k++) { veh.step(DT, ctl); maxV = Math.max(maxV, veh.speed); maxR = Math.max(maxR, Math.abs(veh.r)); }
  const drift = Math.hypot(veh.x - x0, veh.z - z0), yawDrift = Math.abs(veh.yaw - y0);
  record('Low speed: 60 s at rest, no input', maxV < 1e-3 && maxR < 1e-4 && drift < 0.01, 'speed < 0.001 m/s, yaw rate < 1e-4 rad/s, drift < 1 cm', `speed ${maxV.toExponential(2)} m/s, yaw rate ${maxR.toExponential(2)} rad/s, drift ${f(drift * 1000, 3)} mm, yaw drift ${yawDrift.toExponential(2)} rad`, 'Numerical creep and jitter at rest');
  // gentle creep: smooth acceleration with tiny throttle
  ctl.throttle = 0.05; let signChanges = 0, prevA = 0, aF = 0, maxKt = 0;
  const pursue = makePursuit(track);
  for (let k = 0; k < 120 * 6; k++) {
    ctl.steerAngle = pursue(veh, 0).delta; veh.step(DT, ctl);
    aF += (veh.aLong - aF) * 0.2;
    if (k > 60 && Math.sign(aF) !== Math.sign(prevA) && Math.abs(aF) > 0.05) signChanges++;
    prevA = aF; maxKt = Math.max(maxKt, Math.abs(veh.wheels[2].kt));
  }
  record('Low speed: smooth creep with 5% throttle', signChanges <= 2 && veh.forwardSpeed > 0.5, 'acceleration does not oscillate (≤ 2 sign changes); car moves', `speed after 6 s ${f(veh.forwardSpeed)} m/s, sign changes ${signChanges}, max rear slip ${f(maxKt, 3)}`, 'Low-speed slip oscillation (the classic 1/v instability)');
  return { maxV, maxR, drift };
}

// ---------- 9. Frame-rate independence and timestep convergence ----------
function scripted(t) { // stays inside the tire's linear range so the comparison is not chaotic
  return {
    throttle: t < 4 ? 1 : (t < 13 ? 0.45 : 0),
    brake: t >= 13 && t < 15 ? 0.5 : 0,
    steer: t > 5 && t < 13 ? 0.6 * DEG * Math.sin(2 * Math.PI * 0.4 * (t - 5)) : 0,
  };
}
function scriptedPhysics(t) { // no wheelspin, no lock-up, no ABS/TCS limit cycles: isolates numerical convergence
  return { throttle: t < 13 ? 0.35 : 0, brake: t >= 13 && t < 15 ? 0.35 : 0, steer: t > 5 && t < 13 ? 0.6 * DEG * Math.sin(2 * Math.PI * 0.4 * (t - 5)) : 0 };
}
function loopRun(frameDtFn, simDt, seconds, script = scripted, electronics = true) {
  const { track, veh } = makeSim(TEST_PAD); veh.reset(50, 0);
  const ctl = baseCtl(); ctl.abs = ctl.tcs = electronics; let acc = 0, frames = 0; const maxSteps = 8;
  const totalSteps = Math.round(seconds / simDt);
  while (veh.steps < totalSteps) {
    acc += frameDtFn(frames++);
    let n = 0;
    while (acc >= simDt && n < maxSteps && veh.steps < totalSteps) {
      const s = script(veh.time); ctl.throttle = s.throttle; ctl.brake = s.brake; ctl.steerAngle = s.steer;
      veh.step(simDt, ctl); acc -= simDt; n++;
    }
  }
  return { x: veh.x, z: veh.z, yaw: veh.yaw, vx: veh.vx, vz: veh.vz, frames };
}
function testFrameRate() {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const runs = {
    '30 FPS': loopRun(() => 1 / 30, DT, 20), '60 FPS': loopRun(() => 1 / 60, DT, 20), '90 FPS': loopRun(() => 1 / 90, DT, 20),
    '144 FPS': loopRun(() => 1 / 144, DT, 20), '60 FPS ±40% jitter': loopRun(() => (1 / 60) * (0.6 + 0.8 * rnd()), DT, 20),
  };
  const ref = runs['60 FPS'];
  const same = Object.values(runs).every(r => r.x === ref.x && r.z === ref.z && r.yaw === ref.yaw && r.vx === ref.vx);
  record('Frame-rate independence (30/60/90/144 FPS, jitter)', same, 'bit-identical final state for every render rate', same ? `identical: x=${ref.x.toFixed(6)}, z=${ref.z.toFixed(6)}` : JSON.stringify(Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, v.x]))), 'Simulation coupled to render frame time');
  const a = loopRun(() => 1 / 60, 1 / 120, 15, scriptedPhysics, false), b = loopRun(() => 1 / 60, 1 / 240, 15, scriptedPhysics, false), c4 = loopRun(() => 1 / 60, 1 / 480, 15, scriptedPhysics, false);
  const dv4 = Math.abs(Math.hypot(a.vx, a.vz) - Math.hypot(c4.vx, c4.vz)) / Math.hypot(c4.vx, c4.vz);
  const dv = Math.abs(Math.hypot(a.vx, a.vz) - Math.hypot(b.vx, b.vz)) / Math.hypot(b.vx, b.vz), dp = Math.hypot(a.x - b.x, a.z - b.z);
  record('Timestep convergence: 120 Hz vs 240 Hz (physics only)', dv < 0.01 && dp < 2.0, 'speed within 1%, position within 2 m after a 15 s manoeuvre with ABS/TCS off and no wheelspin or lock-up', `speed diff ${f(100 * dv, 3)}% (vs 480 Hz: ${f(100 * dv4, 3)}%), position diff ${f(dp, 3)} m`, 'Results that depend on the step size');
  const r1 = loopRun(() => 1 / 60, DT, 20), r2 = loopRun(() => 1 / 60, DT, 20);
  record('Repeatability (same machine, same inputs)', r1.x === r2.x && r1.vx === r2.vx, 'bit-identical; cross-device determinism is not claimed', r1.x === r2.x ? 'identical' : 'different', 'Hidden state or randomness in the simulation');
  return { same, dv, dp };
}

// ---------- 10. Worlds: braking under different gravity and air ----------
function testWorlds() {
  const L = brakeRun(WORLDS.lumen_harbor, 100 / 3.6, true), H = brakeRun(WORLDS.halcyon_ring, 100 / 3.6, true), V = brakeRun(WORLDS.test_vacuum, 100 / 3.6, true);
  record('Worlds: braking 100–0 km/h', H.stopS > L.stopS && V.stopS > L.stopS, 'longer on 0.7 g Halcyon Ring and in vacuum (no downforce, no drag) than on Lumen Harbor', `Lumen ${f(L.stopS, 1)} m, Halcyon ${f(H.stopS, 1)} m, vacuum ${f(V.stopS, 1)} m`, 'World rules that do not reach the vehicle physics');
  return { L: L.stopS, H: H.stopS, V: V.stopS };
}

// ---------- 11. Integration: bot laps through assists and race rules ----------
function botLap(presetId) {
  const world = WORLDS.lumen_harbor;
  const track = new Track(TRACK_HARBOR, world, CAR_VX1);
  const veh = new Vehicle(CAR_VX1, world, track);
  veh.reset(TRACK_HARBOR.gridS, 0);
  const preset = { ...ASSIST_PRESETS[presetId], autoGears: true };
  const driver = new DriverInput(); const race = new RaceSession(track, 'timetrial', { laps: 2 });
  const pursue = makePursuit(track); const steering = { speedRef: 25, linearity: 1 };
  const raw = { steer: 0, throttle: 0, brake: 0 };
  let minLimit = Infinity;
  for (let k = 0; k < 120 * 200 && !race.finished; k++) {
    const pp = pursue(veh, 0, true, 6, 0.42);
    const u = Math.max(0, veh.forwardSpeed);
    raw.steer = clamp(pp.delta * (steering.speedRef + u) / (steering.speedRef * CAR_VX1.steerLock), -1, 1);
    if (!preset.autoThrottle) { // a skilled "player": follow the reference speed with throttle and brake
      const vRef = track.lineSpeedAt(pp.proj.s + u * 0.3) * 0.96;
      raw.throttle = clamp((vRef - u) * 0.8, 0, 1); raw.brake = clamp((u - vRef - 0.5) * 0.25, 0, 1);
    }
    const ctl = driver.process(DT, raw, veh, track, preset, steering);
    veh.step(DT, ctl);
    race.update(DT, veh.time, veh, assistClass(preset));
    minLimit = Math.min(minLimit, track.limitOffset(pp.proj) - Math.abs(pp.proj.d));
  }
  return { laps: race.laps.map(l => ({ time: l.time, valid: l.valid, reason: l.reason, sectors: l.sectors })), impacts: veh.impactCount, guard: veh.guardTrips + veh.nanResets, refLap: track.referenceLapTime };
}
function testBotLaps() {
  const rk = botLap('rookie'), rc = botLap('racer');
  const fmt = r => r.laps.map(l => `${f(l.time, 3)} s ${l.valid ? 'valid' : 'INVALID (' + l.reason + ')'}`).join('; ');
  record('Integration: Rookie preset lap (bot steers only; assists handle throttle/brake)', rk.laps.length >= 2 && rk.laps.every(l => l.valid) && rk.impacts === 0 && rk.guard === 0, '2 valid timed laps, no barrier contact', `${fmt(rk)}; impacts ${rk.impacts}`, 'Broken assists, lap timing, checkpoints or track limits');
  record('Integration: Racer preset lap (bot steers, throttles and brakes)', rc.laps.length >= 2 && rc.laps.every(l => l.valid) && rc.impacts === 0, `2 valid laps; reference profile lap ${f(rc.refLap, 2)} s`, `${fmt(rc)}; impacts ${rc.impacts}`, 'Speed-profile, braking or stability problems over a full lap');
  return { rookie: rk, racer: rc };
}


// ---------- 13. Car-to-car contact, slipstream and AI field ----------
function momentum(vs) {
  let px = 0, pz = 0, L = 0, E = 0;
  for (const v of vs) { const m = v.car.mass; px += m * v.vx; pz += m * v.vz; L += v.car.yawInertia * v.r + m * (v.z * v.vx - v.x * v.vz); E += v.kineticEnergy(); }
  return { px, pz, L, E };
}
function maxOverlap(A, B) { // penetration depth along the separating axes (0 if apart)
  const C = (v) => { const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw), F = FOOTPRINT; return [[-F.halfWidth, F.rear], [F.halfWidth, F.rear], [F.halfWidth, F.front], [-F.halfWidth, F.front]].map(([a, b]) => [v.x + cy * a + sy * b, v.z - sy * a + cy * b]); };
  const ca = C(A), cb = C(B); let pen = Infinity;
  for (const v of [A, B]) for (const [ax, az] of [[Math.sin(v.yaw), Math.cos(v.yaw)], [Math.cos(v.yaw), -Math.sin(v.yaw)]]) {
    const pa = ca.map((p) => p[0] * ax + p[1] * az), pb = cb.map((p) => p[0] * ax + p[1] * az);
    pen = Math.min(pen, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
  }
  return Math.max(0, pen);
}
function testCarContacts() {
  // (a) one oblique rear-end impact resolved in isolation: conservation and dissipation
  const track = new Track(TEST_PAD, WORLDS.lumen_harbor, CAR_VX1);
  const A = new Vehicle(CAR_VX1, WORLDS.lumen_harbor, track), B = new Vehicle(CAR_VX1, WORLDS.lumen_harbor, track);
  A.reset(100, -0.5); B.reset(104.85, 0.4); B.yaw += 0.12;
  A.vz = 32; A.vx = 0.8; A.r = 0.05; B.vz = 12; B.vx = -0.3; B.r = -0.1;
  const before = { A: [A.vx, A.vz, A.r], B: [B.vx, B.vz, B.r] };
  const pen0 = maxOverlap(A, B);
  const n = resolveCarContacts([A, B]);
  const after = momentum([A, B]);
  const tmp = [[A, before.A], [B, before.B]].map(([v, s]) => { const keep = [v.vx, v.vz, v.r]; [v.vx, v.vz, v.r] = s; return keep; });
  const prior = momentum([A, B]); // pre-impulse velocities at the corrected positions
  [[A.vx, A.vz, A.r], [B.vx, B.vz, B.r]] = tmp;
  const dP = Math.hypot(after.px - prior.px, after.pz - prior.pz) / Math.hypot(prior.px, prior.pz), dL = Math.abs(after.L - prior.L) / Math.max(1, Math.abs(prior.L));
  const pen1 = maxOverlap(A, B);
  record('Car contact: momentum conserved, energy dissipated (oblique rear-end, 20 m/s closing)',
    n === 1 && dP < 1e-12 && dL < 1e-9 && after.E < prior.E && pen1 < pen0,
    'linear and angular momentum change < 1e-9 (relative); kinetic energy falls; overlap reduced',
    `contacts ${n}; Δp ${dP.toExponential(1)}; ΔL ${dL.toExponential(1)}; KE ${f(prior.E / 1000, 1)} → ${f(after.E / 1000, 1)} kJ; overlap ${f(pen0 * 100, 1)} → ${f(pen1 * 100, 1)} cm`,
    'Impulses that create or destroy momentum, or inject energy');
  // (b) two cars squeezed together side by side at 50 m/s for 4 s, full simulation each step
  const L1 = new Vehicle(CAR_VX1, WORLDS.lumen_harbor, track), R1 = new Vehicle(CAR_VX1, WORLDS.lumen_harbor, track);
  L1.reset(200, -1.3); R1.reset(200.6, 1.3);
  for (const v of [L1, R1]) { v.vz = 50; for (const w of v.wheels) w.omega = 50 / CAR_VX1.wheelRadius; v.gear = 6; }
  const ctl = baseCtl(); let maxPen = 0, maxR = 0, hits = 0;
  for (let k = 0; k < 480; k++) {
    const squeeze = k < 90 ? 0.012 : 0;
    speedHold(L1, 50, ctl); ctl.steerAngle = squeeze; L1.step(DT, { ...ctl });
    speedHold(R1, 50, ctl); ctl.steerAngle = -squeeze; R1.step(DT, { ...ctl });
    hits += resolveCarContacts([L1, R1]) > 0 ? 1 : 0;
    maxPen = Math.max(maxPen, maxOverlap(L1, R1)); maxR = Math.max(maxR, Math.abs(L1.r), Math.abs(R1.r));
  }
  const ok = L1.nanResets + R1.nanResets === 0 && maxPen < 0.15 && maxR < 2 && L1.forwardSpeed > 35 && R1.forwardSpeed > 35 && hits > 0;
  record('Car contact: side-by-side squeeze at 50 m/s stays stable (no tunnelling, no spin-out)', ok,
    'contact occurs; overlap < 15 cm; yaw rate < 2 rad/s; both cars keep > 35 m/s; no NaN',
    `contact steps ${hits}; max overlap ${f(maxPen * 100, 1)} cm; max yaw rate ${f(maxR, 2)} rad/s; speeds ${f(L1.forwardSpeed, 1)} / ${f(R1.forwardSpeed, 1)} m/s`,
    'Contact jitter, interpenetration or explosive separation');
  return { dP, dL, energyBefore: prior.E, energyAfter: after.E, hits, maxPen, maxR };
}
function testSlipstream() {
  const run = (tow) => {
    const track = new Track(TEST_PAD, WORLDS.lumen_harbor, CAR_VX1);
    const B = new Vehicle(CAR_VX1, WORLDS.lumen_harbor, track), A = new Vehicle(CAR_VX1, WORLDS.lumen_harbor, track);
    B.reset(50, 0); B.vz = 50; for (const w of B.wheels) w.omega = 50 / CAR_VX1.wheelRadius; B.gear = 5;
    const ctl = baseCtl(); ctl.throttle = 1; const pursue = makePursuit(track); let ds = 0, scale = 1;
    for (let k = 0; k < 120 * 15; k++) {
      ctl.steerAngle = pursue(B, 0).delta;
      if (tow) { A.x = B.x + Math.sin(B.yaw) * 12; A.z = B.z + Math.cos(B.yaw) * 12; A.yaw = B.yaw; applySlipstream([A, B]); scale = B.dragScale; }
      const z0 = B.z; B.step(DT, ctl); ds += B.z - z0;
    }
    return { v: B.forwardSpeed, ds, scale };
  };
  const solo = run(false), tow = run(true);
  const gain = tow.ds - solo.ds;
  record('Slipstream: following 12 m behind cuts drag and gains speed (wake model, estimated)',
    tow.scale < 0.85 && tow.v > solo.v + 1 && gain > 10,
    `drag multiplier < 0.85 at 12 m (model: up to −${WAKE.dragCut * 100}% at 0 m, fading to 0 at ${WAKE.length} m); faster and further after 15 s of full throttle`,
    `drag ×${f(tow.scale, 3)}; speed after 15 s ${f(solo.v * 3.6, 1)} → ${f(tow.v * 3.6, 1)} km/h; +${f(gain, 1)} m covered`,
    'Slipstream missing, reversed, or applied to the wrong car');
  return { solo, tow, gain };
}
function aiField(level, laps, seed) {
  const world = WORLDS.lumen_harbor, track = new Track(TRACK_HARBOR, world, CAR_VX1);
  const field = new RaceField(track, laps), cars = [];
  for (let k = 0; k < 8; k++) {
    const veh = new Vehicle(CAR_VX1, world, track);
    veh.reset(TRACK_HARBOR.lineS - 20 - k * 8, k % 2 ? 2.2 : -2.2);
    const ai = new AIDriver({ pace: AI_LEVELS[level] + (3.5 - k) * 0.004, seed: seed + k * 101 });
    cars.push({ veh, ai, e: field.add(veh, { id: k }) });
  }
  const vehs = cars.map((c) => c.veh);
  let contacts = 0, resets = 0, t = 0, hard = 0, maxHit = 0; const tMax = laps * 75 + 20;
  const hold = { steerAngle: 0, throttle: 0, brake: 1, autoGears: true, gearRequest: 'D', abs: true, tcs: true, esc: false };
  while (t < tMax && !cars.every((c) => c.e.finished)) {
    for (const c of cars) {
      const ctl = t < 1 ? hold : c.ai.process(DT, c.veh, track, field.entries);
      c.veh.step(DT, ctl);
      if (c.ai.needsReset) { c.ai.needsReset = false; resets++; const p = track.project(c.veh.x, c.veh.z, -1, {}); c.veh.reset(p.s - 2, 0); }
    }
    contacts += resolveCarContacts(vehs); applySlipstream(vehs);
    for (let i = 0; i < vehs.length; i++) for (const h of vehs[i].carHits) if (h.impulse > 0 && vehs.indexOf(vehs[i]) === i) { maxHit = Math.max(maxHit, h.speed); if (h.speed > 6) hard++; }
    t += DT; field.update(DT, t);
  }
  return { hard: hard / 2, maxHit, finished: cars.filter((c) => c.e.finished).length, order: field.order.map((e) => e.id), times: field.finishOrder.map((e) => e.finishTime), best: Math.min(...cars.map((c) => c.e.best)),
    contacts, resets, barrier: vehs.reduce((a, v) => a + v.impactCount, 0), nan: vehs.reduce((a, v) => a + v.nanResets, 0), last: vehs.map((v) => [v.x, v.z]), simTime: t };
}
function testAIField() {
  const t0 = performance.now();
  const r1 = aiField('medium', 2, 7), ms = performance.now() - t0;
  const r2 = aiField('medium', 2, 7);
  const same = JSON.stringify(r1.last) === JSON.stringify(r2.last) && r1.order.join() === r2.order.join();
  const ref = new Track(TRACK_HARBOR, WORLDS.lumen_harbor, CAR_VX1).referenceLapTime;
  record('AI field: 8 AI cars race 2 laps from a standing grid start (Harbor Loop, medium pace)',
    r1.finished === 8 && r1.nan === 0 && r1.times[7] - r1.times[0] < 30 && r1.resets <= 1 && r1.hard <= 2,
    `all 8 finish; no NaN; field spread < 30 s; ≤ 1 race-control reset; ≤ 2 car impacts above 6 m/s (reference lap ${f(ref, 2)} s)`,
    `finished ${r1.finished}/8; winner ${f(r1.times[0], 2)} s, last ${f(r1.times[7], 2)} s; best lap ${f(r1.best, 2)} s; car-contact steps ${r1.contacts} (impacts > 6 m/s: ${r1.hard}, hardest ${f(r1.maxHit, 1)} m/s); barrier impacts ${r1.barrier}; resets ${r1.resets}; order ${r1.order.join('-')}; ${f(ms / 1000, 2)} s CPU for ${f(r1.simTime, 1)} s simulated`,
    'AI that cannot complete laps, piles up, or destabilises the field');
  record('AI field is deterministic (same seeds → identical race)', same, 'identical final positions and order across two runs', same ? 'identical' : 'DIFFERENT', 'Hidden randomness or order dependence (would break replays and the Unity port comparison)');
  return { r1: { ...r1, last: undefined }, ms, deterministic: same };
}

// ---------- 12. CPU cost (container, not a phone) ----------
function testPerf() {
  const world = WORLDS.lumen_harbor;
  const track = new Track(TRACK_HARBOR, world, CAR_VX1);
  const veh = new Vehicle(CAR_VX1, world, track); veh.reset(TRACK_HARBOR.gridS, 0);
  const preset = ASSIST_PRESETS.rookie, driver = new DriverInput(), race = new RaceSession(track, 'practice');
  const pursue = makePursuit(track), steering = { speedRef: 25, linearity: 1 }, raw = { steer: 0, throttle: 0, brake: 0 };
  const stepAll = () => {
    const pp = pursue(veh, 0, true, 6, 0.42); const u = Math.max(0, veh.forwardSpeed);
    raw.steer = clamp(pp.delta * (25 + u) / (25 * CAR_VX1.steerLock), -1, 1);
    const ctl = driver.process(DT, raw, veh, track, preset, steering); veh.step(DT, ctl); race.update(DT, veh.time, veh, 'assisted');
  };
  for (let k = 0; k < 3000; k++) stepAll();
  const N = 120 * 120; let t0 = performance.now();
  for (let k = 0; k < N; k++) stepAll();
  const usFull = (performance.now() - t0) * 1000 / N;
  const ctl2 = { ...driver.out }; t0 = performance.now();
  for (let k = 0; k < N; k++) veh.step(DT, ctl2);
  const usVeh = (performance.now() - t0) * 1000 / N;
  const perFrame8 = usFull * 8 * 2 / 1000;
  record('CPU cost per step (this container: x86-64, Node V8 — not a phone measurement)', usFull < 50, '< 50 µs per car-step here; device budget is 1.5 ms per frame for 8 cars at 120 Hz (measure in M1)', `full stack ${f(usFull, 2)} µs/step (vehicle only ${f(usVeh, 2)} µs) → ${f(perFrame8, 3)} ms per 60 FPS frame for 8 cars`, 'Simulation too expensive for the frame budget');
  return { usFull, usVeh, perFrame8 };
}

// ---------- golden trace for the Unity C# port ----------
function writeGolden() {
  const { track, veh } = makeSim(TEST_PAD); veh.reset(50, 0);
  const ctl = baseCtl(); const rows = [];
  for (let k = 0; k <= 120 * 16; k++) {
    const s = scripted(veh.time); ctl.throttle = s.throttle; ctl.brake = s.brake; ctl.steerAngle = s.steer;
    if (k % 12 === 0) rows.push({ t: +veh.time.toFixed(5), x: veh.x, z: veh.z, yaw: veh.yaw, vx: veh.vx, vz: veh.vz, r: veh.r, gear: veh.gear, rpm: veh.rpm, steer: veh.steerAngle, omega: veh.wheels.map(w => w.omega), load: veh.wheels.map(w => w.load) });
    veh.step(DT, ctl);
  }
  const out = { version: 1, dt: DT, car: CAR_VX1.id, world: 'lumen_harbor', track: 'TEST_PAD rectangle (see tests/validate.mjs)', start: { s: 50 }, script: 'throttle 1 for 0–4 s, 0.45 for 4–13 s; brake 0.5 for 13–15 s; steer 0.6°·sin(2π·0.4·(t−5)) for 5–13 s; ABS+TCS on, ESC off, auto gears; 4 wheel substeps', tolerance: 'C# port should match x/z within 0.05 m and speed within 0.1% at t = 16 s', rows };
  fs.mkdirSync(path.join(HERE, 'golden'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'golden', 'vx1_scripted_v1.json'), JSON.stringify(out));
  return rows.length;
}

// ---------- run ----------
const started = Date.now();
const metrics = {};
metrics.acceleration = testAcceleration();
metrics.braking = testBraking();
metrics.coast = testCoastDown();
metrics.skidpad = testSkidpad();
metrics.slalom = testSlalom();
metrics.curbs = testCurbs();
metrics.collisions = testCollisions();
metrics.lowSpeed = testLowSpeed();
metrics.frameRate = testFrameRate();
metrics.worlds = testWorlds();
metrics.bots = testBotLaps();
metrics.perf = testPerf();
metrics.carContacts = testCarContacts();
metrics.slipstream = testSlipstream();
metrics.aiField = testAIField();
const goldenRows = writeGolden();

const passed = results.filter(r => r.pass).length;
const summary = { date: new Date().toISOString(), node: process.version, platform: `${process.platform} ${process.arch}`, dt: DT, passed, total: results.length, seconds: (Date.now() - started) / 1000, goldenRows };
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'report.json'), JSON.stringify({ summary, results, metrics: JSON.parse(JSON.stringify(metrics, (k, v) => (v instanceof Float32Array ? undefined : v))) }, null, 2));
const md = [`# VELOCITYVERSE vehicle validation report`, '', `Run ${summary.date} on ${summary.platform}, Node ${summary.node}, fixed step ${f(1 / DT, 0)} Hz. ${passed}/${results.length} checks passed in ${f(summary.seconds, 1)} s.`, '', '| Result | Test | Expected | Measured | Detects |', '| --- | --- | --- | --- | --- |',
  ...results.map(r => `| ${r.pass ? 'PASS' : 'FAIL'} | ${r.name} | ${r.expected} | ${r.measured} | ${r.detects} |`)].join('\n');
fs.writeFileSync(path.join(HERE, 'results', 'report.md'), md + '\n');
log(`\n${passed}/${results.length} checks passed in ${f(summary.seconds, 1)} s`);
process.exit(passed === results.length ? 0 : 1);
