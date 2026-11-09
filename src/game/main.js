// VELOCITYVERSE client: game shell — fixed-step loop with render interpolation, screens, HUD, race flow
// (practice, time trial, race against AI rivals), saves, ghosts, assists, settings, telemetry and instrumentation.
import { CAR_VX1, WORLDS, TRACK_HARBOR, PROVENANCE_LABEL } from '../sim/data.js';
import { Track } from '../sim/track.js';
import { Vehicle } from '../sim/vehicle.js';
import { DriverInput, ASSIST_PRESETS, assistClass } from '../sim/assists.js';
import { RaceSession, RaceField, ghostPoseAt, ghostTimeAtS } from '../sim/race.js';
import { resolveCarContacts, applySlipstream } from '../sim/traffic.js';
import { AIDriver, AI_LEVELS } from '../sim/ai.js';
import { AcademySession, ACADEMY_DRILLS } from '../sim/academy.js';
import { licenceFor, awardLesson, awardSession, personalLivery } from './career.js';
import { MS_TO_KMH, MS_TO_MPH, clamp } from '../sim/units.js';
import { Renderer } from './renderer.js';
import { CameraRig } from './camera.js';
import { Input, ACTIONS, keyLabel, DEFAULT_KEYS } from './input.js';
import { GameAudio } from './audio.js';
import { SaveStore, encodeGhost, decodeGhost } from './save.js';
import { Telemetry, PerfStats } from './telemetry.js';
import { AppFeatures } from './app.js';
import { HubShell } from './hub.js';
import { LobbyMotion } from './lobby.js';
import { AppNavigation } from './navigation.js';
import { downloadBlob } from './platform.js';
import { OpenlineCampaign } from './openline.js';

const SIM_DT = 1 / 120, MAX_STEPS = 8;
const $ = (id) => document.getElementById(id);
const isTouch = (navigator.maxTouchPoints || 0) > 0;

export function fmtTime(t) {
  if (!Number.isFinite(t) || t <= 0) return '–:––.–––';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}
const fmtDelta = (d) => `${d < 0 ? '▼ −' : '▲ +'}${Math.abs(d).toFixed(3)}`;
const ARC_SPEED = 2 * Math.PI * 88 * 0.75, CIRC_SPEED = 2 * Math.PI * 88, ARC_RPM = 2 * Math.PI * 73 * 0.75, CIRC_RPM = 2 * Math.PI * 73;
const GAUGE_MAX_KMH = 340;
const Q_ORDER = ['ultra', 'high', 'medium', 'low'];

// Fictional rival drivers and teams (original names; temporary until a licensed or original roster exists)
const RIVALS = [
  { code: 'KMO', name: 'Kai Moreno', team: 'Helix Racing', livery: { id: 'r_helix', primary: [0.16, 0.06, 0.34], secondary: [0.1, 0.9, 1.0], accent: [0.62, 0.36, 1.0], stripe: [0.1, 0.9, 1.0] } },
  { code: 'AVA', name: 'Asha Varga', team: 'Solaris GP', livery: { id: 'r_solaris', primary: [0.95, 0.42, 0.06], secondary: [1.0, 0.82, 0.2], accent: [0.1, 0.1, 0.12], stripe: [1.0, 0.85, 0.2] } },
  { code: 'LST', name: 'Leo Strand', team: 'Nordlys', livery: { id: 'r_nordlys', primary: [0.86, 0.9, 0.95], secondary: [0.2, 0.45, 1.0], accent: [0.05, 0.1, 0.3], stripe: [0.9, 0.92, 0.95] } },
  { code: 'MOK', name: 'Mira Okafor', team: 'Verdant Works', livery: { id: 'r_verdant', primary: [0.04, 0.3, 0.16], secondary: [0.3, 1.0, 0.55], accent: [0.9, 0.9, 0.9], stripe: [0.3, 1.0, 0.55] } },
  { code: 'TRE', name: 'Tomás Reyes', team: 'Crimson Arc', livery: { id: 'r_crimson', primary: [0.7, 0.03, 0.06], secondary: [1.0, 1.0, 1.0], accent: [1.0, 0.2, 0.25], stripe: [1.0, 0.95, 0.95] } },
  { code: 'YHA', name: 'Yuki Hale', team: 'Aurora Dynamics', livery: { id: 'r_aurora', primary: [0.95, 0.35, 0.65], secondary: [0.9, 0.95, 1.0], accent: [0.35, 0.1, 0.4], stripe: [1.0, 0.4, 0.75] } },
  { code: 'NHA', name: 'Noor Haddad', team: 'Obsidian', livery: { id: 'r_obsidian', primary: [0.03, 0.03, 0.035], secondary: [1.0, 0.75, 0.25], accent: [1.0, 0.75, 0.25], stripe: [1.0, 0.75, 0.25] } },
];
const PACE_SPREAD = [0.010, -0.004, 0.006, -0.009, 0.003, -0.006, 0.008]; // per-rival pace offsets (tuned)
const PLAYER_GRID = 5; // 0-based: the player starts sixth of eight

function snapshot(veh, out) {
  out.x = veh.x; out.z = veh.z; out.yaw = veh.yaw; out.h = veh.h; out.pitch = veh.pitch; out.roll = veh.roll; out.steer = veh.steerAngle;
  out.spin = out.spin || [0, 0, 0, 0]; out.road = out.road || [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) { out.spin[i] = veh.wheels[i].spin; out.road[i] = veh.wheels[i].road; }
  return out;
}
function lerpPose(a, b, t, out) {
  out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t;
  let dy = b.yaw - a.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  out.yaw = a.yaw + dy * t; out.h = a.h + (b.h - a.h) * t; out.pitch = a.pitch + (b.pitch - a.pitch) * t; out.roll = a.roll + (b.roll - a.roll) * t;
  out.steer = a.steer + (b.steer - a.steer) * t;
  out.spin = out.spin || [0, 0, 0, 0]; out.road = out.road || [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) { out.spin[i] = a.spin[i] + (b.spin[i] - a.spin[i]) * t; out.road[i] = b.road[i]; }
  return out;
}
const brakeGlow = (veh) => veh.wheels.map((w) => clamp((w.brakeTemp - 420) / 560, 0, 1));
const HOLD = { steerAngle: 0, throttle: 0, brake: 1, autoGears: true, gearRequest: 'D', abs: true, tcs: true, esc: false };
const css = (c) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;

const PRESET_TITLES = { rookie: 'Rookie', racer: 'Racer', pro: 'Pro' };
const ASSIST_FIELDS = [
  ['autoThrottle', 'Auto throttle', 'Throttle follows the reference speed. You only steer.'],
  ['brakeAssist', 'Brake assist', 'Adds brake when you are faster than the reference speed ahead.'],
  ['steerAssist', 'Steering assist', 'Smooths steering and limits it by speed, grip and tire slip. Helps recover slides.'],
  ['guidance', 'Line guidance', 'Blends a little steering toward the racing line.'],
  ['abs', 'ABS', 'Releases brake pressure on a locking wheel.'],
  ['tcs', 'Traction control', 'Cuts engine torque when the rear tires spin.'],
  ['esc', 'Stability control', 'Brakes single wheels to stop a spin.'],
  ['autoGears', 'Automatic gears', 'Shifts for you. Off means paddles: Q/E, LB/RB or the − + buttons.'],
  ['showLine', 'Show racing line', 'Red where the reference brakes, green where it accelerates.'],
];

class Game {
  constructor() {
    this.save = new SaveStore();
    this.S = this.save.data.settings;
    this.world = WORLDS.lumen_harbor;
    this.track = new Track(TRACK_HARBOR, this.world, CAR_VX1);
    this.veh = new Vehicle(CAR_VX1, this.world, this.track);
    this.veh.reset(this.track.def.lineS + 18, 0);
    this.school = null; this.pendingLessonResult = null;
    this.driver = new DriverInput();
    this.input = new Input($('touch'));
    this.input.bindings = { ...DEFAULT_KEYS, ...this.S.keys };
    this.audio = new GameAudio();
    this.cam = new CameraRig();
    this.telemetry = new Telemetry($('telemetry'));
    this.perf = new PerfStats();
    this.prev = snapshot(this.veh, {}); this.curr = snapshot(this.veh, {}); this.pose = snapshot(this.veh, {});
    this.mode = 'menu'; this.screen = 'title'; this.paused = false; this.race = null; this.acc = 0; this.last = performance.now();
    this.countdown = 0; this.countTotal = 0; this.pbGhost = null; this.pbTime = null; this.pbSectors = null; this.ghostPose = {};
    this.scaleFactor = isTouch ? 0.85 : 1; this.lastScaleCheck = 0; this.hudT = 0; this.telT = 0; this.coachShown = new Set();
    this.simMs = 0; this.steps = 0; this.renderMs = 0; this.time = 0; this.lastCurbBuzz = 0; this.sessionBestSectors = [Infinity, Infinity, Infinity];
    this.raw0 = { steer: 0, throttle: 0, brake: 0 };
    this.rivals = []; this.field = null; this.finishT = null; this.autopilot = null; this.towerRows = new Map();
    this.fxHits = new Map(); this.gearEvents = new Set(); this.autoQ = null; this.slowChecks = 0; this.ghostActive = false; this.lastPos = 0;
    try {
      this.renderer = new Renderer($('gl'), this.track, CAR_VX1);
      this.renderer.carModel(this.livery());
    } catch (e) {
      this.renderer = null;
      $('title-error').textContent = `${e.message} The physics tests still run with "node tests/validate.mjs".`;
      $('title-error').hidden = false; $('btn-start').disabled = true;
    }
    this.buildGaugeTicks();
    this.buildMinimap();
    this.applySettings();
    this.app = new AppFeatures(this); this.hub = new HubShell(this);
    this.campaign = new OpenlineCampaign(this);
    this.navigation = new AppNavigation(this); this.navigation.wire();
    this.nativeSaveResult = (success,message) => {
      const note=message || (success ? 'File saved.' : 'File could not be saved.');
      this.toast(note);if(this.screen==='team')$('team-save-note').textContent=note;
    };
    document.body.classList.toggle('native-android', !!window.NativeBridge);
    this.lobby = new LobbyMotion(this);
    this.wireUi();
    this.app.wire(); this.hub.wire(); this.campaign.wire();
    this.show(window.NativeBridge ? 'hub' : 'title');
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'race' && !this.paused) this.pause(); });
    window.addEventListener('resize', () => this.layoutCheck());
    requestAnimationFrame((t) => this.frame(t));
    window.__vv = this; // exposed for automated smoke tests and debugging
  }

  livery() { if (this.save.data.livery === 'custom') return personalLivery(this.save.data.customLivery); return CAR_VX1.liveries.find((l) => l.id === this.save.data.livery) || CAR_VX1.liveries[0]; }
  assists() { return this.school ? { ...ASSIST_PRESETS.racer, autoReverse: false } : this.save.data.assists; }
  isRace() { return !!(this.race && this.race.mode === 'race'); }

  // ---------- loop ----------
  frame(now) {
    const dtReal = Math.min(0.25, Math.max(0, (now - this.last) / 1000)); this.last = now; this.time += dtReal;
    const raw = this.input.poll(dtReal);
    this.handleGlobalInput(raw);
    if (this.mode === 'race' && !this.paused) this.simulate(dtReal, raw);
    else { this.simMs = 0; this.steps = 0; }
    if (this.pendingLessonResult) this.completeLesson();
    this.campaign.flush();
    const t0 = performance.now();
    this.draw(dtReal);
    this.renderMs = performance.now() - t0;
    if (this.mode === 'race' && !this.paused) {
      this.perf.push(dtReal * 1000, this.simMs, this.renderMs, this.steps);
      this.hudT += dtReal; if (this.hudT > 0.05) { this.hudT = 0; this.updateHud(); }
      this.telT += dtReal; if (this.S.showTelemetry && this.telT > 0.066) { this.telT = 0; this.telemetry.draw(this.veh, this.driver.out, this.rawLast || this.raw0, this.S.units, { simMs: this.simMs, steps: this.steps }); }
      this.adaptScale();
      if (this.finishT !== null && this.time - this.finishT > 4.5) { this.finishT = null; this.finishSession(); }
    }
    if (this.S.showPerf && (this.time - (this._perfT || 0)) > 0.5) { this._perfT = this.time; this.updatePerf(); }
    this.audio.update({ rpm: this.veh.rpm, throttle: this.driver.out.throttle * this.veh.tcsFactor, speed: Math.abs(this.veh.forwardSpeed), slip: Math.max(...this.veh.wheels.map((w) => w.slipNorm)), curb: this.veh.wheels.some((w) => w.surface === 'curb') && Math.abs(this.veh.forwardSpeed) > 2 ? 1 : 0, gear: this.veh.gear, aLong: this.veh.aLong, running: this.mode === 'race' && !this.paused });
    this.rivalAudio();
    requestAnimationFrame((t) => this.frame(t));
  }

  simulate(dtReal, raw) {
    this.rawLast = raw;
    this.acc += dtReal;
    let steps = 0; const t0 = performance.now();
    while (this.acc >= SIM_DT && steps < MAX_STEPS) {
      this.prev = snapshot(this.veh, this.prev);
      for (const r of this.rivals) r.prev = snapshot(r.veh, r.prev);
      this.stepOnce(raw);
      raw.shiftUp = false; raw.shiftDown = false;
      this.acc -= SIM_DT; steps++;
      this.curr = snapshot(this.veh, this.curr);
      for (const r of this.rivals) r.curr = snapshot(r.veh, r.curr);
    }
    if (steps === MAX_STEPS && this.acc >= SIM_DT) { this.perf.dropped += Math.floor(this.acc / SIM_DT); this.acc = 0; }
    this.simMs = performance.now() - t0; this.steps = steps;
  }

  stepOnce(raw) {
    const veh = this.veh, race = this.race, a = this.assists();
    if (this.countdown > 0) { // everyone holds on the brakes until the start
      this.countdown -= SIM_DT;
      veh.step(SIM_DT, HOLD);
      for (const r of this.rivals) r.veh.step(SIM_DT, HOLD);
      if (this.field) this.field.update(SIM_DT, veh.time);
      return;
    }
    for (const r of this.rivals) {
      const g0 = r.veh.gear;
      r.veh.step(SIM_DT, r.ai.process(SIM_DT, r.veh, this.track, this.field.entries));
      if (r.veh.gear < g0) this.gearEvents.add(r.id);
      if (r.ai.needsReset) { r.ai.needsReset = false; const p = this.track.project(r.veh.x, r.veh.z, -1, {}); r.veh.reset(p.s - 2, 0); r.prev = snapshot(r.veh, r.prev); }
    }
    const ctl = this.autopilot ? this.autopilot.process(SIM_DT, veh, this.track, this.field ? this.field.entries : []) : this.driver.process(SIM_DT, raw, veh, this.track, a, { speedRef: this.S.steerSpeedRef, linearity: 1 });
    const gearBefore = veh.gear;
    veh.step(SIM_DT, ctl);
    if (this.rivals.length) { const all = [veh, ...this.rivals.map((r) => r.veh)]; resolveCarContacts(all); applySlipstream(all); }
    for (const r of this.rivals) this.collectHits(r.id, r.veh);
    if (this.field) this.field.update(SIM_DT, veh.time);
    race.update(SIM_DT, veh.time, veh, this.campaign.active && this.campaign.supported ? 'story-supported' : assistClass(a));
    this.campaign.observe(SIM_DT);
    if (this.school) {
      this.school.update(SIM_DT, veh, raw, this.track);
      for (const ev of this.school.events.splice(0)) {
        if (ev.type === 'complete') {
          const award = awardLesson(this.save.data.career, ev.drillId);
          this.save.data.career = award.career; this.save.save();
          this.pendingLessonResult = { ...ev, earned: award.earned };
        }
      }
    }
    this.telemetry.sample(veh, ctl, raw, veh.time);
    if (veh.gear !== gearBefore) { this.audio.click(); this.buzz(6); if (veh.gear < gearBefore) { this.gearEvents.add('player'); this.audio.pop(); } }
    const hard = this.collectHits('player', veh);
    if (hard) { this.audio.impact(hard); this.buzz(Math.min(70, 10 + hard * 3)); this.lastImpact = hard; }
    if (veh.wheels.some((w) => w.surface === 'curb') && Math.abs(veh.forwardSpeed) > 4 && this.time - this.lastCurbBuzz > 0.12) { this.lastCurbBuzz = this.time; this.buzz(8); }
    while (race.events.length) this.onRaceEvent(race.events.shift());
    if (this.field && this.finishT === null && !this.autopilot && this.field.entries[0].finished) this.onPlayerFinished();
  }

  // Barrier and car contacts for sparks and sound; returns the hardest new impact speed for this car (m/s).
  collectHits(id, veh) {
    let list = this.fxHits.get(id); if (!list) { list = []; this.fxHits.set(id, list); }
    let hard = 0;
    if (veh.contacts.length && veh.collidingSteps === 1) for (const c of veh.contacts) { if (list.length < 6) list.push(c); hard = Math.max(hard, c.speed); }
    for (const h of veh.carHits) if (h.impulse > 0 && h.speed > 1.2) { if (list.length < 6) list.push(h); hard = Math.max(hard, h.speed); }
    return hard;
  }

  buzz(ms) { if (!this.S.haptics || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch (e) { /* not allowed in this frame */ } }

  startLightsLit() {
    if (this.mode !== 'race' || !this.isRace() || this.countdown <= 0) return 0;
    const el = this.countTotal - this.countdown;
    return el < 5 ? Math.floor(el) + 1 : 5;
  }

  draw(dt) {
    if (!this.renderer) return;
    // Opaque app pages need no 3D frames. Resume rendering for the showroom and racing.
    if (this.mode === 'menu' && ['lab','explorer','records','team','academy','event','onboard','story','universe'].includes(this.screen)) return;
    if (this.mode === 'menu' && this.screen === 'hub') {
      this.lobbyFrameAge=(this.lobbyFrameAge||0)+dt;
      if(this.lobbyFrameAge<1/30)return;
      dt=this.lobbyFrameAge;this.lobbyFrameAge=0;
    }
    const R = this.renderer;
    R.resize(Math.min(window.devicePixelRatio || 1, 2) * this.renderScale());
    const racing = this.mode === 'race', alpha = this.paused ? 1 : Math.min(1, this.acc / SIM_DT);
    const pose = racing ? lerpPose(this.prev, this.curr, alpha, this.pose) : snapshot(this.veh, this.pose);
    let camMode = racing ? this.S.camera : (this.screen === 'title' || this.screen === 'onboard' ? 'title' : 'orbit');
    if(this.screen==='hub')camMode='lobby';
    if (racing && this.isRace() && this.countdown > 1.3) camMode = 'grid';
    if (racing && this.autopilot) camMode = 'finish';
    if (this.screen === 'photo') camMode = 'photo';
    const info = { speed: this.veh.forwardSpeed, aLat: this.veh.aLat, aLong: this.veh.aLong, curb: this.veh.wheels.some((w) => w.surface === 'curb'), impact: this.lastImpact || 0 };
    this.lastImpact = 0;
    const motion = !this.S.reducedMotion && this.S.motion;
    const cam = this.cam.update(dt, camMode, pose, info, { fov: this.S.fov, shake: this.S.shake, reducedMotion: !motion, aspect: R.canvas.clientWidth / Math.max(1, R.canvas.clientHeight), photo: this.photo, lobbyAngle: this.lobbyAngle || 0 });
    const playerModel = R.carModel(this.livery());
    const cars = [{ id: 'player', pose, model: playerModel, brakes: brakeGlow(this.veh) }];
    for (const r of this.rivals) { r.pose = lerpPose(r.prev, r.curr, alpha, r.pose || {}); cars.push({ id: r.id, pose: r.pose, model: R.carModel(r.livery), brakes: brakeGlow(r.veh) }); }
    let ghost = null;
    if (racing && !this.isRace() && this.pbGhost && this.race && this.race.lapStart !== null) {
      ghost = ghostPoseAt(this.pbGhost, this.race.currentLapTime(this.veh.time + (this.paused ? 0 : this.acc)), this.ghostPose);
      if (ghost) cars.push({ id: 'ghost', pose: ghost, model: playerModel, ghost: true });
    }
    this.ghostActive = !!ghost;
    const u = Math.abs(this.veh.forwardSpeed), simT = this.veh.time;
    // effects from simulation state (trails, sparks, smoke, exhaust); they age on simulation time
    const fxCars = [this.fxCar('player', pose, this.veh, this.autopilot ? this.autopilot.input.out.throttle : this.driver.out.throttle)];
    for (const r of this.rivals) fxCars.push(this.fxCar(r.id, r.pose, r.veh, r.ai.input.out.throttle));
    R.updateFx(racing && !this.paused ? dt : 0, fxCars, simT, { active: racing, player: { pose, speed: u }, streaks: motion });
    this.fxHits.forEach((l) => { l.length = 0; }); this.gearEvents.clear();
    const trailCols = (id) => { const r = this.rivals.find((x) => x.id === id); return r ? R.carModel(r.livery).trail : playerModel.trail; };
    R.render({ cam, cars, lobby: this.screen==='hub', beacon: this.save.data.openline.completed, focus: pose, showLine: racing && this.assists().showLine && !this.autopilot, time: this.time, fxTime: simT,
      speed: racing ? clamp((u - 40) / 50, 0, 1) : 0, showroom: !racing, motion, startLights: this.startLightsLit(),
      fxOpts: { streakK: racing && motion ? clamp((u - 30) / 40, 0, 1) : 0, speed: u, fwd: [Math.sin(pose.yaw), Math.cos(pose.yaw)], trailCols } });
    if(this.capturePhoto){this.capturePhoto=false;R.canvas.toBlob(blob=>{if(!blob){this.toast('Photo could not be saved.');return;}const target=downloadBlob(blob,'VelocityVerse-'+Date.now()+'.png');this.toast(target==='native'?'Saving photo…':'Photo saved.');},'image/png');}
  }
  fxCar(id, pose, veh, throttle) {
    return { id, pose, speed: Math.abs(veh.forwardSpeed), vx: veh.vx, vz: veh.vz, throttle, rpm: veh.rpm, slip: veh.wheels.map((w) => w.slipNorm),
      wheels: veh.wheels.map((w) => [w.wx, w.wz]), bottoming: veh.bottoming, hits: this.fxHits.get(id) || [], downshift: this.gearEvents.has(id) };
  }
  rivalAudio() {
    if (!this.rivals.length || this.mode !== 'race' || this.paused) { this.audio.rival(null); return; }
    let best = null, bd = 1e9;
    for (const r of this.rivals) { const d = Math.hypot(r.veh.x - this.veh.x, r.veh.z - this.veh.z); if (d < bd) { bd = d; best = r; } }
    if (!best || bd > 60) { this.audio.rival(null); return; }
    const dx = best.veh.x - this.veh.x, dz = best.veh.z - this.veh.z, closing = -((best.veh.vx - this.veh.vx) * dx + (best.veh.vz - this.veh.vz) * dz) / Math.max(bd, 0.1);
    this.audio.rival({ rpm: best.veh.rpm, dist: bd, closing });
  }

  qualityName() {
    const g = this.S.graphics || 'auto';
    if (g !== 'auto') return g;
    return this.autoQ || (isTouch ? 'high' : 'ultra');
  }
  renderScale() {
    const r = this.S.renderScale;
    return r === 'auto' ? this.scaleFactor : Number(r);
  }
  adaptScale() {
    if (this.time - this.lastScaleCheck < 2) return;
    this.lastScaleCheck = this.time;
    const s = this.perf.summary();
    if (this.perf.frames.length < 60) return;
    const slow = s.p95 > 20;
    this.slowChecks = slow ? this.slowChecks + 1 : 0;
    // Auto graphics: after two slow checks in a row, drop one effects level (floor: Medium, which keeps bloom).
    if (this.S.graphics === 'auto' && this.slowChecks >= 2) {
      const i = Q_ORDER.indexOf(this.qualityName());
      if (i >= 0 && i < Q_ORDER.indexOf('medium')) { this.autoQ = Q_ORDER[i + 1]; this.renderer.setQuality(this.autoQ); this.perf.resetWindow(); this.slowChecks = 0; return; }
    }
    if (this.S.renderScale !== 'auto') return;
    if (slow && this.scaleFactor > 0.5) this.scaleFactor = Math.max(0.5, this.scaleFactor - 0.1);
    else if (s.avg < 13 && this.scaleFactor < 1) this.scaleFactor = Math.min(1, this.scaleFactor + 0.05);
  }

  // ---------- input outside the simulation ----------
  handleGlobalInput(raw) {
    if (raw.perf) { this.S.showPerf = !this.S.showPerf; this.applySettings(); this.save.save(); }
    if (this.mode === 'race') {
      if (raw.pause && !this.paused) { this.pause(); return; }
      if (this.paused) { if (raw.back) { if(this.screen==='pause')this.resume();else document.querySelector('.screen.active [data-back]')?.click(); return; } this.menuNav(raw); return; }
      if (raw.telemetry) { this.S.showTelemetry = !this.S.showTelemetry; this.applySettings(); this.save.save(); }
      if (raw.camera) { this.S.camera = this.S.camera === 'chase' ? 'cockpit' : 'chase'; this.cam.snap(); this.save.save(); }
      if (raw.recover && this.countdown <= 0 && !this.autopilot) this.recover();
      return;
    }
    if (raw.back) { const back = document.querySelector('.screen.active [data-back]'); if (back) back.click(); }
    this.menuNav(raw);
  }
  menuNav(raw) {
    if (!raw.navNext && !raw.navPrev && !raw.confirm) return;
    const scr = document.querySelector('.screen.active'); if (!scr) return;
    const items = [...scr.querySelectorAll('button:not([disabled]), input, select')].filter((e) => e.offsetParent !== null);
    if (!items.length) return;
    const focused=document.activeElement;
    if(focused?.tagName==='INPUT' && focused.type==='range' && raw.source==='keyboard' && (raw.navNext||raw.navPrev))return;
    const i = items.indexOf(focused);
    if (raw.confirm && i >= 0) { items[i].click(); return; }
    if (raw.navNext) items[(i + 1 + items.length) % items.length].focus();
    if (raw.navPrev) items[(i - 1 + items.length) % items.length].focus();
  }

  // ---------- screens ----------
  show(id) {
    const previous = this.screen;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    this.screen = id;
    this.navigation.onScreen(id, previous);
    this.lobby?.sync();
    window.NativeBridge?.setKeepScreenOn?.(this.mode === 'race' && !this.paused);
    document.body.classList.toggle('app-art', this.mode === 'menu' && ['lab','explorer','records','team','academy','event','onboard','story','universe'].includes(id));
    const inRace = this.mode === 'race' && !this.paused;
    $('hud').hidden = this.mode !== 'race';
    $('touch').hidden = !(this.mode === 'race' && isTouch && this.S.layout !== 'keyboard') || this.paused;
    $('telemetry').hidden = !(this.mode === 'race' && this.S.showTelemetry) || this.paused;
    document.body.classList.toggle('touch-ui', !$('touch').hidden || (isTouch && this.mode === 'race'));
    document.body.classList.toggle('tel-on', !$('telemetry').hidden);
    document.body.classList.toggle('race-mode', this.mode === 'race' && this.isRace());
    this.input.inRace = inRace;
    if (id === 'garage') this.renderGarage();
    if (id === 'event') this.renderEvent();
    if (id === 'prep') this.renderPrep();
    if (id === 'settings') this.renderSettings();
    if (id === 'photo') $('hud').hidden=true;
    if (id === 'academy') this.renderAcademy();
    if (id === 'customize') this.renderCustomize();
    this.app.render(id); this.hub.render(id);
    this.campaign.render(id);
    $('academy-hud').hidden = !(this.school && this.mode === 'race' && !this.paused);
    if (this.school && this.mode === 'race' && !this.paused) $('hud-coach').classList.remove('on');
    const first = document.querySelector('.screen.active .btn.primary, .screen.active button');
    if (first && !isTouch) setTimeout(() => {
      if(this.screen===id && !document.activeElement?.closest('.screen.active'))first.focus({preventScroll:true});
    }, 0);
    this.layoutCheck();
  }
  toast(msg, ms = 2600) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }
  banner(text, cls = '', ms = 1600) {
    const el = $('hud-center'); el.textContent = text; el.className = 'hud-center on ' + cls;
    this._bannerUntil = this.time + ms / 1000;
  }
  layoutCheck() {
    const portrait = window.innerHeight > window.innerWidth;
    $('rotate').hidden = !(isTouch && portrait && this.mode === 'race' && !this.paused);
  }

  wireUi() {
    document.addEventListener('pointerdown',e=>{
      const b=e.target.closest('button');if(!b||b.disabled||!b.closest('.screen.active'))return;
      if(this.S.haptics)window.NativeBridge?.haptic?.();
      if(this.S.reducedMotion||this.S.motion===false||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      if(!b.matches('.world-gate,.app-nav button,.lab-setup,.icon-button'))return;
      const r=b.getBoundingClientRect(),wave=document.createElement('span');wave.className='tap-ripple';wave.setAttribute('aria-hidden','true');wave.style.left=(e.clientX-r.left)+'px';wave.style.top=(e.clientY-r.top)+'px';b.append(wave);setTimeout(()=>wave.remove(),500);
    });
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]'); if (nav) { this.audio.unlock(); this.navTo(nav.dataset.nav); }
    });
    $('btn-start').addEventListener('click', () => { this.audio.unlock(); this.show('hub'); });
    $('btn-fullscreen').addEventListener('click', () => { const el = document.documentElement; try { (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).catch(() => this.toast('Fullscreen is not allowed here.')); } catch (e) { this.toast('Fullscreen is not allowed here.'); } });
    document.querySelectorAll('#scr-onboard [data-preset]').forEach((b) => b.addEventListener('click', () => {
      this.setPreset(b.dataset.preset);
      this.save.data.firstRunDone = true; this.save.save();
      this.firstDrive = true;
      this.startRace('practice');
    }));
    for(const id of ['btn-photo','btn-garage-photo'])$(id).addEventListener('click',()=>{
      this.photoReturn=this.screen;this.photo={angle:((this.veh.yaw+2.4)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),distance:7,height:2,fov:45};
      for(const k of ['angle','distance','height','fov']){const el=$('photo-'+k);el.value=k==='angle'?this.photo[k]*180/Math.PI:this.photo[k];el.oninput=()=>{this.photo[k]=Number(el.value)*(k==='angle'?Math.PI/180:1);};}
      this.show('photo');
    });
    $('btn-photo-save').addEventListener('click',()=>{this.capturePhoto=true;});
    $('btn-photo-back').addEventListener('click',()=>{this.cam.snap();this.show(this.photoReturn||'garage');});
    $('btn-onboard-school').addEventListener('click',()=>{this.save.data.firstRunDone=true;this.save.save();this.startSchool('launch');});
    $('btn-academy').addEventListener('click', () => { this.mode='menu';this.school=null;this.show('academy'); });
    $('btn-customize').addEventListener('click', () => this.show('customize'));
    $('btn-school-retry').addEventListener('click', () => this.startSchool(this.school?.status.drillId || 'launch'));
    $('btn-lesson-retry').addEventListener('click', () => this.startSchool(this.school?.status.drillId || 'launch'));
    $('btn-lesson-next').addEventListener('click', () => { const i=ACADEMY_DRILLS.findIndex(d=>d.id===this.school?.status.drillId); if(i<2)this.startSchool(ACADEMY_DRILLS[i+1].id);else {this.mode='menu';this.school=null;this.show('academy');} });
    $('btn-lesson-school').addEventListener('click', () => {this.mode='menu';this.school=null;this.show('academy');});
    $('btn-garage-drive').addEventListener('click', () => this.navTo('event'));
    document.querySelectorAll('#scr-event [data-mode]').forEach((b) => b.addEventListener('click', () => { this.pendingMode = b.dataset.mode; this.show('prep'); }));
    $('btn-prep-start').addEventListener('click', () => this.startRace(this.pendingMode || 'timetrial'));
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => this.startRace(this.race.mode));
    $('btn-pause-settings').addEventListener('click', () => { this.settingsReturn = 'pause'; this.show('settings'); });
    $('btn-end').addEventListener('click', () => this.finishSession());
    $('btn-retry').addEventListener('click', () => this.startRace(this.lastMode || 'timetrial'));
    $('btn-results-garage').addEventListener('click', () => { this.mode = 'menu'; this.clearRivals(); this.show('garage'); });
    $('btn-settings-back').addEventListener('click', () => { const r = this.settingsReturn || 'garage'; this.settingsReturn = null; this.show(r); });
    $('btn-copy-tel').addEventListener('click', () => this.copyTelemetry());
    $('dialog-cancel').addEventListener('click', () => { $('dialog').hidden = true; });
    $('dialog-ok').addEventListener('click', () => { $('dialog').hidden = true; this.save.reset(); this.S = this.save.data.settings; this.input.bindings = { ...DEFAULT_KEYS }; this.applySettings(); this.renderSettings(); this.toast('Saved data cleared.'); });
  }
  navTo(where) {
    if (this.mode === 'race' && ['hub','story','universe','garage','event','team','academy','lab','explorer','records'].includes(where)) {
      this.campaign.leaveDrive(); this.input.reset(); this.mode='menu'; this.paused=false; this.school=null;
      this.clearRivals(); this.audio.mute(true); this.acc=0; this.cam.snap();
    }
    if (where === 'settings') { this.settingsReturn = this.screen; this.show('settings'); return; }
    if (where === 'event' && !this.save.data.firstRunDone) { this.show('onboard'); return; }
    this.show(where);
  }

  setPreset(id) {
    this.save.data.preset = id;
    this.save.data.assists = { ...ASSIST_PRESETS[id] };
    this.save.save();
  }

  renderGarage() {
    const c = CAR_VX1;
    const rows = [
      ['Power (peak, at the wheels)', '≈ 398 kW', 'F'], ['Mass with driver', `${c.mass} kg`, 'F'], ['Weight distribution', `${Math.round(c.frontWeight * 100)} / ${Math.round((1 - c.frontWeight) * 100)}`, 'F'],
      ['Top speed (sim test)', '305 km/h', 'M'], ['0–100 km/h (sim test)', '3.2 s', 'M'], ['Downforce at 200 km/h', `${Math.round(0.5 * 1.225 * c.aero.clA * (200 / 3.6) ** 2)} N`, 'E'],
      ['Tire peak friction', `μ ${c.tire.mu}`, 'E'], ['Gearbox', '8-speed sequential, RWD, limited-slip diff', 'T'],
    ];
    $('car-specs').innerHTML = rows.map(([k, v, p]) => `<div><dt>${k}</dt><dd>${v} <abbr class="prov" title="${PROVENANCE_LABEL[p] || 'measured in sim'}">${PROVENANCE_LABEL[p] || 'measured in sim'}</abbr></dd></div>`).join('');
    const career=this.save.data.career;
    $('driver-licence').textContent=licenceFor(career.xp).name;
    $('driver-xp').textContent=`${career.xp} XP · ${Object.keys(career.school).length}/3 academy medals · ${career.validLaps} clean laps`;
    const box = $('liveries'); box.innerHTML = '';
    [...c.liveries, personalLivery(this.save.data.customLivery)].forEach((l) => {
      const b = document.createElement('button'); b.className = 'swatch'; b.type = 'button';
      b.setAttribute('aria-pressed', String(l.id === this.save.data.livery)); b.setAttribute('aria-label', `Livery: ${l.name}`);
      b.innerHTML = `<span class="sw" style="background:linear-gradient(135deg, ${css(l.primary)} 0 55%, ${css(l.secondary)} 55% 80%, ${css(l.accent)} 80%)"></span><span>${l.name}</span>`;
      b.addEventListener('click', () => { this.save.data.livery = l.id; this.save.save(); if (this.renderer) this.renderer.carModel(l); this.renderGarage(); });
      box.appendChild(b);
    });
  }

  pbFor(cls) { return this.save.data.pbs[`${this.track.def.id}|${cls}`]; }
  renderEvent() {
    const cls = assistClass(this.assists());
    const pb = this.pbFor(cls);
    $('ev-tt-meta').textContent = pb ? `Your best (${cls}): ${fmtTime(pb.time)} · ghost ready` : `No ${cls} lap yet. Your first valid lap becomes your ghost.`;
    $('ev-practice-meta').textContent = `Reference lap from the speed profile: ${fmtTime(this.track.referenceLapTime)}`;
    $('ev-race-meta').textContent = `${this.S.raceLaps || 3} laps · 7 AI rivals · you start P${PLAYER_GRID + 1}`;
  }

  renderPrep() {
    const a = this.assists(), race = this.pendingMode === 'race';
    $('prep-event').textContent = this.pendingMode === 'practice' ? 'Practice · Harbor Loop' : race ? `Race · ${this.S.raceLaps || 3} laps vs AI` : 'Time trial · out-lap + 3 timed laps';
    $('race-opts').hidden = !race;
    const segBuild = (el, opts, cur, set) => { el.innerHTML = ''; opts.forEach(([v, l]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'segbtn'; b.textContent = l; b.setAttribute('aria-pressed', String(cur === v)); b.addEventListener('click', () => { set(v); this.save.save(); this.renderPrep(); }); el.appendChild(b); }); };
    if (race) {
      segBuild($('ai-seg'), [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], this.S.aiLevel || 'medium', (v) => { this.S.aiLevel = v; });
      segBuild($('laps-seg'), [[3, '3 laps'], [5, '5 laps']], Number(this.S.raceLaps || 3), (v) => { this.S.raceLaps = v; });
    }
    segBuild($('preset-seg'), ['rookie', 'racer', 'pro'].map((id) => [id, PRESET_TITLES[id]]), this.save.data.preset, (id) => this.setPreset(id));
    const list = $('assist-toggles'); list.innerHTML = '';
    ASSIST_FIELDS.forEach(([key, label, help]) => {
      const row = document.createElement('div'); row.className = 'toggle';
      const id = 'as-' + key;
      if (key === 'guidance') {
        row.innerHTML = `<label for="${id}"><span>${label}</span><small>${help}</small></label><select id="${id}"><option value="0">Off</option><option value="0.35">Light</option><option value="0.7">Strong</option></select>`;
        const sel = row.querySelector('select'); sel.value = String(a.guidance === 0 ? 0 : a.guidance >= 0.6 ? 0.7 : 0.35);
        sel.addEventListener('change', () => { a.guidance = Number(sel.value); this.save.data.preset = 'custom'; this.save.save(); this.renderPrep(); });
      } else {
        row.innerHTML = `<label for="${id}"><span>${label}</span><small>${help}</small></label><input type="checkbox" role="switch" id="${id}" ${a[key] ? 'checked' : ''}>`;
        const inp = row.querySelector('input');
        inp.addEventListener('change', () => { a[key] = inp.checked; this.save.data.preset = 'custom'; this.save.save(); this.renderPrep(); });
      }
      list.appendChild(row);
    });
    const cls = assistClass(a);
    $('assist-class-note').textContent = `Assist class: ${cls === 'assisted' ? 'Assisted' : 'Standard'}. Personal bests and ghosts are kept separately for each class.`;
    segBuild($('cam-seg'), [['chase', 'Chase'], ['cockpit', 'Cockpit']], this.S.camera, (v) => { this.S.camera = v; });
    const layouts = isTouch ? [['buttons', 'Buttons'], ['slider', 'Slider'], ['tilt', 'Tilt']] : [['keyboard', 'Keyboard / gamepad']];
    if (!isTouch && this.S.layout !== 'keyboard') this.S.layout = 'keyboard';
    segBuild($('layout-seg'), layouts, this.S.layout, (v) => { this.S.layout = v; });
    const keys = this.input.bindings;
    $('controls-note').textContent = isTouch
      ? (this.S.layout === 'tilt' ? 'Tilt needs motion sensors. If the car does not respond, switch to Buttons or Slider.' : 'Steer on the left, pedals on the right. RESET puts the car back on track and invalidates the lap.')
      : `Steer ${keyLabel(keys.left)}/${keyLabel(keys.right)}, throttle ${keyLabel(keys.throttle)}, brake ${keyLabel(keys.brake)}, gears ${keyLabel(keys.shiftDown)}/${keyLabel(keys.shiftUp)}. C camera, T telemetry, R reset, Esc pause, F performance.${this.input.padConnected ? ' Gamepad detected.' : ''}`;
    if(a.autoGears)$('controls-note').textContent+=' Hold Brake at rest to reverse. '+(a.autoThrottle?'Release Brake to return to Drive once stopped.':'Use Gas at standstill to return to Drive.');
  }

  renderSettings() {
    const S = this.S, box = $('settings-body');
    const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="segbtn" data-set="${key}" data-val="${v}" aria-pressed="${String(S[key]) === String(v)}">${l}</button>`).join('')}</div>`;
    const range = (key, label, min, max, step, fmt) => `<div class="toggle"><label for="st-${key}"><span>${label}</span><small id="st-${key}-v">${fmt(S[key])}</small></label><input type="range" id="st-${key}" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${S[key]}"></div>`;
    const tog = (key, label, help) => `<div class="toggle"><label for="st-${key}"><span>${label}</span>${help ? `<small>${help}</small>` : ''}</label><input type="checkbox" role="switch" id="st-${key}" data-toggle="${key}" ${S[key] ? 'checked' : ''}></div>`;
    const pct = (v) => `${Math.round(v * 100)}%`;
    box.innerHTML = `
      <h3>Controls</h3>
      ${isTouch ? `<div class="field"><span>Touch layout</span>${seg('layout', [['buttons', 'Buttons'], ['slider', 'Slider'], ['tilt', 'Tilt']])}</div>` : ''}
      ${range('steerSpeedRef', 'Steering at speed', 15, 40, 1, (v) => (v < 21 ? 'Calm' : v < 31 ? 'Standard' : 'Sharp') + ` (${v} m/s reference)`)}
      ${tog('haptics', 'Vibration', 'Curbs, impacts and gear changes, where the device allows it')}
      <h3>Camera</h3>
      <div class="field"><span>View</span>${seg('camera', [['chase', 'Chase'], ['cockpit', 'Cockpit']])}</div>
      ${range('fov', 'Field of view', 50, 80, 1, (v) => `${v}°`)}
      ${range('shake', 'Camera shake', 0, 1, 0.05, pct)}
      ${tog('motion', 'Speed effects', 'Field of view, speed streaks and motion blur grow with speed')}
      <h3>Display</h3>
      <div class="field"><span>Graphics</span>${seg('graphics', [['auto', 'Auto'], ['ultra', 'Ultra'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']])}<small class="note">Ultra: track reflections, 4× anti-aliasing, bloom, lens streaks, motion blur, live car reflections. High: no track reflections. Medium: no anti-aliasing, slower reflection updates. Low: no bloom. Auto starts at ${isTouch ? 'High' : 'Ultra'} and steps down to Medium if frames run slow${this.renderer ? ` (now ${this.renderer.qName})` : ''}.</small></div>
      <div class="field"><span>Render scale</span>${seg('renderScale', [['auto', 'Auto'], ['1', '100%'], ['0.75', '75%'], ['0.5', '50%']])}</div>
      <div class="field"><span>Units</span>${seg('units', [['kmh', 'km/h'], ['mph', 'mph']])}</div>
      <div class="field"><span>Text size</span>${seg('textScale', [['1', '100%'], ['1.15', '115%'], ['1.3', '130%']])}</div>
      ${tog('reducedMotion', 'Reduced motion', 'Turns off shake, sway, speed effects and menu animation')}
      ${tog('showTelemetry', 'Telemetry panel', 'Live tire, suspension and aero data while driving (T)')}
      ${tog('showPerf', 'Performance overlay', 'Frame time, simulation cost and resolution (F)')}
      <h3>Audio</h3>
      ${range('volMaster', 'Master volume', 0, 1, 0.05, pct)}
      ${range('volEngine', 'Engines', 0, 1, 0.05, pct)}
      ${range('volFx', 'Tires, wind and impacts', 0, 1, 0.05, pct)}
      <h3>Keyboard</h3>
      <div class="keys">${ACTIONS.map(([act, l]) => `<div class="keyrow"><span>${l}</span><button type="button" class="btn small" data-remap="${act}">${keyLabel(this.input.bindings[act])}</button></div>`).join('')}</div>
      <p class="note">Gamepad: left stick steers, right trigger throttle, left trigger brake, bumpers shift, Start pauses.</p>
      <h3>Data</h3>
      <p class="note">${this.save.available ? 'Settings, personal bests and ghosts are stored in this browser only.' : 'Browser storage is unavailable here, so nothing will be kept after you close the page.'}</p>
      <button type="button" class="btn danger" id="btn-reset-data">Clear saved data</button>`;
    box.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.set; let v = b.dataset.val; if (k === 'textScale') v = Number(v);
      S[k] = v; if (k === 'camera') this.cam.snap(); if (k === 'graphics') this.autoQ = null; this.applySettings(); this.save.save(); this.renderSettings();
    }));
    box.querySelectorAll('[data-range]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.range; S[k] = Number(r.value);
      const v = $(`st-${k}-v`); if (v) v.textContent = { steerSpeedRef: (x) => (x < 21 ? 'Calm' : x < 31 ? 'Standard' : 'Sharp') + ` (${x} m/s reference)`, fov: (x) => `${x}°` }[k]?.(S[k]) ?? pct(S[k]);
      this.applySettings(); this.save.save();
    }));
    box.querySelectorAll('[data-toggle]').forEach((t) => t.addEventListener('change', () => { S[t.dataset.toggle] = t.checked; this.applySettings(); this.save.save(); }));
    box.querySelectorAll('[data-remap]').forEach((b) => b.addEventListener('click', () => {
      b.textContent = 'Press a key…';
      this.input.remapCallback = (code) => {
        if (code) { const action=b.dataset.remap,old=this.input.bindings[action],conflict=ACTIONS.map(([id])=>id).find(id=>id!==action&&this.input.bindings[id]===code);if(conflict)this.input.bindings[conflict]=old;this.input.bindings[action]=code;S.keys={...this.input.bindings};this.save.save(); }
        this.renderSettings();
      };
    }));
    $('btn-reset-data').addEventListener('click', () => { $('dialog').hidden = false; $('dialog-cancel').focus(); });
  }

  applySettings() {
    const S = this.S;
    document.documentElement.style.setProperty('--ts', String(S.textScale || 1));
    document.documentElement.classList.toggle('reduced', !!S.reducedMotion);
    document.body.classList.toggle('reduce-motion', !!S.reducedMotion || S.motion === false);
    this.lobby?.sync();
    this.audio.setVolumes({ master: S.volMaster, engine: S.volEngine, fx: S.volFx });
    $('perf').hidden = !S.showPerf;
    $('telemetry').hidden = !(this.mode === 'race' && S.showTelemetry && !this.paused);
    document.body.classList.toggle('tel-on', !$('telemetry').hidden);
    $('hud-unit').textContent = S.units === 'mph' ? 'MPH' : 'KM/H';
    if (this.renderer) this.renderer.setQuality(this.qualityName());
  }

  // ---------- race flow ----------
  clearRivals() { this.rivals = []; this.field = null; this.autopilot = null; this.finishT = null; if (this.renderer) this.renderer.fxSys.reset(); this.buildTower(); }

  startRace(mode) {
    if (!this.renderer) return;
    this.audio.unlock(); this.audio.mute(false);
    this.school=null; this.pendingLessonResult=null;
    this.sessionId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.lastMode = mode;
    const a = this.assists(), cls = assistClass(a), laps = mode === 'race' ? Number(this.S.raceLaps || 3) : 3;
    this.clearRivals();
    this.race = new RaceSession(this.track, mode, { laps });
    const lineS = this.track.def.lineS, grid = (k) => [lineS - 20 - k * 8, k % 2 ? 2.2 : -2.2];
    if (mode === 'race') {
      const [s, off] = grid(PLAYER_GRID); this.veh.reset(s, off);
      this.field = new RaceField(this.track, laps);
      this.field.add(this.veh, { id: 'player', code: 'YOU', name: 'You', team: 'VX-1 · ' + this.livery().name, color: this.livery().secondary, player: true });
      const base = AI_LEVELS[this.S.aiLevel || 'medium'];
      let slot = 0;
      RIVALS.forEach((original, k) => {
        const rv=this.campaign.launching && k===0 ? { ...original, code:'SOL',name:'Sola Kest',team:'Crownline',livery:{id:'sola',primary:[.92,.91,.87],secondary:[.92,.28,.1],accent:[.22,.1,.28],stripe:[.92,.28,.1]} } : original;
        if (slot === PLAYER_GRID) slot++;
        const veh = new Vehicle(CAR_VX1, this.world, this.track); const [gs, go] = grid(slot++); veh.reset(gs, go);
        const r = { id: rv.code, ...rv, veh, ai: new AIDriver({ pace: base + PACE_SPREAD[k], seed: 1000 + k * 77 }), prev: snapshot(veh, {}), curr: snapshot(veh, {}) };
        r.entry = this.field.add(veh, { id: rv.code, code: rv.code, name: rv.name, team: rv.team, color: rv.livery.secondary });
        this.renderer.carModel(rv.livery);
        this.rivals.push(r);
      });
      this.countTotal = 5 + 0.6 + Math.random() * 1.0; // five lights, then a random hold before lights out
    } else {
      const startS = mode === 'timetrial' ? this.track.def.gridS : lineS - 45;
      this.veh.reset(startS, 0);
      this.countTotal = mode === 'timetrial' ? 2.4 : 0.8;
    }
    this.countdown = this.countTotal;
    this.driver = new DriverInput();
    this.prev = snapshot(this.veh, this.prev); this.curr = snapshot(this.veh, this.curr);
    this.acc = 0; this.paused = false; this.mode = 'race'; this.lastPos = 0; this._goShown = true;
    const pb = this.pbFor(cls);
    this.pbGhost = pb && pb.ghost && mode !== 'race' ? decodeGhost(pb.ghost) : null; this.pbTime = pb ? pb.time : null; this.pbSectors = pb ? pb.sectors : null;
    this.sessionStartPb = this.pbTime;
    this.sessionBestSectors = [Infinity, Infinity, Infinity];
    this.input.buildTouch(this.S.layout === 'keyboard' ? 'buttons' : this.S.layout, a.autoThrottle, !a.autoGears);
    this.cam.snap(); this.coachShown.clear(); this.perf = new PerfStats();
    $('hud-sectors').querySelectorAll('span').forEach((s, i) => { s.className = ''; s.textContent = `S${i + 1}`; });
    $('hud-flag').hidden = true; $('hud-delta').textContent = '';
    $('hud-best').textContent = mode === 'race' ? `${laps} LAPS · ${(this.S.aiLevel || 'medium').toUpperCase()}` : (this.pbTime ? `BEST ${fmtTime(this.pbTime)}` : 'NO BEST YET');
    $('hud-mode').textContent = mode === 'practice' ? 'PRACTICE · HARBOR LOOP' : mode === 'race' ? 'GRAND PRIX · HARBOR LOOP' : 'TIME TRIAL · HARBOR LOOP';
    this.buildTower();
    this.show('none');
    this._goShown = mode !== 'race' && mode !== 'timetrial';
    this.coach(this.firstDrive ? (a.autoThrottle ? 'You steer. The car handles throttle and braking. Follow the line.' : 'Throttle and brake are yours. Brake where the line turns red.') : (mode === 'race' ? 'Five red lights. When they go out, race. Watch the cars around you into Turn 1.' : ''), 5);
    this.firstDrive = false;
  }

  onPlayerFinished() {
    const me = this.field.entries[0];
    this.banner(me.pos === 1 ? 'P1 · WINNER' : `P${me.pos} · FINISH`, me.pos === 1 ? 'win' : 'fin', 4000);
    this.finishT = this.time;
    this.autopilot = new AIDriver({ pace: 0.8, seed: 5 }); // cool-down: the car drives itself after the flag
    this.autopilot.init = true; this.autopilot.offset = 0;
  }

  coach(msg, seconds = 4, key) {
    if (!msg) return;
    if (key) { if (this.coachShown.has(key)) return; this.coachShown.add(key); }
    const el = $('hud-coach'); el.textContent = msg; el.classList.add('on');
    clearTimeout(this._coachT); this._coachT = setTimeout(() => el.classList.remove('on'), seconds * 1000);
  }

  onRaceEvent(ev) {
    this.campaign.onRaceEvent(ev);
    const race = this.race;
    if (ev.type === 'start') { if (!this.isRace()) this.coach('Timing started.', 2, 'start'); return; }
    if (ev.type === 'invalid') { const f = $('hud-flag'); f.hidden = false; f.textContent = `✕ Lap invalid: ${ev.reason}`; this.coach(ev.reason === 'track limits' ? 'Keep at least one wheel on the asphalt or curb.' : 'This lap will not count.', 3, 'inv-' + ev.reason); return; }
    if (this.school && ev.type === 'lap') return;
    if (ev.type === 'lap') {
      const lap = ev.lap, a = this.assists();
      $('hud-flag').hidden = true; $('hud-delta').textContent = '';
      lap.sectors.forEach((s, i) => { if (Number.isFinite(s) && lap.valid && s < this.sessionBestSectors[i]) this.sessionBestSectors[i] = s; });
      if (this.isRace()) { // races do not set personal bests (slipstream and traffic change lap times)
        if (race.targetLaps - race.laps.length === 1) this.banner('FINAL LAP', 'final', 1800);
        this.toast(`Lap ${lap.n}: ${fmtTime(lap.time)}${lap.valid ? '' : ' — invalid (' + lap.reason + ')'}`);
      } else if (lap.valid) {
        const key = `${this.track.def.id}|${lap.assist}`;
        const pb = this.save.data.pbs[key];
        if (!pb || lap.time < pb.time) {
          const delta = pb ? lap.time - pb.time : null;
          this.save.data.pbs[key] = { time: lap.time, sectors: lap.sectors, date: new Date().toISOString(), preset: this.save.data.preset, ghost: encodeGhost(lap.ghost) };
          lap.pb = true; lap.pbDelta = delta;
          this.pbGhost = lap.ghost; this.pbTime = lap.time; this.pbSectors = lap.sectors;
          $('hud-best').textContent = `BEST ${fmtTime(lap.time)}`;
          this.banner(delta === null ? 'LAP SET' : 'PERSONAL BEST', 'pb', 1500);
          this.toast(delta === null ? `First valid lap: ${fmtTime(lap.time)}. Ghost saved.` : `New personal best ${fmtTime(lap.time)} (${fmtDelta(delta)})`);
        } else this.toast(`Lap ${lap.n}: ${fmtTime(lap.time)} (${fmtDelta(lap.time - pb.time)} to best)`);
      } else this.toast(`Lap ${lap.n}: ${fmtTime(lap.time)} — invalid (${lap.reason})`);
      this.save.data.history.unshift({ t: lap.time, valid: lap.valid, cls: lap.assist, mode: race.mode, date: new Date().toISOString() });
      this.save.data.history = this.save.data.history.slice(0, 30);
      this.save.save();
      $('hud-sectors').querySelectorAll('span').forEach((s, i) => { s.className = ''; s.textContent = `S${i + 1}`; });
      if (!this.isRace() && race.finished) setTimeout(() => this.finishSession(), 900);
      else if (!this.isRace() && a.autoThrottle) this.coach('Lap complete. Try Racer assists when you feel ready.', 3, 'lap1');
    }
  }

  recover() {
    this.campaign.invalidate('Car reset. Start another clean lap for homologation.');
    const p = this.track.project(this.veh.x, this.veh.z, -1, {});
    this.veh.reset(p.s - 2, 0);
    this.race.invalidate('car reset to track');
    this.prev = snapshot(this.veh, this.prev); this.curr = snapshot(this.veh, this.curr);
    this.cam.snap();
    this.toast('Car reset to the track. This lap will not count.');
  }

  pause() {
    if (this.mode !== 'race') return;
    this.input.reset();
    this.paused = true; this.audio.mute(true);
    this.show('pause');
    const me = this.field ? this.field.entries[0] : null;
    $('pause-sub').textContent = this.campaign.active ? 'Light the Beacon · Return to the crew at any time' : this.isRace() ? `Race · lap ${clamp(me.lap + 1, 1, this.race.targetLaps)} of ${this.race.targetLaps} · P${me.pos} of ${this.field.entries.length}` : `${this.race.mode === 'practice' ? 'Practice' : 'Time trial'} · lap ${this.race.laps.length + (this.race.lapStart !== null ? 1 : 0)} · ${this.race.laps.filter((l) => l.valid).length} valid`;
  }
  resume() { this.input.buildTouch(this.S.layout === 'keyboard' ? 'buttons' : this.S.layout, this.assists().autoThrottle, !this.assists().autoGears); this.paused = false; this.last = performance.now(); this.acc = 0; this.audio.mute(false); this.show('none'); }

  finishSession() {
    if (this.campaign.active) { this.campaign.returnToStory(); return; }
    const race = this.race; if (!race) return;
    this.mode = 'menu'; this.paused = false; this.finishT = null;
    const lapRows = race.laps.map((l) => {
      const best = race.bestLap === l;
      return `<tr class="${best ? 'best' : ''}${l.valid ? '' : ' invalid'}"><td>${l.n}</td><td class="num">${fmtTime(l.time)}</td>${l.sectors.map((s) => `<td class="num">${Number.isFinite(s) ? s.toFixed(3) : '–'}</td>`).join('')}<td>${l.valid ? (best ? '<span class="tag best">Best</span>' : '<span class="tag ok">✓ Valid</span>') : `<span class="tag bad">✕ ${l.reason}</span>`}${l.pb ? ' <span class="tag pb">PB</span>' : ''}</td></tr>`;
    }).join('');
    const lapsTable = `<thead><tr><th>Lap</th><th>Time</th><th>S1</th><th>S2</th><th>S3</th><th>Status</th></tr></thead><tbody>${lapRows || '<tr><td colspan="6">No timed laps. Cross the line to start timing.</td></tr>'}</tbody>`;
    if (this.isRace() && this.field) {
      const order = this.field.order, me = this.field.entries[0], lead = order[0];
      const rows = order.map((e) => {
        const gap = e === lead ? (e.finished ? fmtTime(e.finishTime - this.countTotal) : 'LEADER') : (e.finished ? `+${e.gap.toFixed(3)}` : (e.lapped ? `+${e.lapped} lap${e.lapped > 1 ? 's' : ''}` : `+${e.gap.toFixed(1)} est.`));
        return `<tr class="${e.player ? 'me' : ''}${e.pos <= 3 ? ' podium p' + e.pos : ''}"><td class="num">${e.pos}</td><td><i class="team" style="background:${css(e.color)}"></i>${e.name}<small>${e.team}</small></td><td class="num">${gap}</td><td class="num">${Number.isFinite(e.best) ? fmtTime(e.best) : '–'}</td></tr>`;
      }).join('');
      $('results-title').textContent = me.finished ? (me.pos === 1 ? 'Victory' : `Finished P${me.pos}`) : 'Race ended early';
      $('results-table').innerHTML = `<thead><tr><th>Pos</th><th>Driver</th><th>Time / gap</th><th>Best lap</th></tr></thead><tbody>${rows}</tbody>`;
      $('results-laps').innerHTML = lapsTable; $('results-laps-wrap').hidden = false;
      $('results-summary').textContent = me.finished ? `P${me.pos} of ${order.length}${me.pos === 1 ? ' — you beat all seven AI rivals.' : `, ${me.gap.toFixed(3)} s behind the winner.`}` : `You were P${me.pos} when the race ended.`;
      $('results-note').textContent = `Race time includes the run from the grid to the line. Classification comes from fixed ${Math.round(1 / SIM_DT)} Hz steps, interpolated to the line; cars still running when you finished are ranked by distance covered with an estimated gap. Rivals are computer-controlled (not other players). Races do not set personal bests.`;
    } else {
      $('results-title').textContent = race.mode === 'practice' ? 'Practice complete' : 'Time trial complete';
      $('results-table').innerHTML = lapsTable; $('results-laps-wrap').hidden = true;
      const cls = assistClass(this.assists()), pb = this.pbFor(cls);
      const pbLaps = race.laps.filter((l) => l.pb), newPb = pbLaps[pbLaps.length - 1];
      const before = this.sessionStartPb;
      $('results-summary').textContent = newPb
        ? (before === null ? `First ${cls} best: ${fmtTime(newPb.time)}. Your ghost will race you next time.` : `New ${cls} best: ${fmtTime(newPb.time)}, ${(before - newPb.time).toFixed(3)} s faster than before this session.`)
        : (pb ? `Your ${cls} best is still ${fmtTime(pb.time)}.` : 'Finish a valid lap to set your first best.');
      $('results-note').textContent = `Lap times come from fixed ${Math.round(1 / SIM_DT)} Hz simulation steps, interpolated to the line, so they do not depend on frame rate. Dropped simulation steps this session: ${this.perf.dropped}.`;
    }
    const me=this.field?.entries[0];
    const earned=awardSession(this.save.data.career,{id:this.sessionId,validLaps:race.laps.filter(l=>l.valid).length,personalBest:race.laps.some(l=>l.pb),finishedRace:!!me?.finished,position:me?.pos});
    this.save.data.career=earned.career;this.save.save();
    $('results-progression').textContent=`+${earned.earned} driver XP · ${licenceFor(earned.career.xp).name} · ${earned.career.xp} XP total`;
    this.school=null;this.show('results');
  }

  copyTelemetry() {
    const h = this.telemetry.hist;
    const csv = ['sample,speed_mps,throttle,brake', ...h.map((r, i) => `${i},${r[0].toFixed(3)},${r[1].toFixed(3)},${r[2].toFixed(3)}`)].join('\n');
    if(window.NativeBridge?.copyText){window.NativeBridge.copyText(csv);return;}
    try { navigator.clipboard.writeText(csv).then(() => this.toast(`Copied ${h.length} telemetry samples (last 10 s) as CSV.`), () => this.toast('Copying is not allowed here.')); }
    catch (e) { this.toast('Copying is not allowed here.'); }
  }

  renderAcademy() {
    const school=this.save.data.career.school;
    $('academy-cards').innerHTML='';
    for(const d of ACADEMY_DRILLS){
      const b=document.createElement('button');b.type='button';b.className='card';b.dataset.drill=d.id;
      b.innerHTML=`<div class="meta">${school[d.id]?'✓ PASSED · REPLAY':'DRIVING FUNDAMENTALS'}</div><h3>${d.title}</h3><p>${d.summary}</p><div class="meta">${d.target}</div>`;
      b.addEventListener('click',()=>this.startSchool(d.id));$('academy-cards').appendChild(b);
    }
    $('academy-progress').textContent=`${Object.keys(school).length} of 3 medals earned. Each first pass earns 100 driver XP. The instructor observes your real controls and grip.`;
  }
  startSchool(id) {
    this.startRace('practice');
    this.school=new AcademySession(this.track);
    // Race-control placement is explicit exercise setup, never an assist force.
    this.veh.reset(this.track.def.lineS-45,0);
    this.driver=new DriverInput();this.prev=snapshot(this.veh,this.prev);this.curr=snapshot(this.veh,this.curr);
    this.school.start(id,this.veh,this.track);this.countdown=0.8;this._goShown=true;
    this.input.buildTouch(this.S.layout==='keyboard'?'buttons':this.S.layout,false,false);
    $('hud-mode').textContent='DRIVING ACADEMY';$('hud-best').textContent='INSTRUCTOR SESSION';
    $('hud-coach').classList.remove('on');this.show('none');this.updateAcademyHud();this.cam.snap();
  }
  updateAcademyHud() {
    if(!this.school)return;const s=this.school.status;
    $('school-title').textContent=s.title;$('school-instruction').textContent=s.instruction;
    $('school-metric').textContent=s.metric;$('school-feedback').textContent=s.feedback;
    $('school-progress').value=s.progress;$('btn-school-retry').hidden=s.phase!=='retry';
  }
  completeLesson() {
    const ev=this.pendingLessonResult;this.pendingLessonResult=null;
    if (this.campaign.onLesson(ev)) return;
    this.input.reset();this.paused=true;this.acc=0;this.audio.mute(true);
    const d=ACADEMY_DRILLS.find(d=>d.id===ev.drillId);
    $('lesson-title').textContent=d.title+' · passed';$('lesson-feedback').textContent=d.lesson;
    $('lesson-metric').textContent=this.school.status.metric;
    $('lesson-xp').textContent=ev.earned?`+${ev.earned} driver XP · ${this.save.available?'Academy medal saved':'Session medal (storage unavailable)'}`:'Medal already earned · Practice makes precision';
    $('btn-lesson-next').textContent=ev.drillId==='cornering'?'Academy summary':'Next exercise';this.show('lesson');
  }
  renderCustomize() {
    const colors=this.save.data.customLivery;
    for(const k of ['primary','secondary','accent']){
      const el=$('paint-'+k);el.value=/^#[0-9a-f]{6}$/i.test(colors[k])?colors[k]:'#c9d1d5';
      el.onchange=()=>{colors[k]=el.value;this.save.data.livery='custom';this.renderer.invalidateModel('custom');const saved=this.save.save();$('paint-status').textContent=saved?'Personal build saved on this device.':'Storage unavailable: colors are kept for this session only.';};
    }
  }

  // ---------- HUD ----------
  buildTower() {
    const t = $('tower'), g = $('mm-rivals');
    g.innerHTML = '';
    if (!this.field) { t.innerHTML = ''; $('hud-pos').hidden = true; this.towerRows = new Map(); return; }
    $('hud-pos').hidden = false;
    t.innerHTML = this.field.entries.map((e) => `<li data-id="${e.id}" class="${e.player ? 'me' : ''}"><b class="num"></b><i style="background:${css(e.color)}"></i><span>${e.code}</span><em class="num"></em></li>`).join('');
    this.towerRows = new Map([...t.querySelectorAll('li')].map((li) => [li.dataset.id, li]));
    for (const r of this.rivals) { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '2.6'); c.setAttribute('class', 'mm-rival'); c.style.fill = css(r.livery.secondary); g.appendChild(c); r.dot = c; }
  }
  updateHud() {
    this.updateAcademyHud();
    const veh = this.veh, race = this.race, S = this.S;
    const k = S.units === 'mph' ? MS_TO_MPH : MS_TO_KMH;
    const u = Math.abs(veh.forwardSpeed);
    $('hud-speed').textContent = Math.round(u * k);
    $('hud-gear').textContent = veh.gear < 0 ? 'R' : veh.gear === 0 ? 'N' : String(veh.gear);
    $('g-speed').setAttribute('stroke-dasharray', `${(Math.min(1, (u * MS_TO_KMH) / GAUGE_MAX_KMH) * ARC_SPEED).toFixed(1)} ${CIRC_SPEED.toFixed(1)}`);
    const rf = clamp((veh.rpm - 3500) / (veh.car.engine.limiterRpm - 3500), 0, 1);
    $('hud-rpm').setAttribute('stroke-dasharray', `${(rf * ARC_RPM).toFixed(1)} ${CIRC_RPM.toFixed(1)}`);
    $('gauge').classList.toggle('shift', veh.rpm > veh.car.gearbox.autoUpRpm - 300 && !this.assists().autoGears);
    const mm = this.mm;
    if (mm) {
      $('mm-car').setAttribute('cx', (mm.ox + veh.x * mm.sc).toFixed(1)); $('mm-car').setAttribute('cy', (mm.oz - veh.z * mm.sc).toFixed(1));
      const gp = this.ghostPose, on = this.ghostActive && Number.isFinite(gp.x);
      $('mm-ghost').setAttribute('cx', on ? (mm.ox + gp.x * mm.sc).toFixed(1) : '-999'); $('mm-ghost').setAttribute('cy', on ? (mm.oz - gp.z * mm.sc).toFixed(1) : '-999');
      for (const r of this.rivals) if (r.dot) { r.dot.setAttribute('cx', (mm.ox + r.veh.x * mm.sc).toFixed(1)); r.dot.setAttribute('cy', (mm.oz - r.veh.z * mm.sc).toFixed(1)); }
    }
    // start lights, countdown and banners
    const racing = this.isRace(), lit = this.startLightsLit(), lights = $('hud-lights');
    lights.hidden = !(racing && this.countdown > 0);
    if (!lights.hidden) lights.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < lit));
    if (this.countdown > 0) {
      if (!racing) { $('hud-center').textContent = this.countdown > 1.6 ? 'READY' : this.countdown > 0.8 ? 'SET' : 'GO'; $('hud-center').className = 'hud-center on'; }
      else $('hud-center').className = 'hud-center';
    } else if (!this._goShown) { this._goShown = true; this.banner('GO', 'go', 900); }
    else if (race.wrongWay && !this.autopilot) { $('hud-center').textContent = 'WRONG WAY'; $('hud-center').className = 'hud-center on warn'; this._bannerUntil = this.time + 0.2; }
    else if (this.time > (this._bannerUntil || 0)) $('hud-center').className = 'hud-center';
    // lap, position, tower
    if (racing) {
      const me = this.field.entries[0], lapN = clamp(me.lap + 1, 1, race.targetLaps);
      $('hud-lap').textContent = this.campaign.active ? (race.lapStart===null?'REACH THE START LINE':`CLEAN LAP · ATTEMPT ${race.laps.length+1}`) : me.finished ? 'FINISHED' : `LAP ${lapN}/${race.targetLaps}`;
      $('hud-pos').innerHTML = `P${me.pos}<span>/${this.field.entries.length}</span>`;
      if (this.lastPos && this.countdown <= 0 && !me.finished && me.pos !== this.lastPos) this.flashPos(me.pos < this.lastPos ? 'up' : 'down');
      this.lastPos = me.pos;
      this.field.order.forEach((e, i) => {
        const li = this.towerRows.get(e.id); if (!li) return;
        li.style.transform = `translateY(${i * 100}%)`;
        li.querySelector('b').textContent = e.pos;
        li.querySelector('em').textContent = i === 0 ? (e.finished ? 'FLAG' : 'LEADER') : (e.lapped ? `+${e.lapped}L` : `+${e.interval.toFixed(1)}`);
      });
    } else {
      const lapN = race.laps.length + 1;
      $('hud-lap').textContent = race.lapStart === null ? 'OUT LAP' : race.mode === 'timetrial' ? `LAP ${Math.min(lapN, 3)}/3` : `LAP ${lapN}`;
    }
    const t = race.currentLapTime(veh.time);
    if (racing) { const me = this.field.entries[0], rt = me.finished ? me.finishTime - this.countTotal : Math.max(0, veh.time - this.countTotal); $('hud-time').textContent = rt > 0 ? fmtTime(rt) : '0:00.000'; }
    else $('hud-time').textContent = race.lapStart === null ? fmtTime(0).replace(/–/g, '0') : fmtTime(t);
    const del = $('hud-delta');
    if (this.pbGhost && race.lapStart !== null) {
      const tg = ghostTimeAtS(this.pbGhost, race.sRel);
      if (tg !== null && t > 1) { const d = t - tg; del.textContent = fmtDelta(d); del.className = 'delta ' + (d < 0 ? 'ahead' : 'behind'); }
    } else if (racing) {
      const me = this.field.entries[0], order = this.field.order, ahead = order[me.pos - 2];
      if (this.countdown > 0 || me.finished) del.textContent = '';
      else if (ahead) { del.textContent = `${ahead.code} +${me.interval.toFixed(2)} s`; del.className = 'delta behind'; }
      else if (order[1]) { del.textContent = `LEAD ${order[1].interval.toFixed(2)} s`; del.className = 'delta ahead'; }
    }
    const spans = $('hud-sectors').querySelectorAll('span');
    race.sectorSplits.forEach((sp, i) => {
      const sec = i === 0 ? sp : sp - race.sectorSplits[i - 1];
      const pbSec = this.pbSectors ? this.pbSectors[i] : Infinity;
      const cls = sec < this.sessionBestSectors[i] && sec < pbSec ? 'purple' : sec < pbSec ? 'green' : 'yellow';
      spans[i].className = cls; spans[i].textContent = `S${i + 1} ${sec.toFixed(2)}`;
    });
    const aids = $('hud-aids');
    aids.querySelector('[data-a="abs"]').classList.toggle('on', veh.absActive);
    aids.querySelector('[data-a="tcs"]').classList.toggle('on', veh.tcsActive);
    aids.querySelector('[data-a="esc"]').classList.toggle('on', veh.escActive);
    aids.querySelector('[data-a="tow"]').classList.toggle('on', (veh.wake || 0) > 0.15);
    // coaching hints
    const a = this.assists();
    if (!a.brakeAssist && race.lapStart !== null && !this.autopilot) {
      const p = this.driver._p, uu = veh.forwardSpeed;
      if (uu - this.track.lineSpeedAt(p.s + 60) > 18) this.coach('Brake zone ahead: brake before the red line.', 2.5, 'brake1');
    }
    if ((veh.wake || 0) > 0.3 && !this.autopilot) this.coach('Slipstream: less drag behind another car. Pull out to pass before the braking zone.', 3.5, 'tow');
    if (veh.wheels.every((w) => w.offTrack) && !this.autopilot) this.coach('Off track. Ease back on gently; RESET returns you to the track.', 3, 'off');
  }
  flashPos(dir) { const el = $('hud-pos'); el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(dir); }

  // Tick marks every 10 km/h along the 270° speed arc (r = 101).
  buildGaugeTicks() {
    const el = document.querySelector('#gauge .g-ticks'); if (!el) return;
    const C = 2 * Math.PI * 101, L = C * 0.75, N = 34, P = L / N, dash = 1.8;
    el.setAttribute('stroke-dasharray', `${Array(N).fill(`${dash} ${(P - dash).toFixed(3)}`).join(' ')} ${dash} ${(C - L - dash).toFixed(3)}`);
  }
  // North-up minimap from the track centreline samples (Unity top view: +x right, +z up).
  buildMinimap() {
    const t = this.track; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < t.n; i++) { x0 = Math.min(x0, t.x[i]); x1 = Math.max(x1, t.x[i]); z0 = Math.min(z0, t.z[i]); z1 = Math.max(z1, t.z[i]); }
    const pad = 9, sc = (100 - 2 * pad) / Math.max(x1 - x0, z1 - z0, 1);
    const ox = 50 - ((x0 + x1) / 2) * sc, oz = 50 + ((z0 + z1) / 2) * sc;
    this.mm = { sc, ox, oz };
    let d = '';
    for (let i = 0; i < t.n; i += 2) d += `${i ? 'L' : 'M'}${(ox + t.x[i] * sc).toFixed(1)} ${(oz - t.z[i] * sc).toFixed(1)}`;
    $('mm-path').setAttribute('d', d + 'Z');
    const p = t.pointAt(t.def.lineS, 0, {}), nx = Math.cos(p.heading), nz = -Math.sin(p.heading), hw = 0.5 * (t.def.width || 12) * sc + 2.5;
    const sx = ox + p.x * sc, sy = oz - p.z * sc;
    const ln = $('mm-start'); ln.setAttribute('x1', (sx - nx * hw).toFixed(1)); ln.setAttribute('y1', (sy + nz * hw).toFixed(1)); ln.setAttribute('x2', (sx + nx * hw).toFixed(1)); ln.setAttribute('y2', (sy - nz * hw).toFixed(1));
  }

  updatePerf() {
    const s = this.perf.summary(), c = $('gl'), r = this.renderer;
    let heap = '';
    try { if (performance.memory) heap = ` · heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB`; } catch (e) { /* not available */ }
    $('perf').textContent = this.mode === 'race'
      ? `${s.fps.toFixed(0)} fps · frame ${s.avg.toFixed(1)} ms (p95 ${s.p95.toFixed(1)}, max ${s.max.toFixed(1)})\nsim ${s.sim.toFixed(3)} ms/frame · ${s.steps.toFixed(2)} steps · ${1 + this.rivals.length} cars · dropped ${s.dropped}\nrender CPU ${s.render.toFixed(2)} ms · ${r ? r.drawCalls : 0} draws · ${r ? Math.round(r.triangles / 1000) : 0}k world tris · ${r ? r.qName : '–'}${r && r.hdr ? ' HDR' : ''}\n${c.width}×${c.height} px · scale ${this.renderScale().toFixed(2)} · dpr ${(window.devicePixelRatio || 1).toFixed(2)}${heap}`
      : `menus · ${c.width}×${c.height} px · world built in ${r ? r.buildMs.toFixed(0) : '–'} ms · ${r ? r.qName : '–'}`;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!$('scr-story')) {
    try {
      const response=await fetch('./openline.html');
      if(!response.ok)throw new Error('Chapter interface could not load.');
      document.body.insertAdjacentHTML('beforeend',await response.text());
    } catch(e) { $('title-error').textContent=e.message; $('title-error').hidden=false; return; }
  }
  new Game();
});
