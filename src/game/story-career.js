// Story Tour client: short briefings lead directly to observed driving objectives.
// Credits and medals come from completed physical runs, never from viewing a scene.
import { MISSIONS, CAREER_PARTS, applyCareerAction, normalizeStoryCareer, missionUnlocked, rideUnlocked, nextMission, buildCareerCar, upgradePrice, careerDialogue } from './career-mode.js';
import { RIDES, getRide } from '../sim/rides.js';
import { getCircuit } from '../sim/circuits.js';
import { progressOf, selectedCar } from './progress.js';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const TYPES={sprint:'DELIVERY SPRINT',checkpoint:'CHECKPOINT RUSH',duel:'HEAD-TO-HEAD',timetrial:'TIME ATTACK',clean:'PRECISION STINT',race:'GRID RACE'};
const ACTS=['THE FIRST LIGHT','A CREW WORTH KEEPING','THE CROWNLINE INVITATIONAL','THE OPEN SEASON'];
const TOTAL=String(MISSIONS.length).padStart(2,'0');
const fmt=t=>Number.isFinite(t)?`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`:'—';
const cleanName=line=>{const i=line.indexOf(':');return i<0?['CREW',line]:[line.slice(0,i),line.slice(i+1).trim()];};
const speakerId=name=>({Neri:'neri',Tavi:'tavi',Maela:'maela',Sola:'sola',Veska:'veska'}[name]||'neri');
export class StoryCareerClient {
 constructor(game){this.game=game;this.active=false;this.launching=false;this.activeMission=null;this.run=null;this.pending=null;this.result=null;this.focusMission=null;this.chapter=1;this.hudAge=0;this._preview='';}
 get state(){return this.game.save.data.storyCareer;}
 rideId(){return progressOf(this.game.save.data).ride;}
 // The car a story event is driven in: the garage build plus the crew chief and setup chosen for the event.
 carFor(rideId){return buildCareerCar(selectedCar(this.game.save.data,rideId),{...this.state,parts:{grip:0,aero:0,gearing:0}});}
 get selected(){return MISSIONS.find(m=>m.id===(this.focusMission||this.state.selectedMission))||MISSIONS[0];}
 wire(){
  const on=(id,fn)=>$(id)?.addEventListener('click',fn);
  on('career-start',()=>this.start());on('career-quick-start',()=>this.start(this.result?.success?nextMission(this.state).id:this.result?.mission?.id));on('career-retry',()=>this.start(this.result?.mission?.id));
  on('career-result-next',()=>{this.result=null;const m=nextMission(this.state);this.change('select',{missionId:m.id});this.focusMission=m.id;this.chapter=m.chapter;this.renderCareer();this.scrollEvent();});
  on('career-result-map',()=>{this.result=null;this.renderCareer();$('career-mission-list').scrollIntoView({block:'nearest',behavior:'instant'});});
  on('career-hud-exit',()=>this.game.pause());
  const preview=$('career-car-rotate');let pointer=null,lastX=0;
  preview?.addEventListener('pointerdown',event=>{pointer=event.pointerId;lastX=event.clientX;preview.setPointerCapture(pointer);});
  preview?.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;this.game.lobbyAngle=(this.game.lobbyAngle||0)+(event.clientX-lastX)*.008;lastX=event.clientX;});
  const release=event=>{if(event.pointerId===pointer)pointer=null;};preview?.addEventListener('pointerup',release);preview?.addEventListener('pointercancel',release);preview?.addEventListener('lostpointercapture',()=>pointer=null);
 }
 change(action,payload={},quiet=false){
  const result=applyCareerAction(this.state,action,payload);
  if(result.accepted){this.game.save.data.storyCareer=result.state;const saved=this.game.save.save();if(!quiet)this.status(saved?result.reason:'Device storage is unavailable. This progress lasts for this session.');}
  else if(!quiet)this.status(result.reason);
  return result;
 }
 status(message){for(const id of ['career-status','career-workshop-status'])if($(id))$(id).textContent=message;}
 render(screen){
  if(!$('career-hud'))return;
  $('career-hud').hidden=!(this.active&&this.game.mode==='race'&&this.game.screen==='none'&&!this.game.paused);
  if(screen==='hub'&&$('hub-next-title')){const m=nextMission(this.state);this.game.hub.nextDestination='career';$('hub-next-title').textContent=m.title;$('hub-next-detail').textContent=Object.values(this.state.records).filter(r=>r.completed).length+' of '+MISSIONS.length+' events done · Act '+m.chapter;}
 }
 renderCareer(){this.game.pad.render('career');}
 scrollEvent(){}
 renderCareerLegacy(){
  const state=this.state,m=this.selected;
  if(!this.focusMission){this.focusMission=state.selectedMission;this.chapter=m.chapter;}
  $('career-stars').textContent=Object.values(state.records).reduce((sum,r)=>sum+r.stars,0);$('career-credits').textContent=state.credits.toLocaleString();
  const chapters=$('career-chapter-tabs');chapters.replaceChildren();
  for(let c=1;c<=ACTS.length;c++){const b=node('button');b.type='button';b.setAttribute('aria-pressed',String(c===this.chapter));const text=node('span');text.append(node('small','',`ACT 0${c}`),node('span','',ACTS[c-1]));b.append(node('b','',String(c).padStart(2,'0')),text);b.addEventListener('click',()=>{this.chapter=c;this.focusMission=MISSIONS.find(x=>x.chapter===c).id;this.result=null;this.renderCareer();});chapters.append(b);}
  $('career-act-name').textContent=`ACT 0${this.chapter} · ${ACTS[this.chapter-1]}`;
  const list=$('career-mission-list');list.replaceChildren();
  for(const mission of MISSIONS.filter(x=>x.chapter===this.chapter)){
   const unlocked=missionUnlocked(state,mission.id),record=state.records[mission.id],b=node('button','sc-mission'+(unlocked?'':' is-locked'));b.type='button';b.dataset.mission=mission.id;b.setAttribute('aria-pressed',String(mission.id===m.id));b.append(node('span','sc-node-number',String(mission.index+1).padStart(2,'0')),node('small','',unlocked?TYPES[mission.type]:'COMPLETE THE PREVIOUS EVENT'),node('strong','',mission.title),node('span','sc-node-stars',unlocked?record.stars+' / 3 ★':'⌁ LOCKED'));
   b.addEventListener('click',()=>{this.focusMission=mission.id;this.result=null;if(unlocked)this.change('select',{missionId:mission.id},true);this.renderCareer();this.scrollEvent();});list.append(b);
  }
  $('career-event').hidden=!!this.result;$('career-result').hidden=!this.result;
  if(this.result){this.renderResult();return;}
  $('career-event-title').textContent=m.title;$('career-event-copy').textContent=m.objective;$('career-event-type').textContent=TYPES[m.type];$('career-event-number').textContent=String(m.index+1).padStart(2,'0')+' / '+TOTAL;
  $('career-event-track').textContent=getCircuit(m.trackId).name.toUpperCase();$('career-event-ride').textContent=getRide(this.rideId()).name.toUpperCase();
  const goals=$('career-event-goals');goals.replaceChildren();
  for(const text of [this.completionGoal(m),`Time medal: ${fmt(m.targetTime)} or faster`,'Clean medal: zero car or barrier contacts']){const row=node('div','sc-goal');row.append(node('span','','★'),node('span','',text));goals.append(row);}
  const [speaker,line]=cleanName(m.before[0]);$('career-brief-name').textContent=speaker.toUpperCase();$('career-brief-line').textContent=line;$('career-brief-portrait').className='sc-portrait ol-portrait ol-portrait-'+speakerId(speaker);$('career-brief-portrait').setAttribute('aria-label',speaker);$('career-brief-portrait').textContent=speaker==='Veska'?'VT':'';
  this.renderOptions();const unlocked=missionUnlocked(state,m.id);$('career-start').disabled=!unlocked;$('career-start-kicker').textContent=unlocked?(state.records[m.id].completed?'REPLAY · IMPROVE YOUR MEDALS':'READY WHEN YOU ARE'):'EARN THIS GRID ENTRY';$('career-start').querySelector('strong').textContent=unlocked?'LET’S RIDE':'EVENT LOCKED';$('career-quick-start').disabled=!unlocked;$('career-quick-event').textContent=m.title;$('career-quick-start').querySelector('strong').textContent=unlocked?'RIDE NOW ↗':'EVENT LOCKED';
 }
 completionGoal(m){if(m.type==='race'||m.type==='duel')return `${m.laps} lap${m.laps>1?'s':''} · ${m.requiredPosition===1?'Win the duel':'Finish top '+m.requiredPosition}`;if(m.type==='timetrial')return 'Record one valid timed lap';if(m.type==='clean')return 'Complete one contact-free lap';return `${m.checkpoints} ordered gates · ${m.minDistance} m · ${fmt(m.timeLimit)} limit`;}
 renderOptions(){
  const s=this.state;
  const render=(id,items,current,fn)=>{const host=$(id);host.replaceChildren();for(const [value,label] of items){const b=node('button','',label);b.type='button';b.dataset.option=value;b.setAttribute('aria-pressed',String(current===value));b.addEventListener('click',()=>{fn(value);this.renderCareer();});host.append(b);}};
  render('career-crew-options',[['mentor','Maela · Control'],['engineer','Tavi · Aero']],s.crew,choice=>this.change('crew',{choice}));
  render('career-setup-options',[['balanced','Balanced'],['grip','Grip'],['speed','Speed']],s.setup,setup=>this.change('setup',{setup}));
  $('career-strategy-note').textContent=(s.crew==='mentor'?'Maela: gentler steering response and more progressive tire slip. ':'Tavi: more downforce with a small drag cost. ')+(s.setup==='grip'?'Grip setup: stronger tire grip, more drag.':s.setup==='speed'?'Speed setup: less drag, less cornering downforce.':'Balanced setup: preserve the ride’s original aero balance.');
 }
 start(id){
  const mission=MISSIONS.find(m=>m.id===(id||this.selected.id))||this.selected;
  if(!missionUnlocked(this.state,mission.id)){this.status('Finish the previous event to earn this entry.');return;}
  const ready=()=>this.game.pad.readyStory(mission.id);this.briefed=this.briefed||new Set();
  if(this.state.records[mission.id].completed||this.briefed.has(mission.id)||!this.game.juice){ready();return;}
  this.briefed.add(mission.id);
  this.game.juice.cutscene(careerDialogue(this.state,mission.id,false),{title:mission.title,kicker:'Act '+mission.chapter+' · Event '+(mission.index+1)+' of '+MISSIONS.length,done:ready});
 }
 begin(id){
  const mission=MISSIONS.find(m=>m.id===(id||this.selected.id))||this.selected;
  if(!missionUnlocked(this.state,mission.id)){this.status('Finish the previous event to earn this entry.');return;}
  this.change('select',{missionId:mission.id},true);this.focusMission=mission.id;this.result=null;
  const ride=getRide(this.rideId()),car=this.carFor(ride.id);
  this.active=true;this.launching=true;this.activeMission=mission;this.pending=null;
  try{if(this.game.launchCareerMission({...mission,rideId:ride.id,circuitId:mission.trackId},car,{crew:this.state.crew,setup:this.state.setup})===false)throw new Error('The selected circuit could not load.');}
  catch(e){this.active=false;this.launching=false;this.status('This ride could not start. '+e.message);return;}
  this.launching=false;
  const v=this.game.veh,p=this.game.track.project(v.x,v.z,-1,{});
  this.run={attemptId:`tour-${mission.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,elapsed:0,distance:0,netProgress:0,checkpoints:0,lapCount:0,validLaps:0,lapTime:null,contacts:0,carContactEpisodes:0,carContactQuiet:.3,resets:0,wrongWay:false,nonfinite:false,autonomous:false,inputTime:0,startS:p.s,lastS:p.s,lastX:v.x,lastZ:v.z,lastTime:v.time,impact:v.impactCount||0,carImpact:v.carImpactCount||0,nan:v.nanResets||0,offTime:0,reverseTime:0,calls:{},lastPosition:this.game.field?.entries[0]?.pos||1,gateSpacing:['sprint','checkpoint'].includes(mission.type)?mission.minDistance/mission.checkpoints:this.game.track.length/12,nextGateS:0};
  this.run.nextGateS=(p.s+this.run.gateSpacing)%this.game.track.length;this.hudAge=1;this.updateHud();this.game.show('none');
 }
 step(dt,raw={}){
  if(!this.active||!this.run||this.pending)return;
  const g=this.game,v=g.veh,r=this.run,m=this.activeMission;
  if(!Number.isFinite(dt)||dt<=0||dt>.1)return;
  r.elapsed+=dt;this.hudAge+=dt;
  if(![v.x,v.z,v.time,v.forwardSpeed].every(Number.isFinite)){r.nonfinite=true;this.fail('The car data was interrupted. Retry this event.');return;}
  const moved=Math.hypot(v.x-r.lastX,v.z-r.lastZ),speed=Math.hypot(v.vx,v.vz),p=g.track.project(v.x,v.z,-1,{});let ds=p.s-r.lastS;
  if(ds>g.track.length/2)ds-=g.track.length;if(ds<-g.track.length/2)ds+=g.track.length;
  if(v.time<r.lastTime||moved>Math.max(3,speed*dt*2+.5)||(v.nanResets||0)!==r.nan){r.resets++;this.fail('A reset interrupted the run. Your previous medals are safe.');return;}
  const off=v.wheels.every(w=>w.offTrack)||Math.abs(p.d)>g.track.halfWidth+.3;
  const along=v.vx*g.track.tx[p.i]+v.vz*g.track.tz[p.i];
  r.offTime=off?r.offTime+dt:0;r.reverseTime=along<-2?r.reverseTime+dt:Math.max(0,r.reverseTime-dt);
  const legitimate=!off&&Math.abs(ds)<=Math.max(.5,speed*dt*2+.1);
  if(legitimate){r.netProgress+=ds;r.distance=Math.max(0,r.netProgress);const gates=Math.floor(r.distance/r.gateSpacing);if(gates>r.checkpoints){r.checkpoints=gates;r.nextGateS=(r.startS+(r.checkpoints+1)*r.gateSpacing)%g.track.length;}}
  const touchingCar=!!v.carHits?.some(hit=>hit.impulse>0);
  if(touchingCar){if(r.carContactQuiet>=.25)r.carContactEpisodes++;r.carContactQuiet=0;}else r.carContactQuiet+=dt;
  r.contacts=Math.max(0,(v.impactCount||0)-r.impact)+r.carContactEpisodes;
  if(g.autopilot&&!g.field?.entries[0]?.finished)r.autonomous=true;
  if(Math.abs(raw.steer||0)>.05||(raw.throttle||0)>.1||(raw.brake||0)>.1)r.inputTime+=dt;
  r.lastS=p.s;r.lastX=v.x;r.lastZ=v.z;r.lastTime=v.time;
  if(r.reverseTime>.8){r.wrongWay=true;this.fail('Wrong direction. Follow the event gates and try again.');return;}
  if(r.offTime>.35){this.fail('The route left the circuit. Follow the gates and retry.');return;}
  if(r.contacts>m.maxContacts){this.fail(m.maxContacts===0?'The equipment test needs a contact-free run. Try a smoother line.':'Too many contacts. Try Maela’s control setup and another run.');return;}
  if(r.elapsed>m.timeLimit){this.fail('The clock expired. Try a faster line or a different workshop setup.');return;}
  if(['sprint','checkpoint'].includes(m.type)&&r.distance>=m.minDistance&&r.checkpoints>=m.checkpoints)this.queue();
  this.radio();
  if(this.hudAge>.08){this.hudAge=0;this.updateHud();}
 }
 radio(){
  const r=this.run,m=this.activeMission,g=this.game,progress=r.distance/Math.max(m.minDistance,g.track.length*(m.laps||0));
  const say=(key,text)=>{if(r.calls[key])return;r.calls[key]=true;g.coach(text,2.6,'career-'+m.id+'-'+key);};
  if(r.contacts>0)say('contact','Maela: We’re still rolling. Give yourself room on the next exit.');
  if(progress>.25)say('quarter',this.state.crew==='engineer'?'Tavi: The setup is holding. Keep the next braking point repeatable.':'Maela: You have a rhythm now. Look through the next bend.');
  if(progress>.72)say('near',m.type==='race'||m.type==='duel'?'Neri: Final push. Clean exits—don’t hand the place back.':'Tavi: Nearly home. Finish the route; the last gate matters too.');
  const position=g.field?.entries[0]?.pos;
  if(position&&position<r.lastPosition&&r.elapsed>5)say('pass','Sola: That was a proper move. Now keep the place.');
  if(position)r.lastPosition=position;
 }
 onRaceEvent(ev){
  if(!this.active||!this.run||this.pending)return;
  if(ev.type==='lap'){
   const r=this.run;r.lapCount++;if(ev.lap.valid){r.validLaps++;r.lapTime=Math.min(r.lapTime||Infinity,ev.lap.time);}
   if(['race','duel'].includes(this.activeMission.type)&&this.game.field?.entries[0]?.finished)this.queue();
   else if(['timetrial','clean'].includes(this.activeMission.type)&&ev.lap.valid)this.queue();
   else if(['timetrial','clean'].includes(this.activeMission.type))this.game.toast('Lap invalid. Start another clean lap; the event clock is still running.');
  }
 }
 proof(){
  const r=this.run,g=this.game,e=g.field?.entries[0];
  return {missionId:this.activeMission.id,attemptId:r.attemptId,validated:true,supported:false,autonomous:r.autonomous,inputTime:r.inputTime,elapsed:r.elapsed,distance:r.distance,checkpoints:r.checkpoints,lapCount:r.lapCount,validLaps:r.validLaps,lapTime:r.lapTime,contacts:r.contacts,resets:r.resets,wrongWay:r.wrongWay,nonfinite:r.nonfinite,position:e?.pos||1,fieldSize:g.field?.entries.length||1,finished:!!e?.finished};
 }
 queue(){if(this.pending)return;if(this.run.inputTime<.3){this.fail('Use steering or pedals to drive this event. Supported demonstrations do not earn career rewards.');return;}this.pending={proof:this.proof()};}
 fail(reason){if(!this.pending)this.pending={proof:this.proof(),failure:reason};}
 onReset(){if(this.active){this.run.resets++;this.fail('Car reset. Retry this event from the starting line.');}}
 onSessionEnd(){if(!this.active)return false;this.fail('You returned to the crew before the objective was complete.');this.flush();return true;}
 abort(){this.active=false;this.launching=false;this.activeMission=null;this.run=null;this.pending=null;if($('career-hud'))$('career-hud').hidden=true;}
 flush(){
  if(!this.pending)return;
  const pending=this.pending,mission=this.activeMission;this.pending=null;
  let outcome;const before={...this.state.records[mission.id]};
  if(pending.failure)outcome={success:false,stars:0,earned:0,reason:pending.failure,accepted:false};
  else outcome=this.change('result',pending.proof,true);
  const won=!!(outcome.accepted&&outcome.success),first=won&&!before.completed;
  if(won)this.game.pad?.onStory({success:true,first,newStars:Math.max(0,(outcome.stars||0)-(before.stars||0))});
  this.result={mission,proof:pending.proof,...outcome};
  if(!outcome.accepted)this.result.success=false;
  this.active=false;$('career-hud').hidden=true;this.game.returnCareerMenu();this.chapter=mission.chapter;this.focusMission=mission.id;this.renderCareer();this.scrollEvent();
  const j=this.game.juice;if(!j||!won)return;
  const cheer=()=>{if(outcome.unlockedRide){j.pop(getRide(outcome.unlockedRide).name,'New car in your garage','win');j.confetti(150);}else if(outcome.stars===3)j.confetti(90);this.game.pad.render('career');};
  if(first)j.cutscene(careerDialogue(this.state,mission.id,true),{title:mission.title,kicker:'Event complete',done:cheer});else cheer();
 }
 updateHud(){
  if(!this.active||!this.run)return;const r=this.run,m=this.activeMission,g=this.game;
  let goal,detail,progress;
  if(['sprint','checkpoint'].includes(m.type)){goal=`GATE ${Math.min(r.checkpoints,m.checkpoints)} / ${m.checkpoints}`;detail=`${Math.max(0,m.timeLimit-r.elapsed).toFixed(1)}s · ${Math.min(m.minDistance,Math.floor(r.distance))}/${m.minDistance} m`;progress=Math.min(1,Math.min(r.distance/m.minDistance,r.checkpoints/m.checkpoints));}
  else if(['race','duel'].includes(m.type)){const e=g.field?.entries[0];goal=`P${e?.pos||1} / ${m.fieldSize} · LAP ${Math.min(m.laps,(e?.lap||0)+1)} / ${m.laps}`;detail=m.requiredPosition===1?'Win this duel':'Finish top '+m.requiredPosition;progress=Math.min(1,r.distance/Math.max(m.minDistance,g.track.length*m.laps));}
  else{goal=m.type==='clean'?'ZERO CONTACTS · CLEAN STINT':'RECORD A VALID LAP';detail=`${Math.max(0,m.timeLimit-r.elapsed).toFixed(1)}s left · ${r.contacts} contacts`;progress=Math.min(1,r.distance/g.track.length);}
  $('career-hud-goal').textContent=goal;$('career-hud-detail').textContent=detail;$('career-hud-progress').value=progress;
 }
 renderResult(){
  const r=this.result,m=r.mission,proof=r.proof;const record=this.state.records[m.id];
  const next=r.success?nextMission(this.state):m;$('career-quick-start').disabled=false;$('career-quick-event').textContent=next.title;$('career-quick-start').querySelector('strong').textContent=r.success?'NEXT RIDE ↗':'TRY AGAIN ↗';
  $('career-result-kicker').textContent=r.success?'EVENT COMPLETE':'BACK TO THE START';$('career-result-title').textContent=r.success?(r.stars===3?'THAT WAS YOUR LINE.':'YOU MADE THE CUT.'):'ONE MORE RIDE.';
  $('career-result-stars').textContent='★'.repeat(r.stars||0)+'☆'.repeat(3-(r.stars||0));$('career-result-stars').setAttribute('aria-label',`${r.stars||0} of three medals earned`);
  const host=$('career-result-metrics');host.replaceChildren();for(const [label,value] of [['Time',fmt(m.type==='timetrial'?proof.lapTime:proof.elapsed)],['Contacts',String(proof.contacts)],['This reward',`+${r.earned||0} CR`],['Your best',fmt(record.bestTime)]]){const box=node('div');box.append(node('small','',label),node('strong','',value));host.append(box);}
  $('career-result-story').textContent=r.success?careerDialogue(this.state,m.id,true).slice(0,2).join(' '):r.reason||'Retry the event with a different line or setup.';
  $('career-result-unlock').textContent=r.unlockedRide?getRide(r.unlockedRide).name+' unlocked · waiting in your workshop':r.success?'Medals saved. Replays award only newly improved medals.':'Existing medals and credits are preserved. There is no fuel timer.';
  $('career-result-next').hidden=!r.success;$('career-result-next').querySelector('strong').textContent=m.index===MISSIONS.length-1?'YOUR STORY TOUR':'NEXT RIDE';
 }
 renderWorkshop(){
  const s=this.state,ride=getRide(s.selectedRide),car=buildCareerCar(ride.car,s);$('career-workshop-credits').textContent=s.credits.toLocaleString();
  $('career-workshop-h').textContent=ride.name;$('career-ride-description').textContent=ride.tagline;
  const peak=Math.max(...car.engine.curve.map(([rpm,torque])=>rpm*torque*Math.PI/30/1000*car.gearbox.efficiency));const stats=$('career-workshop-stats');stats.replaceChildren();for(const [label,value] of [['POWER',Math.round(peak)+' kW'],['MASS',Math.round(car.mass)+' kg'],['GRIP','μ '+car.tire.mu.toFixed(2)]]){const item=node('div');item.append(node('small','',label),node('strong','',value));stats.append(item);}
  const rides=$('career-rides');rides.replaceChildren();for(const item of RIDES){const available=rideUnlocked(s,item.id),button=node('button','sc-ride'+(available?'':' is-locked'));button.type='button';button.dataset.ride=item.id;button.setAttribute('aria-pressed',String(item.id===s.selectedRide));button.append(node('small','',available?'READY TO RIDE':'STORY REWARD'),node('strong','',item.name),node('span','',available?item.tagline:item.id==='vx1'?'Unlock: Beat the closing bell':'Unlock: Keep the lights steady'));button.addEventListener('click',()=>{const outcome=this.change('ride',{rideId:item.id});if(outcome.accepted){this._preview='';this.renderWorkshop();}});rides.append(button);}
  const parts=$('career-parts');parts.replaceChildren();for(const part of CAREER_PARTS){const level=s.parts[part.id],price=upgradePrice(s,part.id),box=node('div','sc-part'),top=node('div','sc-part-top');top.append(node('strong','',part.name),node('small','',`TIER ${level} / 3`));box.append(top,node('p','',part.effect));const b=node('button','',price===null?'FULLY BUILT':`BUILD TIER ${level+1} · ${price} CR`);b.type='button';b.dataset.part=part.id;b.disabled=price===null||s.credits<price;b.addEventListener('click',()=>{const result=this.change('buy',{part:part.id});if(result.accepted){this._preview='';this.renderWorkshop();}});box.append(b);parts.append(box);}
  const sig=JSON.stringify([ride.id,s.parts,s.crew,s.setup]);if(this._preview!==sig){this._preview=sig;this.game.configureDrive(ride.id,this.game.currentCircuitId||'harbor_loop',car);}
 }
}
