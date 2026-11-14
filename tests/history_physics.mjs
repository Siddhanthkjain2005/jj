import assert from 'node:assert/strict';
import { HISTORY_RIDES } from '../src/sim/history-rides.js';
import { WORLDS, TRACK_HARBOR } from '../src/sim/data.js';
import { Track } from '../src/sim/track.js';
import { Vehicle } from '../src/sim/vehicle.js';
import { benchCar } from '../src/sim/lab.js';
import { CIRCUITS } from '../src/sim/circuits.js';
import { AIDriver } from '../src/sim/ai.js';
import { RaceSession } from '../src/sim/race.js';
import { buildCarLOD0, buildCarLOD1 } from '../src/game/carmodel.js';
import { buildHistoricalFan, buildHistoricalFlaps, buildHistoricalWheel } from '../src/game/history-model.js';

const DT = 1 / 120;
const WORLD = WORLDS.lumen_harbor;
const TEST_TRACK = {
  ...TRACK_HARBOR,
  id: 'historical_test_straight',
  width: 40,
  curbMaxRadius: 0,
  segments: [['S', 2000], ['R', 100, 90], ['S', 400], ['R', 100, 90], ['S', 2000], ['R', 100, 90], ['S', 400], ['R', 100, 90]],
};

function makeCar(year, speed = 0, car = HISTORY_RIDES[`hist_${year}`]) {
  const track = new Track(TEST_TRACK, WORLD, car);
  const vehicle = new Vehicle(car, WORLD, track);
  vehicle.reset(100, 0);
  vehicle.vz = speed;
  for (const wheel of vehicle.wheels) wheel.omega = speed / car.wheelRadius;
  return vehicle;
}

function tick(vehicle, seconds, controls) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    vehicle.step(DT, { throttle: 0, brake: 0, steerAngle: 0, autoGears: true, gearRequest: 'D', abs: true, tcs: true, ...controls });
    assert.ok([vehicle.x, vehicle.z, vehicle.vx, vehicle.vz, vehicle.rpm, vehicle.engineTorque ?? 0, vehicle.energyKJ].every(Number.isFinite));
  }
  assert.equal(vehicle.nanResets, 0);
  assert.equal(vehicle.impactCount, 0);
}

const rows = [];
const geometrySignatures = new Set();
const identifiers = new Set();
const fixedPaint = { primary: [.3, .3, .3], secondary: [.5, .5, .5], accent: [.7, .7, .7] };
function verifyMesh(mesh) {
  assert.ok(mesh.n > 0 && mesh.i.length > 0 && mesh.i.length % 3 === 0);
  assert.ok(mesh.v.every(Number.isFinite));
  assert.ok(mesh.i.every(index => Number.isInteger(index) && index >= 0 && index < mesh.n));
}

for (const [id, car] of Object.entries(HISTORY_RIDES)) {
  assert.equal(car.id, id);
  assert.ok(!identifiers.has(car.liveries[0].id));
  identifiers.add(car.liveries[0].id);
  const body = buildCarLOD0(car, fixedPaint);
  const distantBody = buildCarLOD1(car, fixedPaint);
  verifyMesh(body);
  verifyMesh(distantBody);
  assert.ok(distantBody.i.length < body.i.length);
  geometrySignatures.add(`${body.n}/${body.i.length}/${body.v.slice(0, 3)}`);
  const wheel = buildHistoricalWheel(car, true, -1);
  verifyMesh(wheel);
  assert.ok(Math.abs(Math.max(...wheel.v.filter((_, index) => index % 13 === 1)) - car.wheelRadius) < .002);
  const flaps = buildHistoricalFlaps(car, fixedPaint);
  assert.equal(flaps.length, car.history.year === 2026 ? 2 : 0);
  for (const flap of flaps) verifyMesh(flap.mesh);
  const fan = buildHistoricalFan(car, fixedPaint);
  assert.equal(Boolean(fan), id === 'hist_1978_fan');
  if (fan) verifyMesh(fan.mesh);
  const { valid, metrics } = benchCar(car);
  assert.ok(valid);
  assert.ok(metrics.accel >= 1.8 && metrics.accel < 13, `${car.id}: ${metrics.accel} s to 100 km/h`);
  assert.ok(metrics.brake >= 16 && metrics.brake < 62, `${car.id}: ${metrics.brake} m to stop`);
  const venue = CIRCUITS.find(circuit => circuit.id === 'beacon_short');
  const track = new Track(venue.track, venue.world, car);
  const vehicle = new Vehicle(car, venue.world, track);
  const driver = new AIDriver({ pace: .88, seed: 1 });
  const race = new RaceSession(track, 'timetrial', { laps: 1 });
  vehicle.reset(venue.track.gridS, 0);
  let peakCornerG = 0;
  for (let step = 0; step < 120 * 150 && !race.finished; step++) {
    vehicle.step(DT, driver.process(DT, vehicle, track, []));
    race.update(DT, vehicle.time, vehicle, 'assisted');
    peakCornerG = Math.max(peakCornerG, Math.abs(vehicle.gLat()));
    assert.equal(driver.needsReset, false, `${car.id} driver stalled`);
  }
  assert.ok(race.laps[0]?.valid, `${car.id} could not complete a valid lap`);
  assert.equal(vehicle.impactCount + vehicle.guardTrips + vehicle.nanResets, 0);
  rows.push({
    year: car.history.body === 'fan' ? '1978 fan' : car.history.year,
    zeroTo100Seconds: metrics.accel.toFixed(2),
    brake100ToZeroMetres: metrics.brake.toFixed(2),
    beaconLapSeconds: race.laps[0].time.toFixed(2),
    beaconPeakCornerG: peakCornerG.toFixed(2),
  });
}
const pioneer = rows.find(row => row.year === 1950);
const v10 = rows.find(row => row.year === 2004);
assert.ok(Number(pioneer.brake100ToZeroMetres) > Number(v10.brake100ToZeroMetres) * 1.4);
assert.ok(Number(v10.beaconPeakCornerG) > Number(pioneer.beaconPeakCornerG) * 1.3);
assert.equal(new Set(Object.values(HISTORY_RIDES).map(car => car.history.body)).size, rows.length);
assert.equal(geometrySignatures.size, rows.length);
console.table(rows);

const classic = makeCar(1950, 40);
tick(classic, DT, {});
assert.equal(classic.downF + classic.downR, 0);

const ground = makeCar(1978, 48);
tick(ground, DT, {});
const ordinaryFloor = ground.downF + ground.downR;
const bottomed = makeCar(1978, 48);
bottomed.h = .071;
tick(bottomed, DT, {});
assert.ok(bottomed.downF + bottomed.downR < ordinaryFloor * .6);

const fanCar = makeCar(1978, 0, HISTORY_RIDES.hist_1978_fan);
fanCar.gear = 0;
tick(fanCar, .25, { autoGears: false });
const idleSuction = fanCar.downF + fanCar.downR;
assert.ok(idleSuction > 0 && fanCar.forwardSpeed < .01);
tick(fanCar, .9, { throttle: 1, autoGears: false });
assert.ok(fanCar.downF + fanCar.downR > idleSuction + 1000);
assert.ok(fanCar.fanSpeed > .6 && fanCar.fanSpeed <= 1);
assert.ok(fanCar.forwardSpeed < .01);

const active1992 = makeCar(1992, 54);
const passiveProfile = structuredClone(active1992.car);
delete passiveProfile.history.tech.activeSuspension;
const passive1992 = makeCar(1992, 54, passiveProfile);
active1992.gear = passive1992.gear = 4;
tick(active1992, .6, { throttle: .12 });
tick(passive1992, .6, { throttle: .12 });
assert.ok(active1992.h < passive1992.h * .8, 'Active suspension should reduce steady chassis compression');

const turbo = makeCar(1986, 30);
turbo.gear = 2;
tick(turbo, .15, { throttle: 1 });
const earlySpool = turbo.turboSpool;
tick(turbo, 1.1, { throttle: 1 });
assert.ok(turbo.turboSpool > earlySpool + .05);
const lateSpool = turbo.turboSpool;
tick(turbo, .7, {});
assert.ok(turbo.turboSpool < lateSpool * .5);

for (const year of [2014, 2018, 2022, 2026]) {
  const hybrid = makeCar(year, 45);
  hybrid.gear = 4;
  const full = hybrid.energyKJ;
  tick(hybrid, .75, { throttle: 1, deployEnergy: true });
  assert.ok(hybrid.deployedKJ > 0 && hybrid.energyKJ < full);
  const charged = hybrid.energyKJ;
  tick(hybrid, .45, { brake: .7, deployEnergy: false });
  assert.ok(hybrid.recoveredKJ > 0 && hybrid.energyKJ > charged && hybrid.energyKJ <= full);
  const hold = hybrid.deployedKJ;
  tick(hybrid, .3, { throttle: 1, deployEnergy: false });
  assert.equal(hybrid.deployedKJ, hold);
}

const straight = makeCar(2026, 55);
straight.gear = 5;
const corner = makeCar(2026, 55);
corner.gear = 5;
tick(straight, DT, { throttle: 1, enableStraight: true });
tick(corner, DT, { throttle: 1, enableStraight: false });
assert.equal(straight.straightMode, true);
assert.equal(corner.straightMode, false);
assert.ok(straight.drag < corner.drag * .8);
assert.ok(straight.downF + straight.downR < (corner.downF + corner.downR) * .8);
tick(straight, DT, { brake: 1, enableStraight: true });
assert.equal(straight.straightMode, false);
console.log('PASS historical profiles, distinct meshes, shared bench and AI, floor load, fan suction, turbo response, active suspension, hybrid deployment/recovery and active aero');
