import assert from 'node:assert/strict';
import {defaultOpenline,normalizeOpenline,updateOpenline} from '../src/game/openline-state.js';
import {STORY_CHARACTERS,STORY_CITIES,STORY_CIRCUITS} from '../src/game/openline-data.js';
import {CAR_VX1,WORLDS,TRACK_HARBOR} from '../src/sim/data.js';
import {Track} from '../src/sim/track.js';
import {Vehicle} from '../src/sim/vehicle.js';
import {AcademySession} from '../src/sim/academy.js';
import {DriverInput,ASSIST_PRESETS} from '../src/sim/assists.js';
import {AIDriver} from '../src/sim/ai.js';
import {runLabExperiment} from '../src/sim/lab.js';

const baseline=runLabExperiment('baseline'),study=runLabExperiment('grip');
let state=defaultOpenline();
const apply=(action,payload)=>{const r=updateOpenline(state,action,payload);assert.equal(r.accepted,true,r.reason);state=r.state;return r;};
const reject=(action,payload)=>{const r=updateOpenline(state,action,payload);assert.equal(r.accepted,false);assert.deepEqual(r.state,normalizeOpenline(state));return r;};
assert.deepEqual(normalizeOpenline(undefined),defaultOpenline());
assert.equal(normalizeOpenline({phase:'complete',completed:true,rewardClaimed:true,memories:['beacon-lit']}).completed,false);
assert.equal(normalizeOpenline({guide:'<script>',route:'evil',prediction:'bad',attempts:Infinity}).guide,'neri');
reject('driving',{kind:'lap',valid:true,lapTime:50,elapsed:50,distance:2100,contacts:0,resets:0});
apply('begin',{guide:'tavi',route:'supported'});
apply('predict',{prediction:'longer'}); // A wrong prediction never blocks learning.
reject('evidence',{baseline:{valid:true},study:{valid:true}});
for(const mutate of [
 r=>{r.valid=false;},r=>{r.contacts=1;},r=>{r.guardTrips=1;},r=>{r.metrics.brakingEntryKmh=200;},
 r=>{r.samples.braking.at(-1).speedKmh=20;},r=>{r.samples.braking[1].time=-1;},r=>{r.metrics.brakingMetres=NaN;}
]) {
 const broken=structuredClone(study);mutate(broken);reject('evidence',{baseline,study:broken});
}
apply('evidence',{baseline,study});
assert.equal(state.phase,'choice');
assert.equal(state.evidence.study.metrics.brakingMetres,study.metrics.brakingMetres);
state=normalizeOpenline(JSON.parse(JSON.stringify(state)));
assert.equal(state.phase,'choice');
apply('choice',{choice:'repeat'});
assert.equal(state.repeats,1);
assert.equal(state.phase,'evidence');
apply('evidence',{baseline,study});
apply('choice',{choice:'publish'});
const proof={kind:'lap',valid:true,elapsed:50,lapTime:50,distance:2100,contacts:0,resets:0,assistClass:'story-supported'};
for(const broken of [
 {...proof,valid:false},{...proof,contacts:1},{...proof,resets:1},{...proof,distance:0},{...proof,elapsed:0},
 {...proof,lapTime:Infinity},{...proof,lapTime:10,elapsed:10},{...proof,lapTime:55}
])reject('driving',broken);
const completed=apply('driving',proof);
assert.equal(completed.earned,true);
assert.equal(state.completed,true);
assert.equal(state.rewardClaimed,true);
assert.deepEqual(state.memories,['beacon-lit','signed-test-card','beacon-stripe']);
assert.equal(normalizeOpenline(JSON.parse(JSON.stringify(state))).phase,'complete');
reject('driving',proof); // Duplicate callback cannot award twice.
apply('replay');
assert.equal(state.phase,'intro');
assert.equal(state.completed,true);
assert.equal(state.memories.includes('beacon-lit'),true);
state=normalizeOpenline(JSON.parse(JSON.stringify(state)));
assert.equal(state.completed,true);
apply('begin',{guide:'sola',route:'supported'});
apply('predict',{prediction:'unsure'});
apply('evidence',{baseline,study});
apply('choice',{choice:'publish'});
assert.equal(apply('driving',proof).earned,false);
// Manual route needs an actual qualified controlled-stop result before submitting its comparison.
state=defaultOpenline();
apply('begin',{guide:'maela',route:'manual'});
apply('predict',{prediction:'shorter'});
reject('evidence',{baseline,study});
reject('manual',{result:{drillId:'braking',entryKmh:20,brakingDistance:1,elapsed:1,stoppingBudget:50}});
apply('route',{route:'supported'});
apply('evidence',{baseline,study});
assert.equal(state.phase,'choice');
// A real controlled stop and clean Harbor bend can complete the manual story route.
const track=new Track(TRACK_HARBOR,WORLDS.lumen_harbor,CAR_VX1);
const vehicle=new Vehicle(CAR_VX1,WORLDS.lumen_harbor,track);
const academy=new AcademySession(track),driver=new DriverInput(),dt=1/120;
vehicle.reset(170,0);academy.start('braking',vehicle);let braking=false;
for(let i=0;i<120*25&&academy.active;i++) {
 if(vehicle.forwardSpeed*3.6>=72)braking=true;
 const raw={steer:0,throttle:braking?0:.5,brake:braking?.4:0};
 vehicle.step(dt,driver.process(dt,raw,vehicle,track,ASSIST_PRESETS.racer,{speedRef:25}));academy.update(dt,vehicle,raw);
}
assert.equal(academy.status.complete,true);
const manualResult=structuredClone(academy.status.result);
state=defaultOpenline();apply('begin',{guide:'neri',route:'manual'});apply('predict',{prediction:'unsure'});
apply('manual',{result:manualResult});apply('evidence',{baseline,study});apply('choice',{choice:'publish'});
vehicle.reset(370,0);academy.start('cornering',vehicle);const ai=new AIDriver({pace:.6,seed:3});
for(let i=0;i<120*60&&academy.active;i++) {
 const ctl=ai.process(dt,vehicle,track,[]);vehicle.step(dt,ctl);academy.update(dt,vehicle,ai.raw);
}
assert.equal(academy.status.complete,true);
const cornerResult=academy.status.result;
assert.equal(apply('driving',{kind:'corner',valid:true,elapsed:cornerResult.elapsed,distance:cornerResult.distance,cornerDegrees:cornerResult.cornerDegrees,peakSlip:cornerResult.peakSlip,contacts:vehicle.impactCount,resets:vehicle.nanResets,assistClass:'assisted'}).earned,true);
assert.equal(normalizeOpenline(JSON.parse(JSON.stringify(state))).completed,true);
// The authored roster is distinct from playable content; it never invents a launched map.
assert.equal(STORY_CHARACTERS.length,18);assert.equal(STORY_CITIES.length,10);assert.equal(STORY_CIRCUITS.length,12);
assert.equal(STORY_CHARACTERS.filter(x=>x.active).length,4);
assert.equal(STORY_CIRCUITS.filter(x=>x.playable).length,1);
for(const character of STORY_CHARACTERS)for(const key of ['name','silhouette','personality','origin','ambition','conflict','expertise','identity','relationships','arc','connection','extension'])assert.ok(character[key]?.length>3,key);
console.log('PASS Openline: real Vehicle experiment evidence, rejected false credits, save migration, replay-safe rewards, supported route, complete canon and honest playable map');
