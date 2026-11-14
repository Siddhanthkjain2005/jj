import assert from 'node:assert/strict';
import { HISTORY_CATALOGUE, HISTORY_ERAS, HISTORY_FOUNDATION, HISTORY_RULES_2026 } from '../src/sim/history-data.js';
import { HISTORY_RIDES } from '../src/sim/history-rides.js';
import { HISTORY_VENUES, historyCircuit } from '../src/sim/history-circuits.js';
import { portalBalance } from '../src/game/time-portal.js';
import { Track } from '../src/sim/track.js';
import { Vehicle } from '../src/sim/vehicle.js';
import { SaveStore } from '../src/game/save.js';
import { AIDriver } from '../src/sim/ai.js';
import { RaceSession } from '../src/sim/race.js';

const cars = Object.values(HISTORY_RIDES);
assert.deepEqual(HISTORY_CATALOGUE.filter(entry => entry.representative).map(entry => entry.year), Array.from({length:77}, (_, index) => 1950 + index));
assert.equal(new Set(HISTORY_CATALOGUE.map(entry => entry.id)).size, HISTORY_CATALOGUE.length);
assert.ok(HISTORY_CATALOGUE.length >= 100);
assert.ok(HISTORY_CATALOGUE.every(entry => entry.source.startsWith('https://') && entry.referenceType === 'catalogue'));
assert.ok(HISTORY_CATALOGUE.filter(entry => entry.year === 1952 || entry.year === 1953).every(entry => entry.formula === 'Formula 2'));
assert.equal(HISTORY_FOUNDATION.length, 25);
assert.ok(HISTORY_FOUNDATION.every(item => HISTORY_CATALOGUE.some(entry => entry.id === item.id)));
assert.equal(HISTORY_RULES_2026.technicalIssue, 21);
assert.ok(HISTORY_ERAS.every(era => cars.some(car => car.history.year >= era.from && car.history.year <= era.to)));
assert.equal(new Set(cars.map(car => car.id)).size, cars.length);

for (const venue of HISTORY_VENUES) {
  const dry = historyCircuit(venue.id, 'dry');
  const damp = historyCircuit(venue.id, 'damp');
  const wet = historyCircuit(venue.id, 'rain');
  const dryTrack = new Track(dry.track, dry.world, cars[0]);
  assert.ok(dryTrack.closureError < .01);
  assert.ok(dry.world.surfaces.asphalt.mu > damp.world.surfaces.asphalt.mu && damp.world.surfaces.asphalt.mu > wet.world.surfaces.asphalt.mu);
  const wetTrack = new Track(wet.track, wet.world, cars[0]);
  assert.ok(Math.min(...wetTrack.lineSpeed) < Math.min(...dryTrack.lineSpeed));
}

function brakingDistance(condition) {
  const car = HISTORY_RIDES.hist_1950;
  const venue = historyCircuit('archive_test', condition);
  const track = new Track(venue.track, venue.world, car);
  const vehicle = new Vehicle(car, venue.world, track);
  vehicle.reset(35, 0);
  vehicle.vz = 100 / 3.6;
  for (const wheel of vehicle.wheels) wheel.omega = vehicle.vz / car.wheelRadius;
  const initial = vehicle.z;
  for (let step = 0; step < 1200 && vehicle.forwardSpeed > .05; step++) vehicle.step(1 / 120, { steerAngle:0, throttle:0, brake:1, autoGears:true, gearRequest:'D', abs:true });
  assert.ok(vehicle.forwardSpeed <= .05 && vehicle.nanResets === 0 && vehicle.impactCount === 0);
  return vehicle.z - initial;
}
assert.ok(brakingDistance('rain') > brakingDistance('dry') * 1.2);

// The earliest car used to overshoot the fast Meridian turns in heavy rain.
const rainVenue = historyCircuit('archive_test', 'rain');
const earlyCar = HISTORY_RIDES.hist_1950;
const rainTrack = new Track(rainVenue.track, rainVenue.world, earlyCar);
const rainDriver = new AIDriver({ pace: .995 });
const rainVehicle = new Vehicle(earlyCar, rainVenue.world, rainTrack);
const rainRace = new RaceSession(rainTrack, 'timetrial', { laps: 1 });
rainVehicle.reset(rainTrack.def.gridS, 0);
const dt = 1 / 120;
for (let step = 0; step < 24000 && !rainRace.finished && !rainDriver.needsReset; step++) {
  rainVehicle.step(dt, rainDriver.process(dt, rainVehicle, rainTrack, []));
  rainRace.update(dt, rainVehicle.time, rainVehicle, 'assisted');
}
assert.ok(rainRace.laps[0]?.valid && rainVehicle.impactCount === 0 && !rainDriver.needsReset);

const balanced = portalBalance(HISTORY_RIDES.hist_1950);
assert.ok(balanced.engine.curve.at(-2)[1] > HISTORY_RIDES.hist_1950.engine.curve.at(-2)[1]);
assert.notEqual(balanced.tire.mu, HISTORY_RIDES.hist_1950.tire.mu);
assert.equal(balanced.history.body, HISTORY_RIDES.hist_1950.history.body);
assert.equal(HISTORY_RIDES.hist_1950.aero.clA, 0);

const oldSave = { version: 1, livery:'custom', pbs:{ 'harbor_loop|assisted':{ time:46 } }, storyCareer:{ credits:1234 }, timePortal:{ completed:['hist_1950','hist_2026'] } };
globalThis.window = { localStorage:{ getItem:() => JSON.stringify(oldSave) } };
const save = new SaveStore().data;
assert.equal(save.livery,'custom');
assert.equal(save.pbs['harbor_loop|assisted'].time,46);
assert.equal(save.storyCareer.credits,1234);
assert.deepEqual(save.timePortal.completed,['hist_1950']);
console.log(`PASS ${HISTORY_CATALOGUE.length} references, all 77 Championship years, ${cars.length} playable vehicles across 13 eras, track closure, wet braking, balance and save migration`);
