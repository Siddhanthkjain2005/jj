// VELOCITYVERSE client: particle and ribbon effects, all driven by simulation state:
//  light trails (tail lights, wing tips) · sparks (barrier and car contacts, plank bottoming) · tire smoke (slip)
//  speed streaks (air-light particles that rush past above ~110 km/h) · exhaust glow and lift-off backfires
//  skid marks (rubber laid down where a tire slides; they fade over about a minute).
// The renderer streams two vertex buffers per frame: additive light and alpha-blended smoke.
import { STRIDE } from './gfx.js';

const TRAIL_LIFE = 0.38;
const EXHAUST = [0, 0.50, -2.13];   // car-local exhaust exit (m)
const TRAILS = [[-0.53, 0.75, -2.64, 0], [0.53, 0.75, -2.64, 0], [-0.98, 0.26, 2.84, 1], [0.98, 0.26, 2.84, 1]]; // [x,y,z, colour slot]

function toWorld(p, lx, ly, lz) {
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  return [p.x + cy * lx + sy * lz, ly - (p.h || 0), p.z - sy * lx + cy * lz];
}

export class FX {
  constructor() {
    this.trails = new Map(); this.sparks = []; this.smoke = []; this.streaks = []; this.flames = new Map();
    this.skids = new Array(900); this.skidN = 0; this.skidLast = new Map();
    this.rand = Math.random;
  }
  reset() { this.trails.clear(); this.sparks.length = 0; this.smoke.length = 0; this.streaks.length = 0; this.flames.clear(); this.skids = new Array(900); this.skidN = 0; this.skidLast.clear(); }

  // cars: [{ id, pose, speed, throttle, rpm, slip[4], wheels[4] (world contact points), bottoming, hits[], tail, tip }]
  update(dt, cars, time, opts) {
    const R = this.rand;
    for (const c of cars) {
      // light trails
      let tr = this.trails.get(c.id); if (!tr) { tr = TRAILS.map(() => []); this.trails.set(c.id, tr); }
      TRAILS.forEach((e, k) => {
        const t = tr[k];
        if (!opts.active) { t.length = 0; return; }
        const w = toWorld(c.pose, e[0], e[1], e[2]), last = t[t.length - 1];
        if (!last || Math.hypot(w[0] - last[0], w[2] - last[2]) > 0.3) t.push([w[0], w[1], w[2], time, c.speed]);
        while (t.length && time - t[0][3] > TRAIL_LIFE) t.shift();
        if (t.length > 90) t.shift();
      });
      if (!opts.active || dt <= 0) continue;
      // sparks: contacts (barrier and car) and the titanium skid blocks when the floor bottoms out at speed
      for (const h of c.hits) {
        const nSp = Math.min(60, Math.round(h.speed * 5));
        for (let k = 0; k < nSp && this.sparks.length < 700; k++) {
          const a = R() * Math.PI * 2, sp = 2 + R() * (4 + h.speed * 0.5);
          this.sparks.push({ x: h.x, y: 0.3 + R() * 0.5, z: h.z, vx: Math.cos(a) * sp, vy: 1 + R() * 5, vz: Math.sin(a) * sp, life: 0.3 + R() * 0.6, age: 0, hot: 1 });
        }
      }
      if (c.bottoming > 0.0015 && c.speed > 38 && this.sparks.length < 700) {
        const n = Math.min(10, 2 + Math.round(c.bottoming * 2500));
        const sy = Math.sin(c.pose.yaw), cy = Math.cos(c.pose.yaw), vx = c.vx, vz = c.vz;
        for (let k = 0; k < n; k++) {
          const p = toWorld(c.pose, (R() - 0.5) * 0.3, 0.03, -1.1 + R() * 1.8);
          const back = 0.35 + R() * 0.35, side = (R() - 0.5) * 6;
          this.sparks.push({ x: p[0], y: 0.04, z: p[2], vx: vx * back + cy * side, vy: 0.5 + R() * 2.2, vz: vz * back - sy * side, life: 0.18 + R() * 0.32, age: 0, hot: 1.4 });
        }
      }
      // skid marks: extend a rubber strip under every sliding tire
      for (let k = 0; k < 4; k++) {
        const s = c.slip[k], key = c.id + ':' + k, w = c.wheels[k], last = this.skidLast.get(key);
        if (s > 1.1 && c.speed > 3) {
          if (!last) this.skidLast.set(key, [w[0], w[1]]);
          else { const d = Math.hypot(w[0] - last[0], w[1] - last[1]); if (d > 0.35) { if (d < 3) { this.skids[this.skidN % this.skids.length] = [last[0], last[1], w[0], w[1], Math.min(1, (s - 1.0) * 1.4), time]; this.skidN++; } last[0] = w[0]; last[1] = w[1]; } }
        } else if (last) this.skidLast.delete(key);
      }
      // rain: spray thrown up by the rear tyres, heavier with speed
      if (opts.rain > 0 && c.speed > 12 && this.smoke.length < 340) {
        const n = Math.min(3, (c.speed - 8) / 18) * dt * 60 * 0.5 * opts.rain;
        let k = Math.floor(n) + (R() < n % 1 ? 1 : 0);
        while (k-- > 0) {
          const p = toWorld(c.pose, R() < 0.5 ? -0.72 : 0.72, 0.2, -1.95);
          this.smoke.push({ x: p[0], y: 0.16 + R() * 0.22, z: p[2], vx: c.vx * 0.55 + (R() - 0.5) * 2.4, vy: 0.8 + R() * 1.6, vz: c.vz * 0.55 + (R() - 0.5) * 2.4, age: 0, life: 0.45 + R() * 0.5, s0: 0.25, s1: 1.5 + R() * 1.4, a: 0.14 + 0.1 * Math.min(1, c.speed / 60) });
        }
      }
      // tire smoke from sliding or spinning tires
      for (let k = 0; k < 4; k++) {
        const s = c.slip[k];
        if (s > 1.12 && c.speed > 2.5 && this.smoke.length < 260 && R() < Math.min(1, (s - 1.0) * 1.6) * dt * 60 * 0.5) {
          const w = c.wheels[k];
          this.smoke.push({ x: w[0], y: 0.25, z: w[1], vx: (R() - 0.5) * 1.2 + c.vx * 0.1, vy: 0.4 + R() * 0.6, vz: (R() - 0.5) * 1.2 + c.vz * 0.1, age: 0, life: 1.2 + R() * 1.4, s0: 0.35, s1: 2.6 + R() * 1.8, a: 0.22 + Math.min(0.25, (s - 1.1) * 0.4) });
        }
      }
      // exhaust: steady flame at high load, a bright burst on a lift-off at high rpm or a downshift
      let fl = this.flames.get(c.id); if (!fl) { fl = { burst: 0, thr: 0 }; this.flames.set(c.id, fl); }
      if ((fl.thr > 0.7 && c.throttle < 0.15 && c.rpm > 8500) || c.downshift) fl.burst = 0.16 + R() * 0.08;
      fl.thr = c.throttle; fl.burst = Math.max(0, fl.burst - dt);
      fl.steady = c.throttle > 0.85 && c.rpm > 9500 ? (c.rpm - 9500) / 2800 : 0;
      fl.pose = c.pose;
    }
    // integrate particles
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const p = this.sparks[k]; p.age += dt;
      if (p.age > p.life) { this.sparks.splice(k, 1); continue; }
      p.vy -= 9.81 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.72; p.vz *= 0.72; }
    }
    for (let k = this.smoke.length - 1; k >= 0; k--) {
      const p = this.smoke[k]; p.age += dt;
      if (p.age > p.life) { this.smoke.splice(k, 1); continue; }
      const drag = Math.exp(-dt * 1.4); p.vx *= drag; p.vz *= drag; p.vy = p.vy * drag + 0.25 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    // speed streaks around the player: world-space light dust that the car rushes through
    const pl = opts.player;
    if (pl && opts.active && opts.streaks) {
      const fwdX = Math.sin(pl.pose.yaw), fwdZ = Math.cos(pl.pose.yaw), rgX = fwdZ, rgZ = -fwdX;
      const want = pl.speed > 26 ? 64 : 0;
      while (this.streaks.length < want) this.streaks.push(this._spawnStreak(pl, fwdX, fwdZ, rgX, rgZ, true));
      if (!want) this.streaks.length = 0;
      for (let k = 0; k < this.streaks.length; k++) {
        const st = this.streaks[k], dx = st.x - pl.pose.x, dz = st.z - pl.pose.z;
        if (dx * fwdX + dz * fwdZ < -12 || Math.hypot(dx, dz) > 140) this.streaks[k] = this._spawnStreak(pl, fwdX, fwdZ, rgX, rgZ, false);
      }
    }
  }
  _spawnStreak(pl, fx, fz, rx, rz, any) {
    const R = this.rand, ahead = any ? -10 + R() * 120 : 70 + R() * 60, side = (R() < 0.5 ? -1 : 1) * (9 + R() * 20), y = 1.5 + R() * R() * 15;
    const pal = [[0.1, 0.85, 1.0], [1.0, 0.2, 0.78], [0.9, 0.95, 1.0], [1.0, 0.55, 0.15], [0.55, 0.4, 1.0]];
    return { x: pl.pose.x + fx * ahead + rx * side, y, z: pl.pose.z + fz * ahead + rz * side, col: pal[Math.floor(R() * pal.length)], k: 0.5 + R() * 0.8 };
  }

  // Write additive (light) and alpha (smoke) triangles. view: camera basis for billboards. Returns vertex counts.
  build(add, alpha, eye, right, up, time, opts) {
    const D = add.data, A = alpha.data; let v = 0, va = 0;
    const put = (x, y, z, col, a, mat, u, w) => { if (v >= add.max) return; const o = v * STRIDE; D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = 0; D[o + 4] = 1; D[o + 5] = 0; D[o + 6] = col[0]; D[o + 7] = col[1]; D[o + 8] = col[2]; D[o + 9] = a; D[o + 10] = mat; D[o + 11] = u; D[o + 12] = w; v++; };
    const putA = (x, y, z, col, a, mat, u, w) => { if (va >= alpha.max) return; const o = va * STRIDE; A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = 0; A[o + 4] = 1; A[o + 5] = 0; A[o + 6] = col[0]; A[o + 7] = col[1]; A[o + 8] = col[2]; A[o + 9] = a; A[o + 10] = mat; A[o + 11] = u; A[o + 12] = w; va++; };
    const ribbon = (Ax, Ay, Az, Bx, By, Bz, wA, wB, col, fa, fb, sink) => { // camera-facing soft ribbon segment
      const dx = Bx - Ax, dy = By - Ay, dz = Bz - Az, cx = eye[0] - Ax, cy = eye[1] - Ay, cz = eye[2] - Az;
      let sx = dy * cz - dz * cy, sy = dz * cx - dx * cz, sz = dx * cy - dy * cx; const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
      const p = sink || put;
      p(Ax - sx * wA, Ay - sy * wA, Az - sz * wA, col, fa, 11, -1, 0); p(Ax + sx * wA, Ay + sy * wA, Az + sz * wA, col, fa, 11, 1, 0); p(Bx + sx * wB, By + sy * wB, Bz + sz * wB, col, fb, 11, 1, 0);
      p(Ax - sx * wA, Ay - sy * wA, Az - sz * wA, col, fa, 11, -1, 0); p(Bx + sx * wB, By + sy * wB, Bz + sz * wB, col, fb, 11, 1, 0); p(Bx - sx * wB, By - sy * wB, Bz - sz * wB, col, fb, 11, -1, 0);
    };
    const sprite = (x, y, z, s, col, a, mat, sink) => {
      const p = sink || put, rx = right[0] * s, ry = right[1] * s, rz = right[2] * s, ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
      p(x - rx - ux, y - ry - uy, z - rz - uz, col, a, mat, -1, -1); p(x + rx - ux, y + ry - uy, z + rz - uz, col, a, mat, 1, -1); p(x + rx + ux, y + ry + uy, z + rz + uz, col, a, mat, 1, 1);
      p(x - rx - ux, y - ry - uy, z - rz - uz, col, a, mat, -1, -1); p(x + rx + ux, y + ry + uy, z + rz + uz, col, a, mat, 1, 1); p(x - rx + ux, y - ry + uy, z - rz + uz, col, a, mat, -1, 1);
    };
    const camFade = (x, y, z) => { const d = Math.hypot(x - eye[0], y - eye[1], z - eye[2]); return Math.min(1, Math.max(0, (d - 5) / 8)); };
    // light trails
    if (opts.trails) for (const [id, tr] of this.trails) {
      const cols = opts.trailCols(id);
      tr.forEach((t, k) => {
        const col = TRAILS[k][3] ? cols.tip : cols.tail, w = TRAILS[k][3] ? 0.035 : 0.05;
        for (let i = 0; i < t.length - 1; i++) {
          const P = t[i], Q = t[i + 1];
          const f = (X) => Math.pow(Math.max(0, 1 - (time - X[3]) / TRAIL_LIFE), 1.6) * Math.min(1, Math.max(0, (X[4] - 20) / 25)) * camFade(X[0], X[1], X[2]);
          const tipK = TRAILS[k][3] ? 0.6 : 1, fa = f(P) * tipK, fb = f(Q) * tipK; if (fa + fb < 0.01) continue;
          ribbon(P[0], P[1], P[2], Q[0], Q[1], Q[2], w, w, col, fa, fb);
        }
      });
    }
    // sparks: short streaks along their velocity
    for (const p of this.sparks) {
      const a = 1 - p.age / p.life, k = 0.022, col = [1.0, 0.55 + 0.35 * a, 0.18 + 0.3 * a * (p.hot > 1 ? 1 : 0)];
      ribbon(p.x, p.y, p.z, p.x - p.vx * k, p.y - p.vy * k, p.z - p.vz * k, 0.018 * p.hot, 0.006, col, a * 1.4, 0);
    }
    // speed streaks
    if (opts.streakK > 0.01) for (const st of this.streaks) {
      const len = opts.speed * 0.09 * st.k, fx = opts.fwd[0], fz = opts.fwd[1];
      const fade = opts.streakK * camFade(st.x, st.y, st.z) * Math.min(1, Math.hypot(st.x - eye[0], st.z - eye[2]) / 12);
      ribbon(st.x, st.y, st.z, st.x - fx * len, st.y, st.z - fz * len, 0.026, 0.008, st.col, fade * 0.8, 0);
    }
    // exhaust glow and backfire flames
    for (const [, fl] of this.flames) {
      if (!fl.pose) continue;
      const e = toWorld(fl.pose, EXHAUST[0], EXHAUST[1], EXHAUST[2]), back = toWorld(fl.pose, EXHAUST[0], EXHAUST[1] + 0.02, EXHAUST[2] - 1);
      const bx = back[0] - e[0], bz = back[2] - e[2];
      const flick = 0.75 + 0.25 * Math.sin(time * 91 + e[0]) * Math.sin(time * 57);
      sprite(e[0], e[1], e[2], 0.12, [1.0, 0.45, 0.12], 0.5 + fl.steady * 0.5, 10);
      if (fl.steady > 0) ribbon(e[0], e[1], e[2], e[0] + bx * 0.5 * fl.steady * flick, e[1], e[2] + bz * 0.5 * fl.steady * flick, 0.05, 0.01, [0.35, 0.55, 1.0], 0.8 * fl.steady, 0);
      if (fl.burst > 0) {
        const L = (0.6 + fl.burst * 4) * flick;
        ribbon(e[0], e[1], e[2], e[0] + bx * L, e[1] + 0.03, e[2] + bz * L, 0.11, 0.03, [1.0, 0.5, 0.12], 1.4, 0.1);
        sprite(e[0] + bx * 0.15, e[1], e[2] + bz * 0.15, 0.32, [1.0, 0.62, 0.25], 1.2, 10);
      }
    }
    // skid marks (alpha blended, just above the asphalt)
    const nSk = Math.min(this.skidN, this.skids.length);
    for (let i = 0; i < nSk; i++) {
      const k = this.skids[i]; if (!k) continue;
      const age = time - k[5], a = 0.55 * k[4] * Math.max(0, 1 - age / 60); if (a <= 0.01) continue;
      let dx = k[2] - k[0], dz = k[3] - k[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const sx = dz * 0.13, sz = -dx * 0.13, y = 0.012, col = [0.012, 0.012, 0.016];
      putA(k[0] - sx, y, k[1] - sz, col, a, 0, 0, 0); putA(k[0] + sx, y, k[1] + sz, col, a, 0, 0, 0); putA(k[2] + sx, y, k[3] + sz, col, a, 0, 0, 0);
      putA(k[0] - sx, y, k[1] - sz, col, a, 0, 0, 0); putA(k[2] + sx, y, k[3] + sz, col, a, 0, 0, 0); putA(k[2] - sx, y, k[3] - sz, col, a, 0, 0, 0);
    }
    // tire smoke (alpha blended, lit by the scene's ambient tone)
    if (opts.smoke !== false) for (const p of this.smoke) {
      const t = p.age / p.life, s = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) * (1 - t));
      sprite(p.x, p.y, p.z, s, opts.smokeCol, p.a * (1 - t) * Math.min(1, t * 8), 21, putA);
    }
    // the blinking rear rain light every car shows in the wet
    if (opts.rainPoses && Math.floor(time * 4) % 2 === 0) for (const pose of opts.rainPoses) {
      const p = toWorld(pose, 0, 0.42, -2.5);
      sprite(p[0], p[1], p[2], 0.14, [1, 0.06, 0.08], 1, 10); sprite(p[0], p[1], p[2], 0.55, [1, 0.04, 0.06], 0.22, 10);
    }
    add.count = v; alpha.count = va;
  }
}
