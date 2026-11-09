// Original synthesized prototype audio, not recordings. Every continuous layer is
// driven by real rpm, throttle, speed, tire slip and curb contact from the simulation.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
const smooth = x => { const t=clamp(x,0,1); return t*t*(3-2*t); };

export class GameAudio {
  constructor() {
    this.ctx = null; this.ok = false; this.muted = false;
    this.vol = { master: 0.8, engine: 0.8, fx: 0.8 };
    this.sources = []; this.oneShots = new Set(); this.shiftUntil = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value=-14;comp.knee.value=14;comp.ratio.value=4;comp.attack.value=0.006;comp.release.value=0.15;
      const dc = ctx.createBiquadFilter(); dc.type='highpass';dc.frequency.value=28;dc.Q.value=0.6;dc.connect(comp);comp.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(dc);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const samples = noiseBuf.getChannelData(0);
      // Fixed white-noise bed. Filtering and simulation state, not random gain
      // jumps, determine the audible sound; repeatable for offline review.
      let seed=0x61c88647;
      for (let i=0;i<samples.length;i++) { seed=(Math.imul(seed,1664525)+1013904223)|0;samples[i]=(seed>>>0)/2147483648-1; }
      this.noiseBuf = noiseBuf;
      const noise = offset => { const n=ctx.createBufferSource();n.buffer=noiseBuf;n.loop=true;n.start(0,offset);this.sources.push(n);return n; };
      const gain = value => { const g=ctx.createGain();g.gain.value=value;return g; };
      const filter = (type,freq,q=0.7) => {const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;return f;};
      const oscillator = wave => {const o=ctx.createOscillator();if(typeof wave==='string')o.type=wave;else o.setPeriodicWave(wave);o.start();this.sources.push(o);return o;};
      // Firing pulses contain a rounded pressure peak followed by a decaying
      // harmonic tail. Two banks share pitch (no detuned saw/chorus beating).
      const pulse = phase => {
        const real=new Float32Array(33),imag=new Float32Array(33);
        for(let h=1;h<33;h++) {const a=Math.exp(-h/9)/Math.pow(h,0.92)*(h%3===0?0.72:1);real[h]=Math.cos(h*phase)*a;imag[h]=Math.sin(h*phase)*a;}
        return ctx.createPeriodicWave(real,imag);
      };
      this.engGain=gain(0);this.engFilter=filter('lowpass',1800,0.55);
      const bodyEQ=filter('peaking',720,0.65);bodyEQ.gain.value=2.5;
      const shaper=ctx.createWaveShaper(),curve=new Float32Array(1024);
      for(let i=0;i<curve.length;i++) {const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*1.25);}
      shaper.curve=curve;shaper.oversample='2x';
      this.o1=oscillator(pulse(0));this.o2=oscillator(pulse(0.9));this.o3=oscillator('sine');
      this.bankA=gain(0.40);this.bankB=gain(0.30);this.bodyGain=gain(0.10);
      this.o1.connect(this.bankA);this.o2.connect(this.bankB);this.o3.connect(this.bodyGain);
      this.bankA.connect(shaper);this.bankB.connect(shaper);this.bodyGain.connect(shaper);
      shaper.connect(bodyEQ);bodyEQ.connect(this.engFilter);this.engFilter.connect(this.engGain);this.engGain.connect(this.master);
      // Intake turbulence fills the loaded engine sound; a separate low exhaust
      // texture gives closed-throttle coast a rough edge without random bangs.
      this.intakeGain=gain(0);this.intakeFilter=filter('bandpass',1100,0.55);
      noise(0.24).connect(this.intakeFilter);this.intakeFilter.connect(this.intakeGain);this.intakeGain.connect(this.master);
      this.overrunGain=gain(0);const overrun=filter('bandpass',230,0.8);
      noise(0.71).connect(overrun);overrun.connect(this.overrunGain);this.overrunGain.connect(this.master);
      // Transmission is quieter than the combustion pulses, and follows actual
      // crank speed (optional actual gear only changes its harmonic emphasis).
      this.gearOsc=oscillator('sine');this.gearGain=gain(0);
      this.gearOsc.connect(this.gearGain);this.gearGain.connect(this.master);
      this.tireGain=gain(0);this.tireFilter=filter('bandpass',1000,0.65);
      noise(1.13).connect(this.tireFilter);this.tireFilter.connect(this.tireGain);this.tireGain.connect(this.master);
      this.windGain=gain(0);this.windFilter=filter('lowpass',520,0.6);
      noise(1.61).connect(this.windFilter);this.windFilter.connect(this.windGain);this.windGain.connect(this.master);
      this.curbOsc=oscillator('triangle');this.curbGain=gain(0);const cf=filter('lowpass',210,0.6);
      this.curbOsc.connect(cf);cf.connect(this.curbGain);this.curbGain.connect(this.master);
      // One distant rival voice: a filtered firing pulse with physical Doppler
      // pitch/attenuation. A bounded voice count avoids per-car audio allocation.
      this.rGain=gain(0);this.rFilter=filter('lowpass',1600,0.65);
      this.r1=oscillator(pulse(0.3));this.r2=oscillator('sine');
      const rg=gain(0.42),rb=gain(0.10);this.r1.connect(rg);this.r2.connect(rb);rg.connect(this.rFilter);rb.connect(this.rFilter);
      this.rFilter.connect(this.rGain);this.rGain.connect(this.master);
      this.ok=true;
    } catch (e) { this.dispose(); }
  }

  setVolumes(v) { for(const k of ['master','engine','fx'])if(v && Number.isFinite(v[k]))this.vol[k]=clamp(v[k],0,1); }
  mute(on) { this.muted=!!on;if(this.ok)this.master.gain.setTargetAtTime(on?0:this.vol.master,this.ctx.currentTime,0.04); }

  rival(st) {
    if(!this.ok)return;const t=this.ctx.currentTime;
    if(!st){this.rGain.gain.setTargetAtTime(0,t,0.09);return;}
    const closing=clamp(st.closing,-60,60),dop=343/(343-closing),f=clamp(st.rpm,1500,15000)/60*4*dop;
    this.r1.frequency.setTargetAtTime(f,t,0.025);this.r2.frequency.setTargetAtTime(f*0.25,t,0.025);
    const dist=clamp(st.dist,0,200);this.rFilter.frequency.setTargetAtTime(900+1700/(1+dist/15),t,0.08);
    this.rGain.gain.setTargetAtTime(this.vol.engine*0.25/(1+(dist/8)**2),t,0.06);
  }

  // Optional gear/aLong enrich the mix; no invented state is needed when absent.
  update(st) {
    if(!this.ok)return;const t=this.ctx.currentTime,V=this.vol,run=st.running?1:0;
    const rpm=clamp(st.rpm,1000,15000),load=clamp(st.throttle,0,1),speed=clamp(st.speed,0,150),slip=clamp(st.slip,0,5);
    const f=rpm/60*4,shift=t<this.shiftUntil?0.22:1,high=clamp((rpm-3500)/9000,0,1);
    const tractive=Number.isFinite(st.aLong)?clamp(st.aLong/12,0,1):load;
    this.master.gain.setTargetAtTime(run&&!this.muted?V.master:0,t,0.07);
    this.o1.frequency.setTargetAtTime(f,t,0.014);this.o2.frequency.setTargetAtTime(f,t,0.014);this.o3.frequency.setTargetAtTime(f*0.25,t,0.018);
    this.bodyGain.gain.setTargetAtTime((0.16-0.07*high)*(0.5+0.5*load),t,0.04);
    this.engFilter.frequency.setTargetAtTime(900+rpm*0.10+load*1900+tractive*200,t,0.04);
    this.engGain.gain.setTargetAtTime(V.engine*(0.13+0.17*load+0.02*tractive)*shift*run,t,0.023);
    this.intakeFilter.frequency.setTargetAtTime(650+rpm*0.105,t,0.06);
    this.intakeGain.gain.setTargetAtTime(V.engine*0.055*load*load*shift*run,t,0.04);
    this.overrunGain.gain.setTargetAtTime(V.engine*0.025*(1-load)*high*run,t,0.06);
    this.gearOsc.frequency.setTargetAtTime(180+rpm/60*(6+clamp(st.gear||1,1,8)*0.12),t,0.03);
    this.gearGain.gain.setTargetAtTime(V.engine*(0.007+0.010*load)*Math.min(1,speed/15)*run,t,0.05);
    const scrub=smooth((slip-0.55)/1.05)*Math.min(1,speed/8);
    this.tireFilter.frequency.setTargetAtTime(750+900*scrub+speed*2,t,0.06);
    this.tireGain.gain.setTargetAtTime(V.fx*0.18*scrub*run,t,0.04);
    this.windFilter.frequency.setTargetAtTime(280+speed*6,t,0.15);
    this.windGain.gain.setTargetAtTime(V.fx*0.20*Math.min(1,(speed/85)**2)*run,t,0.14);
    this.curbOsc.frequency.setTargetAtTime(Math.max(22,speed/0.5),t,0.025);
    this.curbGain.gain.setTargetAtTime(V.fx*0.10*clamp(st.curb,0,1)*run,t,0.025);
  }

  _shot(source,nodes,seconds,offset=0) {
    const t=this.ctx.currentTime;this.oneShots.add(source);
    source.onended=()=>{source.disconnect();for(const n of nodes)n.disconnect();this.oneShots.delete(source);};
    if(source.buffer)source.start(t,offset);else source.start(t);source.stop(t+seconds);
  }
  pop() {
    if(!this.ok)return;const ctx=this.ctx,t=ctx.currentTime,n=ctx.createBufferSource();n.buffer=this.noiseBuf;
    const g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=310;f.Q.value=0.65;
    g.gain.setValueAtTime(this.vol.fx*0.19,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.075);
    n.connect(f);f.connect(g);g.connect(this.master);this._shot(n,[f,g],0.09,0.31);
  }
  impact(speed) {
    if(!this.ok||speed<1)return;const ctx=this.ctx,t=ctx.currentTime,amp=Math.min(1,speed/25)*this.vol.fx*0.50;
    const n=ctx.createBufferSource();n.buffer=this.noiseBuf;const g=ctx.createGain(),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=750;
    g.gain.setValueAtTime(amp,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.28);n.connect(lp);lp.connect(g);g.connect(this.master);this._shot(n,[lp,g],0.32);
    const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(105,t);o.frequency.exponentialRampToValueAtTime(38,t+0.22);
    const og=ctx.createGain();og.gain.setValueAtTime(amp*0.65,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.28);o.connect(og);og.connect(this.master);this._shot(o,[og],0.30);
  }
  click() {
    if(!this.ok)return;const ctx=this.ctx,t=ctx.currentTime;this.shiftUntil=t+0.065;
    const n=ctx.createBufferSource();n.buffer=this.noiseBuf;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1250;f.Q.value=0.7;
    const g=ctx.createGain();g.gain.setValueAtTime(this.vol.fx*0.11,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.027);n.connect(f);f.connect(g);g.connect(this.master);this._shot(n,[f,g],0.04,0.57);
  }

  dispose() {
    this.ok=false;for(const s of [...this.sources,...this.oneShots]){try{s.stop();s.disconnect();}catch(e){/* already ended */}}
    this.sources=[];this.oneShots.clear();
    if(this.ctx&&this.ctx.state!=='closed'&&this.ctx.close)this.ctx.close().catch(()=>{});
    this.ctx=null;
  }
}
