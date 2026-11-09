// Real app navigation/progress and an isolated engineering experiment viewer.
import { CAR_VX1 } from '../sim/data.js';
import { licenceFor, LICENCES } from './career.js';
import { LAB_SETUPS, runLabExperiment } from '../sim/lab.js';

const $ = id => document.getElementById(id);
const node = (tag,cls,text) => {const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
const PROTOCOLS = [['acceleration','0–100 km/h'],['braking','100–0 km/h'],['coast','150–100 km/h']];
export class HubShell {
  constructor(game){this.game=game;this.setup='grip';this.chart='braking';this.cache=new Map();this.busy=false;this.study=null;}
  wire(){
    this.wireCarPreview();
    $('hub-next').addEventListener('click',()=>this.game.navTo(this.nextDestination||'academy'));
    $('btn-lab-run').addEventListener('click',()=>this.run());
    const list=$('lab-setups');
    for(const setup of LAB_SETUPS){const b=node('button','lab-setup','');b.type='button';b.dataset.setup=setup.id;b.append(node('strong','',setup.name),node('small','',setup.description));b.addEventListener('click',()=>{if(this.busy)return;this.setup=setup.id;this.renderSetups();$('lab-status').textContent='Study selected. Run the comparison to measure its effects.';});list.append(b);}
    for(const [key,label] of PROTOCOLS){const b=node('button','',label);b.type='button';b.dataset.chart=key;b.addEventListener('click',()=>{this.chart=key;this.renderChart();});$('lab-chart-tabs').append(b);}
    $('lab-protocol').textContent='Three controlled runs on a flat straight: full-throttle acceleration, full braking with ABS, and neutral coast-down. Same mass, world and fixed simulation step for every comparison.';
  }
  render(screen){if(screen==='hub')this.renderHome();if(screen==='lab'){this.renderSetups();if(this.study)this.renderResults();else this.renderEmpty();}}
  wireCarPreview(){
    const zone=$('car-rotate-zone');let pointer=null,lastX=0;
    zone.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;lastX=e.clientX;zone.setPointerCapture(pointer);e.preventDefault();});
    zone.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;this.game.lobbyAngle=(this.game.lobbyAngle||0)+(e.clientX-lastX)*.008;lastX=e.clientX;e.preventDefault();});
    const release=e=>{if(e.pointerId===pointer)pointer=null;};zone.addEventListener('pointerup',release);zone.addEventListener('pointercancel',release);zone.addEventListener('lostpointercapture',()=>pointer=null);
  }
  renderPaints(){
    const host=$('lobby-paints');host.replaceChildren();
    for(const l of CAR_VX1.liveries){const b=node('button','','');b.type='button';b.setAttribute('aria-label',l.name+' livery');b.setAttribute('aria-pressed',String(this.game.save.data.livery===l.id));const sw=node('span','','');sw.style.background='linear-gradient(135deg,rgb('+l.primary.map(n=>Math.round(n*255)).join(',')+'),rgb('+l.secondary.map(n=>Math.round(n*255)).join(',')+'))';b.append(sw);b.addEventListener('click',()=>{this.game.save.data.livery=l.id;this.game.save.save();this.game.renderer.carModel(l);this.renderPaints();});host.append(b);}
  }
  renderHome(){
    this.renderPaints();
    const g=this.game,c=g.save.data.career,l=licenceFor(c.xp),next=LICENCES.find(x=>x.xp>c.xp),team=g.app.team();
    $('hub-tag').textContent=team.tag;$('hub-profile-name').textContent=g.save.data.team?team.name:'Independent driver';
    $('hub-profile-xp').textContent=`${c.xp} XP · ${Object.keys(c.school).length}/3 academy medals`;
    $('hub-licence').textContent=l.name;$('hub-licence-progress').value=next?(c.xp-l.xp)/(next.xp-l.xp):1;
    $('hub-licence-progress').setAttribute('aria-label',next?`${c.xp} XP of ${next.xp} needed for ${next.name}`:'Highest local licence earned');
    const medals=Object.keys(c.school).length;
    this.nextDestination=medals<3?'academy':c.validLaps<1?'event':'records';
    $('hub-next-title').textContent=medals<3?'Earn your next academy medal':c.validLaps<1?'Set your first clean lap':'Your racing story so far';
    $('hub-next-detail').textContent=medals<3?`${medals}/3 fundamentals mastered · 100 XP per first pass`:c.validLaps<1?'Discover Harbor Loop in practice.':`${c.validLaps} valid laps · ${c.completedRaces} race finishes`;
  }
  renderSetups(){document.querySelectorAll('[data-setup]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.setup===this.setup));b.disabled=this.busy;});$('btn-lab-run').disabled=this.busy;}
  renderEmpty(){const host=$('lab-metrics');host.replaceChildren();for(const label of ['0–100 km/h','100–0 km/h distance','Neutral coast 150–100']){const c=node('div','metric-card','');c.append(node('span','stat-label',label),node('strong','stat-value','—'),node('small','','Run a comparison'));host.append(c);}this.renderChart();}
  async run(){
    if(this.busy)return;this.busy=true;this.renderSetups();$('lab-status').textContent='Running the standard car and selected study through the vehicle simulation…';
    // Let the busy state paint before the short synchronous, fixed-step calculations.
    await new Promise(r=>setTimeout(r,60));
    try{if(!this.cache.has('baseline'))this.cache.set('baseline',runLabExperiment('baseline'));if(!this.cache.has(this.setup))this.cache.set(this.setup,runLabExperiment(this.setup));
      const base=this.cache.get('baseline'),selected=this.cache.get(this.setup);if(!base.valid||!selected.valid)throw new Error('A controlled run did not satisfy its measurement checks.');
      this.study={base,selected};this.renderResults();$('lab-status').textContent=`Comparison complete · ${LAB_SETUPS.find(s=>s.id===this.setup).name}. Results below are measured in the local simulation.`;
    }catch(e){$('lab-status').textContent='Experiment could not complete. '+e.message;}finally{this.busy=false;this.renderSetups();}
  }
  renderResults(){
    const {base,selected}=this.study,host=$('lab-metrics');host.replaceChildren();
    $('lab-result-title').textContent=LAB_SETUPS.find(s=>s.id===selected.setupId).name+' · Measured results';
    for(const [key,label,unit,digits] of [['accelerationSeconds','0–100 km/h','s',2],['brakingMetres','100–0 km/h distance','m',1],['coastSeconds','Coast 150–100 km/h','s',2]]){
      const value=selected.metrics[key],reference=base.metrics[key],delta=(value-reference)/reference*100;
      const c=node('div','metric-card','');c.append(node('span','stat-label',label),node('strong','stat-value',`${value.toFixed(digits)} ${unit}`),node('small','',`Standard ${reference.toFixed(digits)} ${unit} · ${delta>=0?'+':''}${delta.toFixed(1)}%`));host.append(c);
    }this.renderChart();
  }
  renderChart(){
    document.querySelectorAll('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chart===this.chart)));
    const host=$('lab-chart');host.replaceChildren();if(!this.study){host.append(node('p','empty-state','Your measured speed traces will appear here.'));return;}
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 560 230');svg.setAttribute('role','img');svg.setAttribute('aria-label',PROTOCOLS.find(x=>x[0]===this.chart)[1]+' speed versus time. White is standard; teal is the selected study.');
    const arrays=[this.study.base.samples[this.chart],this.study.selected.samples[this.chart]],tMax=Math.max(...arrays.map(a=>a[a.length-1].time)),vMax=Math.max(1,...arrays.flat().map(p=>p.speedKmh));
    const make=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;};
    for(let i=0;i<=4;i++){const y=15+170*i/4;make('path',{d:`M45 ${y}H545`,stroke:'#a0c6db22',fill:'none'});make('text',{x:37,y:y+4,'text-anchor':'end',fill:'#a6c2d1','font-size':11},Math.round(vMax*(1-i/4)).toString());}
    for(let i=0;i<=4;i++){const x=45+500*i/4;make('text',{x,y:204,'text-anchor':'middle',fill:'#a6c2d1','font-size':11},(tMax*i/4).toFixed(1));}
    make('text',{x:545,y:225,'text-anchor':'end',fill:'#c8dce6','font-size':11},'Time / seconds');make('text',{x:45,y:10,fill:'#c8dce6','font-size':10},'km/h');
    arrays.forEach((a,i)=>make('path',{d:a.map((p,j)=>`${j?'L':'M'}${(45+p.time/tMax*500).toFixed(1)} ${(185-p.speedKmh/vMax*170).toFixed(1)}`).join(' '),stroke:i?'#94e9e5':'#c9d6e2','stroke-width':i?3:2,fill:'none','stroke-dasharray':i?'none':'5 3'}));
    host.append(svg);
  }
}
