// VELOCITYVERSE client: procedural Lumen Harbor night circuit (temporary art; see README asset list).
// Art direction: a floodlit future-city Grand Prix — glossy track, packed grandstands under glass canopies, needle
// spires, an elevated crossing, neon accents. Everything is generated from the track data, so the scenery always
// matches the simulated geometry. Material ids (see renderer.js):
//  1 asphalt (markings drawn in the shader) · 2 run-off/ground · 3 water · 4 facade windows · 5 emissive
//  6 flowing light strip · 7 crowd · 8 hologram screen · 9 fence mesh (fx) · 10 soft sprite (fx) · 11 ribbon (fx)
//  14 metal · 17 canopy glass · 18 glass curtain wall · 19 floodlit paint · 20 start light (uv.x = light index)
import { MeshBuilder, framesAlong, bezier, circle } from './gfx.js';

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const NEON = {
  cyan: [0.08, 0.86, 1.0], magenta: [1.0, 0.16, 0.74], purple: [0.52, 0.34, 1.0], orange: [1.0, 0.52, 0.14],
  yellow: [1.0, 0.84, 0.3], white: [0.88, 0.94, 1.0], warm: [1.0, 0.86, 0.62], red: [1.0, 0.06, 0.1], blue: [0.2, 0.45, 1.0], green: [0.25, 1.0, 0.6],
};
const n = (c, a) => [c[0], c[1], c[2], a];
const DARK = [0.03, 0.034, 0.045, 0], METAL = [0.16, 0.17, 0.2, 0], CONCRETE = [0.13, 0.135, 0.15, 0], RUNOFF = [0.035, 0.038, 0.05, 0];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const LANES = [-2.0, 2.0];   // dashed lane lines (m from the centreline), drawn by the asphalt shader
export const STAND_ZONE = [40, 412]; // main straight: grandstands and canopies on both sides

export function buildWorld(track) {
  const mb = new MeshBuilder(), fence = new MeshBuilder();
  const N = track.n, hw = track.halfWidth, def = track.def, L = track.length;
  const rnd = mulberry32(20261108);
  const P = (i, d, y) => [track.x[i] + track.nx[i] * d, y, track.z[i] + track.nz[i] * d];
  const inStands = (s) => s > STAND_ZONE[0] && s < STAND_ZONE[1];
  // floodlight positions (outside the canopied straight) → light pools on the asphalt
  const floods = []; for (let s = 450; s < L - 10; s += 64) floods.push({ s, side: floods.length % 2 ? 1 : -1 });
  const pool = (s) => { if (inStands(s)) return 0.85; let b = 1e9; for (const f of floods) { let d = Math.abs(s - f.s); d = Math.min(d, L - d); if (d < b) b = d; } return 0.35 + 0.5 * Math.exp(-((b / 24) ** 2)); };

  // ---- track surface: 8 strips across, rubbered-in racing line in the vertex colour, markings in the shader ----
  const strips = [-hw, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, hw];
  const rowIdx = [];
  for (let i = 0; i < N; i++) {
    const lo = track.lineOffset[i], lit = pool(track.s[i]), row = [];
    for (const d of strips) {
      const rub = Math.exp(-(((d - lo) / 1.4) ** 2)), edge = Math.min(1, Math.abs(d) / hw);
      const g = (0.62 + 0.38 * lit) * (1 - 0.32 * rub) * (1 + 0.08 * edge);
      row.push(mb.vert(...P(i, d, 0), 0, 1, 0, [0.085 * g, 0.09 * g, 0.105 * g, rub], 1, d, track.s[i]));
    }
    rowIdx.push(row);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, A = rowIdx[i], B = rowIdx[j];
    if (j === 0) { // seam: duplicate the first row with s = L so the dashes stay continuous
      const C = strips.map((d, k) => mb.vert(...P(0, d, 0), 0, 1, 0, mb.v.slice(B[k] * 13 + 6, B[k] * 13 + 10), 1, d, L));
      for (let k = 0; k < strips.length - 1; k++) mb.i.push(A[k], A[k + 1], C[k + 1], A[k], C[k + 1], C[k]);
    } else for (let k = 0; k < strips.length - 1; k++) mb.i.push(A[k], A[k + 1], B[k + 1], A[k], B[k + 1], B[k]);
  }

  // ---- curbs, run-off, barriers, catch fence ----
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, si = track.s[i], sj = j === 0 ? L : track.s[j];
    for (const side of [-1, 1]) {
      const curbI = side > 0 ? track.curbR[i] : track.curbL[i], curbJ = side > 0 ? track.curbR[j] : track.curbL[j];
      const rampI = side > 0 ? track.curbRampR[i] : track.curbRampL[i], rampJ = side > 0 ? track.curbRampR[j] : track.curbRampL[j];
      let edge = hw;
      if (curbI || curbJ) {
        const hI = def.curbHeight * (curbI ? rampI : 0) * 4, hJ = def.curbHeight * (curbJ ? rampJ : 0) * 4, w = def.curbWidth;
        const col = (Math.floor(si / 2) % 2 === 0) ? [0.82, 0.05, 0.1, 0] : [0.86, 0.88, 0.9, 0];
        mb.quad(P(i, side * hw, 0.004), P(i, side * (hw + 0.25), hI + 0.004), P(j, side * (hw + 0.25), hJ + 0.004), P(j, side * hw, 0.004), col, 19);
        mb.quad(P(i, side * (hw + 0.25), hI + 0.004), P(i, side * (hw + w), hI + 0.004), P(j, side * (hw + w), hJ + 0.004), P(j, side * (hw + 0.25), hJ + 0.004), col, 19, [0, 1, 0]);
        edge = hw + w;
      }
      const bI = side > 0 ? track.barrierR[i] : track.barrierL[i], bJ = side > 0 ? track.barrierR[j] : track.barrierL[j];
      mb.quad(P(i, side * edge, 0.002), P(i, side * (bI - 0.5), 0.002), P(j, side * (bJ - 0.5), 0.002), P(j, side * edge, 0.002), RUNOFF, 2, [0, 1, 0]);
      mb.quad(P(i, side * (bI - 0.5), 0.004), P(i, side * (bI - 0.3), 0.004), P(j, side * (bJ - 0.3), 0.004), P(j, side * (bJ - 0.5), 0.004), n(NEON.cyan, 0.45), 5, [0, 1, 0]);
      // barrier wall (floodlit concrete), its light strip and cap
      mb.quad(P(i, side * bI, 0), P(i, side * bI, 1.05), P(j, side * bJ, 1.05), P(j, side * bJ, 0), CONCRETE, 19);
      const flowCol = n(side < 0 ? NEON.cyan : NEON.blue, 0.5);
      mb.quad(P(i, side * (bI - 0.015), 0.62), P(i, side * (bI - 0.015), 0.72), P(j, side * (bJ - 0.015), 0.72), P(j, side * (bJ - 0.015), 0.62), flowCol, 6, null, [[side, si], [side, si], [side, sj], [side, sj]]);
      mb.quad(P(i, side * (bI - 0.02), 1.05), P(i, side * (bI + 0.35), 1.05), P(j, side * (bJ + 0.35), 1.05), P(j, side * (bJ - 0.02), 1.05), METAL, 14, [0, 1, 0]);
      if (i % 2 === 0) { const p = P(i, side * (bI + 0.12), 0); mb.box(p[0], 2.05, p[2], 0.08, 2.0, 0.08, METAL, 14); }
      fence.quad(P(i, side * (bI + 0.12), 1.1), P(j, side * (bJ + 0.12), 1.1), P(j, side * (bJ + 0.12), 3.05), P(i, side * (bI + 0.12), 3.05), n([0.55, 0.7, 0.9], 1), 9, null, [[si, 0], [sj, 0], [sj, 1], [si, 1]]);
    }
  }
  for (const side of [-1, 1]) for (let i = 0; i < N; i++) { // fence top rail
    const j = (i + 1) % N, bI = side > 0 ? track.barrierR[i] : track.barrierL[i], bJ = side > 0 ? track.barrierR[j] : track.barrierL[j];
    mb.quad(P(i, side * (bI + 0.1), 3.05), P(j, side * (bJ + 0.1), 3.05), P(j, side * (bJ + 0.1), 3.12), P(i, side * (bI + 0.1), 3.12), METAL, 14);
  }

  // ---- start/finish: chequered line, grid slots, gantry with five start lights and a screen ----
  const sp = track.pointAt(def.lineS, 0, {}), si0 = sp.i;
  const at = (dd, dz, y) => [sp.x + track.nx[si0] * dd + track.tx[si0] * dz, y, sp.z + track.nz[si0] * dd + track.tz[si0] * dz];
  for (let row = 0; row < 2; row++) for (let k = 0; k < 24; k++) {
    const white = (row + k) % 2 === 0, x0 = -hw + k * 0.5;
    mb.quad(at(x0, row * 0.5, 0.008), at(x0 + 0.5, row * 0.5, 0.008), at(x0 + 0.5, row * 0.5 + 0.5, 0.008), at(x0, row * 0.5 + 0.5, 0.008), white ? [0.9, 0.92, 0.95, 0] : [0.02, 0.02, 0.025, 0], 19, [0, 1, 0]);
  }
  for (let k = 0; k < 8; k++) { // grid boxes for the race start (pole on the left)
    const gp = track.pointAt(def.lineS - 20 - k * 8, 0, {}), gi = gp.i, off = k % 2 ? 2.2 : -2.2;
    const g = (dd, dz) => [gp.x + track.nx[gi] * (off + dd) + track.tx[gi] * dz, 0.007, gp.z + track.nz[gi] * (off + dd) + track.tz[gi] * dz];
    const W = [0.92, 0.94, 0.97, 0];
    mb.quad(g(-0.9, 2.9), g(0.9, 2.9), g(0.9, 3.05), g(-0.9, 3.05), W, 19, [0, 1, 0]);
    mb.quad(g(-0.9, 2.1), g(-0.75, 2.1), g(-0.75, 3.05), g(-0.9, 3.05), W, 19, [0, 1, 0]);
    mb.quad(g(0.75, 2.1), g(0.9, 2.1), g(0.9, 3.05), g(0.75, 3.05), W, 19, [0, 1, 0]);
  }
  const gL = track.barrierL[si0] + 1.0, gR = track.barrierR[si0] + 1.0;
  for (const dd of [-gL, gR]) { const p = at(dd, 0.3, 0); mb.boxYaw(p[0], 6, p[2], 1.0, 12, 1.2, sp.heading, METAL, 14); const q = at(dd, -0.32, 0); mb.boxYaw(q[0], 6, q[2], 0.12, 12, 0.1, sp.heading, n(NEON.cyan, 0.9), 5); }
  const mid = at((gR - gL) / 2, 0.3, 0);
  mb.boxYaw(mid[0], 10.4, mid[2], gL + gR + 1.0, 1.6, 1.2, sp.heading, DARK, 14);
  { const w = gL + gR - 4, y0 = 11.4, y1 = 14.6, dz = -0.3, o = (gR - gL) / 2;
    mb.quad(at(-w / 2 + o, dz, y0), at(w / 2 + o, dz, y0), at(w / 2 + o, dz, y1), at(-w / 2 + o, dz, y1), n(NEON.white, 1), 8, null, [[0, 0], [1, 0], [1, 1], [0, 1]]); }
  for (let k = 0; k < 5; k++) for (const row of [0, 1]) { // start lights face the grid; lit by the race countdown
    const c = at(-2.4 + k * 1.2 + (gR - gL) / 2, -0.62, 10.15 + row * 0.5), r = 0.2, a = sp.heading;
    const ex = Math.cos(a) * r, ez = -Math.sin(a) * r;
    const v = (u, w2) => mb.vert(c[0] + ex * u, c[1] + r * w2, c[2] + ez * u, -Math.sin(a), 0, -Math.cos(a), [1, 0.05, 0.08, 1], 20, k + 0.5, row);
    const a0 = v(-1, -1), b0 = v(1, -1), c0 = v(1, 1), d0 = v(-1, 1); mb.i.push(a0, b0, c0, a0, c0, d0);
  }

  // ---- pit building (left of the straight, before the line) ----
  {
    const s0 = 18, s1 = 186, p0 = track.pointAt(s0, 0, {}), p1 = track.pointAt(s1, 0, {});
    const off = track.barrierL[p0.i] + 2.0, depth = 22, len = s1 - s0, cz = (p0.z + p1.z) / 2;
    const fx = -(off), bx = -(off + depth);
    // Open garage bays with a real recessed back wall, floor and structural upper storey.
    mb.box((fx + bx) / 2, 6.7, cz, depth, 4.6, len, [0.25, 0.28, 0.31, 0], 19);
    mb.box((fx + bx) / 2, 0.08, cz, depth, 0.16, len, [0.19, 0.21, 0.23, 0], 19);
    mb.box(bx + 0.3, 2.2, cz, 0.6, 4.4, len, [0.11, 0.13, 0.15, 0], 19);
    mb.box(fx - 3.8, 2.2, cz, 0.25, 4.4, len, [0.13, 0.15, 0.17, 0], 19);
    for (let k = 0; k < 14; k++) { // garages: lit interiors with a team-colour header
      const z0 = p0.z + 4 + k * (len - 8) / 14, z1 = z0 + (len - 8) / 14 - 1.2, team = [NEON.cyan, NEON.magenta, NEON.orange, NEON.purple, NEON.green, NEON.yellow, NEON.blue][k % 7];
      mb.quad([fx - 3.65, 0.2, z0], [fx - 3.65, 0.2, z1], [fx - 3.65, 3.6, z1], [fx - 3.65, 3.6, z0], [0.38, 0.29, 0.17, 0.10], 5, [1, 0, 0]);
      mb.quad([fx + 0.03, 3.75, z0], [fx + 0.03, 3.75, z1], [fx + 0.03, 4.15, z1], [fx + 0.03, 4.15, z0], n(team, 0.18), 5, [1, 0, 0]);
      mb.box(fx + 0.1, 2.2, z0 - 0.25, 0.7, 4.4, 0.5, [0.35, 0.37, 0.39, 0], 19);
      mb.box(fx - 0.6, 3.9, (z0 + z1) / 2, 2.1, 0.12, z1 - z0, [0.37, 0.39, 0.41, 0], 14);
      mb.box(fx - 2.7, 0.8, z0 + 1.8, 1.1, 1.5, 1.8, [0.10, 0.12, 0.14, 0], 14);
      mb.box(fx - 2.0, 0.45, z1 - 1.1, 1.3, 0.9, 1.3, [0.055, 0.06, 0.065, 0], 13);
    }
    mb.quad([fx + 0.02, 4.6, p0.z + 2], [fx + 0.02, 4.6, p1.z - 2], [fx + 0.02, 8.4, p1.z - 2], [fx + 0.02, 8.4, p0.z + 2], [0.05, 0.08, 0.12, 0.31], 18, [1, 0, 0], [[0, 4.6], [len, 4.6], [len, 8.4], [0, 8.4]]);
    mb.box(fx + 0.2, 9.05, cz, 0.4, 0.12, len, n(NEON.cyan, 0.18), 5);
    mb.quad([fx + 0.05, 9.5, cz - 26], [fx + 0.05, 9.5, cz + 26], [fx + 0.05, 15.5, cz + 26], [fx + 0.05, 15.5, cz - 26], n(NEON.white, 1), 8, [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }

  // ---- grandstands (crowd lights) and glass canopies along the main straight ----
  const stand = (s0, s1, side, tiers, canopy) => {
    const step = 5;
    for (let s = s0; s < s1; s += step) {
      const p = track.pointAt(s, 0, {}), q = track.pointAt(Math.min(s + step, s1), 0, {});
      const b = (side < 0 ? track.barrierL[p.i] : track.barrierR[p.i]) + 3.2;
      const aisle = Math.floor((s - s0) / step) % 5 === 0;
      const V = (along, dd, yy) => [p.x + track.tx[p.i] * along + track.nx[p.i] * dd, yy, p.z + track.tz[p.i] * along + track.nz[p.i] * dd];
      for (let t = 0; t < tiers; t++) {
        const d0 = side * (b + t * 1.15), d1 = side * (b + t * 1.15 + 1.15), y = 0.9 + t * 0.72;
        const A = [p.x + track.nx[p.i] * d0, y, p.z + track.nz[p.i] * d0], B = [q.x + track.nx[q.i] * d0, y, q.z + track.nz[q.i] * d0];
        const C = [q.x + track.nx[q.i] * d1, y, q.z + track.nz[q.i] * d1], D = [p.x + track.nx[p.i] * d1, y, p.z + track.nz[p.i] * d1];
        // Actual stair treads and risers, with alternating dark-blue seating rows.
        mb.quad(A, B, C, D, [0.21,0.23,0.25,0],19,[0,1,0]);
        mb.quad(C,D,[D[0],y+0.72,D[2]],[C[0],y+0.72,C[2]],[0.13,0.15,0.17,0],19);
        if (aisle) {
          mb.quad(V(1.6,d0,y+0.006),V(2.1,d0,y+0.006),V(2.1,d0+side*0.12,y+0.006),V(1.6,d0+side*0.12,y+0.006),[0.65,0.63,0.48,0],19,[0,1,0]);
          continue;
        }
        const seatD = d0 + side * 0.55;
        const SC = t % 3 ? [0.055,0.12,0.18,0] : [0.12,0.19,0.23,0];
        mb.quad(V(0,seatD-side*0.22,y+0.18),V(step,seatD-side*0.22,y+0.18),V(step,seatD+side*0.22,y+0.18),V(0,seatD+side*0.22,y+0.18),SC,19,[0,1,0]);
        mb.quad(V(0,seatD+side*0.25,y+0.16),V(step,seatD+side*0.25,y+0.16),V(step,seatD+side*0.25,y+0.56),V(0,seatD+side*0.25,y+0.56),SC,19);
        // Crossed upright silhouettes retain people-shaped depth at grazing view
        // angles without thousands of separate draw calls or full character rigs.
        if (t % 2 === 0) for (let j=0;j<4;j++) {
          const seed=(Math.sin((s+j*3.7+t*17.4)*1.73)*43758.5453)%1;
          const u=0.58+j*1.18, yy=y+0.18, dd=seatD;
          const CC=[[0.27,0.32,0.37,0],[0.42,0.20,0.14,0],[0.20,0.29,0.34,0],[0.45,0.40,0.30,0],[0.10,0.13,0.19,0]][Math.abs(Math.floor(seed*77))%5];
          const skin = Math.abs(seed)>0.5 ? [0.53,0.36,0.24,0] : [0.73,0.54,0.39,0];
          mb.quad(V(u-0.18,dd-side*0.10,yy+0.15),V(u+0.18,dd-side*0.10,yy+0.15),V(u+0.23,dd-side*0.10,yy+0.65),V(u-0.23,dd-side*0.10,yy+0.65),CC,19);
          mb.quad(V(u,dd-side*0.16,yy+0.15),V(u,dd+side*0.16,yy+0.15),V(u,dd+side*0.13,yy+0.65),V(u,dd-side*0.13,yy+0.65),CC,19);
          mb.quad(V(u-0.10,dd-side*0.10,yy+0.67),V(u+0.10,dd-side*0.10,yy+0.67),V(u+0.10,dd-side*0.10,yy+0.88),V(u-0.10,dd-side*0.10,yy+0.88),skin,24);
          mb.quad(V(u,dd-side*0.10,yy+0.67),V(u,dd+side*0.10,yy+0.67),V(u,dd+side*0.10,yy+0.88),V(u,dd-side*0.10,yy+0.88),skin,24);
          if (j===Math.abs(Math.floor(seed*11))%4 && t%4===0) mb.quad(V(u+0.23,dd-side*0.18,yy+0.59),V(u+0.31,dd-side*0.18,yy+0.59),V(u+0.31,dd-side*0.18,yy+0.71),V(u+0.23,dd-side*0.18,yy+0.71),n(NEON.warm,0.16),5);
        }
      }
      const back = side * (b + tiers * 1.15 + 0.4);
      mb.quad([p.x + track.nx[p.i] * back, 0, p.z + track.nz[p.i] * back], [q.x + track.nx[q.i] * back, 0, q.z + track.nz[q.i] * back], [q.x + track.nx[q.i] * back, 1.0 + tiers * 0.72, q.z + track.nz[q.i] * back], [p.x + track.nx[p.i] * back, 1.0 + tiers * 0.72, p.z + track.nz[p.i] * back], [0.04, 0.045, 0.06, 0], 0);
      const lip = side * (b - 0.3); // glowing balustrade at the front
      mb.quad([p.x + track.nx[p.i] * lip, 1.0, p.z + track.nz[p.i] * lip], [q.x + track.nx[q.i] * lip, 1.0, q.z + track.nz[q.i] * lip], [q.x + track.nx[q.i] * lip, 1.12, q.z + track.nz[q.i] * lip], [p.x + track.nx[p.i] * lip, 1.12, p.z + track.nz[p.i] * lip], n(NEON.blue, 0.7), 5);
    }
    if (!canopy) return;
    // canopy: a curved glass wing cantilevered over the track, thick edge beam, organic support ribs
    const prof = (t) => { const sw = Math.sin(Math.PI * t); return [[25, 13], [23, 20.5], [18, 26.5], [11, 30], [4, 30.8], [-1.5, 29.4], [-4 - 2.5 * sw, 27 + 1.5 * sw]]; };
    const rows = [], cnt = Math.round((s1 - s0) / 6);
    for (let k = 0; k <= cnt; k++) {
      const t = k / cnt, s = s0 + (s1 - s0) * t, p = track.pointAt(s, 0, {}), b = (side < 0 ? track.barrierL[p.i] : track.barrierR[p.i]) + 3.2;
      const taper = Math.min(1, Math.sin(Math.PI * t) * 3.5), pr = prof(t);
      rows.push(pr.map(([u, y]) => { const uu = 25 + (u - 25) * (0.25 + 0.75 * taper), yy = 13 + (y - 13) * (0.55 + 0.45 * taper); return [p.x + track.nx[p.i] * side * (b + uu), yy, p.z + track.nz[p.i] * side * (b + uu), s]; }));
    }
    const dn = (a) => [a[0], a[1] - 0.9, a[2]];
    for (let k = 0; k < rows.length - 1; k++) for (let e = 0; e < rows[k].length - 1; e++) {
      const a = rows[k][e], b2 = rows[k + 1][e], c = rows[k + 1][e + 1], d = rows[k][e + 1];
      const arc0 = e * 6, arc1 = (e + 1) * 6;
      mb.quad(a.slice(0, 3), b2.slice(0, 3), c.slice(0, 3), d.slice(0, 3), [0.03, 0.06, 0.12, 0], 17, null, [[a[3], arc0], [b2[3], arc0], [c[3], arc1], [d[3], arc1]]);
      mb.quad(dn(a), dn(d), dn(c), dn(b2), [0.02, 0.05, 0.11, 1], 17, null, [[a[3], arc0], [d[3], arc1], [c[3], arc1], [b2[3], arc0]]);
    }
    for (let k = 2; k < rows.length - 1; k += 3) {
      const spine = rows[k].map(a => [a[0], a[1]-1.0, a[2]]);
      mb.sweep(framesAlong(spine),circle(0.075,5),[0.19,0.25,0.31,0],14,true,false);
    }
    const tip = rows.map((r) => r[r.length - 1].slice(0, 3));
    mb.sweep(framesAlong(tip), circle(0.55, 10, 0.75), [0.05, 0.06, 0.08, 0], 14, true, true);
    mb.sweep(framesAlong(tip.map(([x, y, z]) => [x, y - 0.62, z])), circle(0.09, 6), [...NEON.cyan, 0.95], 5, true, false);
    for (let k = 2; k < rows.length - 2; k += 4) { // ribs from the ground behind the stand up into the roof
      const r = rows[k], base = r[0], top = r[3];
      const g = [base[0] + (base[0] - top[0]) * 0.18, 0, base[2] + (base[2] - top[2]) * 0.18];
      mb.sweep(framesAlong(bezier(g, [g[0], 9, g[2]], [base[0], 18, base[2]], [top[0], top[1] - 0.6, top[2]], 10)), circle(0.42, 8), METAL, 14, true, false);
    }
  };
  stand(196, 410, -1, 15, true);
  stand(44, 410, 1, 15, true);
  { const hp = track.segments.find((g) => g.kind !== 'S' && g.R <= 35); if (hp) stand(hp.s0 - 70, hp.s0 - 5, -hp.dir, 10, false); }

  // ---- floodlight towers around the rest of the lap ----
  for (const f of floods) {
    const p = track.pointAt(f.s, 0, {}), b = (f.side > 0 ? track.barrierR[p.i] : track.barrierL[p.i]) + 5;
    const x = p.x + track.nx[p.i] * f.side * b, z = p.z + track.nz[p.i] * f.side * b;
    mb.box(x, 13, z, 0.5, 26, 0.5, METAL, 14);
    const a = p.heading + (f.side > 0 ? -Math.PI / 2 : Math.PI / 2);
    mb.boxYaw(x - track.nx[p.i] * f.side * 0.4, 26.2, z - track.nz[p.i] * f.side * 0.4, 3.6, 1.6, 0.3, a, DARK, 14);
    mb.boxYaw(x - track.nx[p.i] * f.side * 0.58, 26.2, z - track.nz[p.i] * f.side * 0.58, 3.3, 1.3, 0.05, a, n(NEON.white, 1), 5);
  }

  // ---- LED arches on the back straight: a tunnel of light for speed perception ----
  for (let s = 1080; s < 1480; s += 100) {
    const p = track.pointAt(s, 0, {}), bL = track.barrierL[p.i] + 0.8, bR = track.barrierR[p.i] + 0.8;
    const Ra = (bL + bR) / 2, off = (bR - bL) / 2, tx = track.tx[p.i], tz = track.tz[p.i], nx = track.nx[p.i], nz = track.nz[p.i], seg = 30;
    const pt = (phi, rr, dz) => { const l = off - rr * Math.cos(phi); return [p.x + nx * l + tx * dz, rr * Math.sin(phi) * 0.78, p.z + nz * l + tz * dz]; };
    for (let k = 0; k < seg; k++) {
      const f0 = (k / seg) * Math.PI, f1 = ((k + 1) / seg) * Math.PI, t = k / seg;
      const col = t < 0.5 ? mixc(NEON.cyan, NEON.purple, t * 2) : mixc(NEON.purple, NEON.magenta, (t - 0.5) * 2);
      mb.quad(pt(f0, Ra, -0.18), pt(f1, Ra, -0.18), pt(f1, Ra, 0.18), pt(f0, Ra, 0.18), n(col, 0.8), 5);
      mb.quad(pt(f0, Ra + 0.7, -0.3), pt(f1, Ra + 0.7, -0.3), pt(f1, Ra + 0.7, 0.3), pt(f0, Ra + 0.7, 0.3), METAL, 14);
    }
  }

  // ---- braking boards (stripes = 150 / 100 / 50 m) ----
  for (const g of track.segments) {
    if (g.kind === 'S' || g.R > 130) continue;
    let vIn = 0, vMin = 1e9;
    for (let ds = 100; ds <= 250; ds += 10) vIn = Math.max(vIn, track.lineSpeedAt(g.s0 - ds));
    for (let ds = 0; ds <= g.len; ds += 5) vMin = Math.min(vMin, track.lineSpeedAt(g.s0 + ds));
    if (vIn - vMin < 12) continue;
    const side = g.dir > 0 ? -1 : 1;
    [150, 100, 50].forEach((dist, k) => {
      const p = track.pointAt(g.s0 - dist, 0, {}), b = (side > 0 ? track.barrierR[p.i] : track.barrierL[p.i]) + 1.2;
      const x = p.x + track.nx[p.i] * side * b, z = p.z + track.nz[p.i] * side * b;
      mb.boxYaw(x, 1.9, z, 1.8, 1.9, 0.15, p.heading, DARK, 14);
      for (let st = 0; st < 3 - k; st++) mb.boxYaw(x, 1.3 + st * 0.5, z, 1.5, 0.16, 0.2, p.heading, n(NEON.white, 0.7), 5);
    });
  }

  // ---- elevated crossing: an S-curved bridge over the end of the main straight ----
  {
    const pts = bezier([-330, 15, 120], [-90, 21, 260], [110, 21, 180], [330, 15, 330], 48);
    const fr = framesAlong(pts);
    mb.sweep(fr, [[-7, 0], [7, 0], [7.4, -0.5], [6.6, -1.6], [-6.6, -1.6], [-7.4, -0.5]], [0.06, 0.065, 0.08, 0], 14, true, true);
    for (const sx of [-1, 1]) {
      mb.sweep(fr.map((F) => ({ p: [F.p[0] + F.u[0] * sx * 7.1, F.p[1] + 0.55, F.p[2] + F.u[2] * sx * 7.1], u: F.u, v: F.v })), circle(0.1, 6), [...(sx < 0 ? NEON.cyan : NEON.magenta), 0.95], 5, true, false);
      mb.sweep(fr.map((F) => ({ p: [F.p[0] + F.u[0] * sx * 6.9, F.p[1] - 1.7, F.p[2] + F.u[2] * sx * 6.9], u: F.u, v: F.v })), circle(0.07, 6), [...NEON.blue, 0.8], 5, true, false);
    }
    for (let k = 4; k < pts.length - 2; k += 5) { // pylons only where they stand clear of the circuit
      const [x, y, z] = pts[k], pr = track.project(x, z, -1, {});
      if (Math.sqrt(pr.dist2) < Math.max(track.barrierOffset(pr), hw) + 3) continue;
      mb.sweep(framesAlong([[x, 0, z], [x, y - 1.6, z]]), circle(1.1, 10), CONCRETE, 19, true, false);
      mb.box(x + 1.12, (y - 1.6) / 2, z, 0.08, y - 1.8, 0.08, n(NEON.cyan, 0.7), 5);
    }
  }

  // ---- multiverse set pieces: vertical loop in the infield, helix tower, floating platforms ----
  const ribbon = (pts, width, sideFn) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a0 = pts[k], a1 = pts[k + 1], s0 = sideFn(k, a0), s1 = sideFn(k + 1, a1);
      const off = (p, s, f) => [p[0] + s[0] * f, p[1] + s[1] * f, p[2] + s[2] * f];
      const L0 = off(a0, s0, -width / 2), R0 = off(a0, s0, width / 2), L1 = off(a1, s1, -width / 2), R1 = off(a1, s1, width / 2);
      mb.quad(L0, R0, R1, L1, [0.05, 0.055, 0.075, 0], 14);
      mb.quad(L0, L1, off(L1, s1, 0.35), off(L0, s0, 0.35), n(NEON.cyan, 0.85), 5);
      mb.quad(R0, R1, off(R1, s1, -0.35), off(R0, s0, -0.35), n(NEON.purple, 0.85), 5);
    }
  };
  { const cx = 250, cz = 30, R = 40, pts = [];
    for (let k = 0; k <= 72; k++) { const t = (k / 72) * Math.PI * 2; pts.push([cx + (k / 72 - 0.5) * 14, R + 6 - Math.cos(t) * R, cz + Math.sin(t) * R]); }
    ribbon(pts, 11, () => [1, 0, 0]); mb.box(cx, 3, cz, 6, 6, 18, METAL, 14); }
  { const cx = -430, cz = 160, R = 70, pts = [];
    for (let k = 0; k <= 160; k++) { const t = (k / 160) * Math.PI * 5; pts.push([cx + Math.cos(t) * R, 30 + k * 1.3, cz + Math.sin(t) * R]); }
    ribbon(pts, 10, (k, p) => { const dx = p[0] - cx, dz = p[2] - cz, l = Math.hypot(dx, dz); return [dx / l, 0, dz / l]; });
    mb.loftY(cx, cz, 0.4, [[0, 26, 26, 2], [180, 22, 22, 2], [250, 12, 12, 2], [262, 1, 1, 2]], 20, [0.05, 0.06, 0.09, 0], 18, [0.04, 0.07, 0.12, 0.77]);
    mb.box(cx, 290, cz, 1.2, 50, 1.2, n(NEON.magenta, 1), 5); }
  const clear = (x, z, r) => {
    if (x > 560) return false;
    const pr = track.project(x, z, -1, {});
    return Math.sqrt(pr.dist2) > Math.max(track.barrierOffset(pr), hw + 8) + 30 + r;
  };
  for (let k = 0; k < 7; k++) {
    const ang = rnd() * Math.PI * 2, r = 90 + rnd() * 150, x = 250 + Math.cos(ang) * r, z = 20 + Math.sin(ang) * r * 1.2, y = 50 + rnd() * 60, R = 8 + rnd() * 7;
    if (!clear(x, z, R)) continue;
    for (let e = 0; e < 6; e++) {
      const a0 = (e / 6) * Math.PI * 2, a1 = ((e + 1) / 6) * Math.PI * 2;
      const A = [x + Math.cos(a0) * R, y, z + Math.sin(a0) * R], B = [x + Math.cos(a1) * R, y, z + Math.sin(a1) * R];
      mb.quad([x, y + 0.7, z], [A[0], y + 0.7, A[2]], [B[0], y + 0.7, B[2]], [x, y + 0.7, z], [0.05, 0.055, 0.08, 0], 14);
      mb.quad(A, B, [B[0], y + 0.7, B[2]], [A[0], y + 0.7, A[2]], n(k % 2 ? NEON.cyan : NEON.purple, 0.85), 5);
      mb.quad([x, y - 2.5, z], A, B, [x, y - 2.5, z], [0.03, 0.035, 0.05, 0], 0);
    }
    mb.quad([x - R * 0.7, y + 0.8, z], [x + R * 0.7, y + 0.8, z], [x + R * 0.7, y + 0.8 + R * 0.8, z], [x - R * 0.7, y + 0.8 + R * 0.8, z], n(NEON.white, 1), 8, null, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }

  // ---- Lumen Harbor architecture: track-facing city blocks, setbacks, real facade depth ----
  // Geometry stays batched in the world mesh. Near buildings have slabs/mullions,
  // lobby recesses and roof plant; distant towers rely on the window shader.
  const beacon = (x, y, z) => mb.box(x, y, z, 0.45, 0.45, 0.45, n(NEON.red, 0.35), 5);
  const lots = [];
  const reservedLandmarks = [
    [-430,160,88], [250,30,51], // helix and loop footprints
    [-150,760,31], [70,860,38], [250,720,27], [-330,980,34],
    [360,1020,30], [-40,1180,42], [170,1350,29], [-560,760,25],
    [520,880,28], [-260,1450,34],
    [555,470,29], [570,330,29], [575,120,29], [580,-120,29],
  ];
  const concrete = [0.32, 0.34, 0.35, 0], stone = [0.43, 0.40, 0.35, 0], frames = [0.12, 0.15, 0.18, 0];
  const groundSafe = (x, z, margin = 5) => {
    if (x > 590) return false; // preserve the waterline
    const pr = track.project(x, z, -1, {});
    return Math.sqrt(pr.dist2) > Math.max(track.barrierOffset(pr), hw) + margin;
  };
  const lotSafe = (x, z, w, d, yaw) => {
    const co = Math.cos(yaw), sy = Math.sin(yaw), r = Math.hypot(w, d) / 2 + 3;
    for (const [rx, rz, rr] of reservedLandmarks) if (Math.hypot(x - rx, z - rz) < r + rr) return false;
    for (const old of lots) if (Math.hypot(x - old.x, z - old.z) < r + old.r) return false;
    // Sample the complete footprint, including edge midpoints and interior: a
    // tower beside one straight must never intersect a different part of the lap.
    const cols = Math.max(2, Math.ceil(w / 7)), rows = Math.max(2, Math.ceil(d / 7));
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
      const xx = -w / 2 + w * i / cols, zz = -d / 2 + d * j / rows;
      if (!groundSafe(x + co * xx + sy * zz, z - sy * xx + co * zz, 7)) return false;
    }
    lots.push({ x, z, r }); return true;
  };
  const architecture = (x, z, w, d, h, yaw, seed, detail = true) => {
    const sy = Math.sin(yaw), co = Math.cos(yaw);
    const B = (lx, y, lz, sx, hh, sz, col, mat = 19, sideMat = mat, sideCol = col) =>
      mb.boxYaw(x + co * lx + sy * lz, y, z - sy * lx + co * lz, sx, hh, sz, yaw, col, mat, sideMat, sideCol);
    const variant = Math.floor(seed * 11) % 4;
    const shell = variant === 0 ? stone : concrete;
    const glass = variant === 2 ? [0.14, 0.21, 0.25, seed] : [0.10, 0.16, 0.22, seed];
    const podiumH = detail ? 8.4 : 4.2;
    // A broad street plinth provides a human-scale base beneath the tower.
    B(0, 0.15, 0, w + 3, 0.3, d + 3, [0.27, 0.28, 0.28, 0]);
    B(0, podiumH / 2, 0, w, podiumH, d, shell, 19, 18, glass);
    B(0, podiumH + 0.2, 0, w + 0.9, 0.4, d + 0.9, shell);
    // Floor band behind an inset glass lobby and deep entrance canopies.
    if (detail) {
      for (const side of [-1, 1]) {
        B(side * (w / 2 + 0.55), 3.4, 0, 1.3, 0.26, Math.min(14, d * 0.65), frames, 14);
        B(side * (w / 2 + 0.05), 1.65, 0, 0.11, 2.9, Math.min(10, d * 0.5), [0.56, 0.42, 0.24, 0.15], 5);
        for (let j = -d / 2 + 2; j < d / 2; j += 5.2) B(side * (w / 2 + 0.10), 3.9, j, 0.24, 7.8, 0.30, shell);
        B(side * (w / 2 + 0.16), 6.9, 0, 0.10, 0.20, Math.min(12, d * 0.6), n(NEON.cyan, 0.13), 5);
      }
      B(0, 4.3, 0, w + 0.25, 0.3, d + 0.25, shell);
    }
    const tw = w * (variant === 1 ? 0.76 : 0.84), td = d * (variant === 3 ? 0.68 : 0.85);
    const towerH = h - podiumH;
    B(0, podiumH + towerH / 2, 0, tw, towerH, td, frames, 14, variant === 0 ? 4 : 18, glass);
    // Thin extruded floor plates and vertical fins read as structure in silhouette
    // and at grazing angles, instead of a flat box covered in random white pixels.
    if (detail) {
      for (let y = podiumH + 4; y < h; y += 4.0) {
        B(0, y, 0, tw + 0.42, 0.20, td + 0.42, variant === 0 ? shell : frames, variant === 0 ? 19 : 14);
      }
      for (const side of [-1, 1]) {
        for (let j = -td / 2; j <= td / 2 + 0.1; j += 3.6) B(side * (tw / 2 + 0.10), podiumH + towerH / 2, j, 0.22, towerH, 0.22, frames, 14);
        for (let j = -tw / 2; j <= tw / 2 + 0.1; j += 3.6) B(j, podiumH + towerH / 2, side * (td / 2 + 0.10), 0.22, towerH, 0.22, frames, 14);
      }
    }
    // Mechanical crown: parapet, cooling boxes, screened plant and aerials.
    B(0, h + 0.35, 0, tw + 0.6, 0.7, td + 0.6, shell);
    B(0, h + 2.1, 0, tw * 0.55, 3.0, td * 0.52, [0.17, 0.19, 0.21, 0], 14);
    if (detail) {
      for (const side of [-1, 1]) {
        B(side * tw * 0.2, h + 4.0, 0, 3.2, 1.3, 4.0, [0.34, 0.36, 0.37, 0], 14);
        for (let j = -1; j <= 1; j++) B(side * tw * 0.2, h + 4.7, j * 1.2, 2.8, 0.12, 0.25, frames, 14);
      }
    }
    if (h > 70) {
      B(0, h + 6.8, 0, 0.16, 7.5, 0.16, frames, 14);
      beacon(x, h + 10.6, z);
    }
    // One quiet architectural crown light; no full-height neon cage.
    if (variant !== 0) B(0, h + 0.8, 0, tw + 0.7, 0.12, td + 0.7, n(seed > 0.5 ? NEON.cyan : NEON.warm, 0.12), 5);
  };
  let frontageCount = 0;
  for (let ss = 25; ss < L; ss += 48) for (const side of [-1, 1]) {
    const p = track.pointAt(ss, 0, {}), barrier = side > 0 ? track.barrierR[p.i] : track.barrierL[p.i];
    const w = 14 + rnd() * 10, d = 25 + rnd() * 13;
    // Leave the main-straight canopies and stands unobstructed.
    const setback = inStands(ss) ? 49 : 19;
    const off = barrier + setback + w / 2;
    const x = p.x + track.nx[p.i] * side * off, z = p.z + track.nz[p.i] * side * off;
    // A continuous low-rise waterfront opening lets the harbor cranes, water
    // and distant skyline read beside the long back straight.
    if (x > 520 && z > -240 && z < 350) continue;
    if (!lotSafe(x, z, w + 3, d + 3, p.heading)) continue;
    const h = 28 + rnd() * 82;
    architecture(x, z, w, d, h, p.heading, rnd(), true); frontageCount++;
  }
  // A second, staggered architectural layer adds density beyond the road frontage.
  let placed = 0;
  for (let k = 0; k < 1600 && placed < 115; k++) {
    const x = -920 + rnd() * 1480, z = -820 + rnd() * 1610, w = 20 + rnd() * 30, d = 22 + rnd() * 32;
    const pr = track.project(x, z, -1, {}), dist = Math.sqrt(pr.dist2), yaw = Math.atan2(track.tx[pr.i], track.tz[pr.i]);
    if (dist < 75 || (x > 520 && z > -240 && z < 350) || !lotSafe(x, z, w + 3, d + 3, yaw)) continue;
    architecture(x, z, w, d, 55 + rnd() * 140, yaw, rnd(), dist < 150); placed++;
  }

  // ---- inhabited track edges: paving, trees, benches, lamp posts and service equipment ----
  const tree = (x, z, scale) => {
    mb.box(x, 1.9 * scale, z, 0.28 * scale, 3.8 * scale, 0.28 * scale, [0.22, 0.17, 0.12, 0], 19);
    // Three overlapping faceted ellipsoids make an irregular, readable canopy.
    for (let j = 0; j < 3; j++) {
      const dx = Math.cos(j * 2.4) * 0.7 * scale, dz = Math.sin(j * 2.4) * 0.7 * scale, y = (3.2 + j * 0.45) * scale;
      mb.loftY(x + dx, z + dz, j, [[y - 1.25 * scale, 0.22 * scale, 0.21 * scale, 2], [y - 0.70 * scale, 1.20 * scale, 1.03 * scale, 2], [y, 1.52 * scale, 1.29 * scale, 2], [y + 0.72 * scale, 1.14 * scale, 1.02 * scale, 2], [y + 1.28 * scale, 0.20 * scale, 0.18 * scale, 2]], 10, [0.12 + j * 0.025, 0.23 + j * 0.02, 0.15, 0], 23);
    }
  };
  for (let ss = 18; ss < L; ss += 19) for (const side of [-1, 1]) {
    if (inStands(ss)) continue;
    const p = track.pointAt(ss, 0, {}), barrier = side > 0 ? track.barrierR[p.i] : track.barrierL[p.i];
    const off = barrier + 5, x = p.x + track.nx[p.i] * side * off, z = p.z + track.nz[p.i] * side * off;
    if (!groundSafe(x, z, 3.8)) continue;
    mb.boxYaw(x, 0.09, z, 5.8, 0.18, 14.5, p.heading, [0.30, 0.31, 0.32, 0], 19);
    if (Math.floor(ss / 19) % 3 === 0) {
      const tx = x + track.nx[p.i] * side * 1.2, tz = z + track.nz[p.i] * side * 1.2;
      if (groundSafe(tx, tz, 4)) {
        mb.boxYaw(tx, 0.4, tz, 3.5, 0.65, 3.5, p.heading, concrete, 19);
        tree(tx, tz, 1.0 + rnd() * 0.35);
      }
    } else {
      mb.box(x, 3.6, z, 0.14, 7.2, 0.14, frames, 14);
      mb.boxYaw(x, 7.2, z, 1.8, 0.18, 0.65, p.heading, frames, 14);
      mb.boxYaw(x, 7.08, z, 1.45, 0.06, 0.50, p.heading, n(NEON.warm, 0.25), 5);
      const bx = x + track.nx[p.i] * side * 1.6, bz = z + track.nz[p.i] * side * 1.6;
      mb.boxYaw(bx, 0.65, bz, 0.50, 0.18, 2.4, p.heading, [0.27, 0.20, 0.13, 0], 19);
      mb.boxYaw(bx, 0.35, bz - 0.7, 0.30, 0.65, 0.22, p.heading, frames, 14);
    }
  }

  // Parked race-service vans establish familiar scale outside the safety wall.
  for (let ss = 480; ss < L - 40; ss += 260) {
    const side = Math.floor(ss / 260) % 2 ? 1 : -1, p = track.pointAt(ss, 0, {});
    const off = (side > 0 ? track.barrierR[p.i] : track.barrierL[p.i]) + 10.2;
    const x = p.x + track.nx[p.i] * side * off, z = p.z + track.nz[p.i] * side * off;
    if (!lotSafe(x, z, 2.5, 6.2, p.heading)) continue;
    const sy = Math.sin(p.heading), co = Math.cos(p.heading);
    const B = (lx,y,lz,w,h,d,c,m=19) => mb.boxYaw(x+co*lx+sy*lz,y,z-sy*lx+co*lz,w,h,d,p.heading,c,m);
    B(0,0.92,0,2.15,1.35,5.4,[0.66,0.69,0.70,0],22);
    B(0,1.73,0.15,2.05,0.85,4.8,[0.66,0.69,0.70,0],22);
    B(0,1.75,2.58,1.85,0.66,0.08,[0.04,0.075,0.10,0],15);
    for (const side2 of [-1,1]) {
      B(side2*1.04,1.75,1.7,0.06,0.64,1.55,[0.04,0.075,0.10,0],15);
      for (const zz of [-1.7,1.65]) B(side2*1.04,0.49,zz,0.30,0.90,0.90,[0.025,0.028,0.03,0],13);
      B(side2*0.79,0.97,-2.73,0.23,0.38,0.08,n(NEON.red,0.11),5);
      B(side2*1.09,1.05,-0.65,0.05,0.25,1.8,[0.12,0.31,0.35,0],19);
    }
  }

  // hero needle spires beyond the end of the main straight (the view down the straight looks at them)
  const SPIRES = [[-150, 760, 380, 22], [70, 860, 500, 27], [250, 720, 300, 18], [-330, 980, 430, 24], [360, 1020, 360, 21], [-40, 1180, 560, 30], [170, 1350, 340, 20], [-560, 760, 280, 17], [520, 880, 300, 19], [-260, 1450, 470, 24]];
  for (const [x, z, h, r] of SPIRES) {
    const seed = rnd();
    mb.loftY(x, z, rnd() * 3, [[0, r * 1.2, r * 1.2, 3.2], [h * 0.12, r, r, 3.0], [h * 0.45, r * 0.78, r * 0.78, 2.6], [h * 0.7, r * 0.5, r * 0.5, 2.2], [h * 0.86, r * 0.22, r * 0.22, 2], [h, r * 0.03, r * 0.03, 2]], 16, [0.05, 0.06, 0.09, 0], 18, [0.04, 0.075, 0.13, seed]);
    for (const [f, rr] of [[0.12, r * 1.01], [0.45, r * 0.79], [0.7, r * 0.51], [0.86, r * 0.23]]) mb.loftY(x, z, 0, [[h * f - 0.6, rr + 0.2, rr + 0.2, 2.6], [h * f + 0.6, rr + 0.2, rr + 0.2, 2.6]], 16, n(NEON.cyan, 0.22), 5, n(seed < 0.5 ? NEON.cyan : NEON.white, 0.22));
    mb.box(x, h + 10, z, 0.5, 20, 0.5, n(NEON.white, 0.18), 5); beacon(x, h + 20.5, z);
  }
  for (let k = 0; k < 90; k++) { // distant skyline in the haze
    const ang = (k / 90) * Math.PI * 2, r = 2000 + rnd() * 700, x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    if (x > 700) continue;
    const h = 90 + rnd() * 360, w = 70 + rnd() * 120;
    if (rnd() < 0.3) mb.loftY(x, z, ang, [[0, w / 2, w / 2, 2.4], [h, w * 0.28, w * 0.28, 2.2], [h * 1.25, w * 0.03, w * 0.03, 2]], 10, [0.03, 0.035, 0.06, 0], 18, [0.03, 0.05, 0.09, rnd()]);
    else mb.boxYaw(x, h / 2, z, w, h, w, ang, [0.03, 0.03, 0.06, 0], 0, 4, [0.05, 0.05, 0.09, rnd()]);
    if (rnd() < 0.35) beacon(x, h + 3, z);
  }

  // ---- harbour: quay edge, cranes outlined in light, water; city ground ----
  mb.box(600, -0.3, 100, 2, 1.2, 2200, METAL, 14);
  mb.box(599, 0.32, 100, 0.3, 0.12, 2200, n(NEON.orange, 0.75), 5);
  for (const [x, z] of [[545, 470], [560, 330], [565, 120], [570, -120]]) {
    mb.box(x, 18, z, 2.2, 36, 2.2, METAL, 14); mb.box(x + 14, 36, z, 40, 1.6, 1.6, METAL, 14);
    mb.box(x + 14, 37, z, 40, 0.2, 0.2, n(NEON.orange, 0.85), 5); mb.box(x, 18, z + 1.2, 0.2, 36, 0.2, n(NEON.orange, 0.65), 5);
    beacon(x + 33, 37.2, z);
  }
  // Harbor freight stacks: corrugation, corner castings and staggered containers.
  let freightCount = 0;
  for (let zz = -420; zz < 690; zz += 34) for (const xx of [520, 555]) {
    if (freightCount >= 30) continue;
    if (!lotSafe(xx, zz, 7.5, 14.0, 0)) continue;
    const color = [[0.29,0.16,0.12,0],[0.10,0.24,0.27,0],[0.25,0.29,0.31,0]][freightCount % 3];
    const levels = 1 + (freightCount % 3 ? 1 : 0);
    for (let level = 0; level < levels; level++) {
      const cx = xx + level * 0.25, cy = 1.37 + level * 2.70;
      mb.box(cx,cy,zz,6.2,2.6,12.2,color,19);
      for (const side of [-1,1]) {
        for (let rib = -5.6; rib < 5.8; rib += 0.75) mb.box(cx + side*3.12,cy,zz+rib,0.10,2.52,0.14,color,19);
        mb.box(cx+side*3.12,cy,zz-6.11,0.16,2.65,0.16,[0.34,0.36,0.37,0],14);
        mb.box(cx+side*3.12,cy,zz+6.11,0.16,2.65,0.16,[0.34,0.36,0.37,0],14);
      }
    }
    freightCount++;
  }
  // Thin lattice bracing makes port cranes read as engineered steel rather than boxes.
  for (const [x,z] of [[545,470],[560,330],[565,120],[570,-120]]) {
    for (const side of [-1,1]) for (let y=2;y<34;y+=6) {
      const A=[x-1.1,y,z+side*1.15], B=[x+1.1,y+6,z+side*1.15];
      mb.sweep(framesAlong([A,B]),circle(0.09,4),[0.27,0.30,0.32,0],14,true,false);
      mb.sweep(framesAlong([[x+1.1,y,z+side*1.15],[x-1.1,y+6,z+side*1.15]]),circle(0.09,4),[0.27,0.30,0.32,0],14,true,false);
    }
    mb.sweep(framesAlong([[x-5,29,z],[x+28,36,z]]),circle(0.09,4),[0.27,0.30,0.32,0],14,true,false);
    mb.box(x+27,25.2,z,0.055,20.8,0.055,[0.17,0.19,0.20,0],14);
    mb.box(x+27,14.5,z,2.8,0.35,1.8,[0.45,0.29,0.08,0],19);
  }
  mb.quad([-3000, -0.03, -2400], [600, -0.03, -2400], [600, -0.03, 2600], [-3000, -0.03, 2600], [0.03, 0.033, 0.045, 0], 2, [0, 1, 0]);
  const water = new MeshBuilder();
  water.quad([600, -0.8, -2800], [3600, -0.8, -2800], [3600, -0.8, 3000], [600, -0.8, 3000], [0.008, 0.016, 0.035, 0], 3, [0, 1, 0]);
  return { world: mb, water, fence, artStats: { frontageBuildings: frontageCount, cityBuildings: placed, occupiedLots: lots.length, freightStacks: freightCount } };
}

// Racing line coloured by the reference profile: braking red, accelerating green, steady amber (drawn additively)
export function buildRacingLine(track) {
  const mb = new MeshBuilder(), N = track.n, w = 0.42, UVX = [[-1, 0], [1, 0], [1, 0], [-1, 0]];
  for (let i = 0; i < N; i++) { // soft-edged ribbon (material 11: brightness falls off toward both edges)
    const j = (i + 1) % N, dv = track.lineSpeed[j] - track.lineSpeed[i];
    const col = dv < -0.04 ? n(NEON.red, 1.0) : (dv > 0.04 ? n(NEON.green, 0.5) : n(NEON.yellow, 0.55));
    const ax = track.lineX[i], az = track.lineZ[i], bx = track.lineX[j], bz = track.lineZ[j];
    mb.quad([ax - track.nx[i] * w, 0.03, az - track.nz[i] * w], [ax + track.nx[i] * w, 0.03, az + track.nz[i] * w], [bx + track.nx[j] * w, 0.03, bz + track.nz[j] * w], [bx - track.nx[j] * w, 0.03, bz - track.nz[j] * w], col, 11, [0, 1, 0], UVX);
  }
  return mb;
}

// Soft quads (uv −1..1) for shadows and underglow; rings for the showroom; drawn by the effects shader
export function buildSoftQuad(hx, hz, y, col) {
  const mb = new MeshBuilder();
  const a = mb.vert(-hx, y, -hz, 0, 1, 0, col, 10, -1, -1), b = mb.vert(hx, y, -hz, 0, 1, 0, col, 10, 1, -1);
  const c = mb.vert(hx, y, hz, 0, 1, 0, col, 10, 1, 1), d = mb.vert(-hx, y, hz, 0, 1, 0, col, 10, -1, 1);
  mb.i.push(a, b, c, a, c, d);
  return mb;
}
export function buildRing(r0, r1, col, seg = 96) {
  const mb = new MeshBuilder();
  for (let k = 0; k < seg; k++) {
    const t0 = (k / seg) * Math.PI * 2, t1 = ((k + 1) / seg) * Math.PI * 2;
    mb.quad([Math.cos(t0) * r0, 0.02, Math.sin(t0) * r0], [Math.cos(t1) * r0, 0.02, Math.sin(t1) * r0], [Math.cos(t1) * r1, 0.02, Math.sin(t1) * r1], [Math.cos(t0) * r1, 0.02, Math.sin(t0) * r1], col, 11, [0, 1, 0], [[-1, 0], [-1, 0], [1, 0], [1, 0]]);
  }
  return mb;
}
