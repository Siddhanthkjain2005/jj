import assert from 'node:assert/strict';
import { MISSIONS,CAREER_PARTS,defaultStoryCareer,normalizeStoryCareer,applyCareerAction,missionUnlocked,rideUnlocked,buildCareerCar,careerBuildSignature,upgradePrice,careerDialogue } from '../src/game/career-mode.js';
import { getRide } from '../src/sim/rides.js';
import { getCircuit } from '../src/sim/circuits.js';
import { Track } from '../src/sim/track.js';
import { Vehicle } from '../src/sim/vehicle.js';

let state=defaultStoryCareer();
assert.equal(MISSIONS.length,12);assert.equal(new Set(MISSIONS.map(m=>m.trackId)).size,3);assert.equal(new Set(MISSIONS.map(m=>m.type)).size,6);
assert.deepEqual(state.ownedRides,['sprint']);assert.equal(state.credits,200);assert.ok(missionUnlocked(state,MISSIONS[0].id));assert.ok(!missionUnlocked(state,MISSIONS[1].id));
const initial=JSON.stringify(state);
assert.ok(!applyCareerAction(state,'select',{missionId:MISSIONS[7].id}).accepted);
assert.ok(!applyCareerAction(state,'ride',{rideId:'vanta_gt'}).accepted);
assert.equal(JSON.stringify(state),initial);
let buy=applyCareerAction(state,'buy',{part:'grip'});assert.ok(buy.accepted);assert.equal(buy.state.credits,100);assert.equal(buy.state.parts.grip,1);assert.equal(upgradePrice(buy.state,'grip'),180);assert.ok(!applyCareerAction(buy.state,'buy',{part:'grip'}).accepted);
assert.ok(!applyCareerAction(state,'buy',{part:'engine_power_cheat'}).accepted);
const garbage=normalizeStoryCareer({credits:NaN,selectedRide:'vanta_gt',parts:{grip:Infinity,aero:-3,gearing:99},records:{'crownline-final':{completed:true,stars:3}},processedRuns:[{},null,'ok','ok']});
assert.equal(garbage.credits,0);assert.equal(garbage.parts.grip,0);assert.equal(garbage.parts.gearing,3);assert.equal(garbage.selectedRide,'sprint');assert.equal(garbage.records['crownline-final'].completed,false);assert.deepEqual(garbage.processedRuns,['ok']);
const proof=(m,overrides={})=>({missionId:m.id,attemptId:'run-'+m.id,validated:true,supported:false,inputTime:1,elapsed:Math.max(m.minDistance/40,m.targetTime-1),distance:m.minDistance+5,checkpoints:m.checkpoints,lapCount:m.laps,validLaps:m.laps,lapTime:Math.max(20,m.targetTime-2),contacts:0,resets:0,finished:true,position:1,fieldSize:m.fieldSize,...overrides});
const first=MISSIONS[0];
for(const changed of [{validated:false},{inputTime:0},{inputTime:Infinity},{inputTime:10000},{supported:true},{autonomous:true},{elapsed:0},{distance:Infinity},{distance:700,elapsed:2},{resets:1},{wrongWay:true},{nonfinite:true},{contacts:.5},{checkpoints:NaN},{attemptId:''}])assert.ok(!applyCareerAction(state,'result',proof(first,changed)).accepted,JSON.stringify(changed));
let fail=applyCareerAction(state,'result',proof(first,{elapsed:61,attemptId:'slow'}));assert.ok(fail.accepted);assert.equal(fail.success,false);assert.equal(fail.earned,0);assert.equal(fail.state.records[first.id].stars,0);assert.ok(!missionUnlocked(fail.state,MISSIONS[1].id));
fail=applyCareerAction(state,'result',proof(first,{distance:30,attemptId:'short'}));assert.ok(fail.accepted);assert.equal(fail.success,false);
let result=applyCareerAction(state,'result',proof(first,{elapsed:50,contacts:1}));assert.ok(result.accepted&&result.success);assert.equal(result.stars,1);assert.equal(result.earned,130);state=result.state;
assert.equal(state.credits,330);assert.ok(missionUnlocked(state,MISSIONS[1].id));
assert.ok(!applyCareerAction(state,'result',proof(first)).accepted,'duplicate run rejected');
result=applyCareerAction(state,'result',proof(first,{attemptId:'improved'}));assert.equal(result.stars,3);assert.equal(result.earned,100);state=result.state;
const credits=state.credits;result=applyCareerAction(state,'result',proof(first,{attemptId:'same-again'}));assert.equal(result.earned,0);assert.equal(result.state.credits,credits);state=result.state;
for(const m of MISSIONS.slice(1)){
 state=applyCareerAction(state,'select',{missionId:m.id}).state;
 if(m.type==='timetrial'){const r=applyCareerAction(state,'result',proof(m,{validLaps:0,attemptId:'bad-lap-'+m.id}));assert.ok(r.accepted&&!r.success);}
 if(m.type==='duel'||m.type==='race'){const r=applyCareerAction(state,'result',proof(m,{position:m.requiredPosition+1,attemptId:'miss-podium-'+m.id}));assert.ok(r.accepted&&!r.success);}
 result=applyCareerAction(state,'result',proof(m));assert.ok(result.accepted&&result.success,m.id+' '+result.reason);assert.ok(Number.isFinite(result.earned));state=result.state;
}
assert.equal(Object.values(state.records).filter(r=>r.completed).length,12);assert.deepEqual(state.ownedRides,['sprint','vx1','vanta_gt']);assert.ok(rideUnlocked(state,'vanta_gt'));assert.ok(state.records['crownline-final'].stars===3);
assert.deepEqual(normalizeStoryCareer(JSON.parse(JSON.stringify(state))),state,'complete save round trip');
const original=getRide('vx1').car,copy=JSON.stringify(original);
const base=buildCareerCar(original,{...state,parts:{grip:0,aero:0,gearing:0},crew:'mentor',setup:'balanced'});
const upgraded=buildCareerCar(original,{...state,parts:{grip:3,aero:3,gearing:3},crew:'engineer',setup:'grip'});
assert.ok(upgraded.tire.mu>base.tire.mu);assert.ok(upgraded.aero.clA>base.aero.clA);assert.ok(upgraded.aero.cdA>base.aero.cdA);assert.ok(upgraded.gearbox.final>base.gearbox.final);assert.equal(upgraded.mass,base.mass);assert.equal(JSON.stringify(original),copy,'base config immutable');assert.notEqual(upgraded.careerBuild.signature,base.careerBuild.signature);
const speed=buildCareerCar(original,{...state,parts:{grip:0,aero:0,gearing:0},setup:'speed'});assert.ok(speed.aero.cdA<base.aero.cdA);assert.ok(speed.aero.clA<base.aero.clA);
assert.notDeepEqual(careerDialogue({...state,crew:'mentor',chapterChoices:{1:'mentor'}},first.id,true),careerDialogue({...state,crew:'engineer',chapterChoices:{1:'engineer'}},first.id,true));
// Measure actual physical outcome of the tire work; this is not only an attribute assertion.
function stop(car){const circuit=getCircuit('beacon_short'),track=new Track(circuit.track,circuit.world,car),v=new Vehicle(car,circuit.world,track);v.reset(0,0);const ctl={steerAngle:0,throttle:1,brake:0,autoGears:true,gearRequest:'D',abs:true,tcs:true,esc:false};let n=0;while(v.forwardSpeed<100/3.6&&n++<2400)v.step(1/120,ctl);assert.ok(n<2400);const start=v.z;ctl.throttle=0;ctl.brake=1;while(v.forwardSpeed>.05&&n++<3600)v.step(1/120,ctl);assert.ok(v.forwardSpeed<.05);assert.equal(v.nanResets,0);return v.z-start;}
const without=buildCareerCar(original,{...state,crew:'engineer',parts:{grip:0,aero:0,gearing:0},setup:'balanced'}),withGrip=buildCareerCar(original,{...state,crew:'engineer',parts:{grip:3,aero:0,gearing:0},setup:'balanced'});
const normalStop=stop(without),gripStop=stop(withGrip);assert.ok(gripStop<normalStop,`${gripStop} >= ${normalStop}`);
assert.ok(CAREER_PARTS.every(p=>p.prices.length===3));assert.match(careerBuildSignature(state),/^(sprint|vx1|vanta_gt):/);
console.log(`PASS career mode: eight gated playable events, six objective types, durable stars/credits/ride unlocks, no passive or duplicate awards, bounded tuning and actual stopping ${normalStop.toFixed(2)} → ${gripStop.toFixed(2)} m`);
