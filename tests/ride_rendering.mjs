// Actual WebGL ride silhouettes and renderer resource lifecycle. No mocked draw calls.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const root=path.resolve('.');
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<body style="margin:0;background:#030817"><canvas id="gl" style="width:1000px;height:650px"></canvas></body>');return;}
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=process.env.CHROME_PATH||['/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(fs.existsSync);
const browser=await chromium.launch({executablePath:chrome});
const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[],report={rides:[],errors};page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync('tests/results',{recursive:true});
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.evaluate(async()=>{
  const mods=await Promise.all([import('/src/game/renderer.js'),import('/src/sim/track.js'),import('/src/sim/rides.js'),import('/src/sim/circuits.js')]);
  window.rq={Renderer:mods[0].Renderer,Track:mods[1].Track,RIDES:mods[2].RIDES,CIRCUITS:mods[3].CIRCUITS};
  const gl=document.querySelector('canvas').getContext('webgl2');const live={};
  for(const type of ['Buffer','VertexArray','Texture','Renderbuffer','Framebuffer','Program','Shader']){
   live[type]=new Set();const create=gl['create'+type].bind(gl),release=gl['delete'+type].bind(gl);
   gl['create'+type]=(...a)=>{const obj=create(...a);if(obj)live[type].add(obj);return obj;};
   gl['delete'+type]=obj=>{live[type].delete(obj);return release(obj);};
  }
  window.glLive=live;
 });
 for(const [rideId,circuitId] of [['sprint','beacon_short'],['vx1','harbor_loop'],['vanta_gt','breakwater']]){
  const result=await page.evaluate(async({rideId,circuitId})=>{
   const{Renderer,Track,RIDES,CIRCUITS}=rq,ride=RIDES.find(r=>r.id===rideId),c=CIRCUITS.find(c=>c.id===circuitId),track=new Track(c.track,c.world,ride.car);
   const renderer=window.rideRenderer=new Renderer(document.querySelector('canvas'),track,ride.car);renderer.setQuality('medium');renderer.resize(1);await renderer.assetsReady;
   const model=renderer.carModel(ride.car.liveries[0]);renderer.render({lobby:true,beacon:true,motion:false,time:0,speed:0,cam:{eye:[6,3.2,7],target:[0,.4,0],fov:.7},cars:[{pose:{},model,brakes:[0,0,0,0]}]});
   const pos=track.pointAt(120,0,{}),fwd=[Math.sin(pos.heading),Math.cos(pos.heading)];
   renderer.render({time:0,motion:false,speed:0,focus:{x:pos.x,z:pos.z},careerGate:{s:170,next:1,total:5},cam:{eye:[pos.x-fwd[0]*8,3,pos.z-fwd[1]*8],target:[pos.x+fwd[0]*35,1,pos.z+fwd[1]*35],fov:.9},cars:[{pose:{x:pos.x,z:pos.z,yaw:pos.heading,h:0,pitch:0,roll:0,steer:0},model,brakes:[0,0,0,0]}]});
   return{ride:rideId,circuit:circuitId,error:renderer.gl.getError(),bodyTriangles:model.lod0.tris,worldTriangles:renderer.triangles,careerGateUploaded:!!renderer.careerGates};
  },{rideId,circuitId});
  assert.equal(result.error,0);assert.ok(result.worldTriangles>1000);assert.equal(result.careerGateUploaded,true);
  await page.screenshot({path:'tests/results/ride_'+rideId+'.png'});
  result.afterDispose=await page.evaluate(()=>{rideRenderer.dispose();rideRenderer.dispose();return{error:rideRenderer.gl.getError(),live:Object.fromEntries(Object.entries(glLive).map(([k,s])=>[k,s.size]))};});
  assert.equal(result.afterDispose.error,0);assert.ok(Object.values(result.afterDispose.live).every(v=>v===0),'Every GPU resource should be released before rebuilding a ride/track');report.rides.push(result);
 }
 assert.deepEqual(errors,[]);report.pass=true;
 console.log('PASS ride rendering: three distinct actual WebGL bodies/worlds; all GL objects released across ride/track rebuilds');
}finally{fs.writeFileSync('tests/results/rides_rendering.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
