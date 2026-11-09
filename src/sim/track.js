// VELOCITYVERSE sim core: track geometry, surfaces, barriers, racing line and reference speed profile.
// The track is a closed centerline sampled every ~1.5–2 m. Barriers are half-spaces offset from the
// centerline, so a fast car cannot tunnel through them (there is no thin wall to skip over).
import { DEG, clamp, smoothstep } from './units.js';

export class Track {
  constructor(def, world, car) {
    this.def = def;
    this.world = world;
    this.name = def.name;
    this.halfWidth = def.width / 2;
    this._build(def);
    this._buildRacingLine(car);
  }

  _walk(def, solveLen, closeLen) {
    let x = def.start.x, z = def.start.z, h = def.start.heading * DEG;
    const segs = [];
    for (const seg of def.segments) {
      const kind = seg[0];
      if (kind === 'S') {
        const len = seg[1] === 'solve' ? solveLen : (seg[1] === 'close' ? closeLen : seg[1]);
        segs.push({ kind, x0: x, z0: z, h0: h, len, curv: 0 });
        x += Math.sin(h) * len; z += Math.cos(h) * len;
      } else {
        const R = seg[1], ang = seg[2] * DEG, dir = kind === 'R' ? 1 : -1;
        // centre lies to the right (dir=+1) or left (dir=-1) of the heading
        const cx = x + dir * Math.cos(h) * R, cz = z - dir * Math.sin(h) * R;
        segs.push({ kind, x0: x, z0: z, h0: h, len: R * ang, curv: dir / R, R, dir, cx, cz, ang });
        const h1 = h + dir * ang;
        x = cx - dir * Math.cos(h1) * R; z = cz + dir * Math.sin(h1) * R;
        h = h1;
      }
    }
    return { segs, x, z, h };
  }

  _build(def) {
    // Solve the two unknown straights so the loop closes: E = E0 + X·dX + Y·dY = start
    const base = this._walk(def, 0, 0);
    const iSolve = def.segments.findIndex(s => s[1] === 'solve');
    const iClose = def.segments.findIndex(s => s[1] === 'close');
    let X = 0, Y = 0;
    if (iSolve >= 0 && iClose >= 0) {
      const hX = base.segs[iSolve].h0, hY = base.segs[iClose].h0;
      const dXx = Math.sin(hX), dXz = Math.cos(hX), dYx = Math.sin(hY), dYz = Math.cos(hY);
      const rx = def.start.x - base.x, rz = def.start.z - base.z;
      const det = dXx * dYz - dXz * dYx;
      X = (rx * dYz - rz * dYx) / det;
      Y = (dXx * rz - dXz * rx) / det;
      if (!(X >= 0 && Y >= 0)) throw new Error(`Track does not close with positive straights (X=${X.toFixed(2)}, Y=${Y.toFixed(2)})`);
    }
    const walk = this._walk(def, X, Y);
    if (Math.hypot(walk.x - def.start.x, walk.z - def.start.z) > 0.01) throw new Error('Track does not close');
    this.solvedStraights = { X, Y };
    this.closureError = Math.hypot(walk.x - def.start.x, walk.z - def.start.z);
    this.segments = walk.segs;

    // Sample the centerline
    const xs = [], zs = [], hs = [], cs = [], ss = [], segIdx = [];
    let s = 0;
    walk.segs.forEach((g, gi) => {
      if (g.len <= 0) return;
      const step = g.kind === 'S' ? 2.0 : 1.5;
      const n = Math.max(1, Math.ceil(g.len / step));
      for (let k = 0; k < n; k++) {
        const u = (k / n) * g.len;
        let x, z, h;
        if (g.kind === 'S') {
          h = g.h0; x = g.x0 + Math.sin(h) * u; z = g.z0 + Math.cos(h) * u;
        } else {
          h = g.h0 + g.dir * (u / g.R);
          x = g.cx - g.dir * Math.cos(h) * g.R; z = g.cz + g.dir * Math.sin(h) * g.R;
        }
        xs.push(x); zs.push(z); hs.push(h); cs.push(g.curv); ss.push(s + u); segIdx.push(gi);
      }
      g.s0 = s; s += g.len; g.s1 = s;
    });
    this.length = s;
    const N = this.n = xs.length;
    this.x = Float64Array.from(xs); this.z = Float64Array.from(zs);
    this.s = Float64Array.from(ss); this.curv = Float64Array.from(cs);
    this.seg = Int32Array.from(segIdx);
    this.tx = new Float64Array(N); this.tz = new Float64Array(N);
    this.nx = new Float64Array(N); this.nz = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      this.tx[i] = Math.sin(hs[i]); this.tz[i] = Math.cos(hs[i]);
      this.nx[i] = this.tz[i]; this.nz[i] = -this.tx[i]; // right-hand normal
    }

    // Curbs and barriers
    this.curbL = new Uint8Array(N); this.curbR = new Uint8Array(N);
    const barL = new Float64Array(N), barR = new Float64Array(N);
    const hw = this.halfWidth, cw = def.curbWidth;
    for (let i = 0; i < N; i++) { barL[i] = hw + def.runoffStraight; barR[i] = hw + def.runoffStraight; }
    walk.segs.forEach(g => {
      if (g.kind === 'S') return;
      const curbs = g.R <= def.curbMaxRadius;
      for (let i = 0; i < N; i++) {
        const ds = this._sDelta(g.s0 - def.curbExtend, this.s[i]);
        const inArc = ds >= 0 && ds <= g.len + 2 * def.curbExtend;
        if (!inArc) continue;
        if (curbs) { this.curbL[i] = 1; this.curbR[i] = 1; }
        const outside = hw + (curbs ? cw : 0) + def.runoffCorner;
        const inside = hw + (curbs ? cw : 0) + def.runoffStraight;
        if (g.dir > 0) { barL[i] = Math.max(barL[i], outside); barR[i] = Math.max(barR[i], inside); }
        else { barR[i] = Math.max(barR[i], outside); barL[i] = Math.max(barL[i], inside); }
      }
    });
    for (const [s0, s1, side] of (def.extraCurbs || [])) {
      for (let i = 0; i < N; i++) {
        if (this.s[i] >= s0 && this.s[i] <= s1) { if (side === 'R' || side === 'B') this.curbR[i] = 1; if (side === 'L' || side === 'B') this.curbL[i] = 1; }
      }
    }
    // Curb ends are sloped over 2.5 m (like real curbs) so wheels meet a ramp, not a vertical step
    const ramp = (flags) => {
      const out = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        if (!flags[i]) continue;
        let k = 1;
        while (k < N && flags[(i - k + N) % N]) k++;
        const back = this._sDelta(this.s[(i - k + 1 + N) % N], this.s[i]);
        k = 1; while (k < N && flags[(i + k) % N]) k++;
        const fwd = this._sDelta(this.s[i], this.s[(i + k - 1) % N]);
        out[i] = Math.min(1, Math.min(back, fwd) / 2.5);
      }
      return out;
    };
    this.curbRampL = ramp(this.curbL); this.curbRampR = ramp(this.curbR);
    // Smooth barrier offsets so walls have no steps (steps would cause abrupt contact corrections)
    this.barrierL = this._smoothCircular(barL, 12, 3);
    this.barrierR = this._smoothCircular(barR, 12, 3);
  }

  _sDelta(from, to) { // forward distance from s=from to s=to on the loop, in [0, length)
    let d = (to - from) % this.length; if (d < 0) d += this.length; return d;
  }

  _smoothCircular(arr, radius, passes) {
    let a = Float64Array.from(arr);
    const N = a.length;
    for (let p = 0; p < passes; p++) {
      const b = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += a[(i + k + N) % N];
        b[i] = Math.max(sum / (2 * radius + 1), arr[i] * 0.85);
      }
      a = b;
    }
    return a;
  }

  // Nearest-segment projection. out: { i, t, s, d, dist2 }. d > 0 means right of the centerline.
  project(x, z, hint, out) {
    const N = this.n;
    let best = -1, bestD2 = Infinity, bestT = 0;
    const test = (i) => {
      const j = (i + 1) % N;
      const ax = this.x[i], az = this.z[i];
      const bx = this.x[j], bz = this.z[j];
      const ex = bx - ax, ez = bz - az;
      const len2 = ex * ex + ez * ez;
      let t = ((x - ax) * ex + (z - az) * ez) / len2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const qx = ax + ex * t, qz = az + ez * t;
      const d2 = (x - qx) * (x - qx) + (z - qz) * (z - qz);
      if (d2 < bestD2) { bestD2 = d2; best = i; bestT = t; }
    };
    if (hint >= 0) for (let k = -8; k <= 8; k++) test((hint + k + N) % N);
    if (best < 0 || bestD2 > 40 * 40) { best = -1; bestD2 = Infinity; for (let i = 0; i < N; i++) test(i); }
    const i = best, j = (i + 1) % N, t = bestT;
    const qx = this.x[i] + (this.x[j] - this.x[i]) * t;
    const qz = this.z[i] + (this.z[j] - this.z[i]) * t;
    let nx = this.nx[i] + (this.nx[j] - this.nx[i]) * t;
    let nz = this.nz[i] + (this.nz[j] - this.nz[i]) * t;
    const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
    out.i = i; out.t = t;
    out.d = (x - qx) * nx + (z - qz) * nz;
    const segLen = (j === 0) ? (this.length - this.s[i]) : (this.s[j] - this.s[i]);
    out.s = this.s[i] + segLen * t;
    out.nx = nx; out.nz = nz;
    out.dist2 = bestD2;
    return out;
  }

  // Surface at a projected point. Returns {type, height, ridgePhase}. Height is the road surface height (curbs).
  surface(proj, out) {
    const d = proj.d, ad = Math.abs(d), hw = this.halfWidth, def = this.def;
    const i = proj.i;
    const curb = d >= 0 ? this.curbR[i] : this.curbL[i];
    if (ad <= hw) { out.type = 'asphalt'; out.height = 0; out.ridge = 0; }
    else if (curb && ad <= hw + def.curbWidth) {
      out.type = 'curb';
      const rampArr = d >= 0 ? this.curbRampR : this.curbRampL, j = (i + 1) % this.n;
      const rampK = rampArr[i] + (rampArr[j] - rampArr[i]) * proj.t;
      out.height = def.curbHeight * smoothstep(0, 0.25, ad - hw) * rampK;
      out.ridge = def.curbRidge * rampK * Math.sin((2 * Math.PI * proj.s) / def.curbRidgePeriod);
    } else { out.type = 'runoff'; out.height = 0; out.ridge = 0; }
    return out;
  }

  barrierOffset(proj) {
    const i = proj.i, j = (i + 1) % this.n, t = proj.t;
    const arr = proj.d >= 0 ? this.barrierR : this.barrierL;
    return arr[i] + (arr[j] - arr[i]) * t;
  }

  // Edge of "track limits": asphalt plus curb where present.
  limitOffset(proj) {
    const curb = proj.d >= 0 ? this.curbR[proj.i] : this.curbL[proj.i];
    return this.halfWidth + (curb ? this.def.curbWidth : 0);
  }

  pointAt(s, offset, out) { // world position at distance s and lateral offset
    const N = this.n;
    let ss = s % this.length; if (ss < 0) ss += this.length;
    // binary search
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.s[mid] <= ss) lo = mid; else hi = mid - 1; }
    const i = lo, j = (i + 1) % N;
    const segLen = (j === 0) ? (this.length - this.s[i]) : (this.s[j] - this.s[i]);
    const t = segLen > 0 ? (ss - this.s[i]) / segLen : 0;
    out.x = this.x[i] + (this.x[j] - this.x[i]) * t + this.nx[i] * offset;
    out.z = this.z[i] + (this.z[j] - this.z[i]) * t + this.nz[i] * offset;
    out.heading = Math.atan2(this.tx[i], this.tz[i]);
    out.i = i;
    return out;
  }

  // Racing line: lateral offsets that pull the path tight within the track (approximate minimum-curvature line),
  // then a reference speed profile from lateral grip, braking and power limits. Used by assists and the HUD.
  _buildRacingLine(car) {
    const N = this.n, hw = this.halfWidth;
    const margin = 1.3;
    const off = new Float64Array(N);
    const px = new Float64Array(N), pz = new Float64Array(N);
    const passes = [[1, 300], [4, 400], [8, 300], [2, 200]];
    for (const [k, iters] of passes) {
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < N; i++) { px[i] = this.x[i] + this.nx[i] * off[i]; pz[i] = this.z[i] + this.nz[i] * off[i]; }
        for (let i = 0; i < N; i++) {
          const a = (i - k + N) % N, b = (i + k) % N;
          const mx = 0.5 * (px[a] + px[b]), mz = 0.5 * (pz[a] + pz[b]);
          const target = (mx - this.x[i]) * this.nx[i] + (mz - this.z[i]) * this.nz[i];
          off[i] = clamp(off[i] + 0.5 * (target - off[i]), -(hw - margin), hw - margin);
        }
      }
    }
    for (let i = 0; i < N; i++) { px[i] = this.x[i] + this.nx[i] * off[i]; pz[i] = this.z[i] + this.nz[i] * off[i]; }
    this.lineOffset = off; this.lineX = px; this.lineZ = pz;
    // signed curvature of the line from 3 points (i-2, i, i+2)
    const kap = new Float64Array(N), dsl = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N, b = (i + 2) % N;
      const ax = px[a], az = pz[a], bx = px[i], bz = pz[i], cx = px[b], cz = pz[b];
      const abx = bx - ax, abz = bz - az, bcx = cx - bx, bcz = cz - bz, acx = cx - ax, acz = cz - az;
      const cross = abx * bcz - abz * bcx; // >0 = turning left in (x,z) with x right z forward? sign fixed below
      const la = Math.hypot(abx, abz), lb = Math.hypot(bcx, bcz), lc = Math.hypot(acx, acz);
      // In our left-handed frame a right turn rotates heading from +z toward +x, giving cross < 0.
      kap[i] = (la * lb * lc) > 1e-9 ? (-2 * cross) / (la * lb * lc) : 0;
      const j = (i + 1) % N;
      dsl[i] = Math.hypot(px[j] - px[i], pz[j] - pz[i]);
    }
    // smooth curvature slightly
    const kapS = new Float64Array(N);
    for (let i = 0; i < N; i++) { let sum = 0; for (let k = -3; k <= 3; k++) sum += kap[(i + k + N) % N]; kapS[i] = sum / 7; }
    this.lineCurv = kapS; this.lineDs = dsl;
    this.lineLength = dsl.reduce((a, b) => a + b, 0);

    // Speed profile with a conservative grip estimate so assists are safe
    const m = car.mass, g = this.world.gravity, rho = this.world.airDensity;
    const mu = car.tire.mu * 0.86 * this.world.surfaces.asphalt.mu;
    const kDown = 0.5 * rho * car.aero.clA, kDrag = 0.5 * rho * car.aero.cdA;
    const powerW = 400000 * car.gearbox.efficiency; // approximate peak wheel power (fictional engine, see data)
    const vTop = 95;
    const v = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const k = Math.abs(kapS[i]);
      const den = m * k - mu * kDown;
      v[i] = den <= 1e-6 ? vTop : Math.min(vTop, Math.sqrt((mu * m * g) / den));
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let n = 0; n < N; n++) { // backward pass: braking
        const i = (N - 1 - n + N) % N, j = (i + 1) % N;
        const vj = v[j];
        const aBrake = mu * (g + (kDown * vj * vj) / m) + (kDrag * vj * vj) / m;
        const vmax = Math.sqrt(vj * vj + 2 * aBrake * 0.85 * dsl[i]);
        if (v[i] > vmax) v[i] = vmax;
      }
      for (let n = 0; n < N; n++) { // forward pass: acceleration
        const i = n, j = (i + 1) % N;
        const vi = Math.max(v[i], 1);
        const aTrac = mu * g * (1 - car.frontWeight) * 1.1;
        const aPow = powerW / (m * vi);
        const aAcc = Math.max(0, Math.min(aTrac, aPow) - (kDrag * vi * vi) / m);
        const vmax = Math.sqrt(vi * vi + 2 * aAcc * dsl[i]);
        if (v[j] > vmax) v[j] = vmax;
      }
    }
    this.lineSpeed = v;
    let tLap = 0; for (let i = 0; i < N; i++) tLap += dsl[i] / Math.max(1, v[i]);
    this.referenceLapTime = tLap;
  }

  lineSpeedAt(s) { // interpolated reference speed at distance s along the centerline
    let ss = s % this.length; if (ss < 0) ss += this.length;
    let lo = 0, hi = this.n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.s[mid] <= ss) lo = mid; else hi = mid - 1; }
    const j = (lo + 1) % this.n;
    const segLen = (j === 0) ? (this.length - this.s[lo]) : (this.s[j] - this.s[lo]);
    const t = segLen > 0 ? (ss - this.s[lo]) / segLen : 0;
    return this.lineSpeed[lo] + (this.lineSpeed[j] - this.lineSpeed[lo]) * t;
  }
}
