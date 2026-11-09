// Digital steering safety checks on a wide pad: no barriers or scripted racing-line controller.
// Disable Rookie line guidance here: it intentionally steers after key release.
// Keep its automatic throttle, braking and other assists to test powered turn-in.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CAR_VX1 as C,WORLDS} from '../src/sim/data.js';
import {Track} from '../src/sim/track.js';
import {Vehicle} from '../src/sim/vehicle.js';
import {DriverInput,ASSIST_PRESETS} from '../src/sim/assists.js';
const world=WORLDS.lumen_harbor, dt=1/120;
function trial(speed,sign,heading=0,surface='asphalt',preset='racer') {
 const def={id:'pad',start:{x:0,z:0,heading},width:2000,curbWidth:1,curbHeight:0,curbRidge:0,curbRidgePeriod:1,curbMaxRadius:0,curbExtend:0,runoffStraight:500,runoffCorner:500,lineS:100,gridS:0,extraCurbs:[],segments:[['S',8000],['R',1000,180],['S',8000],['R',1000,180]]};
 const w={...world,surfaces:{...world.surfaces,asphalt:world.surfaces[surface]}};
 const track=new Track(def,w,C), v=new Vehicle(C,w,track), d=new DriverInput();v.reset(1000,0);
 v.vx=Math.sin(v.yaw)*speed;v.vz=Math.cos(v.yaw)*speed;for(const wheel of v.wheels)wheel.omega=speed/C.wheelRadius;
 let steer=0,maxBeta=0,maxSlip=0,maxSlew=0,lastAngle=0,maxYaw=0;
 for(let k=0;k<720;k++) {
  const target=k<72?sign:k<96?-sign:0;
  const rate=target===0?9:Math.sign(target)!==Math.sign(steer)&&steer!==0?10:4.5;
  steer+=Math.max(-rate*dt,Math.min(rate*dt,target-steer));
  const ctl=d.process(dt,{steer,throttle:0.15,brake:0,digitalSteer:true},v,track,{...ASSIST_PRESETS[preset],guidance:0},{speedRef:25});
  maxSlew=Math.max(maxSlew,Math.abs(ctl.steerAngle-lastAngle)/dt);lastAngle=ctl.steerAngle;v.step(dt,ctl);
  maxBeta=Math.max(maxBeta,Math.abs(Math.atan2(v.lateralSpeed,v.forwardSpeed))*180/Math.PI);
  maxSlip=Math.max(maxSlip,...v.wheels.map(w=>Math.abs(w.at)*180/Math.PI));maxYaw=Math.max(maxYaw,Math.abs(v.r));
  assert.ok(Number.isFinite(v.x+v.z+v.r));
 }
 assert.equal(v.impactCount,0);assert.equal(v.nanResets,0);
 assert.ok(maxBeta<8,`sideslip ${maxBeta} at ${speed} m/s, ${surface}`);
 assert.ok(Math.abs(v.r)<0.02,`release failed to settle: ${v.r}`);
 assert.ok(maxSlew<1.6,`wheel angle jumped: ${maxSlew}`);
 return {speed,sign,surface,preset,beta:+maxBeta.toFixed(2),slip:+maxSlip.toFixed(2),yaw:+maxYaw.toFixed(3),x:v.x,z:v.z};
}
const results=[];
for(const speed of [20,35,50,65,80]) for(const sign of [-1,1]) for(const surface of ['asphalt','runoff'])results.push(trial(speed,sign,0,surface));
for(const speed of [20,35,50]) for(const sign of [-1,1])results.push(trial(speed,sign,0,'asphalt','rookie'));
for(const speed of [35,65]) {
 const a=trial(speed,1),b=trial(speed,1,1.7);
 assert.ok(Math.abs(a.beta-b.beta)<1e-6,'handling depends on heading');
}
fs.writeFileSync(new URL('./results/handling_regression.json',import.meta.url),JSON.stringify(results,null,2));
console.log(`Maximum sideslip: ${Math.max(...results.map(r=>r.beta)).toFixed(2)} degrees`);
console.log('PASS 30 digital steering trials (Racer and Rookie auto-throttle): 72–288 km/h, both directions, low grip, direction reversal, release and heading invariance');

for (const sign of [-1,1]) {
 const track=new Track({id:'esc-pad',start:{x:0,z:0,heading:0},width:100,curbWidth:1,curbHeight:0,curbRidge:0,curbRidgePeriod:1,curbMaxRadius:0,curbExtend:0,runoffStraight:50,runoffCorner:50,lineS:100,gridS:0,extraCurbs:[],segments:[['S',500],['R',200,180],['S',500],['R',200,180]]},world,C);
 const v=new Vehicle(C,world,track);v.r=sign*0.8;v.steerAngle=-sign*0.08;
 v._electronics(dt,{esc:true,tcs:true,abs:true,brake:0,throttle:0.4},30);
 assert.ok(v.escActive,'countersteering disabled stability control');
 assert.ok(v.escBrake[sign>0?0:1]>0,'stability control must oppose the spin');
 assert.equal(v.escBrake[2]+v.escBrake[3],0,'stability control must not induce rear slip');
}
console.log('PASS ESC remains active during left/right countersteering');
