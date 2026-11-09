import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const chrome=process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath:chrome,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={keyboard:[],graphics:[],errors:[]};
try {
 const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,firstRunDone:false,settings:{graphics:'low',renderScale:'0.5'}})));
 await page.goto('file://'+path.resolve('dist/velocityverse.html'));
 await page.waitForFunction(()=>window.__vv?.renderer);
 await page.click('#btn-start');await page.click('#scr-onboard [data-preset="racer"]');
 await page.evaluate(()=>{const g=window.__vv;g.paused=true;g.countdown=0;g._goShown=true;});
 for(const fraction of [0.05,0.19,0.35,0.55,0.72,0.9]) for(const key of ['a','d']) {
  await page.evaluate(f=>{
   const g=window.__vv,v=g.veh;g.input.reset();v.reset(g.track.length*f,0);g.driver=new g.driver.constructor();
   const speed=25;v.vx=Math.sin(v.yaw)*speed;v.vz=Math.cos(v.yaw)*speed;for(const w of v.wheels)w.omega=speed/v.car.wheelRadius;
  },fraction);
  await page.keyboard.down(key);
  const held=await page.evaluate(()=>{
   const g=window.__vv;let beta=0,angle=0;
   for(let i=0;i<18;i++){const raw=g.input.poll(1/120);const c=g.driver.process(1/120,raw,g.veh,g.track,g.assists(),{speedRef:g.S.steerSpeedRef});angle=c.steerAngle;g.veh.step(1/120,c);beta=Math.max(beta,Math.abs(Math.atan2(g.veh.lateralSpeed,g.veh.forwardSpeed))*180/Math.PI);}
   return {beta,angle};
  });
  await page.keyboard.up(key);
  const released=await page.evaluate(()=>{
   const g=window.__vv;let beta=0;
   for(let i=0;i<48;i++){const raw=g.input.poll(1/120);const c=g.driver.process(1/120,raw,g.veh,g.track,g.assists(),{speedRef:g.S.steerSpeedRef});g.veh.step(1/120,c);beta=Math.max(beta,Math.abs(Math.atan2(g.veh.lateralSpeed,g.veh.forwardSpeed))*180/Math.PI);}
   return {beta,yaw:g.veh.r,impacts:g.veh.impactCount,nan:g.veh.nanResets};
  });
  assert.ok(held.angle*(key==='a'?-1:1)>0);assert.ok(Math.max(held.beta,released.beta)<8);
  assert.ok(Math.abs(released.yaw)<0.15);assert.equal(released.nan,0);assert.equal(released.impacts,0);
  report.keyboard.push({fraction,key,held,released});
 }
 console.log('PASS real A/D key events at six circuit locations; release settles with no spin or impact');
 await page.evaluate(()=>{const g=window.__vv;g.mode='menu';g.show('none');g.screen='garage';});
 for(const quality of ['medium','high','ultra']) {
  const result=await page.evaluate(async quality=>{
   const g=window.__vv,R=g.renderer,gl=R.gl;g.S.graphics=quality;g.applySettings();
   const original=R.render.bind(R);let frame=0,maxWhite=0,maxBlack=0;const errors=[];
   R.render=sc=>{
    original(sc);
    if(frame%8===0){const px=new Uint8Array(4),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;let white=0,black=0;
     for(let j=0;j<64;j++){gl.readPixels(Math.floor((j%8+.5)*w/8),Math.floor((Math.floor(j/8)+.5)*h/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(px[0]>250&&px[1]>250&&px[2]>250)white++;if(px[0]<4&&px[1]<4&&px[2]<4)black++;}
     maxWhite=Math.max(maxWhite,white/64);maxBlack=Math.max(maxBlack,black/64);
     let e;while((e=gl.getError())!==0&&errors.length<8)errors.push(e);
    }
    frame++;
   };
   for(let i=0;i<120;i++){
    if(i%15===0){g.veh.reset((i/120)*g.track.length,0);g.cam.snap();}
    await new Promise(r=>requestAnimationFrame(r));
   }
   R.render=original;return {quality,frames:frame,maxWhite,maxBlack,errors};
  },quality);
  assert.equal(result.errors.length,0);assert.ok(result.maxWhite<0.35&&result.maxBlack<0.65,JSON.stringify(result));
  report.graphics.push(result);console.log('PASS moving-camera HDR stress '+JSON.stringify(result));
  await page.screenshot({path:'tests/results/stress_'+quality+'.png'});
 }
 assert.equal(report.errors.length,0);
} finally {
 fs.writeFileSync('tests/results/graphics_handling_regression.json',JSON.stringify(report,null,2));await browser.close();
}
