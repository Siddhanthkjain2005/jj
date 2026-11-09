// VELOCITYVERSE client: chase, cockpit and orbit cameras. Motion effects (speed FOV, shake, head sway) are
// scaled by player settings and disabled by Reduced motion.
import { DEG } from '../sim/units.js';

// Exact critically damped spring step (closed form): stable for any frame time, unlike explicit integration.
function spring(pos, vel, target, omega, dt) {
  const e = Math.exp(-omega * dt);
  for (let k = 0; k < 3; k++) {
    const x0 = pos[k] - target[k], v0 = vel[k];
    const c = v0 + omega * x0;
    pos[k] = target[k] + (x0 + c * dt) * e;
    vel[k] = (v0 - omega * c * dt) * e;
  }
}

export class CameraRig {
  constructor() {
    this.eye = [0, 5, -10]; this.eyeVel = [0, 0, 0];
    this.target = [0, 0, 0]; this.tgtVel = [0, 0, 0];
    this.fov = 62 * DEG; this.orbit = 0; this.shake = 0; this.t = 0; this.snapNext = true;
    this.out = { eye: [0, 0, 0], target: [0, 0, 0], fov: this.fov };
  }
  snap() { this.snapNext = true; }

  // pose: interpolated car pose; info: { speed, aLat, aLong, curb, impact }; s: settings
  update(dt, mode, pose, info, s) {
    this.t += dt;
    const reduced = s.reducedMotion;
    const motion = reduced ? 0 : 1;
    const sy = Math.sin(pose.yaw), cy = Math.cos(pose.yaw);
    const fwd = [sy, 0, cy], rgt = [cy, 0, -sy];
    const u = Math.max(0, info.speed);
    let eye, tgt, fov;
    if (mode === 'photo') {
      const p=s.photo||{angle:2.4,distance:7,height:2,fov:45};
      this._set([pose.x+Math.sin(p.angle)*p.distance,p.height,pose.z+Math.cos(p.angle)*p.distance],[pose.x,0.52,pose.z],p.fov*DEG);
      this.lastMode=mode;return this.out;
    }
    if (mode === 'orbit' || mode === 'title') {
      this.orbit += dt * (mode === 'title' ? 0.12 : 0.22) * (reduced ? 0.4 : 1);
      const r = mode === 'title' ? 8.5 : 7.4, h = mode === 'title' ? 2.1 : 1.6;
      eye = [pose.x + Math.sin(this.orbit) * r, h, pose.z + Math.cos(this.orbit) * r];
      // Menus sit on the left, so on wide screens aim left of the car to frame it right of centre.
      const side = (s.aspect || 1) > 1.3 ? (mode === 'title' ? 2.6 : 1.7) : 0;
      const fx = -Math.sin(this.orbit), fz = -Math.cos(this.orbit); // camera forward (towards the car)
      tgt = [pose.x - fz * side, mode === 'title' ? 0.9 : 0.55, pose.z + fx * side];
      fov = (mode === 'title' ? 48 : 40) * DEG;
      this.lastMode = mode; this._set(eye, tgt, fov); this.snapNext = true; return this.out;
    }
    if (mode === 'grid' || mode === 'finish') {
      // grid: a low cinematic sweep from the front quarter to behind the car while the start lights come on
      // finish: a slow orbit around the car after the flag
      this.cine = (this.lastMode === mode ? this.cine : 0) + dt;
      const k = mode === 'grid' ? Math.min(1, this.cine / 4.2) : this.cine * 0.12;
      const kk = k * k * (3 - 2 * k), ang = mode === 'grid' ? 0.75 + kk * (Math.PI - 0.75) : 2.2 + k * (reduced ? 0.3 : 1);
      const r = mode === 'grid' ? 5.2 + 1.2 * kk : 7.5, hh = mode === 'grid' ? 0.75 + 1.0 * kk : 1.8;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      eye = [pose.x + (fwd[0] * ca + rgt[0] * sa) * r, hh, pose.z + (fwd[2] * ca + rgt[2] * sa) * r];
      tgt = [pose.x + fwd[0] * 0.6, 0.55, pose.z + fwd[2] * 0.6];
      fov = (mode === 'grid' ? 42 : 46) * DEG;
      this.lastMode = mode; this._set(eye, tgt, fov);
      return this.out;
    }
    if (this.lastMode === 'grid' || this.lastMode === 'finish') { // hand over to the chase springs without a cut
      this.eye = [this.out.eye[0] - pose.x, this.out.eye[1], this.out.eye[2] - pose.z]; this.eyeVel = [0, 0, 0];
      this.target = [this.out.target[0] - pose.x, this.out.target[1], this.out.target[2] - pose.z]; this.tgtVel = [0, 0, 0];
      this.snapNext = false;
    }
    this.lastMode = mode;
    if (mode === 'cockpit') {
      const sway = -info.aLat * 0.0035 * s.shake * motion;
      const ex = pose.x + fwd[0] * 0.18 + rgt[0] * sway, ez = pose.z + fwd[2] * 0.18 + rgt[2] * sway;
      const ey = 0.93 - pose.h - pose.pitch * 0.18;
      eye = [ex, ey, ez];
      tgt = [ex + fwd[0] * 30, ey - 0.9 - pose.pitch * 30 * 0.6, ez + fwd[2] * 30];
      fov = (s.fov + 10 + 10 * Math.min(1, u / 85) * motion) * DEG;
    } else { // chase
      // Springs act on offsets from the car, so a constant speed causes no lag; turns and spins swing the view.
      const dist = 5.6 + 0.010 * u, height = 1.75 + 0.004 * u;
      const sway = info.aLat * 0.035 * motion;
      const de = [-fwd[0] * dist + rgt[0] * sway, height, -fwd[2] * dist + rgt[2] * sway];
      const dt2 = [fwd[0] * (3 + 0.045 * u), 0.45, fwd[2] * (3 + 0.045 * u)];
      if (this.snapNext) { this.eye = de.slice(); this.target = dt2.slice(); this.eyeVel = [0, 0, 0]; this.tgtVel = [0, 0, 0]; this.snapNext = false; }
      spring(this.eye, this.eyeVel, de, 6.0, dt);
      spring(this.target, this.tgtVel, dt2, 10, dt);
      eye = [pose.x + this.eye[0], this.eye[1], pose.z + this.eye[2]];
      tgt = [pose.x + this.target[0], this.target[1], pose.z + this.target[2]];
      fov = (s.fov + 13 * Math.min(1, u / 85) * motion) * DEG;
    }
    // shake from curbs and impacts
    this.shake = Math.max(this.shake * Math.exp(-dt * 6), (info.curb ? 0.018 + 0.0005 * u : 0) + Math.min(0.35, info.impact * 0.02));
    const amp = this.shake * s.shake * motion;
    if (amp > 1e-4) {
      const t = this.t;
      eye[0] += amp * Math.sin(t * 61.3) * 0.7; eye[1] += amp * Math.sin(t * 47.9 + 1.3); eye[2] += amp * Math.sin(t * 53.1 + 2.1) * 0.7;
    }
    this._set(eye, tgt, fov);
    return this.out;
  }
  _set(e, t, f) { this.out.eye[0] = e[0]; this.out.eye[1] = e[1]; this.out.eye[2] = e[2]; this.out.target[0] = t[0]; this.out.target[1] = t[1]; this.out.target[2] = t[2]; this.out.fov = f; }
}
