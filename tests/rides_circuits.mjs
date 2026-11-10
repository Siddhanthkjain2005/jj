// Real Vehicle/model checks for the three ride classes and three closed playable venues.
import assert from 'node:assert/strict';
import {RIDES,getRide} from '../src/sim/rides.js';
import {CIRCUITS,getCircuit} from '../src/sim/circuits.js';
import {CAR_VX1,WORLDS} from '../src/sim/data.js';
import {Track} from '../src/sim/track.js';
import {Vehicle} from '../src/sim/vehicle.js';
import {AIDriver} from '../src/sim/ai.js';
import {RaceSession} from '../src/sim/race.js';
import {buildCarLOD0,buildCarLOD1} from '../src/game/carmodel.js';

const original=JSON.stringify(CAR_VX1),DT=1/120;
assert.equal(RIDES.length,3);assert.equal(CIRCUITS.length,3);
assert.equal(getRide('bad').id,'vx1');assert.equal(getCircuit('bad').id,'harbor_loop');
const acceleration=[];
for(const ride of RIDES){
 const car=ride.car;
 const straight={...CIRCUITS[1].track,start:{x:0,z:0,heading:0},segments:[['S',6000],['R',200,90],['S',100],['R',200,90],['S',6000],['R',200,90],['S',100],['R',200,90]]};
 const t=new Track(straight,WORLDS.lumen_harbor,car),v=new Vehicle(car,WORLDS.lumen_harbor,t);v.reset(50,0);
 const ctl={steerAngle:0,throttle:1,brake:0,autoGears:true,gearRequest:'D',abs:true,tcs:true,esc:false};
 let first100=null;
 for(let i=0;i<120*20;i++){v.step(DT,ctl);if(first100===null&&v.forwardSpeed>=100/3.6)first100=v.time;}
 assert.ok(first100>1&&first100<8,ride.id+' launch');assert.ok(Number.isFinite(v.forwardSpeed));assert.equal(v.nanResets,0);assert.equal(v.impactCount,0);
 acceleration.push({ride:ride.id,zeroTo100:first100,speed20:v.forwardSpeed*3.6});
 const high=buildCarLOD0(car,car.liveries[0]),low=buildCarLOD1(car,car.liveries[0]);
 assert.ok(high.v.every(Number.isFinite));assert.ok(low.v.every(Number.isFinite));assert.ok(high.i.length>300&&low.i.length>100);assert.ok(high.i.length>=low.i.length);
 ride.id!=='vx1'&&assert.notEqual(high.i.length,buildCarLOD0(CAR_VX1,CAR_VX1.liveries[0]).i.length,'different silhouette geometry');
}
assert.ok(acceleration.find(x=>x.ride==='sprint').speed20<acceleration.find(x=>x.ride==='vx1').speed20-10,'Sprint has a distinct lower speed ceiling');
assert.ok(acceleration.find(x=>x.ride==='vanta_gt').speed20>acceleration.find(x=>x.ride==='sprint').speed20+20,'GT delivers distinct straight-line power');
const laps=[];
for(const ride of RIDES)for(const venue of CIRCUITS){
 const track=new Track(venue.track,venue.world,ride.car),v=new Vehicle(ride.car,venue.world,track);
 assert.ok(track.closureError<1e-8);assert.ok(track.length>750);assert.ok(track.lineSpeed.every(Number.isFinite));
 v.reset(venue.track.lineS-35,0);
 const ai=new AIDriver({pace:.82,seed:12}),race=new RaceSession(track,'practice');
 for(let i=0;i<120*180&&race.laps.length<1;i++){v.step(DT,ai.process(DT,v,track,[]));race.update(DT,v.time,v,'assisted');}
 assert.equal(race.laps.length,1,ride.id+'/'+venue.id+' finishes');assert.equal(race.laps[0].valid,true,ride.id+'/'+venue.id+' valid');
 assert.equal(v.impactCount,0,ride.id+'/'+venue.id+' barriers');assert.equal(v.nanResets,0);assert.equal(ai.needsReset,false);
 laps.push({ride:ride.id,circuit:venue.id,length:track.length,seconds:race.laps[0].time});
}
assert.equal(JSON.stringify(CAR_VX1),original,'Original fictional reference car was not changed');
console.log('PASS rides/circuits: distinct real acceleration, distinct finite body LODs, all nine clean physical AI laps and closed courses');
console.log(JSON.stringify({acceleration,laps},null,2));
