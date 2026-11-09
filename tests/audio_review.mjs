// Real WebAudio DSP regression, rendered offline; no claim of recorded-engine realism.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const chrome=process.env.CHROME_PATH||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({executablePath:chrome});
try{
 const page=await browser.newPage();
 await page.addScriptTag({content:fs.readFileSync('src/game/audio.js','utf8').replace('export class GameAudio','class GameAudio')+'\nwindow.TestAudio=GameAudio;'});
 const results=await page.evaluate(async()=>{
  const Native=window.AudioContext,out=[];
  for(const mode of ['silent','idle','loaded','coast','scrub','shots']){
   const ctx=new OfflineAudioContext(1,44100,44100);window.AudioContext=function(){return ctx;};
   const a=new window.TestAudio();a.unlock();
   const state={rpm:mode==='idle'?3500:10000,throttle:mode==='loaded'?.9:0,speed:mode==='idle'?0:40,slip:mode==='scrub'?1.5:.1,curb:0,running:mode!=='silent',gear:4};
   a.update(state);if(mode==='shots'){a.click();a.pop();a.impact(8);}
   const b=await ctx.startRendering(),d=b.getChannelData(0);let sum=0,peak=0,bad=0;
   for(let i=0;i<d.length;i++){if(!Number.isFinite(d[i]))bad++;sum+=d[i]*d[i];peak=Math.max(peak,Math.abs(d[i]));}
   a.dispose();out.push({mode,rms:Math.sqrt(sum/d.length),peak,bad,remainingSources:a.sources.length,remainingShots:a.oneShots.size});
  }
  window.AudioContext=Native;return out;
 });
 for(const r of results){assert.equal(r.bad,0);assert.ok(r.peak<1);assert.equal(r.remainingSources,0);assert.equal(r.remainingShots,0);}
 assert.ok(results[0].peak<1e-6);assert.ok(results.find(r=>r.mode==='loaded').rms>results.find(r=>r.mode==='idle').rms);
 fs.writeFileSync('tests/results/audio_review.json',JSON.stringify(results,null,2));console.log('PASS WebAudio offline: silence/load/coast/grip/shift/collision finite, unclipped and cleaned up');
}finally{await browser.close();}
