import assert from 'node:assert/strict';
import { CAR_VX1, WORLDS } from '../src/sim/data.js';
import { LAB_PROTOCOL, LAB_SETUPS, runLabExperiment } from '../src/sim/lab.js';

const originalCar=JSON.stringify(CAR_VX1),originalWorld=JSON.stringify(WORLDS.lumen_harbor);
const baseline=runLabExperiment('baseline'),grip=runLabExperiment('grip'),aero=runLabExperiment('aero');
assert.equal(LAB_PROTOCOL.frequencyHz,120);
for(const result of [baseline,grip,aero]) {
  assert.equal(result.valid,true);assert.equal(result.guardTrips,0);assert.equal(result.contacts,0);
  assert.ok(result.metrics.accelerationSeconds>2 && result.metrics.accelerationSeconds<4);
  assert.ok(result.metrics.brakingMetres>15 && result.metrics.brakingMetres<35);
  assert.ok(Math.abs(result.metrics.brakingEntryKmh-100)<0.4,'Braking begins at the stated speed');
  assert.ok(Math.abs(result.metrics.coastEntryKmh-150)<0.4,'Coasting begins at the stated speed');
  assert.ok(result.metrics.coastSeconds>8 && result.metrics.coastSeconds<20);
  assert.ok(result.metrics.coastMetres>300 && result.metrics.coastMetres<650);
  assert.ok(result.samples.acceleration.at(-1).speedKmh>=100);
  assert.ok(result.samples.braking.at(-1).speedKmh<0.18);
  assert.ok(result.samples.coast.at(-1).speedKmh<=100);
  for(const points of Object.values(result.samples)) {
    assert.ok(points.length>5,'Charts contain measured intermediate samples');
    assert.equal(points[0].time,0);assert.equal(points[0].distance,0);
    for(let i=1;i<points.length;i++) {
      assert.ok(points[i].time>points[i-1].time);
      assert.ok(points[i].distance>=points[i-1].distance);
      assert.ok(Object.values(points[i]).every(Number.isFinite));
    }
  }
}
console.log('PASS three real Vehicle experiments reach the measured endpoints without contacts or numerical recovery');
assert.ok(grip.metrics.accelerationSeconds<baseline.metrics.accelerationSeconds*0.9,'Higher friction improves a traction-limited standing launch');
assert.ok(grip.metrics.brakingMetres<baseline.metrics.brakingMetres*0.95,'Higher friction shortens an ABS stop');
assert.ok(Math.abs(grip.metrics.coastSeconds/baseline.metrics.coastSeconds-1)<0.02,'Tire grip alone does not create aerodynamic drag');
assert.ok(aero.metrics.brakingMetres<baseline.metrics.brakingMetres,'Additional downforce reaches braking wheel loads');
assert.ok(aero.metrics.coastSeconds<baseline.metrics.coastSeconds*0.95,'Assumed drag penalty measurably shortens neutral coast time');
assert.ok(aero.metrics.coastMetres<baseline.metrics.coastMetres);
console.log('PASS tire grip and aero variations produce their expected physical tradeoffs');
assert.deepEqual(runLabExperiment('baseline'),baseline,'Repeated baseline must be independent of intervening setup studies');
assert.equal(JSON.stringify(CAR_VX1),originalCar,'Lab cannot mutate the live race car parameters');
assert.equal(JSON.stringify(WORLDS.lumen_harbor),originalWorld,'Lab cannot mutate world physics');
assert.throws(()=>runLabExperiment('unknown'),/Unknown engineering setup/);
assert.equal(LAB_SETUPS.length,3);
console.log('PASS repeatable independent results; original car/world unchanged; unknown setup rejected');
console.log(JSON.stringify({baseline:baseline.metrics,grip:grip.metrics,aero:aero.metrics},null,2));
