// Bundles the ES modules into one self-contained HTML file (dist/velocityverse.html) with no dependencies.
// Each module becomes a function scope; imports become destructured references, so names never collide.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['sim/units', 'sim/data', 'sim/rides', 'sim/circuits', 'sim/track', 'sim/vehicle', 'sim/assists', 'sim/race', 'sim/traffic', 'sim/ai', 'sim/academy', 'sim/lab', 'game/gfx', 'game/world', 'game/carmodel', 'game/fx', 'game/assets', 'game/renderer', 'game/camera', 'game/input', 'game/audio', 'game/career', 'game/openline-data', 'game/openline-state', 'game/career-mode', 'game/save', 'game/telemetry', 'game/platform', 'game/progress', 'game/juice', 'game/paddock', 'game/lobby', 'game/navigation', 'game/openline', 'game/story-career', 'game/main'];
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
  src = src.replace(/^import\s*\*\s*as\s+([A-Za-z0-9_$]+)\s*from\s*'([^']+)';\s*$/gm, (m, name, from) => {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(mod), from)).replace(/\.js$/, '');
    if (!ORDER.includes(resolved)) throw new Error(`Unknown import ${from} in ${mod}`);
    return `const ${name} = ${id(resolved)};`;
  });
  src = src.replace(/^export\s+(async\s+)?(function|class|const|let)\s+([A-Za-z0-9_$]+)/gm, (m, a, kind, name) => { exportsList.push(name); return `${a || ''}${kind} ${name}`; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`Unhandled import/export in ${mod}`);
  bundle += `\n// ---- ${mod}.js ----\nconst ${id(mod)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
}
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const stamp = JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
let out = html
  .replace('<!--OPENLINE-->',fs.readFileSync(path.join(ROOT,'web','openline.html'),'utf8'))
  .replace('<!--CAREER-->',fs.readFileSync(path.join(ROOT,'web','career.html'),'utf8'))
  .replace(/<link rel="stylesheet" href="\.\/(app|neon-panels|openline|career|paddock)\.css">/g,(_,name)=>'<style>\n'+fs.readFileSync(path.join(ROOT,'web',name+'.css'),'utf8')+'\n</style>')
  .replace(/<script src="\.\.\/node_modules\/gsap\/dist\/gsap\.min\.js"><\/script>\n?/, () => {
    // GSAP drives the menu motion. Without it (npm install not run) the game still works, just without those transitions.
    const file = path.join(ROOT, 'node_modules/gsap/dist/gsap.min.js');
    if (!fs.existsSync(file)) { console.warn('gsap not installed: building without menu transitions. Run npm install.'); return ''; }
    return '<script>\n' + fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>\n';
  })
  .replace(/<script type="module" src="[^"]+"><\/script>\n?/, '')
  .replace('<!--APP-->', `<script>\n"use strict";\n// VELOCITYVERSE Milestone 0 bundle, built ${stamp}. Source: src/ (see README).\n${bundle}\n</script>`);
// Embed the exact source assets so the distributable works offline as a single file.
const embedded = [['assets/textures/asphalt-albedo.jpg','image/jpeg'],['assets/art/neon-destinations.jpg','image/jpeg'],['assets/art/openline-key-art.jpg','image/jpeg']];
for(const name of fs.readdirSync(path.join(ROOT,'assets/fonts')))if(/\.(ttf|woff2)$/.test(name))embedded.push(['assets/fonts/'+name,name.endsWith('woff2')?'font/woff2':'font/ttf']);
for(const [file,mime] of embedded)out=out.replaceAll('../'+file,'data:'+mime+';base64,'+fs.readFileSync(path.join(ROOT,file)).toString('base64'));
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'velocityverse.html'), out);
console.log(`dist/velocityverse.html written: ${(out.length / 1024).toFixed(1)} KB, ${ORDER.length} modules`);
