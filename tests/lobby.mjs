// Lifecycle/resource regression: decorative animation must not run behind racing or reduced motion.
import assert from 'node:assert/strict';
import { LobbyMotion } from '../src/game/lobby.js';

const requests=new Map(),windowEvents=new Map(),documentEvents=new Map(),mediaEvents=new Map();
let sequence=0,paints=0;
const context={
  setTransform(...v){assert.ok(v.every(Number.isFinite));},
  clearRect(){paints++;},save(){},restore(){},translate(){},scale(){},beginPath(){},stroke(){},fill(){},
  arc(...v){assert.ok(v.every(Number.isFinite));},moveTo(...v){assert.ok(v.every(Number.isFinite));},lineTo(...v){assert.ok(v.every(Number.isFinite));},
};
const canvas={clientWidth:1920,clientHeight:1080,width:0,height:0,style:{},attributes:{},getContext:()=>context,setAttribute(k,v){this.attributes[k]=v;}};
const media={matches:false,addEventListener(k,v){mediaEvents.set(k,v);},removeEventListener(k){mediaEvents.delete(k);}};
globalThis.window={innerWidth:1920,innerHeight:1080,devicePixelRatio:3,matchMedia:()=>media,
  requestAnimationFrame(fn){const id=++sequence;requests.set(id,fn);return id;},cancelAnimationFrame(id){requests.delete(id);},
  addEventListener(k,v){windowEvents.set(k,v);},removeEventListener(k){windowEvents.delete(k);}};
globalThis.document={hidden:false,visibilityState:'visible',getElementById:id=>id==='hub-atmosphere'?canvas:{},
  addEventListener(k,v){documentEvents.set(k,v);},removeEventListener(k){documentEvents.delete(k);}};
let observer;
globalThis.MutationObserver=class {constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
const frame=now=>{const [id,fn]=requests.entries().next().value;requests.delete(id);fn(now);};
const game={screen:'hub',S:{graphics:'high',reducedMotion:false,motion:true},renderer:{qName:'high'}};
const motion=new LobbyMotion(game);
assert.equal(canvas.style.pointerEvents,'none');assert.equal(canvas.attributes['aria-hidden'],'true');
assert.equal(requests.size,1);assert.ok(canvas.width*canvas.height<=2104000);
frame(0);const initial=paints;frame(16);assert.equal(paints,initial,'High-quality atmosphere caps painting at 30 Hz');
frame(40);assert.ok(paints>initial);assert.equal(requests.size,1);
game.screen='none';observer.fn();assert.equal(requests.size,0,'No lobby request survives entry to racing');
game.screen='hub';observer.fn();assert.equal(requests.size,1);
document.hidden=true;document.visibilityState='hidden';documentEvents.get('visibilitychange')();assert.equal(requests.size,0,'Hidden page consumes no animation frames');
document.hidden=false;document.visibilityState='visible';documentEvents.get('visibilitychange')();assert.equal(requests.size,1);
game.S.reducedMotion=true;motion.sync();assert.equal(requests.size,0);assert.ok(paints>initial,'Reduced motion retains a static frame');
game.S.reducedMotion=false;media.matches=true;mediaEvents.get('change')();assert.equal(requests.size,0,'OS reduced-motion preference cannot be overridden by app false');
media.matches=false;game.S.graphics='low';game.renderer.qName='low';motion.sync();
assert.ok(canvas.width*canvas.height<652000,'Low quality caps decorative pixel area');
frame(100);const lowInitial=paints;frame(135);assert.equal(paints,lowInitial,'Low-quality atmosphere caps painting at 20 Hz');frame(152);assert.ok(paints>lowInitial);
motion.destroy();assert.equal(requests.size,0);assert.equal(windowEvents.size,0);assert.equal(documentEvents.size,0);assert.equal(mediaEvents.size,0);assert.equal(observer.disconnected,true);
motion.sync();assert.equal(requests.size,0,'Destroyed atmosphere cannot restart');
console.log('PASS lobby frame caps, hidden/racing shutdown, reduced motion, resolution budgets and listener cleanup');
