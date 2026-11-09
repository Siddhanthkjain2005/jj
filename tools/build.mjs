// Bundles the ES modules into one self-contained HTML file (dist/velocityverse.html) with no dependencies.
// Each module becomes a function scope; imports become destructured references, so names never collide.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['sim/units', 'sim/data', 'sim/track', 'sim/vehicle', 'sim/assists', 'sim/race', 'sim/traffic', 'sim/ai', 'game/gfx', 'game/world', 'game/carmodel', 'game/fx', 'game/renderer', 'game/camera', 'game/input', 'game/audio', 'game/save', 'game/telemetry', 'game/main'];
const id = (p) => '__m_' + p.replace(/[^a-z0-9]/gi, '_');
let bundle = '';
for (const mod of ORDER) {
  let src = fs.readFileSync(path.join(ROOT, 'src', mod + '.js'), 'utf8');
  const exportsList = [];
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)';\s*$/gm, (m, names, from) => {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(mod), from)).replace(/\.js$/, '');
    if (!ORDER.includes(resolved)) throw new Error(`Unknown import ${from} in ${mod}`);
    const list = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = ${id(resolved)};`;
  });
  src = src.replace(/^export\s+(async\s+)?(function|class|const|let)\s+([A-Za-z0-9_$]+)/gm, (m, a, kind, name) => { exportsList.push(name); return `${a || ''}${kind} ${name}`; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`Unhandled import/export in ${mod}`);
  bundle += `\n// ---- ${mod}.js ----\nconst ${id(mod)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
}
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const stamp = new Date().toISOString();
const out = html
  .replace(/<script type="module" src="[^"]+"><\/script>\n?/, '')
  .replace('<!--APP-->', `<script>\n"use strict";\n// VELOCITYVERSE Milestone 0 bundle, built ${stamp}. Source: src/ (see README).\n${bundle}\n</script>`);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'velocityverse.html'), out);
console.log(`dist/velocityverse.html written: ${(out.length / 1024).toFixed(1)} KB, ${ORDER.length} modules`);
