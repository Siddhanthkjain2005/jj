// NaN-guard regression check: poisons the reflection probe with NaN (as a GPU pow()/normalize() fault would),
// freezes it, and measures how much of the final frame turns pure black / pure white. Software WebGL (SwiftShader);
// this checks the guards, it is not a device measurement. Run: node tests/nan_guard_check.mjs [path-to-html]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'velocityverse.html'));
const chromePath = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: chromePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = { file: path.basename(path.dirname(path.dirname(file))) + '/' + path.basename(file), errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => out.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') out.errors.push(m.text()); });
  await page.goto('file://' + file);
  await page.waitForTimeout(2500);
  out.renderer = await page.evaluate(() => !!window.__vv.renderer);
  await page.evaluate(() => { const g = window.__vv; g.S.graphics = 'high'; g.S.renderScale = '1'; g.applySettings();
    const R = g.renderer, orig = R.render.bind(R);
    R.render = (sc) => { const r = orig(sc); if (window.__grab === 1) { const gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, b = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); let k = 0, wh = 0;
      for (let i = 0; i < b.length; i += 4) { if (b[i] < 4 && b[i + 1] < 4 && b[i + 2] < 4) k++; if (b[i] > 250 && b[i + 1] > 250 && b[i + 2] > 250) wh++; }
      const errs = []; let e; while ((e = gl.getError()) !== 0 && errs.length < 4) errs.push(e);
      window.__grab = { black: +(k / (w * h) * 100).toFixed(2), white: +(wh / (w * h) * 100).toFixed(2), glErrors: errs }; } return r; }; });
  await page.waitForTimeout(6000);
  const grab = async () => { await page.evaluate(() => { window.__grab = 1; }); await page.waitForFunction(() => typeof window.__grab === 'object', null, { timeout: 60000 }); return page.evaluate(() => window.__grab); };
  out.clean = await grab();
  out.hdrProbe = await page.evaluate(() => { const R = window.__vv.renderer, gl = R.gl, P = R.probe; if (!P || !R.hdr) return false;
    const nan = new Uint16Array(P.size * P.size * 4); for (let i = 0; i < nan.length; i += 4) { nan[i] = 0x7E00; nan[i + 1] = 0x7C00; nan[i + 2] = 0x7E00; nan[i + 3] = 0x3C00; }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, P.tex);
    for (let f = 0; f < 6; f++) gl.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, 0, 0, P.size, P.size, gl.RGBA, gl.HALF_FLOAT, nan);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP); R._updateProbe = () => {}; return true; });
  await page.waitForTimeout(3000);
  out.poisoned = await grab();
  await page.screenshot({ path: path.join(ROOT, 'tests', 'results', 'nan_probe_' + (process.argv[3] || 'new') + '.png') });
} catch (e) { out.errors.push('harness: ' + e.message); }
await browser.close();
fs.writeFileSync(path.join(ROOT, 'tests/results/hdr_guard_check.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
assert.equal(out.errors.length, 0);
assert.ok(out.renderer && out.hdrProbe, 'HDR probe must actually be exercised');
for (const r of [out.clean, out.poisoned]) {
  assert.equal(r.glErrors.length, 0); assert.ok(r.black < 20 && r.white < 10, 'HDR contamination blew out the frame');
}
