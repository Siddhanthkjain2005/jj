// 0.8 "Neon Coast" flow in a real browser: the five destinations render, upgrades and setups reach the
// car, a scripted driver earns rewards from real laps and a real Grand Prix, story events open with a
// cutscene and the event-ready screen, school and cups start. Run after `npm run build`.
// CHROME_PATH overrides the browser; VV_SHOTS=dir saves screenshots; VV_W / VV_H set the viewport.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); }
const chrome = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
const shots = process.env.VV_SHOTS || '', W = Number(process.env.VV_W || 915), H = Number(process.env.VV_H || 412);
const browser = await chromium.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { checks: [], errors: [] };
const check = async (name, fn) => { try { await fn(); report.checks.push({ name, pass: true }); console.log('PASS ' + name); } catch (e) { report.checks.push({ name, pass: false, error: String(e.message || e) }); console.error('FAIL ' + name + ': ' + (e.message || e)); } };
const BOT = `(() => { const g = window.__vv; g._botHint = -1; g._botP = {};
  const steer = () => { const v = g.veh, t = g.track, p = t.project(v.x, v.z, g._botHint, g._botP); g._botHint = p.i;
    const u = Math.max(0, v.forwardSpeed), Ld = 6 + 0.42 * u; let ss = (p.s + Ld) % t.length, lo = 0, hi = t.n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t.s[mid] <= ss) lo = mid; else hi = mid - 1; }
    const j = (lo + 1) % t.n, seg = j === 0 ? t.length - t.s[lo] : t.s[j] - t.s[lo], k = seg > 0 ? (ss - t.s[lo]) / seg : 0;
    const tx = t.lineX[lo] + (t.lineX[j] - t.lineX[lo]) * k, tz = t.lineZ[lo] + (t.lineZ[j] - t.lineZ[lo]) * k;
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw), rax = v.x - sy * v.b, raz = v.z - cy * v.b, dx = tx - rax, dz = tz - raz, lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
    const d = Math.atan((2 * v.car.wheelbase * Math.sin(Math.atan2(lx, lz))) / Math.max(Math.hypot(lx, lz), 1)), ref = g.S.steerSpeedRef;
    return Math.max(-1, Math.min(1, d * (ref + u) / (ref * v.car.steerLock))); };
  const orig = g.input.poll.bind(g.input);
  g.input.poll = dt => { const r = orig(dt); if (g.mode === 'race' && !g.school) { r.steer = steer(); r.digitalSteer = false; } return r; };
  // Fast-forward the fixed-step simulation without rendering. Stops when the session ends or the predicate is true.
  window.__ff = (seconds, until) => { let t = 0; while (t < seconds && g.mode === 'race' && !g.paused) { g.simulate(8 / 120, g.input.poll(8 / 120)); t += 8 / 120; if (g.finishT !== null || (until && until(g))) break; } return t; };
  return true; })()`;
const fixture = { version: 1, firstRunDone: true, preset: 'rookie', settings: { graphics: 'low', renderScale: '0.5', reducedMotion: true, aiLevel: 'easy', raceLaps: 3 }, storyCareer: { credits: 900 }, team: { driver: 'Sid' } };
const shot = async (page, name) => { if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(shots, name + '.png') }); } };
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: shots ? 2 : 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  await page.addInitScript(f => { if (!localStorage.getItem('velocityverse.m0.save')) localStorage.setItem('velocityverse.m0.save', JSON.stringify(f)); }, fixture);
  await page.goto('file://' + path.resolve('dist/velocityverse.html'));
  await page.waitForFunction(() => window.__vv?.renderer && window.__vv?.pad && window.__vv?.juice);
  report.gsap = await page.evaluate(() => window.gsap?.version || null);
  await page.evaluate(BOT);
  const nav = async id => { await page.evaluate(id => window.__vv.navTo(id), id); await page.waitForSelector(`#scr-${id}.active`); };
  const credits = () => page.evaluate(() => window.__vv.save.data.storyCareer.credits);
  const home = () => page.evaluate(() => { const g = window.__vv; g.mode = 'menu'; g.school = null; g.clearRivals(); g.navTo('hub'); });

  await check('Home: five destinations, the next story event, the starter car and today’s goal', async () => {
    await nav('hub');
    assert.deepEqual(await page.locator('#scr-hub .nc-nav button').allInnerTexts().then(a => a.map(s => s.trim().toUpperCase())), ['HOME', 'STORY', 'GARAGE', 'WORLD', 'CREW']);
    assert.match(await page.locator('#scr-hub .nc-hero').innerText(), /RUN THE\s+DELIVERY/i);
    assert.match(await page.locator('#scr-hub .nc-cartag').innerText(), /KESTREL SPRINT/i);
    assert.match(await page.locator('#scr-hub .nc-player').innerText(), /SID/i);
    assert.ok(await page.locator('#scr-hub .goalcard').count() === 1);
    const navBox = await page.locator('#scr-hub .nc-nav').boundingBox(); assert.ok(navBox.y + navBox.height >= H - 1 && navBox.height >= 48, 'bottom navigation is at least 48 px tall');
    assert.ok(report.gsap, 'GSAP is bundled');
  });
  await shot(page, 'p_hub');
  await check('Every destination renders inside the viewport with its primary action visible', async () => {
    for (const [id, action] of [['career', '[data-act="story-start"]'], ['garage', '.gar-rides .ride'], ['world', '[data-act="mode"][data-id="race"]'], ['team', '.crew'], ['records', '.troph']]) {
      await nav(id);
      const wide = await page.evaluate(id => document.querySelector(`#scr-${id} .pd-body`).scrollWidth - document.querySelector(`#scr-${id} .pd-body`).clientWidth, id); assert.ok(wide <= 2, `${id} scrolls sideways by ${wide}px`);
      const box = await page.locator(`#scr-${id} ${action}`).first().boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= H + 1 && box.x + box.width <= W + 1, `${id}: ${action} is off screen ${JSON.stringify(box)}`);
      if (id !== 'team' && id !== 'records') assert.ok(box.height >= 30, `${id}: touch target ${box.height}px`);
      await shot(page, 'p_' + id);
    }
  });
  await check('Garage parts: an upgrade spends credits and changes the car that races', async () => {
    await nav('garage'); const before = await credits(), mu0 = await page.evaluate(() => window.__vv.veh.car.tire.mu);
    await page.click('#scr-garage [data-act="gar-tab"][data-id="parts"]'); await shot(page, 'p_garage_parts');
    await page.click('#scr-garage [data-act="upgrade"][data-id="tires"]');
    assert.ok(await credits() < before, 'credits spent'); assert.equal(await page.evaluate(() => window.__vv.save.data.progress.up.sprint.tires), 1);
    await page.evaluate(() => window.__vv.pad.launch('practice', false, true));
    const mu1 = await page.evaluate(() => window.__vv.veh.car.tire.mu); assert.ok(mu1 > mu0 * 1.015, `tyre grip ${mu0} -> ${mu1}`);
    await home();
  });
  await check('Garage tune: the setup changes the car and the bench measures it', async () => {
    await nav('garage'); await page.click('#scr-garage [data-act="gar-tab"][data-id="tune"]');
    await page.click('#scr-garage [data-act="wing"][data-id="-2"]'); assert.equal(await page.evaluate(() => window.__vv.save.data.progress.tune.sprint.wing), -2);
    await page.click('#scr-garage [data-act="bench"]'); await page.waitForFunction(() => window.__vv.pad.benchRun && !window.__vv.pad.benchBusy);
    const run = await page.evaluate(() => ({ mine: window.__vv.pad.benchRun.result.metrics, stock: window.__vv.pad.benchRun.stock.metrics }));
    assert.ok(run.mine.topKmh > run.stock.topKmh + 3, `less wing raises top speed: ${run.stock.topKmh} -> ${run.mine.topKmh}`); assert.ok(run.mine.accel < run.stock.accel, 'stage 1 tyres launch harder than stock');
    await shot(page, 'p_garage_tune'); await page.click('#scr-garage [data-act="wing"][data-id="0"]');
  });
  await check('World → event ready → a real practice lap pays credits, grades sections and earns a mastery star', async () => {
    await nav('world'); const before = await credits();
    await page.click('#scr-world [data-act="mode"][data-id="practice"]'); await page.waitForSelector('#scr-prep.active'); await shot(page, 'p_ready_free');
    const go = await page.locator('#scr-prep [data-act="go"]').boundingBox(); assert.ok(go && go.y + go.height <= H + 1 && go.height >= 44, 'Let’s race is on screen: ' + JSON.stringify(go));
    await page.click('#scr-prep [data-act="assists"]'); assert.ok(await page.locator('#prep-drawer #preset-seg button').count() >= 3); await page.click('#prep-drawer [data-act="assists-close"]');
    await page.click('#scr-prep [data-act="go"]'); await page.waitForFunction(() => window.__vv.mode === 'race');
    const t = await page.evaluate(() => window.__ff(150, g => g.race.laps.filter(l => l.valid).length >= 1));
    const laps = await page.evaluate(() => window.__vv.race.laps.map(l => [l.time, l.valid])); assert.ok(laps.some(l => l[1]), `no valid lap after ${t.toFixed(0)} s: ${JSON.stringify(laps)}`);
    await page.evaluate(() => window.__vv.finishSession()); await page.waitForSelector('#scr-results.active');
    assert.ok(await page.locator('#results-rewards .rw').count() >= 2); assert.ok(await credits() > before);
    const c = await page.evaluate(() => window.__vv.save.data.progress.circuits.beacon_short); assert.ok(c.stars.includes('lap') && c.best > 10 && c.sec.filter(x => x > 0.8).length === 8, JSON.stringify(c));
    await shot(page, 'p_results_practice');
  });
  await check('Grand Prix: rivals keep their own stock cars and the finish pays a purse', async () => {
    await page.evaluate(() => { const g = window.__vv; g.mode = 'menu'; g.clearRivals(); g.navTo('world'); g.pad.launch('race', false, true); });
    const info = await page.evaluate(() => { const g = window.__vv; return { rivals: g.rivals.length, same: g.rivals[0].veh.car === g.veh.car, rivalMu: g.rivals[0].veh.car.tire.mu, myMu: g.veh.car.tire.mu, track: !!g.rivalTrack }; });
    assert.equal(info.rivals, 7); assert.ok(!info.same && info.track && info.myMu > info.rivalMu, JSON.stringify(info));
    await page.evaluate(() => window.__ff(8)); await shot(page, 'p_race_hud');
    const t = await page.evaluate(() => window.__ff(400)); const me = await page.evaluate(() => { const e = window.__vv.field.entries[0]; return { finished: e.finished, pos: e.pos }; });
    assert.ok(me.finished, `player did not finish in ${t.toFixed(0)} s`);
    const before = await credits(); await page.evaluate(() => window.__vv.finishSession()); await page.waitForSelector('#scr-results.active');
    assert.match(await page.locator('#results-rewards').innerText(), /Finished P\d/i); assert.ok(await credits() > before);
    assert.equal(await page.evaluate(() => window.__vv.save.data.progress.stats.races), 1);
    await page.click('#scr-results [data-act="details"]'); assert.ok(await page.locator('#results-table tr').count() >= 8); await shot(page, 'p_results_race');
    await page.click('#btn-results-garage'); await page.waitForSelector('#scr-hub.active');
  });
  await check('Daily goals open from the home card and pay when collected', async () => {
    await page.click('#scr-hub .goalcard'); assert.equal(await page.locator('#scr-hub .goals-pop .goal').count(), 3); await shot(page, 'p_goals');
    const claim = page.locator('#scr-hub [data-act="claim-goal"]');
    if (await claim.count()) { const before = await credits(); await claim.first().click(); assert.ok(await credits() > before); }
  });
  await check('Story: event sheet → cutscene → event ready → the drive starts', async () => {
    await page.click('#scr-hub [data-act="story-continue"]'); await page.waitForSelector('#scr-career.active');
    assert.equal(await page.locator('#scr-career .acts .nc-seg button').count(), 4); assert.ok(await page.locator('#scr-career svg.harbor .hm-pin').count() === 1); await shot(page, 'p_story');
    await page.click('#scr-career [data-act="story-start"]'); await page.waitForSelector('#cutscene.on');
    assert.ok((await page.locator('#cutscene .cs-box b').innerText()).length > 2); await shot(page, 'p_cutscene');
    await page.click('#cutscene .cs-skip'); await page.waitForSelector('#scr-prep.active');
    assert.match(await page.locator('#scr-prep .nc-hero').innerText(), /RUN THE DELIVERY/i); assert.equal(await page.locator('#scr-prep [data-act="story-setup"]').count(), 3); await shot(page, 'p_ready_story');
    await page.click('#scr-prep [data-act="go"]'); await page.waitForFunction(() => window.__vv.mode === 'race' && window.__vv.storyCareer.active);
    const done = await page.evaluate(() => { const g = window.__vv; window.__ff(70, () => !!g.storyCareer.pending); g.storyCareer.flush(); return { result: g.storyCareer.result?.success, stars: g.storyCareer.result?.stars, screen: g.screen }; });
    assert.equal(done.screen, 'career'); assert.ok(done.result === true && done.stars >= 1, 'scripted driver completes the first event: ' + JSON.stringify(done));
    await page.waitForTimeout(200); if (await page.locator('#cutscene.on').count()) await page.click('#cutscene .cs-skip');
    assert.ok(await page.locator('#scr-career .bigstars b').count() >= 1); await shot(page, 'p_story_result');
    await page.click('#scr-career [data-act="story-next"]'); assert.match(await page.locator('#scr-career .sheet .nc-h').innerText(), /CLOSING BELL/i);
  });
  await check('School drills run in the school car and grade a medal', async () => {
    await nav('world'); await page.click('#scr-world [data-act="world-tab"][data-id="school"]'); await shot(page, 'p_school');
    await page.click('#scr-world [data-act="drill"][data-id="launch"]'); await page.waitForFunction(() => window.__vv.school && window.__vv.mode === 'race');
    assert.deepEqual(await page.evaluate(() => [window.__vv.baseRideId, window.__vv.currentCircuitId]), ['sprint', 'beacon_short']);
    await page.evaluate(() => { const g = window.__vv, orig = g.input.poll.bind(g.input); g.input.poll = dt => { const r = orig(dt); if (g.school) { const k = g.veh.forwardSpeed * 3.6; r.throttle = k < 61 ? 0.7 : 0.12; r.brake = 0; r.steer = 0; } return r; }; });
    await page.evaluate(() => { const g = window.__vv; let t = 0; while (t < 20 && !g.pendingLessonResult) { g.simulate(8 / 120, g.input.poll(8 / 120)); t += 8 / 120; } });
    await page.waitForSelector('#scr-lesson.active'); assert.ok(await page.evaluate(() => window.__vv.save.data.progress.medals.launch) >= 1);
    assert.match(await page.locator('#lesson-xp').innerText(), /medal|run/i); await home();
  });
  await check('Cups: entering starts round one with the cup rules', async () => {
    await nav('world'); await page.click('#scr-world [data-act="world-tab"][data-id="cups"]'); await page.click('#scr-world [data-act="cup-start"][data-id="club"]'); await page.waitForSelector('#scr-prep.active');
    assert.ok(await page.evaluate(() => window.__vv.raceOverride?.cup && window.__vv.save.data.progress.cup.id === 'club'));
    await page.click('#scr-prep [data-act="ready-back"]'); await page.waitForSelector('#scr-world.active'); assert.equal(await page.locator('#scr-world [data-act="cup-go"]').count(), 1);
  });
  await check('Android Back closes the event-ready screen before leaving', async () => {
    await page.evaluate(() => window.__vv.pad.launch('practice')); await page.waitForSelector('#scr-prep.active');
    assert.equal(await page.evaluate(() => window.__vv.androidBack()), true); await page.waitForSelector('#scr-world.active');
  });
  await check('Progress survives a reload', async () => {
    const saved = await page.evaluate(() => JSON.stringify([window.__vv.save.data.progress.circuits, window.__vv.save.data.storyCareer.records['first-light']])); await page.reload();
    await page.waitForFunction(() => window.__vv?.pad); assert.equal(await page.evaluate(() => JSON.stringify([window.__vv.save.data.progress.circuits, window.__vv.save.data.storyCareer.records['first-light']])), saved);
  });
} finally { await browser.close(); }
report.pass = report.checks.every(c => c.pass) && report.errors.length === 0;
fs.mkdirSync('tests/results', { recursive: true }); fs.writeFileSync('tests/results/paddock_flow.json', JSON.stringify(report, null, 1));
if (report.errors.length) console.error('Page errors:\n' + report.errors.join('\n'));
console.log(`${report.checks.filter(c => c.pass).length}/${report.checks.length} checks passed`); process.exit(report.pass ? 0 : 1);
