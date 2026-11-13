// Presentation effects: race moments, pop banners, confetti, counting numbers and story cutscenes.
// Nothing here changes game state; every effect respects the reduced-motion settings.
const $ = id => document.getElementById(id);

const PEOPLE = {
  neri: { name: 'Neri Vale', color: '#48dde1' }, tavi: { name: 'Tavi Pell', color: '#e7ece7' }, maela: { name: 'Maela Rook', color: '#ffd66a' },
  sola: { name: 'Sola Kest', color: '#ff786b' }, veska: { name: 'Veska Thorne', color: '#a699e8', mono: 'VT' }, juno: { name: 'Juno Venn', color: '#ff9ad5', mono: 'JV' },
  patch: { name: 'Oren “Patch” Daal', color: '#9be8a6', mono: 'PD' }, crew: { name: 'Crew radio', color: '#22e4f2', mono: '···' },
};
export const personFor = speaker => {
  const key = String(speaker || '').trim().toLowerCase().split(/\s+/)[0];
  const id = Object.keys(PEOPLE).find(k => k === key || PEOPLE[k].name.toLowerCase().startsWith(key)) || 'crew';
  return { id, ...PEOPLE[id] };
};
// "Neri: text" -> { who, id, color, text }
export function parseLine(line) {
  const i = String(line).indexOf(':'), who = i > 0 && i < 24 ? line.slice(0, i) : 'Crew', text = i > 0 && i < 24 ? line.slice(i + 1).trim() : String(line);
  return { ...personFor(who), text };
}

export class Juice {
  constructor(game) {
    this.game = game; this.canvas = $('fx'); this.ctx = this.canvas?.getContext('2d') || null;
    this.parts = []; this.raf = null; this.scene = null; this.lastMoment = new Map();
    // Menu motion follows the clock even when a frame is slow, so the interface is never left half faded.
    try { window.gsap?.ticker.lagSmoothing(0); } catch (e) { /* optional */ }
    $('cutscene')?.addEventListener('click', e => { if (e.target.closest('.cs-skip')) this.endScene(); else this.advance(); });
    window.addEventListener('keydown', e => { if (!this.scene) return; if (e.key === 'Escape') this.endScene(); else if (e.key === 'Enter' || e.key === ' ') this.advance(); e.preventDefault(); e.stopPropagation(); }, true);
  }
  reduced() {
    const S = this.game.S || {};
    try { return !!(S.reducedMotion || S.motion === false || window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  // ---------- sound: three short synthesized cues on the game's own audio bus ----------
  tone(kind = 'tick') {
    const a = this.game.audio; if (!a || !a.ok || a.muted && kind !== 'ui') return;
    try {
      const ctx = a.ctx, t = ctx.currentTime, notes = kind === 'win' ? [523, 659, 784, 1047] : kind === 'coin' ? [988, 1319] : kind === 'star' ? [784, 1175] : [660];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = kind === 'tick' ? 'square' : 'triangle'; o.frequency.value = f;
        const s = t + i * 0.085, vol = (a.vol?.fx ?? 0.8) * (kind === 'tick' ? 0.03 : 0.09);
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
        o.connect(g); g.connect(a.master || ctx.destination); o.start(s); o.stop(s + 0.25);
      });
    } catch (e) { /* audio is optional */ }
  }

  // ---------- race moments (small feed at the edge of the HUD) ----------
  moment(text, bonus = '', cls = '', key = text, gap = 2.5) {
    const host = $('moments'); if (!host) return;
    const now = performance.now() / 1000; if (now - (this.lastMoment.get(key) || -99) < gap) return; this.lastMoment.set(key, now);
    const el = document.createElement('div'); el.className = 'mo ' + cls; el.textContent = text;
    if (bonus) { const b = document.createElement('b'); b.textContent = bonus; el.append(b); }
    host.append(el); while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => el.remove(), 2300);
  }
  clearMoments() { $('moments')?.replaceChildren(); this.lastMoment.clear(); }

  // ---------- centre pop banner ----------
  pop(title, sub = '', sound = 'star') {
    const el = $('pd-pop'); if (!el) return;
    el.replaceChildren(); const b = document.createElement('b'); b.textContent = title; el.append(b);
    if (sub) { const s = document.createElement('span'); s.textContent = sub; el.append(s); }
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); this.tone(sound);
    clearTimeout(this._popT); this._popT = setTimeout(() => el.classList.remove('on'), 2200);
  }

  // ---------- counting number ----------
  count(el, to, ms = 800, from = 0) {
    if (!el) return;
    const end = Math.round(to), fmt = n => Math.round(n).toLocaleString('en-US');
    if (this.reduced() || ms <= 0) { el.textContent = fmt(end); return; }
    const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (end - from) * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---------- confetti ----------
  confetti(count = 110, colors = ['#22e4f2', '#d7ff3f', '#ff3fb4', '#ffc247', '#ffffff']) {
    if (!this.ctx || this.reduced()) return;
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : 0, a = (side ? Math.PI * 1.25 : Math.PI * 1.75) + (Math.random() - 0.5) * 0.9, sp = 420 + Math.random() * 520;
      this.parts.push({ x: side ? w + 10 : -10, y: h * (0.55 + Math.random() * 0.25), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[i % colors.length], life: 1.6 + Math.random() * 0.9 });
    }
    if (this.raf === null) { this._last = performance.now(); this.raf = requestAnimationFrame(t => this._tick(t)); }
  }
  _tick(now) {
    const c = this.ctx, dt = Math.min(0.05, (now - this._last) / 1000), dpr = this.canvas.width / Math.max(1, window.innerWidth); this._last = now;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.parts = this.parts.filter(p => (p.life -= dt) > 0 && p.y < window.innerHeight + 30);
    for (const p of this.parts) {
      p.vy += 900 * dt; p.vx *= 1 - 1.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.3))); c.restore();
    }
    if (this.parts.length) this.raf = requestAnimationFrame(t => this._tick(t));
    else { this.raf = null; c.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  // ---------- motion language (GSAP timelines; timings follow design/neon-coast-20261111/README.md) ----------
  // With reduced motion, or if GSAP is not bundled, every helper leaves the final state in place immediately.
  get G() { return this.reduced() ? null : (typeof window !== 'undefined' && window.gsap) || null; }
  // Screen entry: interface fades in with at most 12 px of travel. Home also lifts the car out of shadow
  // while the showroom camera settles toward it (650 ms).
  enter(screen, root) {
    const G = this.G; if (!G || !root) return;
    this.glitch(); root.querySelectorAll('.nc-hero, .nc-h, .nc-brand-intro').forEach(el => this.decode(el));
    const els = root.querySelectorAll('[data-in]');
    if (els.length) { G.killTweensOf(els); G.fromTo(els, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.36, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity' }); }
    if (screen === 'hub' || screen === 'garage') {
      const veil = $('veil'), cam = { a: screen === 'hub' ? 0.42 : -0.26 }, base = 0;
      if (veil) G.fromTo(veil, { opacity: screen === 'hub' ? 0.9 : 0.6 }, { opacity: 0, duration: 0.65, ease: 'power2.out' });
      G.to(cam, { a: base, duration: 0.65, ease: 'power3.out', onUpdate: () => { this.game.lobbyAngle = cam.a; } });
    }
    this.trace(root);
  }
  // Route reveal: the selected circuit draws itself along the map (400 ms).
  trace(root) {
    const G = this.G; if (!G || !root) return;
    root.querySelectorAll('.hm-trace').forEach(path => { let len = 0; try { len = path.getTotalLength(); } catch (e) { return; } if (!len) return;
      G.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.4, ease: 'power1.inOut', onComplete: () => { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; } }); });
    const pin = root.querySelector('.hm-pin'); if (pin) G.fromTo(pin, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.3, delay: 0.3, ease: 'back.out(2)' });
  }
  // A 200 ms signal glitch between screens: colour-split slices and a scanline flash. Never blocks input.
  glitch() {
    const G = this.G, host = $('glitch'); if (!G || !host) return;
    if (!host.childElementCount) for (let i = 0; i < 7; i++) host.append(document.createElement('i'));
    const bars = [...host.children];
    bars.forEach(b => { b.style.top = (Math.random() * 92).toFixed(1) + '%'; b.style.height = (1 + Math.random() * 7).toFixed(1) + '%'; });
    G.killTweensOf([host, ...bars]);
    G.timeline().set(host, { display: 'block', opacity: 1 })
      .fromTo(bars, { x: () => (Math.random() - 0.5) * 140, opacity: 0.9 }, { x: () => (Math.random() - 0.5) * 30, opacity: 0, duration: 0.2, ease: 'steps(4)', stagger: 0.012 }, 0)
      .to(host, { opacity: 0, duration: 0.08 }, 0.16).set(host, { display: 'none' });
  }
  // Titles resolve out of scrambled glyphs, left to right (about 400 ms). Text nodes only, so markup survives.
  decode(el, ms = 420) {
    if (!el || this.reduced()) return;
    const nodes = [], walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3 && c.nodeValue.trim()) nodes.push([c, c.nodeValue]); else if (c.nodeType === 1 && !c.matches('small')) walk(c); } };
    walk(el); if (!nodes.length) return;
    const glyphs = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789/<>#_', t0 = performance.now(), total = nodes.reduce((a, [, t]) => a + t.length, 0);
    const step = now => {
      const k = Math.min(1, (now - t0) / ms); let seen = 0;
      for (const [node, text] of nodes) {
        if (!node.isConnected) return;
        let out = '';
        for (let i = 0; i < text.length; i++, seen++) out += text[i] === ' ' || seen / total < k ? text[i] : glyphs[(Math.random() * glyphs.length) | 0];
        node.nodeValue = out;
      }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // Launch ident: the wordmark decodes, the lime bar sweeps, then the curtain lifts into the garage.
  intro() {
    const G = this.G, host = $('intro'); if (!host) return;
    if (!G) { host.remove(); return; }
    host.hidden = false; this.decode(host.querySelector('b'), 650);
    G.timeline({ onComplete: () => host.remove() })
      .fromTo(host.querySelector('i'), { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power3.out' }, 0.15)
      .fromTo(host.querySelector('small'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 }, 0.45)
      .to(host, { yPercent: -100, duration: 0.5, ease: 'power3.inOut' }, 1.15);
  }
  sheet(el) { const G = this.G; if (G && el) G.fromTo(el, { opacity: 0, x: 22 }, { opacity: 1, x: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform,opacity' }); }
  // Garage selection: a light sweep crosses the car while the paint or the car changes (300-400 ms).
  sweep(turn = 0) {
    const G = this.G, el = $('sweep'); if (!G) return;
    if (el) G.fromTo(el, { opacity: 1, backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 0.36, ease: 'power2.inOut', onComplete: () => { el.style.opacity = 0; } });
    if (turn) { const cam = { a: (this.game.lobbyAngle || 0) + turn }; G.to(cam, { a: 0, duration: 0.4, ease: 'power3.out', onUpdate: () => { this.game.lobbyAngle = cam.a; } }); }
  }
  // Start event: the shutter drops, the race is prepared behind it, then it lifts into the grid (600-800 ms).
  shutter(run, label = '') {
    const G = this.G, el = $('shutter');
    if (!G || !el) { run(); return; }
    el.innerHTML = label ? '<b></b>' : ''; if (label) el.firstChild.textContent = label;
    G.killTweensOf(el);
    G.timeline().set(el, { yPercent: -101, y: 0 }).to(el, { yPercent: 0, duration: 0.26, ease: 'power2.in' })
      .call(() => { try { run(); } catch (e) { console.error(e); } }).to(el, { yPercent: -101, duration: 0.44, ease: 'power3.inOut', delay: 0.14 });
  }
  // Finish: earned stars land one by one; nothing blocks the Continue button.
  stars(el) { const G = this.G; if (!el) return; const on = el.querySelectorAll('b'); if (!on.length) return; if (G) G.from(on, { scale: 0, rotation: -50, opacity: 0, duration: 0.3, stagger: 0.14, ease: 'back.out(2.4)' }); on.forEach((_, i) => setTimeout(() => this.tone('star'), 120 + i * 140)); }
  reveal(els) { const G = this.G; if (G && els && els.length) G.fromTo(els, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.07, ease: 'power2.out', clearProps: 'transform,opacity' }); }

  // ---------- cutscenes: tap-through dialogue with the speaking character ----------
  // lines: ['Neri: ...'] or parsed objects. title/kicker are optional. done() runs once, on finish or skip.
  cutscene(lines, { title = '', kicker = '', done = null } = {}) {
    const host = $('cutscene'), list = (lines || []).map(l => (typeof l === 'string' ? parseLine(l) : l)).filter(l => l && l.text);
    if (!host || !list.length) { done?.(); return; }
    this.scene = { list, i: -1, done, title, kicker, typing: null, full: false };
    host.classList.add('on'); this.advance();
  }
  advance() {
    const s = this.scene; if (!s) return;
    if (s.typing && !s.full) { clearInterval(s.typing); s.typing = null; s.full = true; const p = $('cs-text'); if (p) p.textContent = s.list[s.i].text; return; }
    s.i++; if (s.i >= s.list.length) { this.endScene(); return; }
    const l = s.list[s.i], host = $('cutscene');
    host.style.setProperty('--c', l.color);
    host.innerHTML = `<button class="cs-skip" type="button">Skip</button>${s.title ? `<div class="cs-title"><small></small><span></span></div>` : ''}<div class="cs"><span class="ol-portrait ${l.mono ? 'mono' : 'ol-portrait-' + l.id}" role="img"></span><div class="cs-box"><b></b><p id="cs-text"></p><div class="cs-foot"><span>${s.i + 1} / ${s.list.length}</span><span>Tap to continue</span></div></div></div>`;
    if (s.title) { host.querySelector('.cs-title small').textContent = s.kicker; host.querySelector('.cs-title span').textContent = s.title; }
    const portrait = host.querySelector('.ol-portrait'); portrait.setAttribute('aria-label', l.name); if (l.mono) portrait.textContent = l.mono;
    host.querySelector('.cs-box b').textContent = l.name;
    const p = $('cs-text'); s.full = false;
    if (this.reduced()) { p.textContent = l.text; s.full = true; return; }
    let n = 0; p.textContent = '';
    s.typing = setInterval(() => { n += 2; p.textContent = l.text.slice(0, n); if (n % 6 === 0) this.tone('tick'); if (n >= l.text.length) { clearInterval(s.typing); s.typing = null; s.full = true; } }, 24);
  }
  endScene() {
    const s = this.scene; if (!s) return;
    if (s.typing) clearInterval(s.typing);
    this.scene = null; const host = $('cutscene'); host.classList.remove('on'); host.replaceChildren();
    s.done?.();
  }
}
