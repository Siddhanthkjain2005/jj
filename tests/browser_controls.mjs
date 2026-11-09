// Focused live regressions for held inputs, settings changes and HUD overlap.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
const chrome = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch({executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width:960,height:540}, hasTouch:true});
  page.setDefaultTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('velocityverse.m0.save', JSON.stringify({version:1, firstRunDone:false, settings:{graphics:'low', renderScale:'0.5'}}));
  });
  await page.goto('file://' + path.resolve('dist/velocityverse.html'));
  await page.waitForFunction(() => window.__vv?.renderer);
  await page.click('#btn-start');
  await page.click('#scr-onboard [data-preset="racer"]');
  const gas = page.getByRole('button', {name:'Throttle', exact:true});
  const box = await gas.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  assert.equal(await page.evaluate(() => window.__vv.input.touch.gas),true);
  await page.evaluate(() => window.__vv.pause());
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__vv.input.touch.gas),false);
  await page.evaluate(() => { const g=window.__vv; g.S.layout='slider'; g.resume(); });
  assert.equal(await page.locator('#touch').getAttribute('data-layout'),'slider');
  assert.equal(await page.locator('.tpad').count(),1);
  await page.evaluate(() => {
    const g=window.__vv;
    g.S.showTelemetry=true; g.applySettings();
    g.countdown=0; g._goShown=true;
    g.banner('PERSONAL BEST','pb',600000);
    g.toast('New personal best 0:49.746',600000);
    g.input.touch.gas=true;
    window.dispatchEvent(new Event('blur'));
  });
  assert.equal(await page.evaluate(() => window.__vv.input.touch.gas),false);
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#hud-center').textContent(),'PERSONAL BEST');
  const bounds = await page.evaluate(() => {
    const r = id => {const b=document.getElementById(id).getBoundingClientRect(); return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
    return {banner:r('hud-center'),telemetry:r('telemetry'),toast:r('toast')};
  });
  assert.ok(bounds.banner.right < bounds.telemetry.left,JSON.stringify(bounds));
  assert.ok(bounds.toast.right < bounds.telemetry.left,JSON.stringify(bounds));
  await page.screenshot({path:'tests/results/07_controls_hud.png'});
  console.log('PASS live controls: actual pedal pointer, pause clears input, resume applies slider, blur clears touch; PB and toast clear telemetry');
} finally {await browser.close();}
