// Local, gameplay-driven career. Results must be observed from the actual drive.
// This is not an authoritative online economy: local saves remain user-editable.
export const CAREER_MODE_VERSION = 1;
const carIds=['sprint','vx1','vanta_gt'];
const partIds=['grip','aero','gearing'];
const crewIds=['mentor','engineer'];
const setupIds=['balanced','grip','speed'];
export const PART_PRICES=[100,180,280];
export const CAREER_PARTS=[
 {id:'grip',name:'Tire compound',effect:'+1.8% peak grip per tier; +1.5% rolling loss',prices:PART_PRICES},
 {id:'aero',name:'Aero package',effect:'+4% downforce per tier; +1.8% drag',prices:PART_PRICES},
 {id:'gearing',name:'Short final drive',effect:'+1.5% final drive per tier; earlier shifts and reduced redline speed',prices:PART_PRICES}
];
const mission=(v)=>Object.freeze({...v,index:v.index,fieldSize:v.fieldSize||1,reward:80,starReward:50,maxContacts:v.maxContacts??(['race','duel'].includes(v.type)?20:4),raceMode:v.raceMode||'practice',raceLaps:v.laps||1});
export const MISSIONS=Object.freeze([
 mission({id:'first-light',index:0,chapter:1,title:'Run the delivery',type:'sprint',trackId:'beacon_short',rideId:'sprint',laps:0,minDistance:650,checkpoints:6,timeLimit:60,targetTime:35,maxContacts:3,objective:'Reach six ordered gates and carry the timing relay 650 m before the workshop closes.',before:['Neri: The last timing relay is at the far end of the test course. We can still make tonight’s qualifier.','Maela: Follow the gates. Bring the car home; a scratch is better than a shortcut.'],after:['Neri: You brought it back! Now the workshop can time its own qualifying runs.','Maela: One delivery. One driver we can trust. Let’s earn a place on the grid.']}),
 mission({id:'beacon-rush',index:1,chapter:1,title:'Beat the closing bell',type:'checkpoint',trackId:'beacon_short',rideId:'sprint',laps:0,minDistance:780,checkpoints:10,timeLimit:80,targetTime:48,maxContacts:3,objective:'Link ten ordered gates around Beacon Short before the clock expires.',unlockRide:'vx1',before:['Tavi: Crownline accepts one final qualifying trace. I’ve marked the full route.','Neri: Keep your momentum through the bends. The gates only count in order.'],after:['Tavi: A complete trace, no missing gates. The qualifier accepts us.','Neri: Maela’s unlocked the VX-1 for you. Time to meet me on the grid.']}),
 mission({id:'neri-duel',index:2,chapter:1,title:'Neri’s wager',type:'duel',trackId:'beacon_short',rideId:'vx1',laps:1,minDistance:780,checkpoints:10,timeLimit:160,targetTime:60,requiredPosition:1,fieldSize:2,opponent:'neri',rival:'neri',raceMode:'race',pace:.78,objective:'Win a one-lap duel against Neri. Clean exits matter more than first-corner bravery.',before:['Neri: One lap. If you win, you lead the crew’s qualifying entry.','Maela: Give each other room. A rival who comes back is worth more than a broken trophy.'],after:['Neri: That exit! All right, you lead. I’ll watch your blind side.','Maela: You’ve won more than a lap. The crew can enter together now.']}),
 mission({id:'tavi-test',index:3,chapter:2,title:'The part we can prove',type:'timetrial',trackId:'harbor_loop',rideId:'vx1',laps:1,minDistance:1900,checkpoints:12,timeLimit:180,targetTime:68,maxContacts:4,raceMode:'timetrial',objective:'Record one valid Harbor lap. Choose a real setup tradeoff in the workshop before driving.',before:['Tavi: We can improve turn-in or straight-line speed. We cannot get both for free.','Sola: Show me your complete lap, not a perfect graph from half the course.'],after:['Tavi: Now the setup has a whole lap behind it. We can decide what the car needs next.','Sola: You tested it on the road. That is worth listening to.']}),
 mission({id:'safe-passage',index:4,chapter:2,title:'Keep the lights steady',type:'clean',trackId:'breakwater',rideId:'vx1',laps:1,minDistance:1550,checkpoints:12,timeLimit:150,targetTime:70,maxContacts:0,raceMode:'practice',unlockRide:'vanta_gt',objective:'Complete a Breakwater lap without touching another car or barrier. Preserve the beacon test equipment.',before:['Maela: The rebuilt beacon needs one uninterrupted vibration test. Give me a clean lap.','Neri: No medal for scaring the pit crew this time. Smooth hands.'],after:['Maela: Steady all the way. The teaching room’s equipment passes inspection.','Tavi: The Vanta GT is ready. Heavier, stronger, and a completely different braking rhythm.']}),
 mission({id:'sola-trial',index:5,chapter:2,title:'Sola’s reference',type:'timetrial',trackId:'harbor_loop',rideId:'vanta_gt',laps:1,minDistance:1900,checkpoints:12,timeLimit:160,targetTime:62,maxContacts:4,raceMode:'timetrial',opponent:'sola',rival:'sola',objective:'Finish one valid lap; chase Sola’s 62-second reference for the time star.',before:['Sola: My reference is sixty-two seconds. You don’t have to copy my line to improve it.','Tavi: Review grip and gearing. What helped at Beacon may cost time here.'],after:['Sola: You’ve earned a comparison, not a copy. Let’s see what you do with it under pressure.','Neri: Crownline’s invitational has our name on the reserve list. Two races left.']}),
 mission({id:'openline-semi',index:6,chapter:3,title:'A place on the grid',type:'race',trackId:'harbor_loop',rideId:'vx1',laps:3,minDistance:5800,checkpoints:36,timeLimit:480,targetTime:195,requiredPosition:3,fieldSize:8,opponent:'sola',rival:'sola',raceMode:'race',pace:.84,objective:'Finish in the top three over three laps. Manage traffic and keep enough grip for the final lap.',before:['Veska: Three laps. A complete classification. Earn the final on the same terms as everyone else.','Sola: I’ll race you properly. I expect you to do the same.'],after:['Neri: Podium! The Openline crew is in the final.','Veska: Your garage has earned its entry. Bring that discipline to Breakwater.']}),
 mission({id:'crownline-final',index:7,chapter:3,title:'Leave the line open',type:'race',trackId:'breakwater',rideId:'vanta_gt',laps:2,minDistance:3100,checkpoints:24,timeLimit:300,targetTime:130,requiredPosition:2,fieldSize:8,opponent:'sola',rival:'sola',raceMode:'race',pace:.90,objective:'Finish first or second in the two-lap Crownline final and secure the garage’s independent season entry.',before:['Maela: That garage began as a place for people who had nowhere to start. Give the next driver a start.','Sola: Two laps. No speeches now. See you at the flag.'],after:['Neri: A season entry. Our name, our car, our crew. The garage stays open.','Sola: You made a place on this grid. Next season, I’m coming for your best lap.']})
]);
const byId=id=>MISSIONS.find(m=>m.id===id);
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const cap=(n,lo,hi)=>Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.floor(n))):lo;
const clone=v=>JSON.parse(JSON.stringify(v));
export function defaultStoryCareer(){return {version:CAREER_MODE_VERSION,credits:200,selectedMission:'first-light',selectedRide:'sprint',ownedRides:['sprint'],crew:'mentor',setup:'balanced',parts:{grip:0,aero:0,gearing:0},records:{},processedRuns:[],chapterChoices:{}};}
function ownedFor(records){const ids=['sprint'];if(records['beacon-rush']?.completed)ids.push('vx1');if(records['safe-passage']?.completed)ids.push('vanta_gt');return ids;}
export function normalizeStoryCareer(value){
 const v=object(value),d=defaultStoryCareer(),records=object(v.records);
 d.credits=cap(v.credits,0,10000000);if(v.credits===undefined)d.credits=200;
 d.crew=crewIds.includes(v.crew)?v.crew:'mentor';d.setup=setupIds.includes(v.setup)?v.setup:'balanced';
 for(const p of partIds)d.parts[p]=cap(object(v.parts)[p],0,3);
 // Only a contiguous completed campaign can unlock later races/cars.
 let earlier=true;
 for(const m of MISSIONS){const r=object(records[m.id]),stars=cap(r.stars,0,3),completed=earlier&&r.completed===true&&stars>0;
  d.records[m.id]={completed,stars:completed?stars:0,bestTime:completed&&finite(r.bestTime,1,1800)?r.bestTime:null,attempts:cap(r.attempts,0,100000),lastOutcome:typeof r.lastOutcome==='string'?r.lastOutcome.slice(0,160):'',bestPosition:completed&&finite(r.bestPosition,1,8)?Math.floor(r.bestPosition):null};
  earlier=completed;
 }
 d.ownedRides=ownedFor(d.records);d.selectedRide=d.ownedRides.includes(v.selectedRide)?v.selectedRide:'sprint';
 d.selectedMission=byId(v.selectedMission)&&missionUnlocked(d,v.selectedMission)?v.selectedMission:MISSIONS.find(m=>!d.records[m.id].completed)?.id||MISSIONS[7].id;
 d.processedRuns=Array.isArray(v.processedRuns)?[...new Set(v.processedRuns.filter(x=>typeof x==='string'&&x.length>0&&x.length<=100))].slice(-150):[];
 for(const chapter of [1,2,3]){const choice=object(v.chapterChoices)[chapter];if(crewIds.includes(choice))d.chapterChoices[chapter]=choice;}
 return d;
}
export function missionUnlocked(state,id){const m=byId(id);if(!m)return false;if(m.index===0)return true;return object(state?.records)[MISSIONS[m.index-1].id]?.completed===true;}
export function rideUnlocked(state,id){return carIds.includes(id)&&ownedFor(object(state?.records)).includes(id);}
export function nextMission(state){return MISSIONS.find(m=>missionUnlocked(state,m.id)&&!state?.records?.[m.id]?.completed)||MISSIONS[7];}
export function careerBuildSignature(state){const s=normalizeStoryCareer(state);return [s.selectedRide,s.crew,s.setup,...partIds.map(p=>s.parts[p])].join(':');}
export function upgradePrice(state,part){if(!partIds.includes(part))return null;const tier=cap(state?.parts?.[part],0,3);return tier<3?PART_PRICES[tier]:null;}
function proofError(p){
 if(typeof p.attemptId!=='string'||!p.attemptId||p.attemptId.length>100)return 'This run has no valid attempt identifier.';
 if(p.validated!==true||p.supported!==false||p.autonomous===true)return 'Drive this career event yourself. Supported exhibitions do not award career progress.';
 for(const key of ['elapsed','distance','checkpoints','lapCount','contacts','resets'])if(!finite(p[key],0,key==='distance'?200000:10000))return 'The run contains incomplete or invalid driving measurements.';
 if(!finite(p.inputTime,.3,p.elapsed))return 'Use the driving controls to complete this career event.';
 if(p.validLaps!==undefined&&(!Number.isInteger(p.validLaps)||p.validLaps<0))return 'Timed lap counts must be complete integers.';
 if(p.elapsed<1||p.distance<1||p.distance/p.elapsed>115)return 'The run moved too far for its measured driving time.';
 if(!Number.isInteger(p.checkpoints)||!Number.isInteger(p.lapCount)||!Number.isInteger(p.contacts)||!Number.isInteger(p.resets))return 'Checkpoint, lap and incident counts must be complete integers.';
 if(p.resets>0||p.wrongWay===true||p.nonfinite===true)return 'A reset or invalid vehicle state interrupted the event. Retry the drive.';
 return null;
}
export function evaluateCareerResult(m,p){
 const reason=proofError(p);if(reason)return {valid:false,success:false,stars:0,reason};
 let failed='';
 if(p.distance<m.minDistance||p.checkpoints<m.checkpoints)failed='Reach every ordered route gate before returning to the crew.';
 else if(p.elapsed>m.timeLimit)failed='The event clock expired. Retry with a different line or workshop setup.';
 else if(p.contacts>m.maxContacts)failed=m.maxContacts===0?'The clean-run equipment test needs a contact-free lap.':'Too many contacts interrupted the run.';
 else if(m.laps>0&&(p.lapCount<m.laps||!Number.isInteger(p.validLaps)||p.validLaps<m.laps))failed='Complete the required valid lap distance without cutting the course.';
 else if(m.type==='timetrial'&&(!finite(p.validLaps,1,100)||!finite(p.lapTime,10,m.timeLimit)))failed='Record a valid timed lap without cutting the course.';
 else if(['race','duel'].includes(m.type)&&(p.finished!==true||!Number.isInteger(p.position)||!Number.isInteger(p.fieldSize)||!finite(p.fieldSize,m.fieldSize,m.fieldSize)||!finite(p.position,1,m.requiredPosition)))failed=`Finish ${m.requiredPosition===1?'first':'in the top '+m.requiredPosition} in the complete race.`;
 const clock=m.type==='timetrial'?p.lapTime:p.elapsed;
 if(failed)return {valid:true,success:false,stars:0,reason:failed,clock};
 return {valid:true,success:true,stars:1+(clock<=m.targetTime?1:0)+(p.contacts===0?1:0),reason:'Event complete. Your crew is ready for the next drive.',clock};
}
export function applyCareerAction(value,action,payload={}){
 const state=normalizeStoryCareer(value),p=object(payload),reject=reason=>({state,accepted:false,reason,earned:0});
 if(action==='select'){
  if(!missionUnlocked(state,p.missionId))return reject('Finish the previous event to earn this entry.');state.selectedMission=p.missionId;
 }else if(action==='ride'){
  if(!rideUnlocked(state,p.rideId))return reject('Earn this ride by completing its crew event.');state.selectedRide=p.rideId;
 }else if(action==='crew'){
  if(!crewIds.includes(p.choice))return reject('Choose Maela’s mentor setup or Tavi’s engineering setup.');state.crew=p.choice;state.chapterChoices[byId(state.selectedMission).chapter]=p.choice;
 }else if(action==='setup'){
  if(!setupIds.includes(p.setup))return reject('Choose a balanced, grip or speed setup.');state.setup=p.setup;
 }else if(action==='buy'){
  const cost=upgradePrice(state,p.part);if(cost===null)return reject('That workshop part is already at its final tier.');if(state.credits<cost)return reject('Earn more workshop credits by improving career medals.');state.credits-=cost;state.parts[p.part]++;
 }else if(action==='result'){
  const m=byId(p.missionId);if(!m||!missionUnlocked(state,m.id))return reject('This event is not unlocked.');
  if(state.selectedMission!==m.id)return reject('Select this event before recording a result.');
  if(state.processedRuns.includes(p.attemptId))return reject('This attempt has already been recorded.');
  const result=evaluateCareerResult(m,p);if(!result.valid)return reject(result.reason);
  const runBuild=careerBuildSignature(state);
  const old=state.records[m.id],newStars=Math.max(old.stars,result.stars),first=!old.completed&&result.success;
  const earned=(first?m.reward:0)+Math.max(0,newStars-old.stars)*m.starReward;
  state.processedRuns.push(p.attemptId);state.processedRuns=state.processedRuns.slice(-150);state.credits+=earned;
  state.records[m.id]={completed:old.completed||result.success,stars:newStars,bestTime:result.success?Math.min(old.bestTime||Infinity,result.clock):old.bestTime,attempts:old.attempts+1,lastOutcome:result.reason,bestPosition:result.success&&finite(p.position,1,8)?Math.min(old.bestPosition||8,p.position):old.bestPosition};
  state.ownedRides=ownedFor(state.records);
  if(first&&m.unlockRide)state.selectedRide=m.unlockRide;
  return {state:clone(state),accepted:true,reason:result.reason,earned,success:result.success,stars:result.stars,unlockedRide:first?m.unlockRide||null:null,buildSignature:runBuild};
 }else return reject('Unknown career action.');
 return {state:clone(state),accepted:true,reason:'Workshop plan saved.',earned:0};
}
export function buildCareerCar(baseCar,buildOrState={}){
 if(!baseCar||!baseCar.tire||!baseCar.aero||!baseCar.gearbox)throw new Error('A complete base vehicle is required.');
 const s=normalizeStoryCareer(buildOrState),t=s.parts,car=clone(baseCar);
 car.tire.mu*=1+t.grip*.018;car.tire.rollRes*=1+t.grip*.015;
 car.aero.clA*=1+t.aero*.04;car.aero.cdA*=1+t.aero*.018;
 car.gearbox.final*=1+t.gearing*.015;
 if(s.setup==='grip'){car.tire.mu*=1.035;car.aero.cdA*=1.025;}
 if(s.setup==='speed'){car.aero.cdA*=.94;car.aero.clA*=.88;}
 if(s.crew==='mentor'){car.steerRate*=.92;car.tire.falloff=Math.min(.96,car.tire.falloff+.035);}
 else{car.aero.clA*=1.02;car.aero.cdA*=1.009;}
 car.careerBuild={signature:[baseCar.id||s.selectedRide,s.crew,s.setup,...partIds.map(p=>s.parts[p])].join(':'),setup:s.setup,crew:s.crew,parts:{...t},rideId:s.selectedRide};
 return car;
}
export function careerCar(baseCar,state){return buildCareerCar(baseCar,state);}

export function careerDialogue(state,missionId,after=false){const m=byId(missionId);if(!m)return [];if(!after)return [...m.before];const crew=state?.chapterChoices?.[m.chapter]||state?.crew;const callback=crew==='engineer'?'Tavi: The setup you chose held up under a real drive. Keep the result; we can improve it.':'Maela: You kept your own rhythm under pressure. That is a skill you can bring to the next grid.';return [m.after[0],callback,m.after[1]];}
