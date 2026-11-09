// Openline campaign state. Pure data transitions; the game supplies real model/mission events.
// Local saves are deliberately not an authoritative online score or tamper-proof identity.
export const OPENLINE_VERSION = 1;
export const OPENLINE_PHASES = ['intro','prediction','evidence','choice','drive','complete'];
export const OPENLINE_GUIDES = ['neri','tavi','maela','sola'];
const predictions = ['shorter','longer','unsure'];
const num = (n,min,max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const clone = value => JSON.parse(JSON.stringify(value));
const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function defaultOpenline() {
  return {version:OPENLINE_VERSION,phase:'intro',guide:'neri',route:'supported',prediction:null,evidence:null,manual:null,choice:null,driving:null,
    completed:false,rewardClaimed:false,completion:null,memories:[],bonds:{neri:false,tavi:false,maela:false,sola:false},attempts:0,repeats:0};
}

function qualifiedTrial(value,id) {
  const v=cleanObject(value),m=cleanObject(v.metrics),samples=cleanObject(v.samples).braking;
  if(v.setupId!==id || v.valid!==true || v.contacts!==0 || v.guardTrips!==0 || !Array.isArray(samples) || samples.length<3 || samples.length>200)return null;
  const fields=['accelerationSeconds','brakingMetres','brakingSeconds','brakingEntryKmh','coastSeconds','coastMetres','coastEntryKmh'];
  if(!fields.every(k=>num(m[k],.001,10000)) || !num(m.brakingEntryKmh,98,102) || !num(m.coastEntryKmh,148,152))return null;
  if(!num(m.brakingMetres,1,200) || !num(m.brakingSeconds,.1,20))return null;
  const trace=[];
  for(const point of samples) {
    const p=cleanObject(point),last=trace[trace.length-1];
    if(!num(p.time,0,20)||!num(p.distance,-.01,200)||!num(p.speedKmh,-.1,105))return null;
    if(last&&(p.time<=last.time||p.distance<last.distance-.01||p.speedKmh>last.speedKmh+1))return null;
    trace.push({time:p.time,distance:p.distance,speedKmh:p.speedKmh});
  }
  const first=trace[0],last=trace[trace.length-1];
  if(first.time>.01 || Math.abs(first.distance)>.02 || Math.abs(first.speedKmh-m.brakingEntryKmh)>.1 || last.speedKmh>.2 || Math.abs(last.distance-m.brakingMetres)>.1 || Math.abs(last.time-m.brakingSeconds)>.05)return null;
  return {setupId:id,valid:true,contacts:0,guardTrips:0,metrics:Object.fromEntries(fields.map(k=>[k,m[k]])),samples:{braking:trace}};
}
function qualifiedManual(value) {
  const v=cleanObject(value);
  if(v.drillId!=='braking'||!num(v.entryKmh,60,90)||!num(v.brakingDistance,1,200)||!num(v.elapsed,.1,600)||!num(v.stoppingBudget,1,220)||v.brakingDistance>v.stoppingBudget)return null;
  return {drillId:'braking',entryKmh:v.entryKmh,brakingDistance:v.brakingDistance,elapsed:v.elapsed,stoppingBudget:v.stoppingBudget};
}
function qualifiedEvidence(value) {
  const v=cleanObject(value),baseline=qualifiedTrial(v.baseline,'baseline');
  const id=v.study?.setupId,study=['grip','aero'].includes(id)?qualifiedTrial(v.study,id):null;
  if(!baseline||!study||Math.abs(baseline.metrics.brakingEntryKmh-study.metrics.brakingEntryKmh)>2)return null;
  return {baseline,study};
}
function qualifiedDriving(value) {
  const v=cleanObject(value);
  if(v.valid!==true||v.contacts!==0||v.resets!==0||!num(v.elapsed,1,1800)||!num(v.distance,10,20000))return null;
  let result;
  if(v.kind==='lap') {
    if(!num(v.lapTime,20,600)||Math.abs(v.elapsed-v.lapTime)>.1||v.distance<1500)return null;
    result={kind:'lap',lapTime:v.lapTime};
  } else if(v.kind==='corner') {
    // Academy already checks clean eligible corner samples; its peak also includes the approach.
    if(!num(v.cornerDegrees,45,360)||!num(v.peakSlip,0,3))return null;
    result={kind:'corner',cornerDegrees:v.cornerDegrees,peakSlip:v.peakSlip};
  } else return null;
  const classes=['assisted','standard','story-supported','rookie','racer','pro'];
  return {...result,valid:true,elapsed:v.elapsed,distance:v.distance,contacts:0,resets:0,assistClass:classes.includes(v.assistClass)?v.assistClass:'assisted'};
}

export function normalizeOpenline(value) {
  const v=cleanObject(value),d=defaultOpenline();
  d.guide=OPENLINE_GUIDES.includes(v.guide)?v.guide:d.guide;
  d.route=v.route==='manual'?'manual':'supported';
  d.prediction=predictions.includes(v.prediction)?v.prediction:null;
  d.evidence=qualifiedEvidence(v.evidence);
  d.manual=qualifiedManual(v.manual);
  d.choice=['publish','repeat'].includes(v.choice)?v.choice:null;
  d.driving=qualifiedDriving(v.driving);
  d.attempts=num(v.attempts,0,100000)?Math.floor(v.attempts):0;
  d.repeats=num(v.repeats,0,100000)?Math.floor(v.repeats):0;
  // A completion remains durable during a chapter replay; malformed flags alone do not mint rewards.
  const ledger=cleanObject(v.completion);
  const ledgerEvidence=qualifiedEvidence(ledger.evidence),ledgerDriving=qualifiedDriving(ledger.driving);
  const ledgerRoute=ledger.route==='manual'?'manual':'supported';
  const ledgerManual=qualifiedManual(ledger.manual);
  const previousCompletion=ledger.missionId==='light-the-beacon'&&ledger.version===1&&!!ledgerEvidence&&!!ledgerDriving&&(ledgerRoute!=='manual'||!!ledgerManual);
  d.completion=previousCompletion?{missionId:'light-the-beacon',version:1,route:ledgerRoute,evidence:ledgerEvidence,manual:ledgerManual,driving:ledgerDriving}:null;
  d.completed=previousCompletion;
  d.rewardClaimed=previousCompletion;
  d.memories=previousCompletion?['beacon-lit','signed-test-card','beacon-stripe']:[];
  const b=cleanObject(v.bonds);
  for(const key of OPENLINE_GUIDES)d.bonds[key]=previousCompletion&&b[key]===true;
  let phase=OPENLINE_PHASES.includes(v.phase)?v.phase:'intro';
  if(phase!=='intro'&&!d.prediction)phase='prediction';
  if(['choice','drive','complete'].includes(phase)&&(!d.evidence||(d.route==='manual'&&!d.manual)))phase='evidence';
  if(['drive','complete'].includes(phase)&&!d.choice)phase='choice';
  if(phase==='complete'&&(!d.driving||!previousCompletion))phase='drive';
  d.phase=phase;
  return d;
}

export function updateOpenline(value,action,payload={}) {
  const state=normalizeOpenline(value),p=cleanObject(payload);
  const reject=reason=>({state,accepted:false,reason,earned:false});
  if(action==='begin') {
    if(state.phase!=='intro')return reject('Continue the current chapter.');
    if(!OPENLINE_GUIDES.includes(p.guide)||!['manual','supported'].includes(p.route))return reject('Choose a crew guide and driving route.');
    state.guide=p.guide;state.route=p.route;state.phase='prediction';state.attempts++;
  } else if(action==='guide') {
    if(!OPENLINE_GUIDES.includes(p.guide))return reject('Choose an available guide.');
    state.guide=p.guide;
  } else if(action==='predict') {
    if(state.phase!=='prediction'||!predictions.includes(p.prediction))return reject('Choose a prediction, including unsure.');
    state.prediction=p.prediction;state.phase='evidence';
  } else if(action==='manual') {
    const proof=qualifiedManual(p.result||p);
    if(state.phase!=='evidence'||!proof)return reject('Complete the controlled-stop exercise to record your measurement.');
    state.manual=proof;
  } else if(action==='evidence') {
    if(state.phase!=='evidence')return reject('Make a prediction before running the comparison.');
    const evidence=qualifiedEvidence(p);
    if(!evidence)return reject('The comparison needs two complete, comparable simulation traces. Retry the study.');
    const manual=qualifiedManual(p.manual)||state.manual;
    if(state.route==='manual'&&!manual)return reject('Complete the controlled-stop exercise or choose the supported route.');
    state.manual=manual;state.evidence=evidence;state.phase='choice';
  } else if(action==='choice') {
    if(state.phase!=='choice'||!['publish','repeat'].includes(p.choice))return reject('Review the evidence, then choose how to submit it.');
    state.choice=p.choice;
    if(p.choice==='repeat'){state.repeats++;state.phase='evidence';}
    else state.phase='drive';
  } else if(action==='driving') {
    if(state.phase!=='drive')return reject('Complete the crew comparison before homologation.');
    const proof=qualifiedDriving(p);
    if(!proof)return reject('Complete a clean qualified lap or corner without contact or a reset.');
    state.driving=proof;state.phase='complete';
    const earned=!state.rewardClaimed;
    if(earned)state.completion={missionId:'light-the-beacon',version:1,route:state.route,evidence:clone(state.evidence),manual:state.manual?clone(state.manual):null,driving:clone(proof)};
    state.completed=true;state.rewardClaimed=true;state.memories=['beacon-lit','signed-test-card','beacon-stripe'];
    state.bonds={neri:true,tavi:true,maela:true,sola:true};
    return {state,accepted:true,reason:earned?'The teaching room is open. Your beacon memory is saved.':'Chapter replay complete. Your original memory is preserved.',earned};
  } else if(action==='replay') {
    if(!state.completed)return reject('Finish this chapter before replaying it.');
    const fresh=defaultOpenline();
    Object.assign(fresh,{guide:state.guide,route:state.route,completed:true,rewardClaimed:true,completion:clone(state.completion),memories:[...state.memories],bonds:{...state.bonds},attempts:state.attempts,repeats:state.repeats});
    return {state:fresh,accepted:true,reason:'Chapter replay ready. Your garage memory stays.',earned:false};
  } else if(action==='route') {
    if(!['intro','prediction','evidence'].includes(state.phase)||!['manual','supported'].includes(p.route))return reject('Choose a route before submitting the comparison.');
    state.route=p.route;
  } else return reject('Unknown chapter action.');
  return {state:clone(state),accepted:true,reason:'Chapter progress saved.',earned:false};
}
