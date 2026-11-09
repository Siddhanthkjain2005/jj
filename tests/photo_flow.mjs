import {chromium} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const chrome=process.env.CHROME_PATH||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath:chrome});
try{
 const page=await browser.newPage({viewport:{width:960,height:540},acceptDownloads:true});page.setDefaultTimeout(60000);
 await page.addInitScript(()=>localStorage.setItem('velocityverse.m0.save',JSON.stringify({version:1,firstRunDone:true,settings:{graphics:'high',renderScale:'1',reducedMotion:true}})));
 await page.goto('file://'+path.resolve('dist/velocityverse.html'));await page.waitForFunction(()=>window.__vv?.renderer);
 await page.click('#btn-start');await page.click('.gate-garage');await page.click('#btn-garage-photo');await page.fill('#photo-angle','160');await page.fill('#photo-height','2.5');
 const [d]=await Promise.all([page.waitForEvent('download'),page.click('#btn-photo-save')]);await d.saveAs('tests/results/v2_photo_export.png');
 const png=fs.readFileSync('tests/results/v2_photo_export.png');assert.equal(png.readUInt32BE(16),960);assert.equal(png.readUInt32BE(20),540);assert.ok(png.length>30000);
 await page.keyboard.press('Escape');await page.waitForSelector('#scr-garage.active');
 await page.click('#btn-garage-drive');await page.click('#scr-event [data-mode="practice"]');await page.click('#btn-prep-start');
 await page.keyboard.press('Escape');await page.waitForSelector('#scr-pause.active');await page.click('#btn-photo');
 const t=await page.evaluate(()=>window.__vv.veh.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__vv.veh.time),t);
 await page.keyboard.press('Escape');await page.waitForSelector('#scr-pause.active');await page.click('#btn-pause-settings');
 await page.keyboard.press('Escape');await page.waitForSelector('#scr-pause.active');
 await page.click('#btn-restart');assert.equal(await page.evaluate(()=>window.__vv.audio.muted),false);
 assert.equal(await page.evaluate(()=>window.__vv.renderer.gl.getError()),0);
 console.log('PASS photo: orbit/lens UI, actual 960×540 PNG export, frozen race, Escape navigation in photo/settings');
}finally{await browser.close();}
