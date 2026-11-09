// VELOCITYVERSE data: car, worlds and track definitions (data-driven tuning).
// Every parameter group carries a provenance label:
//   S = sourced (cited measurement), E = estimated (physics reasoning / typical class values),
//   T = tuned (chosen by feel or test), F = fictional (invented for this original car or world).
// Nothing here is "real F1 data". The VX-1 is an original, fictional single-seater.
import { DEG } from './units.js';

export const PROVENANCE_LABEL = { S: 'sourced', E: 'estimated', T: 'tuned', F: 'fictional' };

export const CAR_VX1 = {
  id: 'vx1',
  name: 'VX-1 Kestrel',
  summary: 'Original open-wheel single-seater, rear-wheel drive, 8-speed sequential.',
  // Chassis and mass properties
  mass: 760,              // kg, including driver
  cgHeight: 0.30,         // m above ground
  wheelbase: 3.10,        // m
  frontWeight: 0.45,      // static front axle load fraction
  trackFront: 1.60,       // m
  trackRear: 1.55,        // m
  yawInertia: 1100,       // kg·m²
  pitchInertia: 900,      // kg·m²
  rollInertia: 260,       // kg·m²
  // Wheels and steering
  wheelRadius: 0.33,      // m
  wheelInertiaFront: 0.9, // kg·m² per wheel
  wheelInertiaRear: 1.3,  // kg·m² per wheel, includes a share of driveline inertia
  steerLock: 24 * DEG,    // max road-wheel angle
  steerRate: 4.0,         // rad/s, max road-wheel slew rate (steering rack speed)
  // Suspension (wheel rates)
  susp: {
    kF: 120000, kR: 130000,          // N/m spring wheel rate
    cBumpF: 5400, cRebF: 6800,       // N·s/m damper, front
    cBumpR: 6200, cRebR: 7800,       // N·s/m damper, rear
    travel: 0.050,                   // m total compression before bump stop
    bumpStopK: 600000,               // N/m
    arbF: 40000, arbR: 25000,        // N/m anti-roll bar (per metre of left/right compression difference)
  },
  // Tire: combined-slip normalized curve with load sensitivity and relaxation lengths
  tire: {
    mu: 1.65,              // peak friction coefficient at nominal load on reference asphalt
    loadSens: 0.10,        // fractional loss of mu per +100% load above nominal
    nominalLoad: 2000,     // N
    peakSlip: 0.10,        // slip ratio at peak longitudinal force
    peakAngle: 7.0 * DEG,  // slip angle at peak lateral force
    falloff: 0.80,         // force at large slip as a fraction of peak (progressive loss of traction)
    falloffWidth: 1.2,     // normalized-slip width of the post-peak decay
    relaxLong: 0.12,       // m, longitudinal relaxation length
    relaxLat: 0.35,        // m, lateral relaxation length
    rollRes: 0.012,        // rolling resistance coefficient
    lowSpeedLatDamp: 7000, // N·s/m lateral damping below ~4 m/s (numerical, fades out with speed)
    lowSpeedLongDamp: 9000,// N·s/m slip-velocity damping below ~4 m/s (numerical, fades out with speed)
  },
  // Engine (net torque at full throttle)
  engine: {
    idleRpm: 3500,
    launchRpm: 7000,       // auto-clutch target during standing starts
    limiterRpm: 12300,
    maxRpm: 12500,
    curve: [[2000, 250], [4000, 320], [6000, 370], [8000, 400], [10000, 390], [11500, 360], [12500, 320]], // rpm, N·m
    frictionBase: 25,      // N·m engine braking at closed throttle
    frictionPerRpm: 0.004, // N·m per rpm
  },
  gearbox: {
    ratios: [4.667, 3.987, 3.406, 2.910, 2.486, 2.124, 1.814, 1.550],
    reverse: 4.0,
    final: 3.0,
    efficiency: 0.92,      // drivetrain efficiency (8% loss)
    shiftTime: 0.05,       // s torque interruption per shift
    autoUpRpm: 11900,
    autoDownRpm: 7600,
  },
  diff: { preload: 80, lockPower: 0.35, lockCoast: 0.20 }, // clutch-pack limited-slip differential
  brakes: { maxTorque: 9600, bias: 0.58 },                   // total N·m at the four wheels, front fraction
  aero: { cdA: 1.00, clA: 2.60, balance: 0.42 },             // m², m², front fraction of downforce
  liveries: [
    { id: 'nova', name: 'Nova', primary: [0.27, 0.37, 0.44], secondary: [0.06, 0.70, 0.77], accent: [0.94, 0.58, 0.24] },
    { id: 'inferno', name: 'Inferno', primary: [0.62, 0.03, 0.06], secondary: [1.0, 0.50, 0.10], accent: [1.0, 0.84, 0.25] },
    { id: 'eclipse', name: 'Eclipse', primary: [0.90, 0.92, 0.96], secondary: [0.56, 0.34, 1.0], accent: [0.08, 0.92, 1.0] },
  ],
  provenance: {
    mass: 'F', geometry: 'F', inertia: 'E', wheels: 'E', steering: 'T', suspension: 'T',
    tirePeak: 'E', tireShape: 'T', relaxation: 'E', rollingResistance: 'E', lowSpeedDamping: 'T',
    engine: 'F', gearing: 'T', drivetrainLoss: 'E', diff: 'T', brakes: 'T', aero: 'E',
  },
};

// Worlds: physical rules a player can learn. Only Lumen Harbor is playable in Milestone 0.
export const WORLDS = {
  lumen_harbor: {
    id: 'lumen_harbor', name: 'Lumen Harbor', playable: true,
    gravity: 9.81,             // m/s² (Earth)
    airDensity: 1.225,         // kg/m³ (sea level, 15 °C)
    surfaces: {                // grip multiplier on tire mu, extra rolling resistance coefficient
      asphalt: { mu: 1.00, roll: 0.000 },
      curb:    { mu: 0.92, roll: 0.004 },
      runoff:  { mu: 0.72, roll: 0.020 },
    },
    weather: 'Dry, blue hour', fogDistance: 1600,
    provenance: { gravity: 'S', airDensity: 'S', surfaces: 'T' },
  },
  mesa_ardent: {
    id: 'mesa_ardent', name: 'Mesa Ardent', playable: false,
    gravity: 9.81, airDensity: 0.98, // ~2,200 m altitude, ISA
    surfaces: { asphalt: { mu: 0.97, roll: 0.0 }, curb: { mu: 0.9, roll: 0.004 }, runoff: { mu: 0.55, roll: 0.05 } },
    weather: 'Hot, clear, drifting sand', fogDistance: 3000,
    provenance: { gravity: 'S', airDensity: 'E', surfaces: 'F' },
  },
  halcyon_ring: {
    id: 'halcyon_ring', name: 'Halcyon Ring', playable: false,
    gravity: 6.87,             // m/s² spin gravity at the floor (0.7 g); direction-dependent effects are deferred
    airDensity: 0.95,          // kg/m³, 0.8 bar at 20 °C
    spinRadius: 4000,          // m
    surfaces: { asphalt: { mu: 0.95, roll: 0.0 }, curb: { mu: 0.9, roll: 0.004 }, runoff: { mu: 0.7, roll: 0.02 } },
    weather: 'Climate-controlled', fogDistance: 4000,
    provenance: { gravity: 'F', airDensity: 'E', surfaces: 'F' },
  },
  test_vacuum: { // test-only: no atmosphere
    id: 'test_vacuum', name: 'Vacuum test', playable: false, gravity: 9.81, airDensity: 0.0,
    surfaces: { asphalt: { mu: 1.0, roll: 0.0 }, curb: { mu: 0.92, roll: 0.004 }, runoff: { mu: 0.72, roll: 0.02 } },
    fogDistance: 2000, provenance: {},
  },
};

// Track built from straights ('S', length) and arcs ('R'|'L', radius, degrees). Heading 0 = +z, 90 = +x.
// 'solve' and 'close' straights are computed so the loop closes exactly.
export const TRACK_HARBOR = {
  id: 'harbor_loop', name: 'Harbor Loop', world: 'lumen_harbor',
  start: { x: 0, z: -157, heading: 0 },
  width: 12,              // m asphalt width
  curbWidth: 1.2,         // m
  curbHeight: 0.025,      // m
  curbRidge: 0.008,       // m ridge amplitude
  curbRidgePeriod: 0.5,   // m
  curbMaxRadius: 130,     // arcs tighter than this get curbs on both sides
  curbExtend: 10,         // m curb extension before and after each arc
  runoffStraight: 7,      // m between curb line and barrier on straights
  runoffCorner: 13,       // m on the outside of corners
  lineS: 200,             // m from start: start/finish line
  gridS: 60,              // m from start: time-trial start position (out-lap of 140 m)
  segments: [
    ['S', 420], ['R', 45, 90], ['S', 120], ['L', 110, 35], ['R', 110, 35], ['S', 80],
    ['R', 120, 90], ['S', 490], ['R', 32, 90], ['S', 140], ['L', 28, 50], ['R', 28, 50],
    ['S', 120], ['R', 70, 45], ['S', 'solve'], ['R', 55, 45], ['S', 'close'],
  ],
  cornerNames: ['Lighthouse', 'Esses', 'Crane Sweep', 'Customs Hairpin', 'Ferry Chicane', 'Warehouse', 'Quay'],
};
