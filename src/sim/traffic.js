// VELOCITYVERSE sim core: interactions between cars.
//  - Car-to-car contact: each car's footprint is an oriented box in the ground plane. Overlaps are found with the
//    separating-axis test and resolved with one restitution + friction impulse at the contact point, applied
//    equally and oppositely (linear and angular momentum are conserved by construction), plus a positional
//    correction that adds no velocity.
//  - Slipstream and dirty air: a following car inside another car's wake gets less drag (tow) and less
//    downforce (turbulent air). Wake size and strengths are estimates for gameplay, not measured data.
import { clamp } from './units.js';

// Footprint of the VX-1 body + wheels (car-local: x right, z forward from the CG), m. Estimated from the model.
export const FOOTPRINT = { halfWidth: 0.98, front: 2.78, rear: -2.22 };
export const CONTACT = { restitution: 0.3, friction: 0.4, slop: 0.01, maxCorrection: 0.3 };
// Wake model (estimates): drag reduction and downforce loss at zero gap, and the distances they fade over.
export const WAKE = { length: 45, dragCut: 0.35, downLength: 25, downCut: 0.25, halfWidth0: 1.0, spread: 0.03 };

function corners(v, out) {
  const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
  const fx = sy, fz = cy, rx = cy, rz = -sy;
  const F = FOOTPRINT;
  const pts = [[-F.halfWidth, F.rear], [F.halfWidth, F.rear], [F.halfWidth, F.front], [-F.halfWidth, F.front]];
  for (let k = 0; k < 4; k++) { const [a, b] = pts[k]; out[k][0] = v.x + rx * a + fx * b; out[k][1] = v.z + rz * a + fz * b; }
  return { fx, fz, rx, rz };
}
const CA = [[0, 0], [0, 0], [0, 0], [0, 0]], CB = [[0, 0], [0, 0], [0, 0], [0, 0]];

function project(pts, ax, az) {
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { const d = p[0] * ax + p[1] * az; if (d < lo) lo = d; if (d > hi) hi = d; }
  return [lo, hi];
}
// Average of the vertices within 3 cm of the extreme along (ax, az): a face contact gives the face midpoint.
function support(pts, ax, az, out) {
  let best = -Infinity;
  for (const p of pts) best = Math.max(best, p[0] * ax + p[1] * az);
  let sx = 0, sz = 0, n = 0;
  for (const p of pts) if (p[0] * ax + p[1] * az > best - 0.03) { sx += p[0]; sz += p[1]; n++; }
  out[0] = sx / n; out[1] = sz / n;
  return out;
}
const SA = [0, 0], SB = [0, 0];

// Resolve all overlapping pairs once per simulation step (after every car has stepped).
// Returns the number of contacts resolved this step.
export function resolveCarContacts(vehs) {
  for (const v of vehs) v.carHits.length = 0;
  let count = 0;
  const C = CONTACT;
  for (let i = 0; i < vehs.length; i++) for (let j = i + 1; j < vehs.length; j++) {
    const A = vehs[i], B = vehs[j];
    const dxc = B.x - A.x, dzc = B.z - A.z;
    if (dxc * dxc + dzc * dzc > 36) continue; // broad phase: centres > 6 m apart cannot touch
    const a = corners(A, CA), b = corners(B, CB);
    const mid = 0.5 * (FOOTPRINT.front + FOOTPRINT.rear); // box centre ahead of the CG
    const cdx = dxc + (b.fx - a.fx) * mid, cdz = dzc + (b.fz - a.fz) * mid;
    let pen = Infinity, nx = 0, nz = 0;
    for (const [ax, az] of [[a.fx, a.fz], [a.rx, a.rz], [b.fx, b.fz], [b.rx, b.rz]]) {
      const [a0, a1] = project(CA, ax, az), [b0, b1] = project(CB, ax, az);
      const sgn = (cdx * ax + cdz * az) >= 0 ? 1 : -1;  // n points from A towards B
      const o = sgn > 0 ? a1 - b0 : b1 - a0;           // distance B must move along n to separate
      if (o <= 0) { pen = -1; break; }
      if (o < pen) { pen = o; nx = ax * sgn; nz = az * sgn; }
    }
    if (pen <= 0) continue;
    // contact point: midway between A's support along +n and B's support along −n
    support(CA, nx, nz, SA); support(CB, -nx, -nz, SB);
    const px = 0.5 * (SA[0] + SB[0]), pz = 0.5 * (SA[1] + SB[1]);
    // positional correction, split equally (no velocity change)
    const corr = Math.min(Math.max(pen - C.slop, 0), C.maxCorrection) * 0.5;
    A.x -= nx * corr; A.z -= nz * corr; B.x += nx * corr; B.z += nz * corr;
    const mA = A.car.mass, mB = B.car.mass, IA = A.car.yawInertia, IB = B.car.yawInertia;
    const rAx = px - A.x, rAz = pz - A.z, rBx = px - B.x, rBz = pz - B.z;
    // point velocities (same convention as the barrier contact in vehicle.js)
    const vAx = A.vx + A.r * rAz, vAz = A.vz - A.r * rAx;
    const vBx = B.vx + B.r * rBz, vBz = B.vz - B.r * rBx;
    const rvx = vBx - vAx, rvz = vBz - vAz;
    const vn = rvx * nx + rvz * nz;
    let jn = 0, jt = 0;
    if (vn < 0) {
      const rnA = rAz * nx - rAx * nz, rnB = rBz * nx - rBx * nz;
      jn = -(1 + C.restitution) * vn / (1 / mA + 1 / mB + rnA * rnA / IA + rnB * rnB / IB);
      const tx = nz, tz = -nx, vt = rvx * tx + rvz * tz;
      const rtA = rAz * tx - rAx * tz, rtB = rBz * tx - rBx * tz;
      jt = clamp(-vt / (1 / mA + 1 / mB + rtA * rtA / IA + rtB * rtB / IB), -C.friction * jn, C.friction * jn);
      const Jx = jn * nx + jt * tx, Jz = jn * nz + jt * tz; // impulse on B; −J on A
      B.vx += Jx / mB; B.vz += Jz / mB; B.r += (rBz * Jx - rBx * Jz) / IB;
      A.vx -= Jx / mA; A.vz -= Jz / mA; A.r -= (rAz * Jx - rAx * Jz) / IA;
    }
    const hit = { x: px, z: pz, nx, nz, pen, speed: Math.max(0, -vn), impulse: jn };
    A.carHits.push(hit); B.carHits.push(hit);
    if (jn > 0) { A.carImpactCount++; B.carImpactCount++; }
    count++;
  }
  return count;
}

// Set each car's drag and downforce multipliers from the wakes of the cars ahead of it.
export function applySlipstream(vehs) {
  const W = WAKE;
  for (const B of vehs) {
    const sy = Math.sin(B.yaw), cy = Math.cos(B.yaw);
    let tow = 0, dirty = 0;
    for (const A of vehs) {
      if (A === B) continue;
      const dx = A.x - B.x, dz = A.z - B.z;
      const along = dx * sy + dz * cy;               // distance of A ahead of B along B's heading
      if (along <= 0.5 || along > W.length) continue;
      if (Math.sin(A.yaw) * sy + Math.cos(A.yaw) * cy < 0.8) continue; // wake only from a car going the same way
      const lat = Math.abs(dx * cy - dz * sy), hw = W.halfWidth0 + W.spread * along;
      if (lat > hw) continue;
      const cross = 1 - (lat / hw) * (lat / hw);
      tow = Math.max(tow, Math.pow(1 - along / W.length, 1.3) * cross);
      if (along < W.downLength) dirty = Math.max(dirty, (1 - along / W.downLength) * cross);
    }
    B.dragScale = 1 - W.dragCut * tow;
    B.downScale = 1 - W.downCut * dirty;
    B.wake = tow;
  }
}
