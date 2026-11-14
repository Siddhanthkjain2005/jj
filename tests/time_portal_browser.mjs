import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome });
const url = process.env.VV_TEST_URL || pathToFileURL(resolve('dist/velocityverse.html')).href;
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS ' + name); };
try {
  const page = await browser.newPage({ viewport:{width:1280,height:800} });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('velocityverse.m0.save')) localStorage.setItem('velocityverse.m0.save', JSON.stringify({version:1, firstRunDone:true, settings:{graphics:'low',renderScale:'0.5',reducedMotion:true}, storyCareer:{credits:900}, pbs:{'legacy|standard':{time:42}}}));
  });
  await page.goto(`${url}?view=time-portal`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.__vv?.portal && window.__vv?.renderer);
  check('Time Portal opens with all 77 Championship years and 13 era groups', await page.locator('#tp-year option').count() === 78 && await page.locator('[data-tp-era]').count() === 13);
  await page.selectOption('#tp-year','1952');
  check('Museum presents the Formula 2 distinction and a source', (await page.locator('#tp-content').textContent()).includes('Formula 2') && await page.locator('#tp-content a[href^="https:"]').count() > 0);
  await page.selectOption('#tp-year','2026');
  check('2026 museum gives dated technical and sporting source links', await page.locator('#tp-content a').filter({hasText:'FIA Sporting Regulations'}).count() === 1 && (await page.locator('#tp-content').textContent()).includes('350 kW'));
  await page.locator('[data-tp-view="drive"]').click();
  check('Every historical car can be selected without career unlocks', await page.locator('[data-tp-field="selected"] option').count() === 16);
  await page.selectOption('[data-tp-field="selected"]','hist_1950');
  await page.selectOption('[data-tp-field="comparison"]','hist_2026');
  await page.selectOption('[data-tp-field="venue"]','archive_test');
  await page.selectOption('[data-tp-field="condition"]','rain');
  await page.locator('[data-tp-launch="mixed"]').click();
  check('Mixed race instantiates 1950 and 2026 cars with separate AI geometry and grip', await page.evaluate(() => {
    const g = window.__vv, opponent = g.rivals[0];
    return g.mode === 'race' && g.veh.car.id === 'hist_1950' && g.rivals.length === 5 && opponent.veh.car.id === 'hist_2026' && g.track.def.id === 'archive_test' && g.world.surfaces.asphalt.mu === .66 && g.renderer.carModel(opponent.livery,opponent.historyCar).flaps.length === 2;
  }));
  await page.evaluate(() => window.__vv.finishSession());
  await page.locator('#btn-results-garage').click();
  await page.locator('[data-tp-launch="balance"]').click();
  check('Balanced event changes actual tyre and aero parameters', await page.evaluate(() => window.__vv.veh.car.tire.mu === 1.5 && window.__vv.veh.car.aero.clA === 1.55));
  await page.evaluate(() => window.__vv.finishSession());
  await page.locator('#btn-results-garage').click();
  await page.selectOption('[data-tp-field="selected"]','hist_2026');
  await page.selectOption('[data-tp-field="venue"]','archive_road');
  await page.locator('[data-tp-launch="drive"]').click();
  await page.locator('#tp-boost').click();
  await page.keyboard.press('v');
  await page.waitForFunction(() => !window.__vv.portal.session.straight);
  check('Hybrid and active-aero controls work through buttons and keyboard', await page.evaluate(() => !window.__vv.portal.session.deploy && !window.__vv.portal.session.straight && window.__vv.renderer.gl.getError() === 0));
  await page.evaluate(() => window.__vv.finishSession());
  await page.locator('#btn-results-garage').click();
  await page.locator('[data-tp-view="career"]').click();
  check('Career begins with the first generation and locks later lessons', await page.locator('[data-tp-chapter]:enabled').count() === 1);
  await page.selectOption('[data-tp-field="condition"]','dry');
  await page.selectOption('[data-tp-field="style"]','Arcade');
  await page.locator('[data-tp-chapter="hist_1950"]').click();
  const firstLap = await page.evaluate(() => {
    const game = window.__vv;
    // Apply the normal Rookie controls with a scripted lookahead steering input.
    const track = game.track, vehicle = game.veh;
    let hint = -1;
    for (let step = 0; step < 120 * 180 && !game.race.laps.some(lap => lap.valid); step++) {
      const projected = track.project(vehicle.x,vehicle.z,hint,{});
      hint = projected.i;
      const speed = Math.max(0,vehicle.forwardSpeed);
      const target = track.pointAt(projected.s+6+.42*speed,track.lineOffset[hint],{});
      const sy = Math.sin(vehicle.yaw), cy = Math.cos(vehicle.yaw);
      const dx = target.x - (vehicle.x-sy*vehicle.b), dz = target.z - (vehicle.z-cy*vehicle.b);
      const angle = Math.atan(2 * vehicle.car.wheelbase * Math.sin(Math.atan2(dx*cy-dz*sy,dx*sy+dz*cy))/Math.max(Math.hypot(dx,dz),1));
      game.stepOnce({steer:Math.max(-1,Math.min(1,angle*(game.S.steerSpeedRef+speed)/(game.S.steerSpeedRef*vehicle.car.steerLock))),throttle:0,brake:0,digitalSteer:false});
    }
    game.finishSession();
    return game.race.laps.find(lap => lap.valid)?.time;
  });
  check('An actual valid timed lap unlocks the next History Career chapter', Number.isFinite(firstLap) && (await page.locator('#results-progression').textContent()).includes('Chapter completed'));
  await page.locator('#btn-results-garage').click();
  check('Continue returns to Time Portal and the next chapter is selectable', await page.locator('#scr-time-portal.active [data-tp-chapter]:enabled').count() === 2);
  await page.locator('[data-tp-view="bench"]').click();
  await page.locator('[data-tp-action="measure"]').click();
  await page.waitForSelector('#tp-metrics tbody tr');
  check('Engineering bench renders actual metrics for both cars', await page.locator('#tp-metrics tbody tr').count() === 2);
  await page.reload();
  await page.waitForFunction(() => window.__vv?.portal);
  check('Career progress survives reload with existing credits and lap records', await page.evaluate(() => {
    const d = window.__vv.save.data;
    return d.timePortal.completed[0] === 'hist_1950' && d.storyCareer.credits === 900 && d.pbs['legacy|standard'].time === 42;
  }));
  await page.locator('#scr-time-portal [data-nav="garage"]').click();
  check('Neon Coast Garage returns to the owned car and retains five destinations', await page.evaluate(() => !window.__vv.veh.car.history) && await page.locator('#scr-garage.active .nc-nav button').count() === 5);
  await page.locator('#scr-garage [data-nav="time-portal"]').click();
  for (const size of [{width:915,height:412},{width:390,height:844}]) {
    await page.setViewportSize(size);
    for (const view of ['museum','drive','career','bench']) {
      await page.locator(`[data-tp-view="${view}"]`).click();
      check(`${size.width}×${size.height} ${view} fits`, await page.locator('.tp-shell').evaluate(shell => shell.scrollWidth <= shell.clientWidth + 1));
    }
  }
  check('No uncaught browser errors', errors.length === 0);
  console.log(`${checks.length}/${checks.length} Time Portal browser checks passed`);
} finally { await browser.close(); }
