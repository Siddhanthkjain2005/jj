// VELOCITYVERSE client: synthesized audio (temporary). Engine pitch follows real rpm, tire scrub rises as the
// tires approach their grip limit, so sound carries grip and load information, not only excitement.
export class GameAudio {
  constructor() { this.ctx = null; this.ok = false; this.vol = { master: 0.8, engine: 0.8, fx: 0.8 }; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(comp);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = noiseBuf;
      const noise = () => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(); return n; };
      // engine: two detuned saws + sub, soft-clipped, low-passed by load
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.Q.value = 2.2;
      const shaper = ctx.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.2 * x); } shaper.curve = curve;
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
      this.o2 = ctx.createOscillator(); this.o2.type = 'sawtooth'; this.o2.detune.value = 9;
      this.o3 = ctx.createOscillator(); this.o3.type = 'triangle';
      const og = ctx.createGain(); og.gain.value = 0.32;
      [this.o1, this.o2, this.o3].forEach((o) => { o.connect(og); o.start(); });
      og.connect(shaper); shaper.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      // tire scrub (band-passed noise)
      this.tireGain = ctx.createGain(); this.tireGain.gain.value = 0;
      this.tireFilter = ctx.createBiquadFilter(); this.tireFilter.type = 'bandpass'; this.tireFilter.frequency.value = 1100; this.tireFilter.Q.value = 1.4;
      noise().connect(this.tireFilter); this.tireFilter.connect(this.tireGain); this.tireGain.connect(this.master);
      // wind
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
      const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 520;
      noise().connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master);
      // curb rumble
      this.curbOsc = ctx.createOscillator(); this.curbOsc.type = 'square'; this.curbOsc.start();
      this.curbGain = ctx.createGain(); this.curbGain.gain.value = 0;
      const cf = ctx.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 260;
      this.curbOsc.connect(cf); cf.connect(this.curbGain); this.curbGain.connect(this.master);
      // nearest rival: a second engine voice with distance attenuation and a Doppler shift
      this.rGain = ctx.createGain(); this.rGain.gain.value = 0;
      this.rFilter = ctx.createBiquadFilter(); this.rFilter.type = 'lowpass'; this.rFilter.frequency.value = 1800;
      this.r1 = ctx.createOscillator(); this.r1.type = 'sawtooth'; this.r2 = ctx.createOscillator(); this.r2.type = 'sawtooth'; this.r2.detune.value = -7;
      const rg = ctx.createGain(); rg.gain.value = 0.25; [this.r1, this.r2].forEach((o) => { o.connect(rg); o.start(); });
      rg.connect(this.rFilter); this.rFilter.connect(this.rGain); this.rGain.connect(this.master);
      this.ok = true;
    } catch (e) { this.ok = false; }
  }

  setVolumes(v) { this.vol = v; }
  // st: { rpm, dist (m), closing (m/s, + = approaching) } or null when no rival is near
  rival(st) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    if (!st) { this.rGain.gain.setTargetAtTime(0, t, 0.1); return; }
    const dop = 343 / Math.max(200, 343 - Math.max(-60, Math.min(60, st.closing)));
    const f = Math.max(30, (st.rpm / 60) * 4) * dop;
    this.r1.frequency.setTargetAtTime(f, t, 0.02); this.r2.frequency.setTargetAtTime(f * 2, t, 0.02);
    this.rGain.gain.setTargetAtTime(this.vol.engine * 0.5 / (1 + (st.dist / 9) ** 2), t, 0.05);
  }
  pop() { // exhaust backfire on a lift-off
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 0.9;
    g.gain.setValueAtTime(this.vol.fx * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.1);
  }
  mute(on) { if (!this.ok) return; this.master.gain.setTargetAtTime(on ? 0 : this.vol.master, this.ctx.currentTime, 0.05); }

  // state: { rpm, throttle, speed, slip (max normalized slip), curb (0..1), running }
  update(st) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, V = this.vol;
    this.master.gain.setTargetAtTime(st.running ? V.master : 0, t, 0.08);
    const f = Math.max(30, (st.rpm / 60) * 4); // fictional 8-cylinder firing frequency (4 pulses per revolution)
    this.o1.frequency.setTargetAtTime(f, t, 0.012);
    this.o2.frequency.setTargetAtTime(f * 2, t, 0.012);
    this.o3.frequency.setTargetAtTime(f * 0.5, t, 0.012);
    this.engFilter.frequency.setTargetAtTime(500 + 3800 * st.throttle + st.rpm * 0.12, t, 0.03);
    this.engGain.gain.setTargetAtTime(V.engine * (0.10 + 0.20 * st.throttle) * (st.running ? 1 : 0), t, 0.04);
    const scrub = Math.max(0, Math.min(1, (st.slip - 0.72) * 1.8)) * Math.min(1, st.speed / 8);
    this.tireFilter.frequency.setTargetAtTime(st.slip > 1.15 ? 2100 : 1100, t, 0.05);
    this.tireGain.gain.setTargetAtTime(V.fx * 0.55 * scrub, t, 0.03);
    this.windGain.gain.setTargetAtTime(V.fx * 0.32 * Math.min(1, (st.speed / 85) ** 2), t, 0.1);
    this.curbOsc.frequency.setTargetAtTime(Math.max(20, st.speed / 0.5), t, 0.02);
    this.curbGain.gain.setTargetAtTime(V.fx * 0.22 * st.curb, t, 0.02);
  }

  impact(speed) {
    if (!this.ok || speed < 1) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const g = ctx.createGain(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const amp = Math.min(1, speed / 25) * this.vol.fx;
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.4);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const og = ctx.createGain(); og.gain.setValueAtTime(amp * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.32);
  }

  click() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 180;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.08 * this.vol.fx, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.06);
  }
}
