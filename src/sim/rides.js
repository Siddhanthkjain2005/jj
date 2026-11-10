// Original club-class rides. Every ride uses Vehicle; no scripted speed or purchase modifier.
import { CAR_VX1 } from './data.js';
import { DEG } from './units.js';

const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
const sprint=copy(CAR_VX1);
Object.assign(sprint,{id:'sprint',name:'Kestrel Sprint',summary:'Compact club racer. Light, progressive and forgiving, with a lower power ceiling.',bodyStyle:'sprint',mass:620,cgHeight:.29,wheelbase:2.50,frontWeight:.46,trackFront:1.48,trackRear:1.46,yawInertia:680,pitchInertia:660,rollInertia:230,steerLock:26*DEG});
sprint.tire.mu=1.78;sprint.tire.falloff=.88;sprint.tire.nominalLoad=1600;
sprint.engine.curve=sprint.engine.curve.map(([rpm,torque])=>[rpm,torque*.58]);
sprint.aero={cdA:.74,clA:1.45,balance:.44};sprint.brakes={maxTorque:8200,bias:.59};
sprint.susp={...sprint.susp,kF:98000,kR:107000,arbF:33000,arbR:22000};
sprint.liveries=[{id:'sprint_teal',name:'Workshop Teal',primary:[.04,.32,.37],secondary:[.16,.92,.80],accent:[1,.64,.24]},{id:'sprint_sun',name:'Apricot',primary:[.95,.35,.13],secondary:[.96,.86,.65],accent:[.15,.27,.32]}];
const gt=copy(CAR_VX1);
Object.assign(gt,{id:'vanta_gt',name:'Vanta GT',summary:'Enclosed endurance coupe. Strong straight-line power, heavier braking and deliberate turn-in.',bodyStyle:'gt',mass:1120,cgHeight:.38,wheelbase:2.80,frontWeight:.47,trackFront:1.66,trackRear:1.64,yawInertia:1620,pitchInertia:1420,rollInertia:410,steerLock:22*DEG});
gt.tire.mu=1.52;gt.tire.nominalLoad=2900;gt.tire.falloff=.84;
gt.engine={...gt.engine,idleRpm:2200,launchRpm:6200,limiterRpm:8850,maxRpm:9000,curve:gt.engine.curve.map(([rpm,torque])=>[rpm*.72,torque*2.2]),frictionBase:35,frictionPerRpm:.005};
gt.gearbox={...gt.gearbox,ratios:[4.1,3.08,2.34,1.8,1.4,1.08],final:3.2,reverse:3.5,shiftTime:.08,autoUpRpm:8500,autoDownRpm:5400};
gt.brakes={maxTorque:14200,bias:.60};gt.aero={cdA:.90,clA:1.75,balance:.44};
gt.susp={...gt.susp,kF:155000,kR:165000,cBumpF:6500,cRebF:8000,cBumpR:7200,cRebR:8900,travel:.065,arbF:48000,arbR:30000};
gt.liveries=[{id:'vanta_coral',name:'Crownline Coral',primary:[.24,.05,.09],secondary:[1,.30,.15],accent:[1,.79,.35]},{id:'vanta_ice',name:'Polar Night',primary:[.055,.08,.14],secondary:[.64,.84,.91],accent:[.56,.39,1]}];

export const RIDES=freeze([
 {id:'vx1',name:'VX-1 Kestrel',tagline:'Aero precision',car:copy(CAR_VX1),body:'formula',unlock:0,stats:{power:'398 kW',mass:'760 kg',character:'Balanced high-downforce racer'}},
 {id:'sprint',name:'Kestrel Sprint',tagline:'Light. Nimble. Yours.',car:sprint,body:'sprint',unlock:0,stats:{power:'231 kW',mass:'620 kg',character:'Forgiving grip, lower speed ceiling'}},
 {id:'vanta_gt',name:'Vanta GT',tagline:'Power with a purpose',car:gt,body:'gt',unlock:3,stats:{power:'630 kW',mass:'1,120 kg',character:'Powerful coupe, longer braking approach'}}
]);
export function getRide(id){return RIDES.find(r=>r.id===id)||RIDES[0];}
