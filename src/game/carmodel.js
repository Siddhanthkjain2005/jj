// VELOCITYVERSE client: procedural VX-1 single-seater (original design; temporary art until the Unity model).
// Car-local axes: origin on the ground below the CG, +z forward, +x right, +y up. Wheels are separate meshes
// (axle along x) so the renderer can steer, spin and move them with the suspension.
// Materials: 22 car paint (clear-coated) · 5 emissive · 12 carbon · 13 rubber · 14 metal · 15 glass · 16 brake disc (glows with heat)
import { MeshBuilder, framesAlong, bezier, circle } from './gfx.js';

const CARBON = [0.035, 0.037, 0.045, 0], DARK = [0.012, 0.012, 0.016, 0], TI = [0.42, 0.44, 0.48, 0];
const RED = [1.0, 0.05, 0.10, 0.35];
const IVORY = [0.82, 0.85, 0.86, 0], ALLOY = [0.49, 0.53, 0.57, 0];

// Inverted (downforce) airfoil in the (chord, normal) plane: leading edge at +c/2 (forward), cambered downward,
// then rotated by the angle of attack (trailing edge up). Closed loop, n points per surface.
function airfoil(c, t, camber, aoaDeg, n = 9) {
  const pts = [], aoa = aoaDeg * Math.PI / 180, ca = Math.cos(aoa), sa = Math.sin(aoa);
  const surf = (u, sgn) => { // u: 0 at leading edge → 1 at trailing edge; NACA 4-digit thickness, chord-scaled
    const yt = 5 * t * c * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);
    const yc = -camber * c * 4 * u * (1 - u);
    return [c / 2 - u * c, yc + sgn * yt];
  };
  for (let k = 0; k <= n; k++) pts.push(surf((1 - Math.cos((k / n) * Math.PI)) / 2, 1));
  for (let k = n - 1; k > 0; k--) pts.push(surf((1 - Math.cos((k / n) * Math.PI)) / 2, -1));
  return pts.map(([a, b]) => [a * ca + b * sa, -a * sa + b * ca]); // trailing edge (−c/2) rises with aoa
}

// A wing element swept along x from -span to +span; shape(x) → { y, z } positions the element (spoon, sweep).
function wing(mb, span, chord, thick, camber, aoa, shape, col, mat = 0, steps = 14, colorFn = null) {
  const frames = [];
  for (let k = 0; k <= steps; k++) {
    const x = -span + (2 * span * k) / steps, s = shape(x);
    frames.push({ p: [x, s.y, s.z], u: [0, 0, 1], v: [0, 1, 0] });
  }
  return mb.sweep(frames, airfoil(chord, thick, camber, aoa), col, mat, true, true, colorFn);
}

function tube(mb, pts, r, col, mat = 14, sides = 8, flat = 1) {
  mb.sweep(framesAlong(pts), circle(r * flat, sides, r), col, mat, true, false);
}

// Hard-edged box from 8 corners [x,y,z] (order: bottom 4 then top 4, counter-clockwise from the rear left).
function hull(mb, P, col, mat) {
  const q = (a, b, c, d) => mb.quad(P[a], P[b], P[c], P[d], col, mat);
  q(0, 1, 2, 3); q(4, 7, 6, 5); q(0, 4, 5, 1); q(1, 5, 6, 2); q(2, 6, 7, 3); q(3, 7, 4, 0);
}

// Body loft with smooth normals.
function body(mb, cx, sections, seg, col, mat = 0) {
  const v0 = mb.n, i0 = mb.i.length;
  mb.loft(cx, sections, seg, col, mat);
  mb.smooth(v0, i0);
}

// Every material-0 vertex in a car mesh is paint: switch it to the clear-coat paint material (22).
function paint(mb) { for (let k = 0; k < mb.n; k++) if (mb.v[k * 13 + 10] === 0) mb.v[k * 13 + 10] = 22; return mb; }

export function buildCarLOD0(car, livery) { return paint(carLOD0(car, livery)); }
export function buildCarLOD1(car, livery) { return paint(carLOD1(car, livery)); }

function carLOD0(car, livery) {
  const mb = new MeshBuilder();
  const P = [...livery.primary, 0], S = [...livery.secondary, 0], A = [...livery.accent, 0];
  const Sg = [...livery.secondary, 0.14], Ag = [...livery.accent, 0.10];
  const shoulder = livery.primary.map((v,i)=>v*0.55+IVORY[i]*0.45).concat(0);
  const zf = car.wheelbase * (1 - car.frontWeight), zr = -car.wheelbase * car.frontWeight;
  // --- monocoque, nose and engine cover ---
  body(mb, 0, [
    [-2.06, 0.08, 0.08, 0.42, 2.2], [-1.80, 0.15, 0.13, 0.44, 2.4], [-1.40, 0.23, 0.19, 0.47, 2.6], [-1.00, 0.29, 0.25, 0.52, 2.8],
    [-0.60, 0.33, 0.29, 0.55, 3.0], [-0.28, 0.355, 0.31, 0.575, 3.0], [0.05, 0.365, 0.27, 0.525, 3.2], [0.55, 0.33, 0.245, 0.47, 3.0],
    [1.05, 0.27, 0.21, 0.42, 2.8], [1.50, 0.19, 0.155, 0.36, 2.6], [1.95, 0.13, 0.11, 0.29, 2.4], [2.30, 0.095, 0.08, 0.235, 2.2],
  ], 32, P);
  body(mb, 0, [[2.28, 0.097, 0.082, 0.236, 2.2], [2.62, 0.06, 0.05, 0.205, 2.1], [2.82, 0.018, 0.018, 0.19, 2.0]], 24, S); // nose tip
  // Pearl-metallic nose spine: a broad readable livery shape, not an emissive strip.
  body(mb, 0, [[0.66, 0.115, 0.009, 0.699, 2.6], [1.04, 0.103, 0.008, 0.638, 2.6],
    [1.50, 0.080, 0.007, 0.522, 2.5], [1.95, 0.061, 0.006, 0.406, 2.4],
    [2.30, 0.044, 0.005, 0.322, 2.2], [2.60, 0.023, 0.004, 0.263, 2.0]], 12, IVORY);
  // Technical race-number stencil on the nose. The bars follow its slope.
  const numberBar = (x0, x1, z0, z1) => {
    const y = z => 0.654 - (z - 1.0) * 0.252;
    mb.quad([x0,y(z0),z0],[x1,y(z0),z0],[x1,y(z1),z1],[x0,y(z1),z1], DARK, 12, [0,1,0]);
  };
  numberBar(-0.048,-0.035,1.18,1.40); numberBar(0.022,0.037,1.18,1.40);
  numberBar(-0.048,0.005,1.18,1.197); numberBar(-0.048,0.005,1.383,1.40); numberBar(-0.008,0.005,1.18,1.40);
  // cockpit opening, padding and driver
  body(mb, 0, [[-0.18, 0.12, 0.05, 0.80, 2.4], [0.0, 0.24, 0.06, 0.795, 2.6], [0.35, 0.22, 0.05, 0.735, 2.6], [0.62, 0.10, 0.03, 0.70, 2.4]], 18, DARK, 12);
  mb.sphere(0, 0.83, 0.10, 0.135, 10, 16, A, 0, 1.06);                                        // helmet
  body(mb, 0, [[0.14, 0.11, 0.035, 0.855, 2.2], [0.21, 0.115, 0.04, 0.85, 2.4], [0.245, 0.09, 0.03, 0.845, 2.2]], 14, DARK, 15); // visor
  // Wraparound aero screen and a visible quick-release steering wheel in the cockpit.
  body(mb, 0, [[0.30,0.218,0.035,0.80,2.5],[0.46,0.18,0.055,0.775,2.4],[0.57,0.115,0.035,0.75,2.2]], 20, [0.19,0.29,0.34,0], 15);
  mb.box(0,0.745,0.31,0.21,0.045,0.027,CARBON,12);
  for(const side of [-1,1]) {
    mb.box(side*0.097,0.727,0.31,0.029,0.095,0.035,DARK,13);
    mb.box(side*0.054,0.773,0.327,0.012,0.009,0.004,side<0?A:S,0);
  }
  body(mb,0,[[-0.014,0.026,0.007,0.968,2.0],[0.10,0.024,0.006,0.973,2.0],[0.19,0.020,0.005,0.936,2.0]],10,IVORY);
  // airbox / roll hoop with the intake, T-camera and the shark fin
  body(mb, 0, [[-0.78, 0.04, 0.04, 0.80, 2.2], [-0.48, 0.10, 0.15, 0.86, 2.6], [-0.20, 0.12, 0.17, 0.90, 2.8], [-0.04, 0.11, 0.13, 0.93, 2.6]], 16, P);
  body(mb, 0, [[-0.05, 0.085, 0.09, 0.94, 2.4], [-0.02, 0.07, 0.07, 0.95, 2.4]], 12, DARK, 12);
  mb.box(0, 1.06, -0.22, 0.11, 0.055, 0.19, A);                                            // T-camera
  mb.taper(0, -2.08, -0.45, 0.012, 0.012, 0.56, 0.93, 0.84, 1.03, P);
  mb.taper(0, -1.70, -0.62, 0.016, 0.016, 0.935, 0.95, 1.02, 1.04, Sg, 5);                  // fin light line
  // halo (titanium): centre pylon + hoop
  tube(mb, bezier([0, 0.60, 0.70], [0, 0.72, 0.68], [0, 0.84, 0.62], [0, 0.885, 0.52], 6), 0.022, TI, 14, 8, 0.7);
  for (const sx of [-1, 1]) tube(mb, [...bezier([0, 0.885, 0.52], [sx * 0.20, 0.89, 0.50], [sx * 0.29, 0.875, 0.22], [sx * 0.28, 0.84, -0.06], 10), [sx * 0.27, 0.70, -0.20], [sx * 0.26, 0.62, -0.24]], 0.024, TI, 14, 8, 0.75);
  // sidepods with inlets, downwash ramps and glow strips
  for (const sx of [-1, 1]) {
    body(mb, sx * 0.55, [[-1.32, 0.05, 0.05, 0.27, 2.4], [-0.95, 0.12, 0.11, 0.29, 2.8], [-0.45, 0.185, 0.16, 0.32, 3.2], [0.05, 0.215, 0.185, 0.35, 3.4], [0.42, 0.215, 0.165, 0.36, 3.4], [0.60, 0.195, 0.13, 0.37, 3.0]], 18, P);
    mb.taper(sx * 0.565, 0.60, 0.635, 0.30, 0.30, 0.27, 0.47, 0.27, 0.47, DARK, 12);        // inlet
    mb.taper(sx * 0.70, -0.85, 0.50, 0.03, 0.03, 0.47, 0.50, 0.50, 0.53, Sg, 5);             // top edge light
    mb.taper(sx * 0.42, -0.30, 0.66, 0.012, 0.012, 0.14, 0.44, 0.16, 0.46, CARBON, 12);      // bargeboard
  }
  // Upper sidepod shoulder panels, cooling gills and recessed intake vanes.
  for (const sx of [-1,1]) {
    body(mb,sx*0.55,[[-0.98,0.063,0.007,0.405,2.5],[-0.58,0.14,0.009,0.477,2.5],
      [-0.08,0.18,0.008,0.535,2.8],[0.35,0.17,0.007,0.527,2.5],[0.56,0.10,0.004,0.488,2.3]],16,S);
    for(let i=0;i<7;i++) {
      const z=-0.94+i*0.115, y=0.46+(z+0.94)*0.12;
      // Flush dark slots have a raised alloy lip that catches the key light.
      mb.box(sx*0.55,y,z,0.17,0.012,0.035,DARK,12);
      mb.box(sx*0.55,y+0.009,z-0.020,0.17,0.006,0.008,ALLOY,14);
    }
    for(let i=0;i<5;i++) mb.box(sx*(0.45+i*0.055),0.373,0.641,0.009,0.145,0.009,CARBON,12);
    // Exposed dzus fasteners and small metallic towing marker.
    for(const z of [-0.65,-0.12,0.38]) mb.sphere(sx*0.696,0.46+(z+0.65)*0.06,z,0.010,3,6,ALLOY,14,0.35);
    // Floor edge inlet vanes; their separated silhouettes sell real carbon aero.
    for(let i=0;i<3;i++) mb.taper(sx*(0.61+i*0.058),0.38+i*0.09,0.76+i*0.06,0.008,0.008,0.10,0.24,0.10,0.19,CARBON,12);
  }
  // Metallic spine trims the engine cover; smaller than the structural carbon fin.
  body(mb,0,[[-1.80,0.035,0.008,0.573,2.4],[-1.40,0.055,0.008,0.669,2.4],[-1.04,0.075,0.006,0.774,2.4],[-0.77,0.049,0.005,0.828,2.4]],12,IVORY);
  // Continuous shoulder shells give the Kestrel a sculpted solid volume in chase view.
  // These wrap above the existing sidepods and rear engine cover; suspension stays open.
  for (const sx of [-1,1]) {
    body(mb,sx*0.31,[[-1.97,0.040,0.022,0.475,2.2],[-1.72,0.105,0.073,0.56,2.5],
      [-1.38,0.165,0.115,0.602,2.7],[-1.04,0.180,0.140,0.625,2.8],
      [-0.72,0.17,0.158,0.63,2.8],[-0.47,0.12,0.13,0.625,2.6]],22,shoulder);
    body(mb,sx*0.55,[[-1.40,0.07,0.045,0.305,2.4],[-1.08,0.13,0.08,0.35,2.7],
      [-0.68,0.175,0.11,0.38,3.0],[-0.20,0.215,0.137,0.392,3.0],
      [0.22,0.215,0.14,0.393,3.0],[0.48,0.20,0.12,0.392,2.8],[0.59,0.16,0.09,0.39,2.6]],22,P);
    // Thin painted shoulder seam and lower carbon cut-out keep the broad surfaces precise.
    mb.taper(sx*0.715,-1.06,0.47,0.012,0.012,0.36,0.385,0.43,0.45,S,0);
  }
  // floor, edge fences, underglow line, plank, diffuser and strakes
  mb.taper(0, -1.96, 1.48, 1.56, 1.24, 0.035, 0.065, 0.035, 0.065, CARBON, 12);
  for (const sx of [-1, 1]) {
    mb.taper(sx * 0.785, -1.65, 1.05, 0.016, 0.016, 0.035, 0.13, 0.035, 0.11, CARBON, 12);
    mb.taper(sx * 0.795, -1.55, 1.20, 0.018, 0.018, 0.04, 0.065, 0.04, 0.065, Ag, 5);
  }
  mb.taper(0, -1.20, 1.10, 0.30, 0.30, 0.02, 0.036, 0.02, 0.036, [0.25, 0.2, 0.12, 0], 0);     // plank (skid blocks spark)
  // Open diffuser exit: a ramp and vertical strakes, not a solid black rear wall.
  mb.quad([-0.55,0.33,-2.32],[0.55,0.33,-2.32],[0.55,0.10,-1.76],[-0.55,0.10,-1.76],CARBON,12);
  for (const x of [-0.36, -0.18, 0.18, 0.36]) mb.taper(x, -2.30, -1.82, 0.012, 0.012, 0.06, 0.31, 0.05, 0.11, CARBON, 12);
  // rear crash structure light, exhaust and the rain light
  mb.taper(0, -2.10, -2.06, 0.12, 0.12, 0.40, 0.45, 0.40, 0.45, RED, 5);
  { const v0 = mb.n, i0 = mb.i.length; mb.lathe([[0, 0.032], [0, 0.046], [0.10, 0.046], [0.10, 0.038], [0.0, 0.030]], 12, [0.35, 0.3, 0.28, 0], 14);
    for (let k = v0; k < mb.n; k++) { const o = k * 13, x = mb.v[o], y = mb.v[o + 1], z = mb.v[o + 2]; mb.v[o] = y; mb.v[o + 1] = 0.50 + z; mb.v[o + 2] = -2.02 - x; const nx = mb.v[o + 3], ny = mb.v[o + 4], nz = mb.v[o + 5]; mb.v[o + 3] = ny; mb.v[o + 4] = nz; mb.v[o + 5] = -nx; } void i0; }
  // rear wing: endplates with rain lights, main plane, DRS flap, beam wing, swan-neck mount
  for (const sx of [-1, 1]) {
    mb.taper(sx * 0.53, -2.64, -2.02, 0.022, 0.022, 0.36, 1.03, 0.36, 0.99, P);
    mb.taper(sx * 0.53, -2.665, -2.635, 0.03, 0.03, 0.57, 0.79, 0.57, 0.79, RED, 5);
    mb.taper(sx * 0.545, -2.60, -2.06, 0.006, 0.006, 0.985, 1.01, 0.965, 0.99, IVORY, 0);
  }
  wing(mb, 0.52, 0.34, 0.12, 0.04, 9, () => ({ y: 0.83, z: -2.29 }), S, 0, 8);
  wing(mb, 0.52, 0.20, 0.12, 0.03, 32, () => ({ y: 0.945, z: -2.47 }), P, 0, 8);
  wing(mb, 0.46, 0.15, 0.12, 0.03, 14, () => ({ y: 0.41, z: -2.36 }), CARBON, 12, 6);
  mb.taper(0, -2.40, -2.12, 0.035, 0.035, 0.84, 0.90, 0.84, 0.90, DARK, 12);                  // DRS pod
  tube(mb, bezier([0, 0.46, -1.95], [0, 0.66, -2.05], [0, 0.82, -2.18], [0, 0.86, -2.24], 5), 0.018, CARBON, 12, 6, 0.4);
  // front wing: three spoon-shaped elements, endplates and the light line
  const spoon = (y0, z0) => (x) => { const a = Math.abs(x) / 0.97; return { y: y0 + 0.10 * a * a * a, z: z0 - 0.12 * a * a }; };
  wing(mb, 0.97, 0.30, 0.10, 0.035, 4, spoon(0.075, 2.62), P, 0, 16);
  wing(mb, 0.94, 0.20, 0.10, 0.03, 14, spoon(0.135, 2.46), S, 0, 16);
  wing(mb, 0.90, 0.15, 0.10, 0.03, 24, spoon(0.19, 2.36), CARBON, 12, 16);
  for (const sx of [-1, 1]) {
    mb.taper(sx * 0.98, 2.22, 2.86, 0.02, 0.02, 0.05, 0.31, 0.05, 0.20, P);
    mb.taper(sx * 0.995, 2.26, 2.84, 0.006, 0.006, 0.28, 0.305, 0.18, 0.20, IVORY, 0);
  }
  // suspension: wishbones, push rods and steering arms (aero-section tubes)
  for (const sx of [-1, 1]) {
    const fo = sx * 0.66, ro = sx * 0.62;
    tube(mb, [[sx * 0.16, 0.50, zf + 0.30], [fo, 0.45, zf]], 0.016, CARBON, 12, 6, 0.45); tube(mb, [[sx * 0.16, 0.49, zf - 0.32], [fo, 0.45, zf]], 0.016, CARBON, 12, 6, 0.45);
    tube(mb, [[sx * 0.14, 0.24, zf + 0.32], [fo, 0.21, zf]], 0.016, CARBON, 12, 6, 0.45); tube(mb, [[sx * 0.14, 0.23, zf - 0.34], [fo, 0.21, zf]], 0.016, CARBON, 12, 6, 0.45);
    tube(mb, [[fo * 0.95, 0.23, zf - 0.02], [sx * 0.14, 0.58, zf - 0.12]], 0.012, TI, 14, 6);
    tube(mb, [[sx * 0.14, 0.37, zf + 0.16], [fo, 0.36, zf + 0.12]], 0.011, CARBON, 12, 6, 0.6);
    tube(mb, [[sx * 0.15, 0.31, zr + 0.40], [ro, 0.22, zr]], 0.016, CARBON, 12, 6, 0.45); tube(mb, [[sx * 0.12, 0.30, zr - 0.36], [ro, 0.22, zr]], 0.016, CARBON, 12, 6, 0.45);
    tube(mb, [[sx * 0.16, 0.50, zr + 0.30], [ro, 0.47, zr]], 0.016, CARBON, 12, 6, 0.45); tube(mb, [[sx * 0.12, 0.52, zr - 0.30], [ro, 0.47, zr]], 0.016, CARBON, 12, 6, 0.45);
    // mirrors
    tube(mb, [[sx * 0.30, 0.66, 0.58], [sx * 0.44, 0.69, 0.62]], 0.010, CARBON, 12, 6);
    hull(mb, [[sx * 0.39, 0.66, 0.58], [sx * 0.51, 0.66, 0.58], [sx * 0.51, 0.66, 0.66], [sx * 0.39, 0.66, 0.66], [sx * 0.39, 0.72, 0.58], [sx * 0.51, 0.72, 0.58], [sx * 0.51, 0.72, 0.66], [sx * 0.39, 0.72, 0.66]], P, 0);
    mb.quad([sx * 0.395, 0.665, 0.575], [sx * 0.505, 0.665, 0.575], [sx * 0.505, 0.715, 0.575], [sx * 0.395, 0.715, 0.575], DARK, 15, [0, 0, -1]);
  }
  return mb;
}

// Far LOD (beyond ~45 m): same silhouette with a fraction of the triangles.
function carLOD1(car, livery) {
  const mb = new MeshBuilder();
  const P = [...livery.primary, 0], S = [...livery.secondary, 0], A = [...livery.accent, 0], Sg = [...livery.secondary, 0.14];
  body(mb, 0, [[-2.06, 0.08, 0.08, 0.42, 2.2], [-1.00, 0.29, 0.25, 0.52, 2.8], [-0.28, 0.355, 0.31, 0.575, 3.0], [0.55, 0.33, 0.245, 0.47, 3.0], [1.50, 0.19, 0.155, 0.36, 2.6], [2.30, 0.095, 0.08, 0.235, 2.2], [2.82, 0.02, 0.02, 0.19, 2]], 10, P);
  body(mb,0,[[0.66,0.115,0.008,0.699,2.5],[1.50,0.08,0.007,0.522,2.5],[2.60,0.023,0.004,0.263,2]],6,IVORY);
  for(const sx of [-1,1]) body(mb,sx*0.31,[[-1.97,0.04,0.022,0.475,2.2],[-1.38,0.165,0.115,0.602,2.7],[-0.72,0.17,0.158,0.63,2.8],[-0.47,0.12,0.13,0.625,2.6]],8,livery.primary.map((v,i)=>v*0.55+IVORY[i]*0.45).concat(0));
  mb.sphere(0, 0.83, 0.10, 0.135, 5, 8, A, 0, 1.06);
  body(mb, 0, [[-0.78, 0.04, 0.04, 0.80, 2.2], [-0.30, 0.12, 0.17, 0.89, 2.8], [-0.04, 0.11, 0.13, 0.93, 2.6]], 8, P);
  for (const sx of [-1, 1]) {
    body(mb, sx * 0.55, [[-1.32, 0.05, 0.05, 0.27, 2.4], [-0.45, 0.185, 0.16, 0.32, 3.2], [0.42, 0.215, 0.165, 0.36, 3.4], [0.60, 0.195, 0.13, 0.37, 3.0]], 8, P);
    mb.taper(sx * 0.70, -0.85, 0.50, 0.03, 0.03, 0.47, 0.50, 0.50, 0.53, Sg, 5);
    mb.taper(sx * 0.53, -2.64, -2.02, 0.022, 0.022, 0.36, 1.03, 0.36, 0.99, P);
    mb.taper(sx * 0.53, -2.665, -2.635, 0.03, 0.03, 0.57, 0.79, 0.57, 0.79, RED, 5);
    mb.taper(sx * 0.98, 2.22, 2.86, 0.02, 0.02, 0.05, 0.31, 0.05, 0.20, P);
  }
  mb.taper(0, -1.96, 1.48, 1.56, 1.24, 0.035, 0.065, 0.035, 0.065, CARBON, 12);
  // Open diffuser exit: a ramp and vertical strakes, not a solid black rear wall.
  mb.quad([-0.55,0.33,-2.32],[0.55,0.33,-2.32],[0.55,0.10,-1.76],[-0.55,0.10,-1.76],CARBON,12);
  mb.taper(0, -2.46, -2.12, 1.04, 1.04, 0.80, 0.86, 0.80, 0.86, S);
  mb.taper(0, -2.58, -2.40, 1.04, 1.04, 0.92, 0.97, 0.92, 0.97, P);
  mb.taper(0, 2.45, 2.82, 1.94, 1.94, 0.06, 0.10, 0.06, 0.10, P);
  mb.taper(0, 2.32, 2.50, 1.86, 1.86, 0.13, 0.17, 0.13, 0.17, S);
  mb.taper(0, -2.10, -2.06, 0.12, 0.12, 0.40, 0.45, 0.40, 0.45, RED, 5);
  return mb;
}

// Wheel with the axle along x, outer face toward +x when side = 1 (right) or −x when side = −1 (left).
// Tire (rubber, compound stripe), machined rim with twin spokes, glowing rim lip and a carbon brake disc.
export function buildWheel(width, side, glow, stripe, lod = 0) {
  const mb = new MeshBuilder();
  const R = 0.33, rb = 0.236, w = width / 2, seg = lod ? 16 : 48;
  const tire = [0.028, 0.028, 0.032, 0], st = [...stripe, 0];
  // tire profile from the inner bead to the outer bead (x along the axle, outer side +)
  const prof = [[-w + 0.012, rb], [-w, 0.26], [-w - 0.004, 0.292], [-w + 0.014, 0.321], [-w + 0.045, R], [w - 0.045, R], [w - 0.014, 0.321],
    [w + 0.004, 0.302], [w + 0.004, 0.302], [w + 0.005, 0.282], [w + 0.005, 0.282], [w, 0.26], [w - 0.012, rb]];
  const cols = prof.map((_, k) => (k === 8 || k === 9) ? st : tire), mats = prof.map((_, k) => (k === 8 || k === 9) ? 0 : 13);
  if (lod) { mb.lathe([[-w, rb], [-w, 0.3], [-w + 0.04, R], [w - 0.04, R], [w, 0.3], [w, rb]], seg, tire, 13); }
  else mb.lathe(prof, seg, tire, 13, cols, mats);
  // rim barrel and face
  mb.lathe([[-w + 0.02, rb - 0.004], [w - 0.03, rb - 0.004], [w - 0.035, rb - 0.03], [w - 0.07, 0.07], [w - 0.06, 0.035], [w - 0.045, 0.0]], seg, [0.16, 0.17, 0.2, 0], 14);
  mb.lathe([[w - 0.028, rb + 0.002], [w - 0.022, rb - 0.012], [w - 0.03, rb - 0.024]], seg, [0.58,0.61,0.64,0], 14); // polished forged rim lip
  if (!lod) {
    for (let k = 0; k < 10; k++) { // twin spokes
      const a = (k / 10) * Math.PI * 2 + (k % 2 ? 0.07 : -0.07), ca = Math.cos(a), sa = Math.sin(a), wa = 0.014;
      const x0 = w - 0.06, x1 = w - 0.04;
      const pt = (x, r, d) => [x, ca * r - sa * d, sa * r + ca * d];
      mb.quad(pt(x1, 0.055, -wa), pt(x1, 0.215, -wa * 0.6), pt(x1, 0.215, wa * 0.6), pt(x1, 0.055, wa), [0.55, 0.57, 0.62, 0], 14, [1, 0, 0]);
      mb.quad(pt(x0, 0.055, -wa), pt(x1, 0.055, -wa), pt(x1, 0.215, -wa * 0.6), pt(x0, 0.215, -wa * 0.6), [0.3, 0.31, 0.35, 0], 14);
      mb.quad(pt(x0, 0.055, wa), pt(x0, 0.215, wa * 0.6), pt(x1, 0.215, wa * 0.6), pt(x1, 0.055, wa), [0.3, 0.31, 0.35, 0], 14);
    }
    mb.lathe([[w - 0.035, 0.0], [w - 0.017, 0.028], [w - 0.017, 0.042], [w - 0.035, 0.046]], 6, [0.53,0.46,0.30,0], 14); // hexagonal titanium center lock
    // Molded sidewall rings and white compound ticks remain readable without glowing tires.
    mb.lathe([[w+0.004,0.267],[w+0.006,0.269],[w+0.004,0.272]],48,[0.055,0.057,0.061,0],13);
    for(let k=0;k<12;k++) {
      const a=k*Math.PI/6, ca=Math.cos(a),sa=Math.sin(a), x=w+0.006, r=0.283;
      const pt=(rr,d)=>[x,ca*rr-sa*d,sa*rr+ca*d];
      mb.quad(pt(r,-0.006),pt(r+0.012,-0.006),pt(r+0.012,0.006),pt(r,0.006),k%3===0?IVORY:[0.13,0.14,0.15,0],13,[1,0,0]);
    }
    // Five wheel-nut seats, small balance weights and an outer valve stem.
    for(let k=0;k<5;k++) {
      const a=k*Math.PI*0.4;mb.sphere(w-0.028,Math.cos(a)*0.068,Math.sin(a)*0.068,0.010,3,6,ALLOY,14);
    }
    mb.box(w-0.025,0.194,0.035,0.016,0.025,0.011,DARK,13);
    mb.lathe([[-w * 0.2, 0.06], [-w * 0.2, 0.165], [-w * 0.2 + 0.032, 0.165], [-w * 0.2 + 0.032, 0.06]], 28, [0.06, 0.06, 0.07, 0], 16); // brake disc
  }
  if (side < 0) for (let k = 0; k < mb.n; k++) { mb.v[k * 13] = -mb.v[k * 13]; mb.v[k * 13 + 3] = -mb.v[k * 13 + 3]; }
  return paint(mb);
}
