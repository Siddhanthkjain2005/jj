// Restrained menu atmosphere. Scenic light only: no telemetry, progress or simulated worlds.
// Runs independently of racing and stops scheduling frames when the lobby is not visible.

const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const fract = x => x - Math.floor(x);
const hash = i => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const FLOW_PATHS = [
  [.50,.61,.38,.55,.30,.32,.22,.31],
  [.48,.65,.38,.70,.25,.59,.17,.55],
  [.48,.67,.40,.75,.30,.77,.22,.76],
  [.52,.61,.64,.51,.70,.30,.80,.30],
  [.53,.65,.65,.61,.73,.52,.83,.51],
  [.52,.68,.65,.73,.72,.75,.80,.74],
];

function cubic(p,t) {
  const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
  return {x:a*p[0]+b*p[2]+c*p[4]+d*p[6],y:a*p[1]+b*p[3]+c*p[5]+d*p[7]};
}

export class LobbyMotion {
  constructor(game) {
    this.game=game;this.canvas=document.getElementById('hub-atmosphere');
    this.ctx=this.canvas?.getContext('2d',{alpha:true}) || null;
    this.raf=null;this.elapsed=0;this.lastPaint=null;this.width=0;this.height=0;this.destroyed=false;
    this.motes=Array.from({length:28},(_,i)=>({x:hash(i+1),y:hash(i+71),phase:hash(i+131)*TAU,size:.6+hash(i+191)*1.1,warm:i%5===0}));
    this.tick=this.tick.bind(this);this.onResize=()=>this.resize();this.onVisibility=()=>this.sync();
    if(!this.ctx)return;
    this.canvas.style.pointerEvents='none';this.canvas.setAttribute('aria-hidden','true');
    this.motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionQuery.addEventListener?.('change',this.onVisibility);
    window.addEventListener('resize',this.onResize,{passive:true});
    document.addEventListener('visibilitychange',this.onVisibility);
    const hub=document.getElementById('scr-hub');
    if(hub && typeof MutationObserver!=='undefined') {
      this.observer=new MutationObserver(()=>this.sync());
      this.observer.observe(hub,{attributes:true,attributeFilter:['class','hidden']});
    }
    this.sync();
  }

  active() {return !this.destroyed && !!this.ctx && this.game.screen==='hub' && !document.hidden && document.visibilityState!=='hidden';}
  reduced() {return !!(this.motionQuery?.matches || this.game.S?.reducedMotion || this.game.S?.motion===false);}
  lowQuality() {return (this.game.S?.graphics==='low' || this.game.renderer?.qName==='low');}

  // Call after menu/settings changes. The screen observer is a fallback for ordinary navigation.
  sync() {
    this.stop();
    if(!this.active())return;
    this.resize(false);this.render(this.elapsed);
    if(!this.reduced())this.raf=window.requestAnimationFrame(this.tick);
  }

  resize(paint=true) {
    if(!this.active())return;
    const w=Math.max(1,this.canvas.clientWidth || window.innerWidth || 1),h=Math.max(1,this.canvas.clientHeight || window.innerHeight || 1);
    const low=this.lowQuality(),budget=low?650000:2100000;
    this.scale=Math.max(.25,Math.min(low?1:1.5,window.devicePixelRatio || 1,Math.sqrt(budget/(w*h))));
    this.width=w;this.height=h;
    const pw=Math.max(1,Math.round(w*this.scale)),ph=Math.max(1,Math.round(h*this.scale));
    if(this.canvas.width!==pw)this.canvas.width=pw;
    if(this.canvas.height!==ph)this.canvas.height=ph;
    if(paint)this.render(this.elapsed);
  }

  stop() {
    if(this.raf!==null)window.cancelAnimationFrame(this.raf);
    this.raf=null;this.lastPaint=null;
  }

  tick(now) {
    this.raf=null;
    if(!this.active()) {this.stop();return;}
    if(this.reduced()) {this.render(this.elapsed);this.stop();return;}
    const interval=this.lowQuality()?1000/20:1000/30;
    if(this.lastPaint===null || now-this.lastPaint>=interval-.5) {
      if(this.lastPaint!==null)this.elapsed+=Math.min(.1,(now-this.lastPaint)/1000);
      this.lastPaint=now;this.render(this.elapsed);
    }
    this.raf=window.requestAnimationFrame(this.tick);
  }

  render(seconds=0) {
    if(!this.active() || !this.width || !this.height)return;
    const c=this.ctx,w=this.width,h=this.height,low=this.lowQuality();
    c.setTransform(this.scale,0,0,this.scale,0,0);c.clearRect(0,0,w,h);
    c.globalCompositeOperation='lighter';c.lineCap='round';
    // The source art is centered and cover-fitted at 16:9. Keep the light attached to it.
    const artW=Math.max(w,h*16/9),artH=artW*9/16,ox=(w-artW)/2,oy=(h-artH)/2;
    const px=x=>ox+x*artW,py=y=>oy+y*artH;
    const cx=px(.5),cy=py(.38),radius=Math.min(112,Math.max(28,artW*.064));
    const t=this.reduced()?0:seconds;

    // Thin holographic ellipses on the central helmet, with slow traveling segments.
    c.save();c.translate(cx,cy);c.scale(1,.29);
    for(let ring=0;ring<3;ring++) {
      const r=radius*(.76+ring*.13),angle=t*(ring%2?-.075:.055)+ring*1.8;
      c.lineWidth=(ring===1?1.2:.7)/.65;c.strokeStyle=ring===1?'rgba(145,231,240,.16)':'rgba(127,215,235,.08)';
      c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
      c.strokeStyle=ring===1?'rgba(197,248,251,.30)':'rgba(123,224,241,.20)';
      c.beginPath();c.arc(0,0,r,angle,angle+.32);c.stroke();
    }
    // Small calibration marks are abstract, never numbers or mocked instruments.
    c.strokeStyle='rgba(166,229,242,.12)';c.lineWidth=.8;
    for(let i=0;i<12;i++) {
      const a=i*TAU/12+t*.035,r=radius*1.09;
      c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a)*(r+3),Math.sin(a)*(r+3));c.stroke();
    }
    c.restore();

    // A short glint travels each architectural bridge; never a thick interface connector.
    for(let i=0;i<FLOW_PATHS.length;i++) {
      const p=FLOW_PATHS[i],head=fract(t*.031+i*.173),tail=Math.max(0,head-.025);
      c.lineWidth=.9;c.strokeStyle=i%3===0?'rgba(246,191,132,.19)':'rgba(119,222,237,.17)';
      c.beginPath();
      for(let k=0;k<=6;k++) {
        const q=cubic(p,tail+(head-tail)*k/6),x=px(q.x),y=py(q.y);
        if(k===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.stroke();
    }

    // A few slow, faint motes above the architecture, with no input interaction or bounce.
    const count=low?12:this.motes.length;
    for(let i=0;i<count;i++) {
      const m=this.motes[i],travel=fract(m.y-t*(.0035+(i%3)*.0007)),x=m.x*w+Math.sin(t*.13+m.phase)*5,y=h*(.16+travel*.63);
      const fade=clamp01(travel*7)*clamp01((1-travel)*7),alpha=fade*(.055+.045*(.5+.5*Math.sin(t*.3+m.phase)));
      c.fillStyle=m.warm?`rgba(244,191,136,${alpha})`:`rgba(151,225,239,${alpha})`;
      c.beginPath();c.arc(x,y,m.size,0,TAU);c.fill();
    }
    c.globalCompositeOperation='source-over';
  }

  destroy() {
    this.stop();this.destroyed=true;this.observer?.disconnect();
    window.removeEventListener('resize',this.onResize);document.removeEventListener('visibilitychange',this.onVisibility);
    this.motionQuery?.removeEventListener?.('change',this.onVisibility);
    if(this.ctx)this.ctx.clearRect(0,0,this.width,this.height);
  }
}
