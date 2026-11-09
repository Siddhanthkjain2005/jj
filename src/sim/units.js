// VELOCITYVERSE sim core: units and small math helpers.
// Convention: SI everywhere inside the simulation (m, kg, s, N, N·m, rad, rad/s, kg/m³).
// Axes match Unity: x = right, y = up, z = forward (left-handed). Yaw ψ is measured from +z toward +x,
// so positive yaw rate means the car is turning right. No axis conversion is needed when porting to Unity.

export const G0 = 9.80665;            // standard gravity, m/s²
export const RHO_SEA_LEVEL = 1.225;   // ISA sea-level air density at 15 °C, kg/m³
export const MS_TO_KMH = 3.6;         // m/s → km/h
export const MS_TO_MPH = 2.2369363;   // m/s → mph
export const RADS_TO_RPM = 60 / (2 * Math.PI);
export const RPM_TO_RADS = (2 * Math.PI) / 60;
export const DEG = Math.PI / 180;     // degrees → radians (Unity Transform APIs use degrees)

export function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function moveToward(x, target, maxDelta) {
  const d = target - x;
  if (d > maxDelta) return x + maxDelta;
  if (d < -maxDelta) return x - maxDelta;
  return target;
}
export function wrapPi(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
// Piecewise-linear table lookup: table = [[x0,y0],[x1,y1],...] sorted by x.
export function tableLookup(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 1; i < n; i++) {
    if (x <= table[i][0]) {
      const a = table[i - 1], b = table[i];
      return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
  }
  return table[n - 1][1];
}
