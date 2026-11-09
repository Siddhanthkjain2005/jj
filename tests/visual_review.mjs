// Captures the actual WebGL game at fixed review positions; this is not concept art.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const chrome=process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath:chrome,args:process.env.VV_SOFTWARE?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
const report={errors:[],views:[]};
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))report.errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,firstRunDone:true,settings:{graphics:'ultra',renderScale:'1',showTelemetry:false,showPerf:false,reducedMotion:true}})));
 await page.goto('file://'+path.resolve('dist/velocityverse.html'));
 await page.waitForFunction(()=>window.__vv?.renderer);
 const frames=async(n=12)=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));},n);
 await frames();
 report.frameTiming=await page.evaluate(async()=>{const t=performance.now();for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(r));return {frames:30,wallMs:performance.now()-t};});
 report.gpu=await page.evaluate(()=>{const g=window.__vv.renderer.gl,e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);});
 console.log('GPU '+report.gpu);
 await page.screenshot({path:'tests/results/art_title.png'});
 await page.click('#btn-start');await page.click('.gate-garage');await frames(4);await page.screenshot({path:'tests/results/art_garage.png'});
 await page.click('#btn-garage-drive');await page.click('#scr-event [data-mode="practice"]');await page.click('#btn-prep-start');
 await page.evaluate(()=>{const g=window.__vv;g.countdown=0;g._goShown=true;g.paused=true;g.show('none');document.getElementById('hud-center').className='hud-center';document.getElementById('hud-coach').classList.remove('on');});
 for(const [name,s] of [['stadium',240],['city',560],['harbor',1100],['chicane',1600],['beacon',1475]]) {
  await page.evaluate(s=>{const g=window.__vv,v=g.veh;v.reset(s,0);for(const o of [g.prev,g.curr])Object.assign(o,{x:v.x,z:v.z,yaw:v.yaw,h:0,pitch:0,roll:0,steer:0});g.cam.snap();},s);
  await frames(10);await page.screenshot({path:'tests/results/art_'+name+'.png'});
  const stats=await page.evaluate(()=>{const R=window.__vv.renderer;return {tris:R.triangles,draws:R.drawCalls,quality:R.qName,shadow:!!R.shadowMap,glError:R.gl.getError()};});
  report.views.push({name,...stats});console.log(name+' '+JSON.stringify(stats));
 }
 await page.evaluate(()=>{const g=window.__vv;g.pause();g.settingsReturn='pause';g.show('settings');});
 await page.screenshot({path:'tests/results/art_settings.png'});
 const mobile=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 mobile.setDefaultTimeout(90000);
 await mobile.addInitScript(()=>localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,firstRunDone:false,settings:{graphics:'high',renderScale:'1',showTelemetry:false,showPerf:false,reducedMotion:true}})));
 await mobile.goto('file://'+path.resolve('dist/velocityverse.html'));
 await mobile.waitForFunction(()=>window.__vv?.renderer);
 await mobile.click('#btn-start');await mobile.click('.gate-race');await mobile.click('#scr-onboard [data-preset="racer"]');
 await mobile.evaluate(()=>{const g=window.__vv;g.countdown=0;g._goShown=true;g.paused=true;g.show('none');document.getElementById('touch').hidden=false;document.getElementById('hud-center').className='hud-center';document.getElementById('hud-coach').classList.remove('on');});
 await mobile.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));});
 await mobile.screenshot({path:'tests/results/art_mobile.png'});
 report.touch=await mobile.locator('#touch button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {name:b.getAttribute('aria-label'),w:r.width,h:r.height};}));
 if(report.touch.some(b=>Math.min(b.w,b.h)<44))throw Error('Touch target below 44px');
 if(report.errors.length || report.views.some(v=>v.glError))throw Error(JSON.stringify(report));
} finally {fs.writeFileSync('tests/results/visual_review.json',JSON.stringify(report,null,2));await browser.close();}
