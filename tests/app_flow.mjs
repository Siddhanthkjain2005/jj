// Connected offline app review. Record fixtures test presentation/persistence, not earned gameplay.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const chrome = process.env.CHROME_PATH || ['/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath:chrome, args:['--autoplay-policy=no-user-gesture-required'] });
const report = { checks:[], errors:[], externalRequests:[], mobile:[], measurements:{} };
report.artifactSHA256=createHash('sha256').update(fs.readFileSync('dist/velocityverse.html')).digest('hex');
fs.mkdirSync('tests/results', { recursive:true });
const check = async (name, fn) => { try { await fn(); report.checks.push({name,pass:true}); console.log('PASS '+name); } catch(e) { report.checks.push({name,pass:false,error:String(e)}); console.error('FAIL '+name+': '+e.message); } };
const watch = page => { page.setDefaultTimeout(45000); page.on('pageerror', e => report.errors.push(String(e))); page.on('request', r => { if(/^https?:/.test(r.url()))report.externalRequests.push(r.url()); }); };
const ready = page => page.waitForFunction(() => window.__vv?.renderer && window.__vv?.app && window.__vv?.hub);
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const nav = async (page, screen) => { await page.evaluate(() => window.__vv.navTo('hub')); await page.click(`#scr-hub .world-gate[data-nav="${screen}"]`); await page.waitForSelector(`#scr-${screen}.active`); };
const saveFixture = {version:1,firstRunDone:false,settings:{graphics:'low',renderScale:'0.5',reducedMotion:true}};

try {
  const page = await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}); watch(page);
  await page.addInitScript(f => { if(!localStorage.getItem('velocityverse.m0.save'))localStorage.setItem('velocityverse.m0.save',JSON.stringify(f)); }, saveFixture);
  await page.goto('file://'+path.resolve('dist/velocityverse.html')); await ready(page);
  report.gpu = await page.evaluate(() => { const g=window.__vv.renderer.gl,e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER); });
  await check('First launch enters live world hub', async () => { await page.click('#btn-start'); await page.waitForSelector('#scr-hub.active'); assert.equal(await page.locator('#scr-hub .world-gate').count(),7); });
  await check('New driver racing gate opens driving introduction', async () => { await page.click('#scr-hub .gate-race'); await page.waitForSelector('#scr-onboard.active'); await page.click('#scr-onboard [data-nav="hub"]'); await page.waitForSelector('#scr-hub.active'); });
  await page.evaluate(() => {const g=window.__vv;g.save.data.firstRunDone=true;g.save.save();});
  await check('All seven destination gates connect', async () => {for(const screen of ['event','lab','team','explorer','academy','records','garage'])await nav(page,screen);});
  await page.evaluate(() => window.__vv.navTo('hub')); await frame(page); await page.screenshot({path:'tests/results/v4_hub_desktop.png'});
  await nav(page,'lab');
  const before = await page.evaluate(() => { const g=window.__vv;return JSON.stringify({x:g.veh.x,z:g.veh.z,yaw:g.veh.yaw,car:g.veh.car,world:g.world,assists:g.save.data.assists}); });
  await check('Grip study measures actual simulation traces', async () => {
    await page.click('[data-setup="grip"]'); await page.click('#btn-lab-run'); await page.waitForFunction(() => window.__vv.hub.study?.selected.setupId === 'grip' && !window.__vv.hub.busy);
    const study=await page.evaluate(()=>({base:window.__vv.hub.study.base.metrics,selected:window.__vv.hub.study.selected.metrics})); report.measurements.grip=study;
    assert.ok(study.selected.accelerationSeconds>0 && study.selected.brakingMetres>0 && study.selected.coastSeconds>0);
    assert.ok(study.selected.brakingMetres<study.base.brakingMetres);
    assert.equal(await page.locator('#lab-metrics .metric-card').count(),3);
    for(const chart of ['acceleration','braking','coast']){await page.click(`[data-chart="${chart}"]`);assert.equal(await page.locator('#lab-chart svg path[stroke-width]').count(),2);}
  });
  await check('Aero study compares a separate controlled vehicle', async () => {
    await page.click('[data-setup="aero"]');await page.click('#btn-lab-run');await page.waitForFunction(()=>window.__vv.hub.study?.selected.setupId==='aero'&&!window.__vv.hub.busy);
    const study=await page.evaluate(()=>({base:window.__vv.hub.study.base.metrics,selected:window.__vv.hub.study.selected.metrics}));report.measurements.aero=study;
    assert.ok(study.selected.coastSeconds<study.base.coastSeconds);
    const after=await page.evaluate(()=>{const g=window.__vv;return JSON.stringify({x:g.veh.x,z:g.veh.z,yaw:g.veh.yaw,car:g.veh.car,world:g.world,assists:g.save.data.assists});});assert.equal(after,before,'Lab mutated live race state');
  });
  await page.screenshot({path:'tests/results/v4_lab_desktop.png'});
  await nav(page,'explorer');
  await check('Circuit explorer selects all actual track sections', async () => {
    assert.equal(await page.locator('#explorer-segments button').count(),17);assert.equal(await page.locator('#explorer-map svg').count(),1);
    for(let i=0;i<17;i++){await page.locator('#explorer-segments button').nth(i).click();const detail=await page.locator('#explorer-detail').innerText();const expected=await page.evaluate(i=>Math.round(window.__vv.track.segments[i].len),i);assert.ok(detail.includes(`${expected} m`));assert.equal(await page.locator('#explorer-segments [aria-pressed="true"]').count(),1);}
    await page.locator('#explorer-segments button').nth(8).click();assert.match(await page.locator('#explorer-detail').innerText(),/Customs Hairpin/i);
  });
  await check('Circuit map fits above section selectors', async () => {
    const bounds=await page.locator('#explorer-map').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('svg').getBoundingClientRect();return {host:{top:a.top,bottom:a.bottom,height:a.height},svg:{top:b.top,bottom:b.bottom,height:b.height}};});
    report.explorerBounds=bounds;assert.ok(bounds.svg.top>=bounds.host.top-1&&bounds.svg.bottom<=bounds.host.bottom+1,`SVG overflows map host: ${JSON.stringify(bounds)}`);
  });
  await page.screenshot({path:'tests/results/v4_explorer_desktop.png'});
  await nav(page,'team');
  await check('Team fields keep native typing and cursor control', async () => {
    await page.fill('#team-name','');const perf=await page.evaluate(()=>window.__vv.S.showPerf);
    await page.locator('#team-name').pressSequentially('Fast Family');await frame(page);assert.equal(await page.inputValue('#team-name'),'Fast Family');assert.equal(await page.evaluate(()=>window.__vv.S.showPerf),perf,'Typing F toggled performance overlay');
    await page.locator('#team-name').press('ArrowLeft');await frame(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'team-name','ArrowLeft stole text focus');
    await page.focus('#team-region');await page.keyboard.press('ArrowDown');await frame(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'team-region','ArrowDown stole select focus');
  });
  await check('Local identity treats malicious input as text', async () => {
    const payload='<img src=x onerror=1>';await page.fill('#team-name',payload);await page.fill('#team-tag','<b>!');await page.locator('#team-form button[type="submit"]').click();
    assert.equal(await page.locator('#team-preview img').count(),0);assert.ok((await page.locator('#team-preview').textContent()).includes(payload));assert.equal(await page.evaluate(()=>window.__vv.app.team().tag),'B');
  });
  await page.fill('#team-name','Kestrel Family');await page.fill('#team-tag','CYA');await page.fill('#team-color','#ff8844');await page.selectOption('#team-region','Asia');await page.locator('#team-form button[type="submit"]').click();
  await check('Identity card download contains real local achievements', async () => {
    const wait=page.waitForEvent('download');await page.click('#btn-team-export');const d=await wait;await d.saveAs('tests/results/v4_team_identity.svg');const svg=fs.readFileSync('tests/results/v4_team_identity.svg','utf8');assert.match(svg,/Kestrel Family/);assert.match(svg,/0 DRIVER XP/);assert.match(svg,/OFFLINE DRIVER CARD/);assert.doesNotMatch(svg,/<script|<img/);
  });
  await page.screenshot({path:'tests/results/v4_team_desktop.png'});
  await check('Team identity survives reload and appears on home profile', async () => {
    await page.reload();await ready(page);await page.click('#btn-start');await page.waitForSelector('#scr-hub.active');assert.equal(await page.locator('#hub-profile-name').innerText(),'Kestrel Family');assert.equal(await page.locator('#hub-tag').innerText(),'CYA');assert.equal(await page.evaluate(()=>window.__vv.app.team().region),'Asia');
  });
  await check('Driver archive renders actual saved fixtures with assist separation', async () => {
    await page.evaluate(()=>{const g=window.__vv;g.save.data.career={xp:475,validLaps:7,completedRaces:3,podiums:1,school:{launch:true,braking:true},paidSessions:[]};g.save.data.pbs={[g.track.def.id+'|assisted']:{time:90.125,ghost:'fixture'},[g.track.def.id+'|standard']:{time:94.5}};g.save.data.history=[{t:90.125,valid:true,cls:'assisted',mode:'timetrial'},{t:91.5,valid:false,cls:'standard',mode:'practice'}];g.save.save();});
    await nav(page,'records');const summary=await page.locator('#records-summary').innerText();for(const text of ['475','7','3','1','2 / 3'])assert.ok(summary.includes(text));const best=await page.locator('#records-bests').innerText();assert.match(best,/Assisted/);assert.match(best,/Standard/);assert.match(best,/1:30.125/);assert.match(best,/1:34.500/);assert.equal(await page.locator('#records-history tbody tr').count(),2);assert.match(await page.locator('#records-history').innerText(),/Time trial/);
  });
  assert.equal(await page.evaluate(()=>window.__vv.renderer.gl.getError()),0);
  await page.close();

  // JavaScript bridge integration uses a mock native host. This does not claim an Android device run.
  const native=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});watch(native);
  await native.addInitScript(()=>{
    localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,firstRunDone:true,settings:{graphics:'low',renderScale:'0.5',textScale:1,reducedMotion:false,motion:true}}));
    window.__nativeCalls=[];
    window.NativeBridge={
      setKeepScreenOn(value){window.__nativeCalls.push({type:'awake',value});},
      haptic(){window.__nativeCalls.push({type:'haptic'});},
      saveFile(filename,mime,base64){window.__nativeCalls.push({type:'file',filename,mime,length:base64.length,header:atob(base64.slice(0,Math.floor(Math.min(96,base64.length)/4)*4))});},
    };
  });
  await native.goto('file://'+path.resolve('dist/velocityverse.html'));await ready(native);
  await check('Mock Android host cold-starts in game hub',async()=>{assert.equal(await native.evaluate(()=>window.__vv.screen),'hub');assert.equal(await native.evaluate(()=>document.body.classList.contains('native-android')),true);assert.equal(await native.evaluate(()=>window.__vv.androidBack()),false);});
  await check('Lobby atmosphere changes actual pixels while motion is enabled',async()=>{
    await native.waitForFunction(()=>window.__vv.lobby.raf!==null&&window.__vv.lobby.elapsed>.1);
    const pixels=()=>native.evaluate(()=>{const c=document.getElementById('hub-atmosphere'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(let i=0;i<d.length;i+=13)hash=Math.imul(hash^d[i],16777619);return{hash:hash>>>0,elapsed:window.__vv.lobby.elapsed,pixels:c.width*c.height};});
    const a=await pixels();await native.waitForFunction(t=>window.__vv.lobby.elapsed>t+.25,a.elapsed);const b=await pixels();assert.notEqual(a.hash,b.hash);assert.ok(b.pixels<652000);report.lobbyMotion={before:a,after:b};
  });
  await check('App reduced motion freezes canvas and removes CSS motion',async()=>{
    await native.evaluate(()=>{window.__vv.S.reducedMotion=true;window.__vv.applySettings();});
    const a=await native.evaluate(()=>({elapsed:window.__vv.lobby.elapsed,raf:window.__vv.lobby.raf,animation:getComputedStyle(document.querySelector('.world-gate')).animationName,gleam:getComputedStyle(document.querySelector('.world-gate'),'::before').animationName}));
    await native.waitForTimeout(180);const b=await native.evaluate(()=>window.__vv.lobby.elapsed);assert.equal(a.raf,null);assert.equal(a.elapsed,b);assert.equal(a.animation,'none');assert.equal(a.gleam,'none');
  });
  await check('OS reduced-motion preference takes precedence over app motion',async()=>{
    await native.emulateMedia({reducedMotion:'reduce'});await native.evaluate(()=>{window.__vv.S.reducedMotion=false;window.__vv.applySettings();});assert.equal(await native.evaluate(()=>window.__vv.lobby.raf),null);assert.equal(await native.locator('.world-gate').first().evaluate(e=>getComputedStyle(e).animationName),'none');await native.emulateMedia({reducedMotion:'no-preference'});
  });
  await check('Android Back dismisses text editing before leaving team',async()=>{
    await nav(native,'team');await native.focus('#team-name');assert.equal(await native.evaluate(()=>window.__vv.androidBack()),true);assert.equal(await native.evaluate(()=>window.__vv.screen),'team');assert.notEqual(await native.evaluate(()=>document.activeElement.id),'team-name');await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.screen),'hub');
  });
  await check('Android Back cancels destructive dialog and pending key remap',async()=>{
    await native.click('#scr-hub [data-nav="settings"]');await native.click('#btn-reset-data');await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.locator('#dialog').evaluate(e=>e.hidden),true);assert.equal(await native.evaluate(()=>window.__vv.screen),'settings');
    await native.locator('[data-remap]').first().click();assert.equal(await native.evaluate(()=>typeof window.__vv.input.remapCallback),'function');await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.input.remapCallback),null);await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.screen),'hub');
  });
  await check('Mock native identity export receives an SVG file',async()=>{
    await nav(native,'team');await native.click('#btn-team-export');await native.waitForFunction(()=>window.__nativeCalls.some(x=>x.type==='file'&&x.mime==='image/svg+xml'));const f=await native.evaluate(()=>window.__nativeCalls.find(x=>x.type==='file'&&x.mime==='image/svg+xml'));assert.match(f.header,/<svg/);assert.ok(f.length>1000);assert.match(f.filename,/\.svg$/);report.nativeIdentity={filename:f.filename,mime:f.mime,base64Length:f.length};
  });
  await check('Android Back pauses and resumes actual driving safely',async()=>{
    await nav(native,'event');await native.click('#scr-event [data-mode="practice"]');await native.click('#btn-prep-start');await native.waitForFunction(()=>window.__vv.mode==='race'&&!window.__vv.paused);await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.screen),'pause');assert.equal(await native.evaluate(()=>window.__vv.paused),true);assert.equal(await native.evaluate(()=>window.__vv.lobby.raf),null);
    const t=await native.evaluate(()=>window.__vv.veh.time);await frame(native);assert.equal(await native.evaluate(()=>window.__vv.veh.time),t);await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.paused),false);assert.equal(await native.evaluate(()=>window.__vv.screen),'none');await native.evaluate(()=>window.__vv.androidBack());
  });
  await check('Android Back returns from race settings and photo to pause',async()=>{
    await native.click('#btn-pause-settings');await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.screen),'pause');await native.click('#btn-photo');assert.equal(await native.evaluate(()=>window.__vv.screen),'photo');
    await native.click('#btn-photo-save');await native.waitForFunction(()=>window.__nativeCalls.some(x=>x.type==='file'&&x.mime==='image/png'));const f=await native.evaluate(()=>window.__nativeCalls.find(x=>x.type==='file'&&x.mime==='image/png'));assert.equal(f.header.charCodeAt(0),137);assert.equal(f.header.slice(1,4),'PNG');assert.ok(f.length>10000);report.nativePhoto={filename:f.filename,mime:f.mime,base64Length:f.length};
    await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.screen),'pause');assert.equal(await native.evaluate(()=>window.__vv.paused),true);
  });
  await check('Simulated background lifecycle pauses driving and releases keep-awake',async()=>{
    await native.evaluate(()=>window.__vv.androidBack());await native.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await native.evaluate(()=>window.__vv.paused),true);assert.equal(await native.evaluate(()=>window.__nativeCalls.filter(x=>x.type==='awake').at(-1).value),false);await native.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    await native.click('#btn-end');await native.evaluate(()=>window.__vv.androidBack());assert.equal(await native.evaluate(()=>window.__vv.mode),'menu');assert.equal(await native.evaluate(()=>window.__vv.screen),'garage');await native.click('#scr-garage [data-nav="hub"]');assert.equal(await native.evaluate(()=>window.__vv.androidBack()),false);assert.ok(await native.evaluate(()=>window.__nativeCalls.some(x=>x.type==='haptic')));report.nativeBridgeMock=true;
  });
  await native.close();

  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    const p=await browser.newPage({viewport,isMobile:true,hasTouch:true});watch(p);await p.addInitScript(()=>localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,firstRunDone:true,settings:{graphics:'low',renderScale:'0.5',textScale:1.3,reducedMotion:true}})));
    await p.goto('file://'+path.resolve('dist/velocityverse.html'));await ready(p);await p.click('#btn-start');await p.waitForSelector('#scr-hub.active');
    const m={viewport,screens:[]};report.mobile.push(m);
    await check(`Mobile ${viewport.width}×${viewport.height}: home gates have no overlaps`,async()=>{
      const boxes=await p.locator('#scr-hub .world-gate').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,overflow:[...e.querySelectorAll('strong,small')].map(c=>{const b=c.getBoundingClientRect();return{text:c.textContent,bottom:b.bottom-r.bottom,right:b.right-r.right};})};}));
      for(const b of boxes)assert.ok(b.x>=-1&&b.x+b.w<=viewport.width+1&&b.w>=44&&b.h>=44);
      for(const b of boxes)for(const c of b.overflow)assert.ok(c.bottom<=1&&c.right<=1,`Gate text spills outside card: ${c.text} (${JSON.stringify(c)})`);
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=1||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=1,`Gates ${i}/${j} overlap`);}
      for(let i=0;i<7;i++){const gate=p.locator('#scr-hub .world-gate').nth(i);await gate.scrollIntoViewIfNeeded();const box=await gate.boundingBox();assert.ok(box.y>=-1&&box.y+box.height<=viewport.height+1);}
    });
    await p.evaluate(()=>document.getElementById('scr-hub').scrollTop=0);await p.screenshot({path:`tests/results/v4_hub_${viewport.width}.png`});
    for(const screen of ['lab','explorer','team','records']){
      await nav(p,screen);
      await check(`Mobile ${viewport.width}×${viewport.height}: ${screen} remains reachable at 130% text`,async()=>{
        const metrics=await p.locator(`#scr-${screen}`).evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(metrics.scroll<=metrics.width+1,`${screen} horizontal overflow ${metrics.scroll}/${metrics.width}`);
        const buttons=await p.locator(`#scr-${screen} button`).evaluateAll(es=>es.filter(e=>e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent.trim(),w:r.width,h:r.height};}));assert.ok(buttons.every(b=>b.w>=43.5&&b.h>=43.5),'Small targets: '+JSON.stringify(buttons.filter(b=>b.w<43.5||b.h<43.5)));
        const dock=await p.locator(`#scr-${screen} .app-foot .app-nav`).boundingBox();assert.ok(dock.x>=-1&&dock.y>=-1&&dock.x+dock.width<=viewport.width+1&&dock.y+dock.height<=viewport.height+1,'Persistent destination dock does not fit');
        if(screen==='explorer'){const fits=await p.locator('#explorer-map').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('svg').getBoundingClientRect();return b.top>=a.top-1&&b.bottom<=a.bottom+1;});assert.ok(fits,'Circuit map spills over mobile section buttons');}
        if(viewport.width===390){await frame(p);await p.screenshot({path:`tests/results/v4_${screen}_390.png`});}
        const home=p.locator(`#scr-${screen} .app-header [data-nav="hub"]`);await home.scrollIntoViewIfNeeded();await home.click();await p.waitForSelector('#scr-hub.active');m.screens.push({screen,...metrics,minTarget:Math.min(...buttons.map(b=>Math.min(b.w,b.h)))});
      });
    }
    await check(`Mobile ${viewport.width}×${viewport.height}: long team identity fits profile`,async()=>{
      await p.evaluate(()=>{const g=window.__vv;g.save.data.team={name:'WWWWWWWWWWWWWWWWWWWWWWWW',tag:'RACE'};g.hub.renderHome();document.getElementById('scr-hub').scrollTop=0;});
      const fits=await p.locator('#scr-hub .hub-top').evaluate(e=>[...e.querySelectorAll('button')].every(b=>{const r=b.getBoundingClientRect();return r.x>=-1&&r.right<=innerWidth+1;}));assert.ok(fits,'Long team name pushes profile/settings beyond the viewport');
    });
    assert.equal(await p.evaluate(()=>window.__vv.renderer.gl.getError()),0);await p.close();
  }
  await check('No JavaScript errors or external network dependency',async()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);});
} finally {
  report.passed=report.checks.filter(c=>c.pass).length;report.total=report.checks.length;fs.writeFileSync('tests/results/app_flow.json',JSON.stringify(report,null,2));await browser.close();
}
console.log(`${report.passed}/${report.total} app checks passed`);
if(report.passed!==report.total)process.exitCode=1;
