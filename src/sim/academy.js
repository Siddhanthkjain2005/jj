// Offline driving school. The instructor observes the same car, controls and circuit
// used by racing; it never changes the vehicle, applies forces or moves it.
import { clamp, G0 } from './units.js';

export const ACADEMY_DRILLS = [
  { id: 'launch', title: '01 · Smooth launch', summary: 'Use the throttle to reach 60 km/h, then hold a steady pace.', lesson: 'Feed in power. Rear-wheel slip means the tires cannot use all the torque.', target: '60 km/h', assistNote: 'Manual throttle; ABS, traction and steering assistance are welcome.' },
  { id: 'braking', title: '02 · Controlled stop', summary: 'Reach 70 km/h, release the throttle, and brake to a complete stop.', lesson: 'Brake while straight. Braking and turning share the same tire grip.', target: '70 km/h → stop', assistNote: 'Use the brake pedal yourself; ABS can prevent a wheel lock.' },
  { id: 'cornering', title: '03 · Find the grip', summary: 'Drive through 45° of a real circuit corner above 30 km/h without leaving the road.', lesson: 'Small steering inputs preserve grip. More steering does not always mean more turning.', target: '45° clean corner', assistNote: 'Follow the racing line; steering, traction and stability assistance are allowed.' },
];

const DEG = 180 / Math.PI;
const finite = n => Number.isFinite(n);
const speedOf = v => Math.hypot(v.vx, v.vz);
const forwardOf = v => finite(v.forwardSpeed) ? v.forwardSpeed : v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
const counts = v => [v.impactCount || 0, v.carImpactCount || 0, v.nanResets || 0];

export class AcademySession {
  constructor(track = null) {
    this.track = track;
    this.events = [];
    this.active = false;
    this.status = { drillId: null, title: '', phase: 'idle', instruction: '', feedback: '', metric: '', progress: 0, complete: false, attempts: 0, result: null };
    this._p = {};
  }

  start(drillId, veh, track = this.track) {
    const drill = ACADEMY_DRILLS.find(d => d.id === drillId);
    if (!drill) throw new Error(`Unknown driving-school exercise: ${drillId}`);
    if (!track || !finite(track.length) || typeof track.project !== 'function') throw new Error('Driving school needs the actual circuit.');
    this.track = track;
    this.drill = drill;
    this.events.length = 0;
    this.active = true;
    this.elapsed = 0;
    this.hint = -1;
    this.inputTime = 0;
    this.hold = 0;
    this.offTime = 0;
    this.wrongTime = 0;
    this.distance = 0;
    this.peakSlip = 0;
    this.peakBrakeG = 0;
    this.turn = 0;
    this.brakeDistance = 0;
    this.entrySpeed = 0;
    this.brakeLimit = 0;
    this.startSpeed = speedOf(veh);
    this.counts = counts(veh);
    this.last = { x: veh.x, z: veh.z, time: veh.time, s: null };
    this.status = { drillId, title: drill.title, target: drill.target, phase: drillId === 'launch' ? (speedOf(veh) < 1 ? 'accelerate' : 'ready') : 'approach', instruction: '', feedback: '', metric: '', progress: 0, complete: false, attempts: (this.status.drillId === drillId ? this.status.attempts : 0) + 1, result: null };
    this._describe(veh);
    return this.status;
  }

  restart(veh) { if (!this.drill) return this.status; return this.start(this.drill.id, veh, this.track); }
  cancel() { this.active = false; this.status.phase = 'idle'; this.status.instruction = 'Choose an exercise when you are ready.'; }

  _retry(reason) {
    this.active = false;
    this.status.phase = 'retry';
    this.status.progress = 0;
    this.status.feedback = reason;
    this.status.instruction = 'Stop safely, then select Retry exercise.';
    this.events.push({ type: 'retry', drillId: this.drill.id, reason });
  }

  _finish(extra = {}) {
    this.active = false;
    this.status.phase = 'complete';
    this.status.complete = true;
    this.status.progress = 1;
    this.status.instruction = 'Exercise passed. Continue when you are ready.';
    this.status.feedback = this.drill.lesson;
    this.status.result = { drillId: this.drill.id, elapsed: this.elapsed, distance: this.distance, peakSlip: this.peakSlip, ...extra };
    if(this.drill.id==='launch')this.status.metric=`Held ${extra.reachedKmh.toFixed(0)} km/h · target band54–72`;
    else if(this.drill.id==='braking')this.status.metric=`Stopped in ${extra.brakingDistance.toFixed(1)} m from ${extra.entryKmh.toFixed(1)} km/h`;
    else this.status.metric=`${extra.cornerDegrees.toFixed(1)}° clean corner completed`;
    this.events.push({ type: 'complete', drillId: this.drill.id, result: this.status.result });
  }

  _describe(veh) {
    const s = this.status, kmh = Math.max(0, forwardOf(veh)) * 3.6;
    if (this.drill.id === 'launch') {
      s.instruction = s.phase === 'ready' ? 'Stop safely to begin this standing-start exercise.' : 'Reach 60 km/h and hold between 54 and 72 km/h briefly.';
      s.metric = `${Math.round(kmh)} / 60 km/h`;
    } else if (this.drill.id === 'braking') {
      s.instruction = s.phase === 'brake' ? 'Release the throttle. Brake smoothly until the car is fully stopped.' : 'Build up to 70 km/h on the straight, then press the brake.';
      s.metric = s.phase === 'brake' ? `${Math.round(kmh)} km/h · ${this.brakeDistance.toFixed(1)} m braking` : `${Math.round(kmh)} / 70 km/h`;
    } else {
      s.instruction = s.phase === 'corner' ? 'Look through the bend. Use small steering inputs and keep the tires gripping.' : 'Approach the next bend above 30 km/h. Follow the racing line.';
      s.metric = `${Math.min(45, this.turn * DEG).toFixed(0)} / 45° · ${Math.round(kmh)} km/h`;
    }
  }

  update(dt, veh, raw = {}, track = this.track) {
    if (!this.active) return this.status;
    if (!(finite(dt) && dt > 0 && dt <= 0.1)) return this.status;
    if (track !== this.track) { this._retry('The circuit changed. Restart this exercise.'); return this.status; }
    const u = forwardOf(veh), speed = speedOf(veh);
    if (![veh.x, veh.z, veh.yaw, veh.time, u, speed].every(finite)) { this._retry('Vehicle data was invalid. Restart this exercise.'); return this.status; }
    const moved = Math.hypot(veh.x - this.last.x, veh.z - this.last.z);
    const nowCounts = counts(veh);
    if (veh.time < this.last.time - 1e-6 || nowCounts[2] !== this.counts[2] || moved > Math.max(3, speed * dt * 2 + 0.5)) {
      this._retry('The car was reset or moved between positions. This attempt does not count.'); return this.status;
    }
    if (nowCounts[0] > this.counts[0] || nowCounts[1] > this.counts[1]) { this._retry('Contact interrupted the exercise. Try again with more space.'); return this.status; }
    const p = track.project(veh.x, veh.z, this.hint, this._p);
    this.hint = p.i;
    let ds = this.last.s === null ? 0 : p.s - this.last.s;
    if (ds > track.length / 2) ds -= track.length;
    if (ds < -track.length / 2) ds += track.length;
    const along = veh.vx * track.tx[p.i] + veh.vz * track.tz[p.i];
    const allOff = veh.wheels.every(w => w.offTrack) || Math.abs(p.d) > track.halfWidth + 0.3;
    this.offTime = allOff ? this.offTime + dt : 0;
    this.wrongTime = along < -1 ? this.wrongTime + dt : Math.max(0, this.wrongTime - dt);
    if (this.offTime > 0.25) { this._retry('Stay on the asphalt. Rejoin safely and retry.'); return this.status; }
    if (this.wrongTime > 0.3) { this._retry('Drive in the circuit direction, then retry.'); return this.status; }
    const slip = Math.max(...veh.wheels.map(w => finite(w.slipNorm) ? w.slipNorm : 0));
    const beta = Math.abs(Math.atan2(veh.lateralSpeed || 0, Math.max(1, u)));
    this.peakSlip = Math.max(this.peakSlip, speed > 4 ? slip : 0);
    this.elapsed += dt;
    this.distance += moved;
    this.last = { x: veh.x, z: veh.z, time: veh.time, s: p.s };
    this.status.feedback = slip > 1.3 && speed > 4 ? 'The tires are sliding. Ease off and use smaller inputs.' : this.drill.lesson;

    if (this.drill.id === 'launch') {
      if (this.status.phase === 'ready') {
        // Entering this lesson at speed cannot satisfy a standing launch.
        if (speed < 1) this.hold += dt; else this.hold = 0;
        if (this.hold >= 0.3) { this.status.phase = 'accelerate'; this.hold = 0; this.distance = 0; }
      } else {
        if ((raw.throttle || 0) > 0.15 && (raw.brake || 0) < 0.05) this.inputTime += dt;
        const stable = u >= 15 && u <= 20 && slip < 1.8 && beta < 0.14 && !allOff;
        this.hold = stable ? this.hold + dt : 0;
        this.status.progress = clamp(u / (60 / 3.6), 0, 0.9);
        if (this.hold >= 0.6 && this.inputTime >= 0.5 && this.distance >= 10) this._finish({ reachedKmh: u * 3.6 });
      }
    } else if (this.drill.id === 'braking') {
      if (this.status.phase === 'approach') {
        if (u >= 70 / 3.6) this.hold += dt; else if (u < 60 / 3.6) this.hold = 0;
        if (this.hold > 0 && (raw.brake || 0) > 0.12 && u >= 60 / 3.6) {
          this.status.phase = 'brake'; this.entrySpeed = u; this.brakeDistance = 0; this.hold = 0;
          // Beginner budget: 45% of estimated peak dry grip, plus response margin.
          const a = Math.max(2, veh.car.tire.mu * veh.world.gravity * 0.45);
          this.brakeLimit = u * u / (2 * a) + 10;
        }
        this.status.progress = clamp(u / (70 / 3.6), 0, 1) * 0.35;
      } else {
        this.brakeDistance += moved;
        this.peakBrakeG = Math.max(this.peakBrakeG, -(veh.aLong || 0) / G0);
        if ((raw.brake || 0) > 0.15 && (raw.throttle || 0) < 0.1) this.inputTime += dt;
        if (this.brakeDistance > this.brakeLimit) { this._retry('Begin braking earlier and hold steady pressure. The stopping target was exceeded.'); return this.status; }
        this.hold = speed < 0.6 && (raw.brake || 0) > 0.1 ? this.hold + dt : 0;
        this.status.progress = 0.35 + 0.6 * clamp(1 - speed / this.entrySpeed, 0, 1);
        if (this.hold >= 0.45 && this.inputTime >= 0.3 && this.brakeDistance > 1) this._finish({ entryKmh: this.entrySpeed * 3.6, brakingDistance: this.brakeDistance, peakBrakeG: this.peakBrakeG, stoppingBudget: this.brakeLimit });
      }
    } else {
      const curv = Math.abs(track.curv[p.i]);
      const legitimate = ds >= 0 && ds <= Math.max(1, speed * dt * 2) && along > speed * 0.6;
      const clean = !allOff && slip < 1.6 && beta < 0.16;
      if (u >= 30 / 3.6 && curv >= 0.004 && legitimate) {
        if (!clean) { this._retry('The corner was too fast or the tires slid. Slow before the bend and retry.'); return this.status; }
        this.status.phase = 'corner';
        if (Math.abs(raw.steer || 0) > 0.04) this.inputTime += dt;
        this.turn += Math.max(0, ds) * curv;
        this.status.progress = clamp(this.turn / (Math.PI / 4), 0, 0.99);
        if (this.turn >= Math.PI / 4 && this.inputTime >= 0.2 && this.distance >= 10) this._finish({ cornerDegrees: this.turn * DEG });
      }
    }
    if (!this.status.complete) this._describe(veh);
    return this.status;
  }
}
