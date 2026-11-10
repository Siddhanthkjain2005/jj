// Authored first chapter. Every measurement comes from the vehicle model; driving
// completion is observed from race/academy events, never from a timer or a button.
import { updateOpenline } from './openline-state.js';
import { STORY_CHARACTERS, STORY_CITIES, STORY_CIRCUITS } from './openline-data.js';
import { runLabExperiment } from '../sim/lab.js';
import { AIDriver } from '../sim/ai.js';
import { CIRCUITS } from '../sim/circuits.js';

const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const PHASES=['intro','prediction','evidence','choice','drive','complete'];
const STAGES={
 intro:['A light worth leaving on','The harbor teaching room needs a witnessed test. Join Neri, Tavi, Maela and Sola at Openline Garage.'],
 prediction:['First, make a prediction','Tavi proposes tires with 15% more peak friction. At the same entry speed, what happens to stopping distance?'],
 evidence:['One change. Two real traces.','Compare the standard VX-1 with Tavi’s grip study. You can also drive your own controlled stop.'],
 choice:['What can we honestly claim?','Shorter stopping distance is one finding, not a universally better car. Publish the conditions or repeat the experiment.'],
 drive:['A rival. A witness. Your clean lap.','Sola joins the Harbor grid. Finish one clean timed lap; position does not matter. Retry freely or watch a supported exhibition.'],
 complete:['You left the light on.','The teaching room has its permit. Your signed test card and beacon stripe are now part of this garage.']
};
const LINES={
 intro:[['maela','That light used to mean anyone could come in and learn. Let’s give it a reason to shine again.'],['neri','I can do fast. “Credible evidence” might need a little help.'],['tavi','One question. One changed variable. We can start there.'],['sola','I’m here as a witness. You don’t have to beat me to prove your work.']],
 prediction:[['tavi','A prediction isn’t a promise to be right. “I’m unsure” is a useful beginning.']],
 evidence:[['tavi','Both cars start braking at the same speed. These traces are computed by our actual vehicle model.'],['maela','Drive a stop yourself if you like. Supported measurement is a valid way into this story too.']],
 choice:[['neri','I wanted to call them the best tires. But we only tested one condition.'],['tavi','Then that’s the sentence we publish. A useful result comes with its limits.']],
 drive:[['sola','Same car rules. A clean finish, not a victory. I’ll see you on the line.'],['maela','The supported exhibition uses the same car simulation. It earns a story memory, never a competitive record.']],
 complete:[['neri','Look. Someone’s already put a notebook on the new bench. We did that.'],['tavi','Not because the first guess was perfect. Because we checked.'],['sola','I signed your test. That part is mine to stand behind.'],['maela','I once signed a report without all its conditions. Next time, I’ll tell you why.']]
};
export class OpenlineCampaign {
 constructor(game){this.game=game;this.active=false;this.supported=false;this.launching=false;this.lesson=null;this.pending=null;this.busy=false;this.dialogue=0;this.tab='crew';this.selected='neri';this.lapCounts=null;this.lapReset=false;}
 get state(){return this.game.save.data.openline;}
 wire(){
  const on=(id,fn)=>$(id)?.addEventListener('click',fn);
  on('btn-story-continue',()=>{if(this.state.phase==='intro')this.change('begin',{guide:this.state.guide,route:'supported'});$('story-stage').scrollIntoView({block:'start',behavior:'instant'});$('story-stage').focus({preventScroll:true});});
  for(const p of ['shorter','longer','unsure'])on('btn-story-predict-'+p,()=>this.change('predict',{prediction:p}));
  on('btn-story-supported',()=>this.runEvidence());
  on('btn-story-braking',()=>this.startLesson('braking'));
  on('btn-story-publish',()=>this.change('choice',{choice:'publish'}));
  on('btn-story-repeat',()=>this.change('choice',{choice:'repeat'}));
  on('btn-story-drive',()=>this.startDrive(false));
  on('btn-story-supported-drive',()=>this.startDrive(true));
  on('btn-story-replay',()=>this.change('replay'));
  on('btn-story-livery',()=>this.equipReward());
  on('btn-story-dialogue-next',()=>{this.dialogue++;this.renderDialogue();});
  on('btn-openline-pause',()=>this.game.paused?this.game.resume():this.game.pause());
  on('btn-openline-return',()=>this.returnToStory());
  document.querySelectorAll('[data-universe-tab]').forEach(b=>b.addEventListener('click',()=>{this.tab=b.dataset.universeTab;this.selected=this.tab==='crew'?'neri':'lumen_harbor';this.renderUniverse();}));
  this.syncMemory();
 }
 change(action,payload={}){
  const result=updateOpenline(this.state,action,payload);
  if(!result.accepted){$('story-status').textContent=result.reason;return false;}
  this.game.save.data.openline=result.state;
  const saved=this.game.save.save();this.dialogue=Math.max(0,LINES[result.state.phase].findIndex(line=>line[0]===result.state.guide));this.syncMemory();this.render(this.game.screen);
  $('story-status').textContent=saved?result.reason:'Progress is session-only: device storage is unavailable.';
  if(this.game.screen==='story' && action!=='guide'){$('story-stage').scrollIntoView({block:'start',behavior:'instant'});$('story-stage').focus({preventScroll:true});}
  return true;
 }
 syncMemory(){document.body.classList.toggle('openline-complete',this.state.completed);}
 render(screen){
  $('openline-hud').hidden=!(this.active&&this.game.mode==='race'&&this.game.screen==='none'&&!this.game.paused);
  if(screen==='story')this.renderStory();
  if(screen==='universe')this.renderUniverse();
  if(screen==='hub'){
   this.game.hub.nextDestination='story';
   $('hub-next-title').textContent=this.state.completed?'Your beacon is burning':'Light the Beacon';
   $('hub-next-detail').textContent=this.state.completed?'Chapter complete · Revisit your crew':'Four people. One garage. Your first crew story.';
  }
 }
 renderStory(){
  const s=this.state,[title,copy]=STAGES[s.phase];
  $('story-stage-title').textContent=title;$('story-stage-copy').textContent=copy;
  $('story-guide-name').textContent=STORY_CHARACTERS.find(c=>c.id===s.guide).name+' · Your guide';
  const saveLabel=document.querySelector('.ol-cover-foot span:last-child');
  saveLabel.textContent=this.game.save.available?'Saved on this device ◆':'Session only · Storage unavailable';
  for(const phase of PHASES){$('story-panel-'+phase).hidden=s.phase!==phase;const step=document.querySelector('[data-story-step="'+phase+'"]');if(step){step.classList.toggle('is-current',phase===s.phase);step.classList.toggle('is-done',PHASES.indexOf(phase)<PHASES.indexOf(s.phase));if(phase===s.phase)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');}}
  const host=$('story-guide-cards');host.replaceChildren();
  for(const c of STORY_CHARACTERS.filter(c=>c.active)){
   const b=el('button','ol-guide');b.type='button';b.dataset.guide=c.id;b.setAttribute('aria-pressed',String(s.guide===c.id));
   b.append(el('span','ol-portrait ol-portrait-'+c.id),el('strong','',c.name),el('small','',c.id==='neri'?'Feel the line':c.id==='tavi'?'Ask a better question':c.id==='maela'?'Build your confidence':'Respect your rival'));
   b.addEventListener('click',()=>this.change('guide',{guide:c.id}));host.append(b);
  }
  $('story-evidence').replaceChildren();
  if(s.evidence){
   const {baseline,study}=s.evidence;
   for(const [label,value] of [['Standard stop',baseline.metrics.brakingMetres.toFixed(2)+' m'],['Grip study stop',study.metrics.brakingMetres.toFixed(2)+' m'],['Entry speed',baseline.metrics.brakingEntryKmh.toFixed(1)+' / '+study.metrics.brakingEntryKmh.toFixed(1)+' km/h']]){
    const box=el('div','ol-measure');box.append(el('small','',label),el('strong','',value));$('story-evidence').append(box);
   }
   this.trace(s.evidence);
  }
  const prediction=s.prediction==='unsure'?'You began unsure.':s.prediction?'You predicted a '+s.prediction+' stop.':'';
  $('story-evidence-note').textContent=s.evidence?prediction+' Higher modeled grip shortened this stop. These fictional model results are not real-car measurements.':s.manual?`Your controlled stop: ${s.manual.brakingDistance.toFixed(1)} m from ${s.manual.entryKmh.toFixed(1)} km/h. Run the comparison to review Tavi’s study.`:'Same car mass, dry straight, ABS, same entry speed. Only peak tire friction changes.';
  $('story-memory').textContent=s.completed?'BEACON LIT · SIGNED TEST CARD · TEACHING ROOM OPEN':'Your memory will appear after the homologation.';
  $('story-complete-copy').textContent=s.driving?.assistClass==='story-supported'?'You witnessed a clean supported exhibition. Your story memory is saved separately from competitive records.':'Your clean driving and honest evidence reopened the teaching room. The crew will remember.';
  $('btn-story-supported').disabled=this.busy;
  this.renderDialogue();
 }
 renderDialogue(){
  const lines=LINES[this.state.phase],line=lines[this.dialogue%lines.length],c=STORY_CHARACTERS.find(c=>c.id===line[0]);
  $('story-dialogue-name').textContent=c.name;$('story-dialogue-line').textContent=line[1];
  $('story-dialogue-name').style.color=c.color;
  $('story-speaker-portrait').className='ol-dialogue-portrait ol-portrait ol-portrait-'+c.id;
  $('story-speaker-portrait').setAttribute('aria-label',c.name);
  $('btn-story-dialogue-next').textContent=lines.length===1?'Read again':'Next voice · '+(this.dialogue%lines.length+1)+'/'+lines.length;
 }
 trace(evidence){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 460 155');svg.setAttribute('role','img');svg.setAttribute('aria-label','Actual braking traces. Ivory standard car, cyan grip study. Speed falls to zero; exact stop distances are shown above.');
  const all=[evidence.baseline.samples.braking,evidence.study.samples.braking],max=Math.max(...all.map(a=>a[a.length-1].distance));
  all.forEach((a,i)=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',a.map((p,j)=>`${j?'L':'M'}${20+p.distance/max*420} ${130-p.speedKmh/105*110}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',i?'#48dde1':'#e7ece7');path.setAttribute('stroke-width','3');if(!i)path.setAttribute('stroke-dasharray','6 4');svg.append(path);});
  $('story-evidence').append(svg);
 }
 async runEvidence(){
  if(this.busy)return;this.busy=true;$('story-status').textContent='Running both cars through the 120 Hz vehicle model…';this.renderStory();
  await new Promise(resolve=>setTimeout(resolve,60));
  try{
   if(this.state.route==='manual'&&!this.state.manual)this.change('route',{route:'supported'});
   this.change('evidence',{baseline:runLabExperiment('baseline'),study:runLabExperiment('grip')});
  }catch(e){$('story-status').textContent='The study could not finish. Please retry. '+e.message;}
  finally{this.busy=false;this.renderStory();}
 }
 startLesson(id){
  if(this.state.phase!=='evidence')return;
  this.change('route',{route:'manual'});this.game.startSchool(id);this.lesson=id;this.active=true;this.supported=false;
  this.game.show('none');
 }
 onLesson(event){
  if(!this.lesson)return false;
  const id=this.lesson;this.lesson=null;
  if(id==='braking')this.change('manual',{result:event.result});
  this.returnToStory();return true;
 }
 startDrive(supported){
  if(this.state.phase!=='drive')return;
  this.launching=true;this.game.startRace('race');this.launching=false;
  this.active=true;this.lesson=null;this.supported=supported;this.lapReset=false;this.lapCounts=null;this.pending=null;
  this.game.race.targetLaps=Infinity;this.game.field.laps=Infinity;
  if(supported){this.game.autopilot=new AIDriver({pace:.75,seed:46});this.game.autopilot.init=true;this.game.autopilot.offset=0;}
  $('hud-mode').textContent='OPENLINE · HOMOLOGATION';$('hud-best').textContent=supported?'SUPPORTED EXHIBITION':'ONE CLEAN LAP';
  this.game.show('none');
 }
 observe(){
  if(!this.active)return;
  $('openline-hud-goal').textContent=this.lesson?'Your controlled stop':'Light the Beacon · '+(this.supported?'Supported exhibition':'Homologation');
  const r=this.game.race;
  $('openline-hud-detail').textContent=this.lesson?'Reach 70 km/h, then brake smoothly.':this.lapReset?'This lap needs a retry. Cross the line to begin another clean lap.':'One clean timed lap. Position does not matter. Pause or return at any time.';
  $('openline-hud-progress').value=this.lesson?(this.game.school?.status.progress||0):Math.min(1,(r?.sectorNext||0)/3);
 }
 onRaceEvent(event){
  if(!this.active||this.lesson)return;
  const v=this.game.veh,counts=[v.impactCount||0,v.carImpactCount||0,v.nanResets||0];
  if(event.type==='invalid')this.lapReset=true;
  if(event.type==='start'){this.lapCounts=counts;this.lapReset=false;}
  if(event.type==='lap'){
   const base=this.lapCounts||counts,contacts=Math.max(0,counts[0]-base[0])+Math.max(0,counts[1]-base[1]),resets=Math.max(0,counts[2]-base[2])+(this.lapReset?1:0);
   if(event.lap.valid&&!contacts&&!resets)this.pending={kind:'lap',valid:true,elapsed:event.lap.time,lapTime:event.lap.time,distance:this.game.track.length,contacts,resets,assistClass:this.supported?'story-supported':event.lap.assist};
   this.lapCounts=counts;this.lapReset=false;
  }
 }
 flush(){
  if(!this.pending)return;const proof=this.pending;this.pending=null;
  if(this.change('driving',proof)){this.returnToStory();this.game.toast('The beacon is lit. Your crew memory is saved.');}
 }
 invalidate(message){if(this.active){this.lapReset=true;this.game.toast(message);}}
 leaveDrive(){this.active=false;this.lesson=null;this.pending=null;this.supported=false;this.game.autopilot=null;$('openline-hud').hidden=true;}
 returnToStory(){
  const g=this.game;this.leaveDrive();g.input.reset();g.mode='menu';g.paused=false;g.acc=0;g.school=null;g.pendingLessonResult=null;g.clearRivals();g.audio.mute(true);g.cam.snap();g.show('story');$('story-stage').scrollIntoView({block:'start',behavior:'instant'});$('story-stage').focus({preventScroll:true});
 }
 equipReward(){
  if(!this.state.completed)return;
  const g=this.game;g.save.data.customLivery={primary:'#e7ece7',secondary:'#48dde1',accent:'#ffd66a'};g.save.data.livery='custom';g.renderer?.invalidateModel('custom');g.save.save();g.toast('Beacon stripe equipped. Paint only; car performance stays the same.');
 }
 renderUniverse(){
  document.querySelectorAll('[data-universe-tab]').forEach(b=>b.setAttribute('aria-pressed',String(this.tab===b.dataset.universeTab)));
  $('universe-heading').textContent=this.tab==='crew'?'People worth coming back for':'An archive of places';
  $('universe-description').textContent=this.tab==='crew'?'Meet your four chapter companions and discover fourteen voices from the wider Openline.':'Three closed circuits in Lumen Harbor are ready to drive. Other cities remain world lore.';
  const list=$('universe-list');list.replaceChildren();const data=this.tab==='crew'?STORY_CHARACTERS:STORY_CITIES;
  if(!data.some(x=>x.id===this.selected))this.selected=data[0].id;
  for(const item of data){const b=el('button','ol-index-item');b.type='button';b.setAttribute('aria-pressed',String(item.id===this.selected));b.append(el('strong','',item.name),el('small','',this.tab==='crew'?(item.active?'YOUR CHAPTER CREW':'ARCHIVE PROFILE'):(item.playable?'HARBOR LOOP · PLAYABLE':'WORLD LORE')));b.addEventListener('click',()=>{this.selected=item.id;this.renderUniverse();});list.append(b);}
  const item=data.find(x=>x.id===this.selected),detail=$('universe-detail');detail.replaceChildren();detail.append(el('h3','',item.name));
  if(this.tab==='crew'){
   if(item.active){detail.append(el('div','ol-detail-portrait ol-portrait ol-portrait-'+item.id));const meet=el('button','ol-button','Meet the crew');meet.type='button';meet.dataset.nav='story';detail.append(meet);}
   for(const [key,label] of [['personality','Who they are'],['origin','Where they began'],['ambition','What they want'],['conflict','What gets in their way'],['expertise','Their craft'],['relationships','Connections'],['arc','The journey'],['silhouette','Silhouette'],['identity','Signature identity'],['connection','Place in the Openline']]){detail.append(el('h4','',label),el('p','',item[key]));}
  } else {
   detail.append(el('p','',item.geography),el('h4','','The city remembers'),el('p','',item.history),el('h4','','Discoveries'),el('p','',item.opportunities));
   for(const c of STORY_CIRCUITS.filter(c=>c.city===item.name)){const card=el('div','ol-circuit');card.append(el('h4','',c.name),el('p','',c.layout),el('p','',c.category),el('small','',c.playable?'Available now · Harbor Loop':'Circuit concept · World lore'));detail.append(card);}
   if(item.playable){for(const circuit of CIRCUITS){const b=el('button','ol-button','Drive '+circuit.name);b.type='button';b.dataset.circuit=circuit.id;b.addEventListener('click',()=>{if(this.game.configureDrive(this.game.baseRideId,circuit.id))this.game.navTo('event');});detail.append(b);}}
  }
 }
}
