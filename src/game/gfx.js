// VELOCITYVERSE client: minimal WebGL2 layer (math, shaders, mesh building). Left-handed, y-up, z-forward,
// matching the simulation and Unity, so no axis conversion is needed anywhere.
// Vertex layout (13 floats): position(3) normal(3) colour(4: sRGB rgb + material parameter) material id(1) uv(2)

export const STRIDE = 13;

export const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(o, a, b) {
    const r = M4._tmp || (M4._tmp = new Float32Array(16));
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) {
      r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
    }
    o.set(r); return o;
  },
  perspectiveLH(o, fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    o.fill(0); o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (far - near); o[11] = 1; o[14] = (-2 * far * near) / (far - near);
    return o;
  },
  lookAtLH(o, ex, ey, ez, tx, ty, tz, upY = 1) {
    let zx = tx - ex, zy = ty - ey, zz = tz - ez; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = upY * zz, xy = 0, xz = -upY * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[4] = xy; o[8] = xz; o[12] = -(xx * ex + xy * ey + xz * ez);
    o[1] = yx; o[5] = yy; o[9] = yz; o[13] = -(yx * ex + yy * ey + yz * ez);
    o[2] = zx; o[6] = zy; o[10] = zz; o[14] = -(zx * ex + zy * ey + zz * ez);
    o[3] = 0; o[7] = 0; o[11] = 0; o[15] = 1;
    return o;
  },
  // T · Ry(yaw) · Rx(pitch, nose down +) · Rz(roll, right side down +)
  fromPose(o, x, y, z, yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const ax = cr, ay = -sr * cp, az = -sr * sp, bx = sr, by = cr * cp, bz = cr * sp, cx = 0, cyy = -sp, cz = cp;
    o[0] = cy * ax + sy * az; o[1] = ay; o[2] = -sy * ax + cy * az; o[3] = 0;
    o[4] = cy * bx + sy * bz; o[5] = by; o[6] = -sy * bx + cy * bz; o[7] = 0;
    o[8] = cy * cx + sy * cz; o[9] = cyy; o[10] = -sy * cx + cy * cz; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  },
  invert(o, m) {
    const a = m, inv = new Float32Array(16);
    inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
    inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
    inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
    inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
    inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
    inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
    inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
    inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
    inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
    inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
    inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
    inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
    inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
    inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
    inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
    inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
    let det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
    det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) o[i] = inv[i] * det;
    return o;
  },
};

const UV0 = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class MeshBuilder {
  constructor() { this.v = []; this.i = []; this.n = 0; }
  vert(x, y, z, nx, ny, nz, c, mat = 0, u = 0, w = 0) {
    this.v.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], c[3] === undefined ? 0 : c[3], mat, u, w);
    return this.n++;
  }
  quad(p0, p1, p2, p3, c, mat = 0, nrm, uv = UV0) {
    let nx, ny, nz;
    if (nrm) [nx, ny, nz] = nrm;
    else {
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
      const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    }
    const a = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, c, mat, uv[0][0], uv[0][1]);
    const b = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, c, mat, uv[1][0], uv[1][1]);
    const d = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, c, mat, uv[2][0], uv[2][1]);
    const e = this.vert(p3[0], p3[1], p3[2], nx, ny, nz, c, mat, uv[3][0], uv[3][1]);
    this.i.push(a, b, d, a, d, e);
  }
  // Tapered box along z (car parts): back face at z0 (w0 wide, y0b..y0t), front face at z1 (w1, y1b..y1t)
  taper(cx, z0, z1, w0, w1, y0b, y0t, y1b, y1t, c, mat = 0) {
    const P = [
      [cx - w0 / 2, y0b, z0], [cx + w0 / 2, y0b, z0], [cx + w0 / 2, y0t, z0], [cx - w0 / 2, y0t, z0],
      [cx - w1 / 2, y1b, z1], [cx + w1 / 2, y1b, z1], [cx + w1 / 2, y1t, z1], [cx - w1 / 2, y1t, z1],
    ];
    this.quad(P[0], P[1], P[2], P[3], c, mat, [0, 0, -1]); this.quad(P[5], P[4], P[7], P[6], c, mat, [0, 0, 1]);
    this.quad(P[3], P[2], P[6], P[7], c, mat); this.quad(P[0], P[4], P[5], P[1], c, mat);
    this.quad(P[0], P[3], P[7], P[4], c, mat); this.quad(P[1], P[5], P[6], P[2], c, mat);
  }
  box(cx, cy, cz, sx, sy, sz, c, mat = 0) { this.taper(cx, cz - sz / 2, cz + sz / 2, sx, sx, cy - sy / 2, cy + sy / 2, cy - sy / 2, cy + sy / 2, c, mat); }
  // Oriented box on the ground plane with yaw. Side faces get uv in metres (u along face, v up) for facades.
  boxYaw(cx, cy, cz, sx, sy, sz, yaw, c, mat = 0, sideMat = mat, sideCol = c) {
    const s = Math.sin(yaw), co = Math.cos(yaw);
    const pt = (lx, ly, lz) => [cx + co * lx + s * lz, cy + ly, cz - s * lx + co * lz];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = [pt(-hx, -hy, -hz), pt(hx, -hy, -hz), pt(hx, hy, -hz), pt(-hx, hy, -hz), pt(-hx, -hy, hz), pt(hx, -hy, hz), pt(hx, hy, hz), pt(-hx, hy, hz)];
    const N = (lx, lz) => [co * lx + s * lz, 0, -s * lx + co * lz];
    const y0 = cy - hy, y1 = cy + hy;
    const uvs = (w) => [[0, y0], [w, y0], [w, y1], [0, y1]];
    this.quad(P[0], P[1], P[2], P[3], sideCol, sideMat, N(0, -1), uvs(sx)); this.quad(P[5], P[4], P[7], P[6], sideCol, sideMat, N(0, 1), uvs(sx));
    this.quad(P[4], P[0], P[3], P[7], sideCol, sideMat, N(-1, 0), uvs(sz)); this.quad(P[1], P[5], P[6], P[2], sideCol, sideMat, N(1, 0), uvs(sz));
    this.quad(P[3], P[2], P[6], P[7], c, mat, [0, 1, 0]);
    return P;
  }
  // Loft through superellipse cross-sections along z: sections = [[z, halfWidth, halfHeight, centreY, exponent]]
  loft(cx, sections, seg, c, mat = 0, capFront = true, capBack = true) {
    const rings = [];
    for (const [z, w, h, y0, n] of sections) {
      const ring = [];
      for (let k = 0; k < seg; k++) {
        const t = (k / seg) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t), e = 2 / (n || 2.5);
        const x = cx + w * Math.sign(ct) * Math.pow(Math.abs(ct), e), y = y0 + h * Math.sign(st) * Math.pow(Math.abs(st), e);
        let nx = ct / Math.max(w, 1e-3), ny = st / Math.max(h, 1e-3); const l = Math.hypot(nx, ny) || 1;
        ring.push(this.vert(x, y, z, nx / l, ny / l, 0, c, mat, k / seg, z));
      }
      rings.push(ring);
    }
    for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg, a = rings[r][k], b = rings[r][k1], d = rings[r + 1][k1], e = rings[r + 1][k];
      this.i.push(a, b, d, a, d, e);
    }
    const cap = (ri, sign) => {
      const [z, , , y0] = sections[ri]; const ctr = this.vert(cx, y0, z, 0, 0, sign, c, mat, 0.5, z);
      for (let k = 0; k < seg; k++) {
        const p0 = this.v.slice(rings[ri][k] * STRIDE, rings[ri][k] * STRIDE + 3), p1 = this.v.slice(rings[ri][(k + 1) % seg] * STRIDE, rings[ri][(k + 1) % seg] * STRIDE + 3);
        const a = this.vert(p0[0], p0[1], p0[2], 0, 0, sign, c, mat), b = this.vert(p1[0], p1[1], p1[2], 0, 0, sign, c, mat);
        this.i.push(ctr, a, b);
      }
    };
    if (capFront) cap(sections.length - 1, 1);
    if (capBack) cap(0, -1);
  }
  // Recompute smooth (area-weighted) normals for vertices added since v0 / indices since i0.
  // Duplicate a vertex position to keep a hard crease (normals are accumulated per vertex index).
  smooth(v0, i0) {
    const V = this.v, I = this.i, S = STRIDE;
    for (let k = v0; k < this.n; k++) { V[k * S + 3] = 0; V[k * S + 4] = 0; V[k * S + 5] = 0; }
    for (let t = i0; t < I.length; t += 3) {
      const a = I[t] * S, b = I[t + 1] * S, c = I[t + 2] * S;
      if (I[t] < v0 || I[t + 1] < v0 || I[t + 2] < v0) continue;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
      const wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      for (const q of [a, b, c]) { V[q + 3] += nx; V[q + 4] += ny; V[q + 5] += nz; }
    }
    for (let k = v0; k < this.n; k++) {
      const o = k * S, l = Math.hypot(V[o + 3], V[o + 4], V[o + 5]) || 1;
      V[o + 3] /= l; V[o + 4] /= l; V[o + 5] /= l;
    }
  }
  // Sweep a 2D profile [[a, b], …] along frames [{p, u, v}] (vertex = p + u·a + v·b). Smooth normals.
  // colorFn(k) / matFn(k) may vary colour and material per profile point (e.g. a stripe).
  sweep(frames, profile, c, mat = 0, closed = true, caps = false, colorFn = null, matFn = null) {
    const v0 = this.n, i0 = this.i.length, P = profile.length, rings = [];
    let dist = 0;
    frames.forEach((F, f) => {
      if (f) dist += Math.hypot(F.p[0] - frames[f - 1].p[0], F.p[1] - frames[f - 1].p[1], F.p[2] - frames[f - 1].p[2]);
      const ring = [];
      for (let k = 0; k < P; k++) {
        const [a, b] = profile[k];
        ring.push(this.vert(F.p[0] + F.u[0] * a + F.v[0] * b, F.p[1] + F.u[1] * a + F.v[1] * b, F.p[2] + F.u[2] * a + F.v[2] * b, 0, 1, 0,
          colorFn ? colorFn(k, f) : c, matFn ? matFn(k, f) : mat, k / P, dist));
      }
      rings.push(ring);
    });
    const segs = closed ? P : P - 1;
    for (let f = 0; f < frames.length - 1; f++) for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % P, a = rings[f][k], b = rings[f][k1], d = rings[f + 1][k1], e = rings[f + 1][k];
      this.i.push(a, b, d, a, d, e);
    }
    this.smooth(v0, i0);
    if (caps) for (const f of [0, frames.length - 1]) {
      const F = frames[f]; let cx = 0, cy = 0, cz = 0;
      for (const id of rings[f]) { cx += this.v[id * STRIDE]; cy += this.v[id * STRIDE + 1]; cz += this.v[id * STRIDE + 2]; }
      const n = rings[f].length, t = f === 0 ? -1 : 1;
      const tx = (frames[Math.min(f + 1, frames.length - 1)].p[0] - frames[Math.max(f - 1, 0)].p[0]), ty = (frames[Math.min(f + 1, frames.length - 1)].p[1] - frames[Math.max(f - 1, 0)].p[1]), tz = (frames[Math.min(f + 1, frames.length - 1)].p[2] - frames[Math.max(f - 1, 0)].p[2]);
      const tl = Math.hypot(tx, ty, tz) || 1, nn = [t * tx / tl, t * ty / tl, t * tz / tl];
      const ctr = this.vert(cx / n, cy / n, cz / n, nn[0], nn[1], nn[2], c, mat);
      for (let k = 0; k < n; k++) {
        const A = rings[f][k], B = rings[f][(k + 1) % n];
        const a = this.vert(this.v[A * STRIDE], this.v[A * STRIDE + 1], this.v[A * STRIDE + 2], nn[0], nn[1], nn[2], c, mat);
        const b = this.vert(this.v[B * STRIDE], this.v[B * STRIDE + 1], this.v[B * STRIDE + 2], nn[0], nn[1], nn[2], c, mat);
        this.i.push(ctr, a, b);
      }
    }
    return rings;
  }
  // Surface of revolution around the local x axis: profile [[x, r], …]; cols/mats optional per profile point.
  lathe(profile, seg, c, mat = 0, cols = null, mats = null) {
    const v0 = this.n, i0 = this.i.length, rows = [];
    profile.forEach(([x, r], k) => {
      const row = [];
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        row.push(this.vert(x, Math.cos(a) * r, Math.sin(a) * r, 0, 1, 0, cols ? cols[k] : c, mats ? mats[k] : mat, s / seg, r));
      }
      rows.push(row);
    });
    for (let k = 0; k < rows.length - 1; k++) for (let s = 0; s < seg; s++) {
      const a = rows[k][s], b = rows[k][s + 1], d = rows[k + 1][s + 1], e = rows[k + 1][s];
      this.i.push(a, b, d, a, d, e);
    }
    this.smooth(v0, i0);
  }
  // Vertical loft (towers): sections [[y, halfX, halfZ, exponent]] around (cx, cz) with yaw. uv = (perimeter m, y m).
  loftY(cx, cz, yaw, sections, seg, c, mat = 0, sideCol = c) {
    const v0 = this.n, i0 = this.i.length, rings = [], s = Math.sin(yaw), co = Math.cos(yaw);
    for (const [y, hx, hz, n] of sections) {
      const ring = []; let per = 0, px = 0, pz = 0;
      for (let k = 0; k <= seg; k++) {
        const t = (k / seg) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t), e = 2 / (n || 2);
        const lx = hx * Math.sign(ct) * Math.pow(Math.abs(ct), e), lz = hz * Math.sign(st) * Math.pow(Math.abs(st), e);
        const x = cx + co * lx + s * lz, z = cz - s * lx + co * lz;
        if (k) per += Math.hypot(x - px, z - pz); px = x; pz = z;
        ring.push(this.vert(x, y, z, 0, 1, 0, sideCol, mat, per, y));
      }
      rings.push(ring);
    }
    for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < seg; k++) {
      const a = rings[r][k], b = rings[r][k + 1], d = rings[r + 1][k + 1], e = rings[r + 1][k];
      this.i.push(a, b, d, a, d, e);
    }
    this.smooth(v0, i0);
    const top = sections[sections.length - 1]; // flat roof
    if (top[1] > 0.05) {
      const ctr = this.vert(cx, top[0], cz, 0, 1, 0, c, 0);
      const last = rings[rings.length - 1];
      for (let k = 0; k < seg; k++) {
        const A = last[k], B = last[k + 1];
        const a = this.vert(this.v[A * STRIDE], top[0], this.v[A * STRIDE + 2], 0, 1, 0, c, 0), b = this.vert(this.v[B * STRIDE], top[0], this.v[B * STRIDE + 2], 0, 1, 0, c, 0);
        this.i.push(ctr, a, b);
      }
    }
    return rings;
  }
  sphere(cx, cy, cz, r, lat, lon, c, mat = 0, squashY = 1) {
    const idx = [];
    for (let a = 0; a <= lat; a++) {
      const th = (a / lat) * Math.PI, row = [];
      for (let b = 0; b <= lon; b++) {
        const ph = (b / lon) * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        row.push(this.vert(cx + nx * r, cy + ny * r * squashY, cz + nz * r, nx, ny, nz, c, mat, b / lon, a / lat));
      }
      idx.push(row);
    }
    for (let a = 0; a < lat; a++) for (let b = 0; b < lon; b++) this.i.push(idx[a][b], idx[a + 1][b], idx[a + 1][b + 1], idx[a][b], idx[a + 1][b + 1], idx[a][b + 1]);
  }
  // Wheel along local x: tire, rim and a glowing rim ring
  wheel(r, w, seg, tire, rimA, rimB, glow) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const y0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, y1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
      const nm = [0, Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)];
      this.quad([-w / 2, y0, z0], [w / 2, y0, z0], [w / 2, y1, z1], [-w / 2, y1, z1], tire, 0, nm);
      const ri = r * 0.64, rg = r * 0.70;
      for (const side of [-1, 1]) {
        const x = side * w / 2 * 1.002;
        const rc = (k % 3 === 0) ? rimA : rimB;
        this.quad([x, 0, 0], [x, Math.cos(a0) * ri, Math.sin(a0) * ri], [x, Math.cos(a1) * ri, Math.sin(a1) * ri], [x, 0, 0], rc, 0, [side, 0, 0]);
        this.quad([x, Math.cos(a0) * ri, Math.sin(a0) * ri], [x, Math.cos(a0) * rg, Math.sin(a0) * rg], [x, Math.cos(a1) * rg, Math.sin(a1) * rg], [x, Math.cos(a1) * ri, Math.sin(a1) * ri], glow, 5, [side, 0, 0]);
        this.quad([x, Math.cos(a0) * rg, Math.sin(a0) * rg], [x, y0, z0], [x, y1, z1], [x, Math.cos(a1) * rg, Math.sin(a1) * rg], tire, 0, [side, 0, 0]);
      }
    }
  }
}

// Orthonormal frames along a polyline for MeshBuilder.sweep: u = side (horizontal where possible), v = "up".
export function framesAlong(points, upHint = [0, 1, 0]) {
  return points.map((p, k) => {
    const a = points[Math.max(0, k - 1)], b = points[Math.min(points.length - 1, k + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let up = upHint; if (Math.abs(tx * up[0] + ty * up[1] + tz * up[2]) > 0.95) up = [1, 0, 0];
    let ux = up[1] * tz - up[2] * ty, uy = up[2] * tx - up[0] * tz, uz = up[0] * ty - up[1] * tx; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
    return { p, u: [ux, uy, uz], v: [vx, vy, vz] };
  });
}
// Points on a cubic Bézier
export function bezier(p0, p1, p2, p3, n) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = (1 - t) ** 3, b = 3 * t * (1 - t) ** 2, c = 3 * t * t * (1 - t), d = t ** 3;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1], a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]]);
  }
  return out;
}
export const circle = (r, n, rx = r) => Array.from({ length: n }, (_, k) => [Math.cos((k / n) * Math.PI * 2) * rx, Math.sin((k / n) * Math.PI * 2) * r]);

export function compile(gl, vsSrc, fsSrc) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

function attribs(gl) {
  const S = STRIDE * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 40);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, S, 44);
}

export function upload(gl, mb) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mb.v), gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mb.i), gl.STATIC_DRAW);
  attribs(gl);
  gl.bindVertexArray(null);
  return { vao, count: mb.i.length, vb, ib, tris: mb.i.length / 3 };
}

// Streaming buffer for per-frame effects (light trails, sparks): non-indexed triangles
export function dynamicMesh(gl, maxVerts) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, maxVerts * STRIDE * 4, gl.DYNAMIC_DRAW);
  attribs(gl);
  gl.bindVertexArray(null);
  return { vao, vb, data: new Float32Array(maxVerts * STRIDE), max: maxVerts, count: 0 };
}
