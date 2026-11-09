import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const chrome=process.env.CHROME_PATH||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath:chrome,args:['--autoplay-policy=no-user-gesture-required']});
const report={steps:[],errors:[],externalRequests:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
 await page.addInitScript(()=>{if(!localStorage.getItem('velocityverse.m0.save'))localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,settings:{graphics:'low',renderScale:'0.75',reducedMotion:true}}));});
 await page.goto('file://'+path.resolve('dist/velocityverse.html'));await page.waitForFunction(()=>window.__vv?.renderer);
 assert.equal(await page.evaluate(()=>window.__vv.renderer.assetsReady),true);
 await page.click('#btn-start');await page.click('.gate-race');await page.click('#btn-onboard-school');
 await page.waitForFunction(()=>window.__vv.countdown<=0);
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__vv.veh.forwardSpeed>16.2);await page.keyboard.up('ArrowUp');
 await page.waitForSelector('#scr-lesson.active');
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.school.launch),true);
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.xp),100);
 await page.screenshot({path:'tests/results/v2_academy_pass.png'});
 report.steps.push('Real keyboard launch → observed pass → one saved medal and 100 XP');
 await page.click('#btn-lesson-next');await page.waitForFunction(()=>window.__vv.countdown<=0);
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__vv.veh.forwardSpeed>20.5);await page.keyboard.up('ArrowUp');await page.keyboard.down('ArrowDown');
 await page.waitForSelector('#scr-lesson.active');await page.keyboard.up('ArrowDown');
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.school.braking),true);
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.xp),200);
 assert.ok(await page.evaluate(()=>window.__vv.school.status.result.brakingDistance>1));
 report.steps.push('Real keyboard measured braking → actual stop → second saved medal');
 await page.click('#btn-lesson-next');
 // A scripted analogue controller drives the real car through an actual track
 // corner; only exercise setup is positioned, no state is forced to completion.
 await page.evaluate(()=>{
   const g=window.__vv,t=g.track,v=g.veh,arc=t.segments.find(s=>s.kind!=='S');
   v.reset(arc.s0-20,0);g.school.start('cornering',v,t);g.countdown=0;
   for(let k=0;k<2400 && g.school.active;k++){
     const p=t.project(v.x,v.z,-1,{}),u=v.forwardSpeed,pt=t.pointAt(p.s+8+u*.25,0,{});
     const sy=Math.sin(v.yaw),cy=Math.cos(v.yaw),dx=pt.x-(v.x-sy*v.b),dz=pt.z-(v.z-cy*v.b);
     const angle=Math.atan(2*v.car.wheelbase*Math.sin(Math.atan2(dx*cy-dz*sy,dx*sy+dz*cy))/Math.max(1,Math.hypot(dx,dz)));
     const raw={steer:Math.max(-1,Math.min(1,angle*(25+u)/(25*v.car.steerLock))),throttle:Math.max(0,Math.min(1,(15-u)*.5)),brake:Math.max(0,Math.min(1,(u-15)*.3)),digitalSteer:false};
     g.stepOnce(raw);
   }
 });
 await page.waitForSelector('#scr-lesson.active');
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.school.cornering),true);
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.xp),300);
 report.steps.push('Real simulation corner exercise → observed progression → third saved medal');

 await page.click('#btn-lesson-school');await page.screenshot({path:'tests/results/v2_academy.png'});
 await page.click('#scr-academy [data-nav="garage"]');await page.click('#btn-customize');
 await page.fill('#paint-primary','#aa3322');await page.fill('#paint-secondary','#ddeeff');
 assert.equal(await page.evaluate(()=>window.__vv.save.data.livery),'custom');
 await page.screenshot({path:'tests/results/v2_paint.png'});
 assert.ok(await page.evaluate(()=>window.__vv.renderer.models.size<14));
 await page.reload();await page.waitForFunction(()=>window.__vv?.renderer);await page.click('#btn-start');await page.click('.gate-garage');
 const saved=await page.evaluate(()=>({career:window.__vv.save.data.career,paint:window.__vv.save.data.customLivery,livery:window.__vv.save.data.livery}));
 assert.equal(saved.career.xp,300);assert.equal(saved.paint.primary,'#aa3322');assert.equal(saved.livery,'custom');
 report.steps.push('Paint changes rebuild real model; paint, medals and licence survive reload');
 // Ending a session repeatedly must never manufacture progress.
 await page.click('#btn-garage-drive');await page.click('#scr-event [data-mode="practice"]');await page.click('#btn-prep-start');
 await page.evaluate(()=>{const g=window.__vv;g.finishSession();g.finishSession();});
 assert.equal(await page.evaluate(()=>window.__vv.save.data.career.xp),300);
 report.steps.push('Empty/repeated results award zero XP');
 assert.equal(report.errors.length,0);assert.equal(report.externalRequests.length,0);
 report.steps.push('Standalone game makes zero external HTTP requests');
 console.log('PASS feature flow: '+report.steps.join('; '));
}finally{fs.writeFileSync('tests/results/feature_flow.json',JSON.stringify(report,null,2));await browser.close();}
