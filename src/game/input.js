// VELOCITYVERSE client: keyboard, gamepad, touch and tilt input → one raw input record per frame.
// Keyboard driving keys are remappable; gamepads use the standard mapping.

export const ACTIONS = [
  ['left', 'Steer left'], ['right', 'Steer right'], ['throttle', 'Throttle'], ['brake', 'Brake'], ['shiftUp', 'Shift up'], ['shiftDown', 'Shift down'],
];
export const DEFAULT_KEYS = { left: 'ArrowLeft', right: 'ArrowRight', throttle: 'ArrowUp', brake: 'ArrowDown', shiftUp: 'KeyE', shiftDown: 'KeyQ' };
const ALT = { left: 'KeyA', right: 'KeyD', throttle: 'KeyW', brake: 'KeyS' };
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function keyLabel(code) {
  if (!code) return '—';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('Right', ' R').replace('Left', ' L').replace(/^ /, '');
}

export class Input {
  constructor(touchRoot) {
    this.keys = new Set(); this.edges = new Set();
    this.bindings = { ...DEFAULT_KEYS };
    this.inRace = false; this.remapCallback = null;
    this.dSteer = 0; this.thr = 0; this.brk = 0;
    this.prevPad = []; this.padConnected = false; this.padName = '';
    this.touch = { left: false, right: false, gas: false, brake: false, up: false, down: false, cam: false, recover: false, padSteer: 0, padActive: false };
    this.touchEdges = new Set();
    this.tilt = { available: false, steer: 0, enabled: false };
    this.raw = { steer: 0, throttle: 0, brake: 0, shiftUp: false, shiftDown: false, pause: false, camera: false, recover: false, telemetry: false, perf: false, navNext: false, navPrev: false, confirm: false, back: false, source: 'keyboard' };
    this.touchRoot = touchRoot;
    window.addEventListener('keydown', (e) => {
      if (this.remapCallback) { e.preventDefault(); const cb = this.remapCallback; this.remapCallback = null; if (e.code !== 'Escape') cb(e.code); else cb(null); return; }
      // Text editing, selects and sliders own their native keyboard interaction in menus.
      const target = e.target;
      if (!this.inRace && e.code !== 'Escape' && (['INPUT','TEXTAREA','SELECT'].includes(target?.tagName) || target?.isContentEditable)) return;
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
      if (this.inRace && BLOCK.has(e.code)) e.preventDefault();
      this.raw.source = 'keyboard';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    window.addEventListener('gamepadconnected', (e) => { this.padConnected = true; this.padName = e.gamepad.id; });
    window.addEventListener('gamepaddisconnected', () => { this.padConnected = false; });
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      this.tilt.available = true;
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      let a = e.gamma;
      if (ang === 90) a = e.beta; else if (ang === -90 || ang === 270) a = -e.beta;
      this.tilt.steer = Math.max(-1, Math.min(1, a / 28));
    });
  }

  reset() {
    this.keys.clear(); this.edges.clear(); this.touchEdges.clear();
    this.dSteer = this.thr = this.brk = 0;
    for (const k of Object.keys(this.touch)) this.touch[k] = k === 'padSteer' ? 0 : false;
    this.touchRoot.querySelectorAll('.on').forEach((b) => b.classList.remove('on'));
    this.touchRoot.querySelectorAll('.tknob').forEach((b) => { b.style.transform = ''; });
    this.raw.steer = this.raw.throttle = this.raw.brake = 0;
  }

  key(action) { const b = this.bindings[action]; return this.keys.has(b) || (ALT[action] && this.bindings[action] === DEFAULT_KEYS[action] && this.keys.has(ALT[action])); }
  edge(action) { const b = this.bindings[action]; return this.edges.has(b); }

  // Build touch controls for the chosen layout ('buttons' | 'slider' | 'tilt')
  buildTouch(layout, autoThrottle, manualGears) {
    const root = this.touchRoot;
    this.reset();
    root.innerHTML = '';
    root.dataset.layout = layout;
    const mk = (cls, label, aria, key) => {
      const b = document.createElement('button'); b.className = 'tb ' + cls; b.innerHTML = label; b.setAttribute('aria-label', aria); b.type = 'button';
      let pointer = null;
      const down = (e) => { if (pointer !== null) return; pointer = e.pointerId; e.preventDefault(); b.setPointerCapture(e.pointerId); if (!this.touch[key]) this.touchEdges.add(key); this.touch[key] = true; b.classList.add('on'); this.raw.source = 'touch'; };
      const up = (e) => { if (e.pointerId !== pointer) return; pointer = null; e.preventDefault(); this.touch[key] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    const left = document.createElement('div'); left.className = 'tz tz-left';
    const right = document.createElement('div'); right.className = 'tz tz-right';
    if (layout === 'slider') {
      const pad = document.createElement('div'); pad.className = 'tpad'; pad.setAttribute('aria-label', 'Steering pad: slide left or right');
      const knob = document.createElement('div'); knob.className = 'tknob'; pad.appendChild(knob);
      let x0 = 0, w = 1;
      pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); x0 = e.clientX; w = r.width; this.touch.padActive = true; this.raw.source = 'touch'; });
      pad.addEventListener('pointermove', (e) => { if (!this.touch.padActive) return; const v = Math.max(-1, Math.min(1, (e.clientX - x0) / (w * 0.32))); this.touch.padSteer = v; knob.style.transform = `translateX(${v * w * 0.32}px)`; });
      const end = () => { this.touch.padActive = false; this.touch.padSteer = 0; knob.style.transform = ''; };
      pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
      left.appendChild(pad);
    } else if (layout === 'buttons') {
      left.appendChild(mk('tb-steer', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8"/></svg>', 'Steer left', 'left'));
      left.appendChild(mk('tb-steer', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8"/></svg>', 'Steer right', 'right'));
    } else {
      const note = document.createElement('div'); note.className = 'tilt-note'; note.textContent = 'Tilt to steer'; left.appendChild(note);
    }
    if (manualGears) {
      const g = document.createElement('div'); g.className = 'tgears';
      g.appendChild(mk('tb-gear', '−', 'Shift down', 'down')); g.appendChild(mk('tb-gear', '+', 'Shift up', 'up'));
      right.appendChild(g);
    }
    right.appendChild(mk('tb-pedal tb-brake', '<span>BRAKE</span>', 'Brake', 'brake'));
    if (!autoThrottle) right.appendChild(mk('tb-pedal tb-gas', '<span>GAS</span>', 'Throttle', 'gas'));
    root.appendChild(left); root.appendChild(right);
    const util = document.createElement('div'); util.className = 'tz tz-util';
    util.appendChild(mk('tb-small', 'CAM', 'Change camera', 'cam'));
    util.appendChild(mk('tb-small', 'RESET', 'Recover car to track (invalidates lap)', 'recover'));
    root.appendChild(util);
    this.tilt.enabled = layout === 'tilt';
  }

  poll(dt) {
    const r = this.raw;
    // gamepad
    let gSteer = 0, gThr = 0, gBrk = 0; const gEdge = (i) => false;
    let pad = null;
    try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.connected) { pad = p; break; } } catch (e) { pad = null; }
    const pb = (i) => pad && pad.buttons[i] ? (pad.buttons[i].value > 0.5 || pad.buttons[i].pressed) : false;
    const pe = (i) => pb(i) && !this.prevPad[i];
    if (pad) {
      const ax = pad.axes[0] || 0, dz = 0.08;
      gSteer = Math.abs(ax) < dz ? 0 : Math.sign(ax) * Math.pow((Math.abs(ax) - dz) / (1 - dz), 1.4);
      gThr = pad.buttons[7] ? pad.buttons[7].value : 0; gBrk = pad.buttons[6] ? pad.buttons[6].value : 0;
      if (Math.abs(gSteer) > 0.05 || gThr > 0.05 || gBrk > 0.05) r.source = 'gamepad';
    }
    // digital steering (keyboard / touch buttons) with a ramp so taps are not full-lock jerks
    const t = this.touch;
    const dTarget = (this.key('left') || t.left ? -1 : 0) + (this.key('right') || t.right ? 1 : 0);
    const rate = dTarget === 0 ? 9 : (Math.sign(dTarget) !== Math.sign(this.dSteer) && this.dSteer !== 0 ? 10 : 4.5);
    this.dSteer += Math.max(-rate * dt, Math.min(rate * dt, dTarget - this.dSteer));
    let steer = this.dSteer;
    if (t.padActive) steer = t.padSteer;
    if (this.tilt.enabled && this.tilt.available) steer = this.tilt.steer;
    if (Math.abs(gSteer) > 0.001) steer = gSteer;
    const thrTarget = Math.max(this.key('throttle') || t.gas ? 1 : 0, gThr);
    const brkTarget = Math.max(this.key('brake') || t.brake ? 1 : 0, gBrk);
    const ramp = (cur, tgt) => cur + Math.max(-10 * dt, Math.min(10 * dt, tgt - cur));
    this.thr = gThr > 0 ? gThr : ramp(this.thr, thrTarget);
    this.brk = gBrk > 0 ? gBrk : ramp(this.brk, brkTarget);
    r.digitalSteer = !t.padActive && !(this.tilt.enabled && this.tilt.available) && Math.abs(gSteer) <= 0.001;
    r.steer = steer; r.throttle = this.thr; r.brake = this.brk;
    const te = (k) => this.touchEdges.has(k);
    r.shiftUp = this.edge('shiftUp') || pe(5) || te('up');
    r.shiftDown = this.edge('shiftDown') || pe(4) || te('down');
    const shortcut = code => this.edges.has(code) && !Object.values(this.bindings).includes(code);
    r.pause = shortcut('Escape') || shortcut('KeyP') || pe(9);
    r.camera = shortcut('KeyC') || pe(3) || te('cam');
    r.recover = shortcut('KeyR') || pe(2) || te('recover');
    r.telemetry = shortcut('KeyT') || pe(8);
    r.perf = shortcut('KeyF');
    r.navNext = this.edges.has('ArrowDown') || this.edges.has('ArrowRight') || pe(13) || pe(15);
    r.navPrev = this.edges.has('ArrowUp') || this.edges.has('ArrowLeft') || pe(12) || pe(14);
    r.confirm = pe(0);
    r.back = pe(1) || this.edges.has('Escape');
    if (!pad) { this.prevPad = []; this.padConnected = false; this.padName = ''; }
    if (pad) { this.prevPad = pad.buttons.map((b) => b.value > 0.5 || b.pressed); this.padConnected = true; this.padName = pad.id; }
    this.edges.clear(); this.touchEdges.clear();
    return r;
  }
}
