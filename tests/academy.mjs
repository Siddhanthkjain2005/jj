// Real-simulation success paths plus adversarial observation traces for false credit.
import assert from 'node:assert/strict';
import { CAR_VX1, WORLDS, TRACK_HARBOR } from '../src/sim/data.js';
import { Track } from '../src/sim/track.js';
import { Vehicle } from '../src/sim/vehicle.js';
import { DriverInput, ASSIST_PRESETS } from '../src/sim/assists.js';
import { AIDriver } from '../src/sim/ai.js';
import { AcademySession } from '../src/sim/academy.js';
const dt=1/120, world=WORLDS.lumen_harbor;
const track=new Track(TRACK_HARBOR,world,CAR_VX1);
const v=new Vehicle(CAR_VX1,world,track), academy=new AcademySession(track), input=new DriverInput();
function tick(raw) { v.step(dt,input.process(dt,raw,v,track,ASSIST_PRESETS.racer,{speedRef:25})); academy.update(dt,v,raw); }
v.reset(170,0);academy.start('launch',v);
for(let i=0;i<120*20 && academy.active;i++) {
 const kmh=v.forwardSpeed*3.6;
 tick({steer:0,throttle:kmh<61?0.4:0,brake:0});
}
assert.equal(academy.status.complete,true,JSON.stringify(academy.status));
assert.ok(academy.status.result.reachedKmh>=54);assert.equal(academy.events.filter(e=>e.type==='complete').length,1);
console.log('PASS actual Vehicle smooth launch reaches target with manual throttle');
academy.start('braking',v);
let braking=false;
for(let i=0;i<120*25 && academy.active;i++) {
 if(v.forwardSpeed*3.6>=72)braking=true;
 tick({steer:0,throttle:braking?0:0.5,brake:braking?0.4:0});
}
assert.equal(academy.status.complete,true,JSON.stringify(academy.status));
assert.ok(academy.status.result.brakingDistance>5);assert.ok(academy.status.result.brakingDistance<academy.status.result.stoppingBudget);
console.log('PASS actual Vehicle measured stop: '+academy.status.result.brakingDistance.toFixed(1)+' m from '+academy.status.result.entryKmh.toFixed(1)+' km/h');
// Begin before the first true bend; slow AI commands are only a repeatable test driver.
v.reset(370,0);academy.start('cornering',v);const ai=new AIDriver({pace:0.6,seed:3});
for(let i=0;i<120*60 && academy.active;i++) {
 const ctl=ai.process(dt,v,track,[]);v.step(dt,ctl);academy.update(dt,v,ai.raw);
}
assert.equal(academy.status.complete,true,JSON.stringify(academy.status));
assert.ok(academy.status.result.cornerDegrees>=45);
console.log('PASS actual Vehicle clean corner on the Harbor circuit');

// A stationary held key is not driving, and opening a lesson already at speed is not a standing launch.
v.reset(170,0);academy.start('launch',v);
for(let i=0;i<240;i++){v.time+=dt;academy.update(dt,v,{throttle:1,brake:0,steer:0});}
assert.equal(academy.status.complete,false);
v.vx=Math.sin(v.yaw)*18;v.vz=Math.cos(v.yaw)*18;academy.start('launch',v);
assert.equal(academy.status.phase,'ready');
for(let i=0;i<120;i++){v.time+=dt;academy.update(dt,v,{throttle:1,brake:0,steer:0});}
assert.equal(academy.status.complete,false);
console.log('PASS no false standing-launch credit for stationary keys or entering at speed');

// A reset / position discontinuity and backwards travel invalidate an attempt.
v.reset(170,0);academy.start('launch',v);v.time=1;academy.update(dt,v,{});v.reset(175,0);academy.update(dt,v,{});
assert.equal(academy.status.phase,'retry');assert.equal(academy.status.complete,false);
academy.start('launch',v);v.x+=20;v.time+=dt;academy.update(dt,v,{throttle:1});
assert.equal(academy.status.phase,'retry');
v.reset(170,0);academy.start('cornering',v);
for(let i=0;i<60 && academy.active;i++){v.vz=-5;v.z-=5*dt;v.time+=dt;academy.update(dt,v,{steer:1});}
assert.equal(academy.status.phase,'retry');
console.log('PASS reset, teleport and wrong-direction attempts receive no completion');

// Forward scripted travel through a bend without steering cannot get credit.
v.reset(425,0);academy.start('cornering',v);
for(let i=0;i<900 && academy.active;i++) {
 const p=track.pointAt(425+i*12*dt,0,{});v.x=p.x;v.z=p.z;v.yaw=p.heading;
 v.vx=Math.sin(p.heading)*12;v.vz=Math.cos(p.heading)*12;v.time+=dt;
 academy.update(dt,v,{steer:0,throttle:0,brake:0});
}
assert.equal(academy.status.complete,false);
console.log('PASS circuit progress without actual steering input earns no corner completion');
