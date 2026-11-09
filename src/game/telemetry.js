// VELOCITYVERSE client: live telemetry overlay and performance counters. Every value drawn here is read from the
// simulation state of the current step; nothing is mocked.
import { MS_TO_KMH, MS_TO_MPH, G0, DEG } from '../sim/units.js';

const C = { bg: 'rgba(6,8,26,0.84)', line: 'rgba(110,150,255,0.22)', txt: '#EAF6FF', dim: '#8EA2C8', acc: '#19F6FF', ok: '#35FFA0', warn: '#FFD24A', bad: '#FF4D6D', cyan: '#FF2FD1', glow: 'rgba(25,246,255,0.7)' };

export class Telemetry {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.hist = []; this.gg = []; this.lastSample = 0; this.t = 0;
  }
  sample(veh, driverOut, raw, time) {
    if (time - this.lastSample < 1 / 30) return;
    this.lastSample = time;
    this.hist.push([veh.forwardSpeed, driverOut.throttle, driverOut.brake]);
    if (this.hist.length > 300) this.hist.shift();
    this.gg.push([veh.aLat / G0, veh.aLong / G0]);
    if (this.gg.length > 45) this.gg.shift();
  }
  draw(veh, driverOut, raw, units, simInfo) {
    const c = this.c, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H); g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    const mono = '12px ui-monospace, "SF Mono", Menlo, Consolas, monospace', head = '700 12px Rajdhani, "Arial Narrow", system-ui, sans-serif';
    const txt = (s, x, y, col = C.txt, font = mono, align = 'left') => { g.font = font; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); };
    const k = units === 'mph' ? MS_TO_MPH : MS_TO_KMH, uLab = units === 'mph' ? 'mph' : 'km/h';
    let y = 18;
    g.shadowColor = C.glow; g.shadowBlur = 8; txt('LIVE TELEMETRY', 12, y, C.acc, '800 11px Orbitron, Rajdhani, system-ui, sans-serif'); g.shadowBlur = 0;
    txt('sim state · 120 Hz', W - 12, y, C.dim, head, 'right');
    const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, '#19F6FF'); grd.addColorStop(0.5, '#8B5CFF'); grd.addColorStop(1, '#FF2FD1');
    g.fillStyle = grd; g.fillRect(0, 0, W, 2);
    y += 20;
    txt(`${(veh.forwardSpeed * k).toFixed(0)} ${uLab}`, 12, y); txt(`G${veh.gear < 0 ? 'R' : veh.gear === 0 ? 'N' : veh.gear}`, 120, y); txt(`${veh.rpm.toFixed(0)} rpm`, W - 12, y, C.txt, mono, 'right');
    // g-g diagram
    y += 12; const cx = 64, cy = y + 52, R = 26;
    g.strokeStyle = C.line; g.lineWidth = 1;
    for (const rr of [1, 2, 3]) { g.beginPath(); g.arc(cx, cy, R * rr * 0.62, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 52, cy); g.lineTo(cx + 52, cy); g.moveTo(cx, cy - 52); g.lineTo(cx, cy + 52); g.stroke();
    this.gg.forEach(([lat, lon], i) => { g.fillStyle = `rgba(255,47,209,${0.15 + 0.6 * i / this.gg.length})`; g.fillRect(cx + lat * R * 0.62 - 1.5, cy - lon * R * 0.62 - 1.5, 3, 3); });
    g.shadowColor = C.glow; g.shadowBlur = 10; g.fillStyle = C.acc; g.beginPath(); g.arc(cx + (veh.aLat / G0) * R * 0.62, cy - (veh.aLong / G0) * R * 0.62, 4, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    txt('g-g (rings 1/2/3 g)', 12, cy + 64, C.dim, head);
    const bx = 136;
    txt(`long ${(veh.aLong / G0).toFixed(2)} g`, bx, y + 14); txt(`lat  ${(veh.aLat / G0).toFixed(2)} g`, bx, y + 30);
    txt(`drag ${veh.drag.toFixed(0)} N`, bx, y + 50); txt(`down F ${veh.downF.toFixed(0)} N`, bx, y + 66); txt(`down R ${veh.downR.toFixed(0)} N`, bx, y + 82);
    txt(`steer in ${raw.steer.toFixed(2)} → ${(veh.steerAngle / DEG).toFixed(1)}°`, bx, y + 102);
    y = cy + 80;
    // input bars: raw vs applied
    const bar = (label, a, b, col) => {
      txt(label, 12, y + 9, C.dim, head);
      g.fillStyle = C.line; g.fillRect(70, y, W - 82, 10);
      g.fillStyle = col; g.fillRect(70, y, (W - 82) * Math.max(0, Math.min(1, b)), 10);
      g.fillStyle = '#fff'; g.fillRect(70 + (W - 82) * Math.max(0, Math.min(1, a)) - 1, y - 2, 2, 14);
      y += 18;
    };
    bar('THROTTLE', raw.throttle, driverOut.throttle * veh.tcsFactor * veh.escCut, C.ok);
    bar('BRAKE', raw.brake, driverOut.brake, C.bad);
    txt('bar = applied · tick = your input', 12, y + 8, C.dim, head); y += 20;
    // wheels
    const names = ['FL', 'FR', 'RL', 'RR'];
    const cw = (W - 30) / 2, ch = 70;
    veh.wheels.forEach((w, i) => {
      const x0 = 12 + (i % 2) * (cw + 6), y0 = y + Math.floor(i / 2) * (ch + 6);
      g.strokeStyle = C.line; g.strokeRect(x0, y0, cw, ch);
      const sn = w.slipNorm, sc = sn < 0.8 ? C.ok : sn < 1.05 ? C.warn : C.bad, sl = sn < 0.8 ? 'grip' : sn < 1.05 ? 'limit' : 'slide';
      txt(names[i], x0 + 6, y0 + 14, C.acc, head); txt(`${w.surface}`, x0 + cw - 6, y0 + 14, C.dim, head, 'right');
      txt(`${w.load.toFixed(0)} N  ${(w.travelRel * 1000).toFixed(1)} mm`, x0 + 6, y0 + 30);
      txt(`κ ${w.kt.toFixed(3)}  α ${(Math.atan(w.at) / DEG).toFixed(1)}°`, x0 + 6, y0 + 46);
      g.fillStyle = C.line; g.fillRect(x0 + 6, y0 + 54, cw - 54, 8);
      g.fillStyle = sc; g.fillRect(x0 + 6, y0 + 54, (cw - 54) * Math.min(1, sn / 1.4), 8);
      txt(sl, x0 + cw - 6, y0 + 62, sc, head, 'right');
    });
    y += 2 * (ch + 6) + 6;
    // strip chart: speed, throttle, brake (last 10 s)
    const sh = 54; g.strokeStyle = C.line; g.strokeRect(12, y, W - 24, sh);
    const n = this.hist.length;
    if (n > 1) {
      const vmax = 95;
      for (let i = 0; i < n; i++) {
        const x = 12 + (W - 24) * (i / 299);
        const [, th, br] = this.hist[i];
        if (th > 0.02) { g.fillStyle = 'rgba(53,255,160,0.4)'; g.fillRect(x, y + sh - th * 12, 1.2, th * 12); }
        if (br > 0.02) { g.fillStyle = 'rgba(255,77,109,0.55)'; g.fillRect(x, y, 1.2, br * 12); }
      }
      g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.beginPath();
      for (let i = 0; i < n; i++) { const x = 12 + (W - 24) * (i / 299), yy = y + sh - (this.hist[i][0] / vmax) * sh; if (i === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    }
    txt('speed (line) · throttle / brake (bars) · 10 s', 12, y + sh + 14, C.dim, head);
    y += sh + 26;
    const flags = [['ABS', veh.absActive], ['TCS', veh.tcsActive], ['ESC', veh.escActive], ['STEER', driverOut.steerLimited], ['GUIDE', Math.abs(driverOut.guidanceDelta) > 0.002], ['BRK-AST', driverOut.assistBraking]];
    let fx = 12;
    flags.forEach(([lab, on]) => { g.font = head; const w = g.measureText(lab).width + 12; g.fillStyle = on ? C.acc : C.line; g.fillRect(fx, y - 11, w, 16); g.fillStyle = on ? '#111' : C.dim; g.textAlign = 'left'; g.fillText(lab, fx + 6, y + 1); fx += w + 5; });
    txt(`sim ${simInfo.simMs.toFixed(2)} ms/frame · ${simInfo.steps} steps`, 12, H - 10, C.dim, head);
  }
}

export class PerfStats {
  constructor() { this.frames = []; this.sims = []; this.renders = []; this.steps = []; this.dropped = 0; this.last = 0; this.text = ''; }
  push(frameMs, simMs, renderMs, steps) {
    this.frames.push(frameMs); this.sims.push(simMs); this.renders.push(renderMs); this.steps.push(steps);
    if (this.frames.length > 240) { this.frames.shift(); this.sims.shift(); this.renders.shift(); this.steps.shift(); }
  }
  resetWindow() { this.frames.length = 0; this.sims.length = 0; this.renders.length = 0; this.steps.length = 0; }
  summary() {
    const f = this.frames.slice().sort((a, b) => a - b), n = f.length || 1;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    return { fps: 1000 / avg(this.frames), avg: avg(this.frames), p95: f[Math.floor(n * 0.95)] || 0, max: f[n - 1] || 0, sim: avg(this.sims), render: avg(this.renders), steps: avg(this.steps), dropped: this.dropped };
  }
}
