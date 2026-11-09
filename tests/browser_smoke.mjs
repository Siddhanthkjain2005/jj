// Browser smoke test: loads the built single-file game in headless Chrome (software WebGL via SwiftShader),
// drives the real UI flow, lets a scripted "player" steer (Rookie assists handle throttle and braking) until a
// lap completes, then checks results, saves, a Grand Prix against AI rivals (start lights, positions, contacts),
// every graphics preset (no WebGL errors, a lit frame) and the touch layout. Frame rates here are NOT device measurements.
// Run: node tests/browser_smoke.mjs   (needs Playwright and Chrome; paths below match this dev container)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright'); }
catch (error) {
  if (process.env.PLAYWRIGHT_PATH) throw error;
  playwright = require('/opt/npm-tools/node_modules/playwright');
}
const { chromium } = playwright;
const chromePath = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'results');
fs.mkdirSync(OUT, { recursive: true });
const url = 'file://' + path.join(ROOT, 'dist', 'velocityverse.html');
const report = { started: new Date().toISOString(), steps: [], errors: [] };
const step = (name, ok, detail) => { report.steps.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

const BOT = `(() => {
  const g = window.__vv; g._botHint = -1; g._botP = {};
  const steer = () => {
    const v = g.veh, t = g.track;
    const p = t.project(v.x, v.z, g._botHint, g._botP); g._botHint = p.i;
    const u = Math.max(0, v.forwardSpeed), Ld = 6 + 0.42 * u;
    let ss = (p.s + Ld) % t.length; let lo = 0, hi = t.n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t.s[mid] <= ss) lo = mid; else hi = mid - 1; }
    const j = (lo + 1) % t.n, seg = j === 0 ? t.length - t.s[lo] : t.s[j] - t.s[lo], k = seg > 0 ? (ss - t.s[lo]) / seg : 0;
    const tx = t.lineX[lo] + (t.lineX[j] - t.lineX[lo]) * k, tz = t.lineZ[lo] + (t.lineZ[j] - t.lineZ[lo]) * k;
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw), rax = v.x - sy * v.b, raz = v.z - cy * v.b;
    const dx = tx - rax, dz = tz - raz, lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
    const d = Math.atan((2 * v.car.wheelbase * Math.sin(Math.atan2(lx, lz))) / Math.max(Math.hypot(lx, lz), 1));
    const ref = g.S.steerSpeedRef;
    return Math.max(-1, Math.min(1, d * (ref + u) / (ref * v.car.steerLock)));
  };
  const orig = g.input.poll.bind(g.input);
  g.input.poll = (dt) => { const r = orig(dt); r.steer = steer(); r.digitalSteer = false; return r; };
  return true;
})()`;

const browser = await chromium.launch({
  executablePath: chromePath,
  args: process.env.VV_NATIVE_GPU ? ['--autoplay-policy=no-user-gesture-required'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
try {
  // ---------- desktop flow ----------
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.setDefaultTimeout(90000);
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(2500);
  const boot = await page.evaluate(() => ({ webgl: !!window.__vv.renderer, buildMs: window.__vv.renderer && window.__vv.renderer.buildMs, tris: window.__vv.renderer && window.__vv.renderer.triangles, gl: (() => { const g = window.__vv.renderer && window.__vv.renderer.gl; if (!g) return null; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })() }));
  step('Boot: WebGL2 renderer and world built', boot.webgl, `${boot.gl}; world built in ${boot.buildMs?.toFixed(0)} ms; ${boot.tris} triangles`);
  await page.waitForTimeout(4000); // first frames compile shaders (slow under software rendering)
  await page.screenshot({ path: path.join(OUT, '01_title.png') });
  // software rendering is slow at Ultra: drive the UI at Medium, half resolution (presets are all checked below)
  await page.evaluate(() => { const g = window.__vv; g.S.renderScale = '0.5'; g.S.graphics = 'medium'; g.applySettings(); });
  await page.waitForTimeout(2500);
  await page.click('#btn-start', { timeout: 90000 });
  await page.waitForTimeout(300);
  step('Title → first-run onboarding', await page.isVisible('#scr-onboard.active'));
  await page.evaluate(() => { const g = window.__vv; g.S.renderScale = '0.5'; g.S.graphics = 'medium'; g.S.showTelemetry = true; g.S.showPerf = true; g.applySettings(); });
  await page.click('#scr-onboard [data-preset="rookie"]');
  await page.waitForTimeout(400);
  const inRace = await page.evaluate(() => ({ mode: window.__vv.mode, hud: !document.getElementById('hud').hidden, preset: window.__vv.save.data.preset }));
  step('Onboarding (Rookie) → practice session with HUD', inRace.mode === 'race' && inRace.hud && inRace.preset === 'rookie', JSON.stringify(inRace));
  await page.evaluate(BOT);
  const t0 = Date.now();
  let lapInfo = null;
  while (Date.now() - t0 < 420000) {
    await page.waitForTimeout(2000);
    lapInfo = await page.evaluate(() => { const g = window.__vv, r = g.race; return { laps: r.laps.map((l) => ({ t: l.time, valid: l.valid, reason: l.reason })), simTime: g.veh.time, impacts: g.veh.impactCount, speed: g.veh.forwardSpeed, sRel: r.sRel, dropped: g.perf.dropped }; });
    if (lapInfo.laps.length >= 2) break;
    if (lapInfo.laps.length >= 1 && Date.now() - t0 > 300000) break;
  }
  await page.screenshot({ path: path.join(OUT, '02_race_hud_telemetry.png') });
  const perf = await page.evaluate(() => { const g = window.__vv, s = g.perf.summary(), c = document.getElementById('gl'); return { ...s, w: c.width, h: c.height, draws: g.renderer.drawCalls, pbs: Object.keys(g.save.data.pbs), saveOk: g.save.available, ghost: !!g.pbGhost }; });
  const valid = lapInfo.laps.filter((l) => l.valid);
  step('Scripted player completes timed laps in the browser build', valid.length >= 1, `${lapInfo.laps.map((l) => `${l.t.toFixed(3)} s ${l.valid ? 'valid' : 'invalid: ' + l.reason}`).join('; ')}; sim time ${lapInfo.simTime.toFixed(1)} s; wall impacts ${lapInfo.impacts}; real time ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  step('Personal best + ghost saved to local storage', perf.pbs.length >= 1 && perf.saveOk && perf.ghost, `keys ${perf.pbs.join(', ')}`);
  report.desktopPerf = perf;
  console.log(`      headless browser perf (not an Android measurement): ${perf.fps.toFixed(1)} fps, frame avg ${perf.avg.toFixed(1)} ms, p95 ${perf.p95.toFixed(1)} ms, sim ${perf.sim.toFixed(3)} ms/frame, render CPU ${perf.render.toFixed(2)} ms, ${perf.draws} draws, ${perf.w}×${perf.h}, dropped steps ${perf.dropped}`);
  // pause → end session → results
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  step('Pause menu opens with Escape', await page.isVisible('#scr-pause.active'));
  await page.click('#btn-end');
  await page.waitForTimeout(400);
  const results = await page.evaluate(() => ({ visible: document.querySelector('#scr-results').classList.contains('active'), rows: document.querySelectorAll('#results-table tbody tr').length, summary: document.getElementById('results-summary').textContent }));
  step('Results screen lists laps', results.visible && results.rows >= 1, results.summary);
  await page.screenshot({ path: path.join(OUT, '03_results.png') });
  await page.click('#btn-results-garage');
  await page.waitForTimeout(300);
  step('Results → garage', await page.isVisible('#scr-garage.active'));
  await page.click('#liveries .swatch:nth-child(2)');
  await page.waitForTimeout(200);
  step('Livery change persists', await page.evaluate(() => window.__vv.save.data.livery === 'inferno'));
  await page.click('#btn-garage-drive');
  await page.click('#scr-event [data-mode="timetrial"]');
  await page.waitForTimeout(200);
  const prep = await page.evaluate(() => ({ visible: document.querySelector('#scr-prep').classList.contains('active'), toggles: document.querySelectorAll('#assist-toggles .toggle').length, ghostNote: document.getElementById('assist-class-note').textContent }));
  step('Event select → race preparation with assist toggles', prep.visible && prep.toggles === 9, `${prep.toggles} toggles`);
  await page.click('#btn-prep-start');
  for (let k = 0; k < 120; k++) { await page.waitForTimeout(500); if (await page.evaluate(() => window.__vv.countdown <= 0)) break; } // software rendering runs the sim slower than real time
  const tt = await page.evaluate(() => ({ mode: window.__vv.race.mode, ghostLoaded: !!window.__vv.pbGhost, countdownDone: window.__vv.countdown <= 0 }));
  step('Time trial starts with the saved ghost loaded', tt.mode === 'timetrial' && tt.ghostLoaded && tt.countdownDone, JSON.stringify(tt));
  // every graphics preset renders without WebGL errors, and the frame is lit (read back inside the frame)
  const presets = await page.evaluate(async () => {
    const g = window.__vv, gl = g.renderer.gl, out = {};
    const frame = () => new Promise((res) => requestAnimationFrame(() => res()));
    for (const q of ['low', 'medium', 'high', 'ultra']) {
      while (gl.getError() !== 0) { /* clear */ }
      g.S.graphics = q; g.applySettings();
      for (let k = 0; k < 8; k++) await frame(); // probe needs six frames to fill
      const errs = []; let e; while ((e = gl.getError()) !== 0 && errs.length < 4) errs.push(e);
      const px = await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => { // runs after the game's frame
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(4 * 64);
        let sum = 0, bright = 0, colorful = 0;
        for (let i = 0; i < 64; i++) { gl.readPixels(Math.floor(((i % 8) + 0.5) * w / 8), Math.floor((Math.floor(i / 8) + 0.5) * h / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf.subarray(i * 4, i * 4 + 4)); }
        for (let i = 0; i < 64; i++) { const r = buf[i * 4], gg = buf[i * 4 + 1], b = buf[i * 4 + 2], l = (r + gg + b) / 3; sum += l; if (l > 60) bright++; if (Math.max(r, gg, b) - Math.min(r, gg, b) > 40) colorful++; }
        res({ mean: sum / 64, bright, colorful });
      })));
      out[q] = { errs, ...px, drawCalls: g.renderer.drawCalls };
    }
    g.S.graphics = 'medium'; g.applySettings();
    return out;
  });
  const presetOk = Object.values(presets).every((p) => p.errs.length === 0 && p.mean > 12 && p.colorful > 4);
  step('All graphics presets render without WebGL errors and produce a lit, coloured frame', presetOk, Object.entries(presets).map(([q, p]) => `${q}: mean ${p.mean.toFixed(0)}/255, ${p.colorful}/64 coloured samples, ${p.drawCalls} draws${p.errs.length ? ' GL errors ' + p.errs.join(',') : ''}`).join('; '));
  // Grand Prix against seven AI rivals: grid, start lights, lights out, AI racing, positions
  await page.evaluate(() => { const g = window.__vv; g.finishSession(); g.mode = 'menu'; g.clearRivals(); g.show('garage'); });
  await page.click('#btn-garage-drive');
  await page.click('#scr-event [data-mode="race"]');
  await page.waitForTimeout(200);
  const raceOpts = await page.evaluate(() => ({ visible: !document.getElementById('race-opts').hidden, ai: document.querySelectorAll('#ai-seg .segbtn').length, laps: document.querySelectorAll('#laps-seg .segbtn').length }));
  step('Event → Grand Prix preparation shows AI difficulty and race distance', raceOpts.visible && raceOpts.ai === 3 && raceOpts.laps === 2, JSON.stringify(raceOpts));
  await page.click('#btn-prep-start');
  await page.evaluate(BOT);
  let maxLit = 0, sawOut = false, gp = null; const tg = Date.now();
  while (Date.now() - tg < 240000) {
    await page.waitForTimeout(400);
    gp = await page.evaluate(() => { const g = window.__vv; return { lit: g.startLightsLit(), countdown: g.countdown, field: g.field ? g.field.entries.length : 0, tower: document.querySelectorAll('#tower li').length, pos: g.field ? g.field.order.map((e) => e.pos) : [], rivalSpeed: Math.max(...g.rivals.map((r) => r.veh.forwardSpeed)), simT: g.veh.time, me: g.field ? g.field.entries[0].pos : 0, contacts: g.rivals.reduce((a, r) => a + r.veh.carImpactCount, 0) + g.veh.carImpactCount, nan: g.rivals.reduce((a, r) => a + r.veh.nanResets, 0) + g.veh.nanResets, progress: g.field ? g.field.entries[0].progress : 0 }; });
    maxLit = Math.max(maxLit, gp.lit);
    if (gp.countdown <= 0) sawOut = true;
    if (sawOut && gp.progress > 260) break;
  }
  await page.screenshot({ path: path.join(OUT, '05_grand_prix.png') });
  step('Grand Prix: 8-car field, five start lights then lights out', gp.field === 8 && gp.tower === 8 && maxLit === 5 && sawOut, `field ${gp.field}, tower rows ${gp.tower}, most lights lit ${maxLit}, lights out ${sawOut}`);
  step('Grand Prix: AI rivals race (speed, positions, contacts resolved without NaN)', gp.rivalSpeed > 15 && [...gp.pos].sort((a, b) => a - b).join() === '1,2,3,4,5,6,7,8' && gp.nan === 0, `fastest rival ${(gp.rivalSpeed * 3.6).toFixed(0)} km/h; positions ${gp.pos.join(',')}; player P${gp.me}; car-contact steps ${gp.contacts} (the scripted player ignores other cars); sim ${gp.simT.toFixed(1)} s`);
  await page.evaluate(() => { const g = window.__vv; g.finishSession(); });
  await page.waitForTimeout(300);
  const gpRes = await page.evaluate(() => ({ visible: document.querySelector('#scr-results').classList.contains('active'), rows: document.querySelectorAll('#results-table tbody tr').length, me: !!document.querySelector('#results-table tr.me') }));
  step('Grand Prix results classify all 8 cars', gpRes.visible && gpRes.rows === 8 && gpRes.me, JSON.stringify(gpRes));
  await page.screenshot({ path: path.join(OUT, '06_gp_results.png') });
  await page.evaluate(() => { const g = window.__vv; g.mode = 'menu'; g.clearRivals(); });
  // reload: settings and PB survive
  await page.reload(); await page.waitForTimeout(1500);
  const persisted = await page.evaluate(() => ({ first: window.__vv.save.data.firstRunDone, pbs: Object.keys(window.__vv.save.data.pbs).length, livery: window.__vv.save.data.livery }));
  step('Reload keeps first-run flag, best laps and livery', persisted.first && persisted.pbs >= 1 && persisted.livery === 'inferno', JSON.stringify(persisted));
  await page.close();

  // ---------- phone-sized touch layout ----------
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await ctx.newPage();
  m.setDefaultTimeout(90000);
  m.on('pageerror', (e) => report.errors.push('mobile: ' + String(e)));
  await m.goto(url); await m.waitForTimeout(4000);
  await m.evaluate(() => { const g = window.__vv; g.S.renderScale = '0.5'; g.S.graphics = 'low'; g.applySettings(); });
  await m.waitForTimeout(1500);
  await m.tap('#btn-start'); await m.waitForTimeout(300);
  await m.evaluate(() => { const g = window.__vv; g.S.renderScale = '0.5'; g.applySettings(); });
  await m.tap('#scr-onboard [data-preset="racer"]');
  for (let k = 0; k < 120; k++) { await m.waitForTimeout(500); if (await m.evaluate(() => window.__vv.countdown <= 0)) break; }
  const touch = await m.evaluate(() => ({ visible: !document.getElementById('touch').hidden, buttons: [...document.querySelectorAll('#touch button')].map((b) => b.getAttribute('aria-label')) }));
  step('Touch layout (Racer): steering, pedals, camera and reset buttons', touch.visible && touch.buttons.includes('Brake') && touch.buttons.includes('Throttle') && touch.buttons.includes('Steer left'), touch.buttons.join(', '));
  // press the throttle with a real touch pointer and check the car accelerates
  const gas = await m.$('#touch .tb-gas'); const box = await gas.boundingBox();
  const [v0, s0] = await m.evaluate(() => [window.__vv.veh.forwardSpeed, window.__vv.veh.time]);
  await m.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await m.evaluate(() => { window.__vv.input.touch.gas = true; });
  for (let k = 0; k < 120; k++) { await m.waitForTimeout(500); if (await m.evaluate((t) => window.__vv.veh.time - t > 2.0, s0)) break; } // 2 s of simulated time
  const [v1, s1] = await m.evaluate(() => { const g = window.__vv; g.input.touch.gas = false; return [g.veh.forwardSpeed, g.veh.time]; });
  step('Throttle button drives the car', v1 > v0 + 3, `${v0.toFixed(1)} → ${v1.toFixed(1)} m/s over ${(s1 - s0).toFixed(1)} s of simulated time`);
  const sizes = await m.evaluate(() => [...document.querySelectorAll('#touch button')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  step('Touch targets ≥ 44 CSS px', sizes.every((s) => s >= 44), `smallest ${Math.min(...sizes).toFixed(0)} px`);
  await m.screenshot({ path: path.join(OUT, '04_phone_touch.png') });
  await ctx.close();
} finally {
  await browser.close();
}
const ignorable = (e) => /fonts\.g(oogleapis|static)\.com|ERR_NAME_NOT_RESOLVED|net::ERR_|Failed to load resource/.test(e);
const realErrors = report.errors.filter((e) => !ignorable(e));
step('No JavaScript errors in the console', realErrors.length === 0, realErrors.slice(0, 5).join(' | ') || `${report.errors.length} network-only messages (web fonts unavailable offline)`);
report.passed = report.steps.filter((s) => s.ok).length; report.total = report.steps.length;
fs.writeFileSync(path.join(OUT, 'browser_smoke.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.passed}/${report.total} browser checks passed`);
process.exit(report.passed === report.total ? 0 : 1);
