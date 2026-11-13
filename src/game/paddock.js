// VELOCITYVERSE 0.8 paddock, "Neon Coast" layout: Home, Story, Garage, World and Crew, plus the
// event-ready screen, profile and the results rewards. Screens are rendered from the save on every visit
// over the live 3D car and circuit; all rules live in progress.js and the story rules in career-mode.js.
import * as PG from './progress.js';
import { RIDES, getRide } from '../sim/rides.js';
import { CIRCUITS, getCircuit } from '../sim/circuits.js';
import { Track } from '../sim/track.js';
import { benchCar } from '../sim/lab.js';
import { ACADEMY_DRILLS } from '../sim/academy.js';
import { MISSIONS, missionUnlocked, nextMission, careerDialogue } from './career-mode.js';
import { STORY_CHARACTERS } from './openline-data.js';
import { parseLine } from './juice.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = id => `<svg class="pd-ic" aria-hidden="true"><use href="#${id}"></use></svg>`;
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
const num = n => Math.round(n).toLocaleString('en-US');
const pct = x => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
const rgb = c => `rgb(${c.map(x => Math.round(x * 255)).join(',')})`;
export const fmtLap = t => (Number.isFinite(t) && t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}` : '–:––.–––');
const fmtShort = t => (Number.isFinite(t) && t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : '–');
const NAV = [['hub', 'Home', 'i-home'], ['career', 'Story', 'i-story'], ['garage', 'Garage', 'i-car'], ['world', 'World', 'i-pin'], ['team', 'Crew', 'i-team']];
const SCREENS = ['hub', 'career', 'garage', 'world', 'team', 'records', 'prep'];
const SEE3D = ['hub', 'garage', 'prep'];
const HARBOR_NAMES = ['Lighthouse', 'Esses entry', 'Esses exit', 'Crane Sweep', 'Customs Hairpin', 'Ferry Chicane entry', 'Ferry Chicane exit', 'Warehouse', 'Quay'];
const AI_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const TYPES = { sprint: 'Delivery sprint', checkpoint: 'Checkpoint run', duel: 'Head to head', timetrial: 'Time attack', clean: 'Precision run', race: 'Grid race' };
const ACTS = ['The first light', 'A crew worth keeping', 'The Crownline invitational', 'The open season'];
const BIO = [['personality', 'What they are like'], ['origin', 'Where they come from'], ['ambition', 'What they want'], ['conflict', 'What holds them back'], ['arc', 'Where this is going']];
const MAP = { harbor_loop: { x: 34, y: 88, w: 250, h: 168, c: '#8fe9ff' }, beacon_short: { x: 322, y: 186, w: 150, h: 84, c: '#dcff52' }, breakwater: { x: 452, y: 58, w: 236, h: 108, c: '#ffb84a' } };
const RADIO = { race: 'Neri: Lights out and away. Look for the gap, not the gearbox.', timetrial: 'Sola: Three laps. Beat your ghost first, then come for mine.', practice: 'Maela: No clock today. Find the grip and enjoy it.' };
const stars = (n, of) => `<span class="pd-stars" aria-label="${n} of ${of} stars">${'<b>★</b>'.repeat(n)}${'★'.repeat(Math.max(0, of - n))}</span>`;
const twoTone = text => { const w = String(text).trim().split(/\s+/); return w.length < 2 ? esc(text) : `${esc(w.slice(0, -1).join(' '))} <em>${esc(w[w.length - 1])}</em>`; };
const twoLines = text => { const w = String(text).trim().split(/\s+/); if (w.length < 2) return esc(text); let best = 1, diff = 1e9; for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } } return `${esc(w.slice(0, best).join(' '))}<br>${esc(w.slice(best).join(' '))}`; };

export class Paddock {
  constructor(game) {
    this.game = game; this.nextDestination = 'career'; this.viewRide = null; this.viewCrew = 'neri'; this.garTab = 'paint'; this.worldTab = 'circuit'; this.goalsOpen = false;
    this.tracks = new Map(); this.benchRun = null; this.benchBusy = false; this.session = null; this.ready = null; this.cityCache = null;
    PG.progressOf(this.data);
  }
  get data() { return this.game.save.data; }
  get p() { return PG.progressOf(this.data); }
  get story() { return this.game.storyCareer; }
  save() { return this.game.save.save(); }
  team() { return PG.normalizeTeam(this.data.team); }

  // ---------- wiring ----------
  wire() {
    for (const id of [...SCREENS, 'results']) {
      const root = $('scr-' + id); if (!root) continue;
      root.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') this.act(el.dataset.act, el); });
      root.addEventListener('input', e => this.input(e.target));
      root.addEventListener('change', e => this.input(e.target, true));
      let pointer = null, lastX = 0;
      root.addEventListener('pointerdown', e => { if (!e.target.closest('.rotate-zone') || pointer !== null) return; pointer = e.pointerId; lastX = e.clientX; e.preventDefault(); });
      root.addEventListener('pointermove', e => { if (e.pointerId !== pointer) return; this.game.lobbyAngle = (this.game.lobbyAngle || 0) + (e.clientX - lastX) * 0.008; lastX = e.clientX; });
      const release = e => { if (e.pointerId === pointer) pointer = null; };
      root.addEventListener('pointerup', release); root.addEventListener('pointercancel', release); root.addEventListener('pointerleave', release);
    }
  }

  // ---------- shell ----------
  render(screen, entering = false) {
    if (!SCREENS.includes(screen)) return;
    const root = $('scr-' + screen), host = screen === 'prep' ? $('prep-main') : root; if (!root || !host) return;
    if (screen === 'hub' || screen === 'garage') this.syncShowroom(screen === 'garage' ? this.viewRide : null);
    if (screen === 'prep' && entering && $('prep-drawer')) $('prep-drawer').hidden = true;
    const d = this.data, lv = PG.levelFor(d.career.xp), cl = PG.claimable(d), team = this.team();
    const here = screen === 'prep' ? (this.ready?.kind === 'story' ? 'career' : 'world') : screen;
    const badge = { hub: cl.goals, team: 0 };
    host.innerHTML = `<header class="nc-top"><button type="button" class="nc-brand" data-nav="hub" aria-label="Velocityverse home">VELOCITYVERSE</button><i class="nc-slash" aria-hidden="true"></i>
<button type="button" class="nc-player" data-nav="records" aria-label="${esc(team.driver)}, driver level ${lv.level}. Open profile"><span class="nc-avatar" aria-hidden="true">${esc(team.driver.charAt(0).toUpperCase())}</span><span><b>${esc(team.driver)}</b><small>LV ${lv.level}${cl.trophies ? ` · ${cl.trophies} to collect` : ''}</small><i style="--f:${pct(lv.into / lv.span)}"></i></span></button>
<span class="sp"></span><div class="nc-cr" aria-label="${PG.credits(d)} credits"><span class="nc-coin"></span><span class="pd-wallet">${num(PG.credits(d))}</span></div>
<button type="button" class="nc-gear" data-nav="settings" aria-label="Settings">${icon('i-settings')}</button></header>
<div class="pd-body${['team', 'records'].includes(screen) ? ' scrolly' : ''}">${this['v_' + screen]()}</div>
<nav class="nc-nav" aria-label="Main menu">${NAV.map(([id, label, ic]) => `<button type="button" data-nav="${id}"${id === here ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${badge[id] ? `<i class="nc-badge">${badge[id]}</i>` : ''}</button>`).join('')}</nav>`;
    host.querySelectorAll('input[type=range]').forEach(el => this.fillRange(el));
    if (entering) this.game.juice.enter(screen, host);
    if (screen === 'career' && this.story.result && this._resultShown !== this.story.result && !this.game.juice.scene) { this._resultShown = this.story.result; this.game.juice.stars(host.querySelector('.bigstars')); }
  }
  fillRange(el) { const min = Number(el.min), max = Number(el.max); el.style.setProperty('--v', pct((Number(el.value) - min) / Math.max(1e-6, max - min))); }
  rerender() {
    const s = this.game.screen; if (!SCREENS.includes(s)) return;
    const keep = [...document.querySelectorAll(`#scr-${s} .scroll, #scr-${s} .pd-body, #scr-${s} .events`)].map(e => [e.scrollTop, e.scrollLeft]);
    this.render(s);
    document.querySelectorAll(`#scr-${s} .scroll, #scr-${s} .pd-body, #scr-${s} .events`).forEach((e, i) => { if (keep[i]) { e.scrollTop = keep[i][0]; e.scrollLeft = keep[i][1]; } });
  }
  wallet(from) { document.querySelectorAll('.screen.active .pd-wallet').forEach(el => this.game.juice.count(el, PG.credits(this.data), 700, from)); }
  toast(msg) { this.game.toast(msg); }
  // The 3D showroom shows the car you will race; a locked car is previewed in stock trim.
  syncShowroom(preview) {
    const g = this.game, d = this.data, owned = PG.ownedRides(d), id = preview && RIDES.some(r => r.id === preview) ? preview : this.p.ride;
    if (g.mode !== 'menu') return;
    if (g.baseRideId !== id) g.configureDrive(id, g.currentCircuitId || this.p.circuit, owned.includes(id) ? PG.selectedCar(d, id) : PG.buildCar(id));
  }
  trackFor(id) { if (!this.tracks.has(id)) { const c = getCircuit(id); this.tracks.set(id, new Track(c.track, c.world, getRide('vx1').car)); } return this.tracks.get(id); }
  sectionNames(id) {
    const t = this.trackFor(id), names = id === 'harbor_loop' ? HARBOR_NAMES : (getCircuit(id).track.cornerNames || []); let c = 0, s = 0;
    return t.segments.map(g => (g.kind === 'S' ? `Straight ${++s}` : names[c++] || `Turn ${c}`));
  }
  // Track outline fitted into a box. Returns the path and the start/finish point.
  outline(id, x, y, w, h, pad = 6) {
    const t = this.trackFor(id), minX = Math.min(...t.x), maxX = Math.max(...t.x), minZ = Math.min(...t.z), maxZ = Math.max(...t.z);
    const sc = Math.min((w - pad * 2) / Math.max(1, maxX - minX), (h - pad * 2) / Math.max(1, maxZ - minZ)), ox = x + (w - (maxX - minX) * sc) / 2, oy = y + (h - (maxZ - minZ) * sc) / 2;
    const px = (wx, wz) => [ox + (wx - minX) * sc, oy + (maxZ - wz) * sc], step = Math.max(1, Math.floor(t.n / 220));
    let d = ''; for (let i = 0; i < t.n; i += step) { const [a, b] = px(t.x[i], t.z[i]); d += `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`; }
    const s0 = t.pointAt(t.def.lineS, 0, {}), start = px(s0.x, s0.z);
    return { d: d + 'Z', start, t, px };
  }
  miniMap(id, grades = null) {
    const o = this.outline(id, 0, 0, 150, 74, 8), t = o.t, col = { S: '#b98bff', A: '#5fe39a', B: '#ffd84a', C: '#ff9a3d', D: '#ff5d6c' };
    let out = `<svg class="mini" viewBox="0 0 150 74" aria-hidden="true"><path d="${o.d}" fill="none" stroke="${grades ? '#5d6d8c' : '#f4f0e6'}" stroke-width="${grades ? 4 : 2.6}" stroke-linejoin="round"/>`;
    if (grades) t.segments.forEach((g, gi) => { let sd = '', k = 0, last = 0; for (let i = 0; i < t.n; i++) if (t.seg[i] === gi) { const [a, b] = o.px(t.x[i], t.z[i]); sd += `${k++ ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`; last = i; }
      if (!k) return; const [a, b] = o.px(t.x[(last + 1) % t.n], t.z[(last + 1) % t.n]); out += `<path d="${sd}L${a.toFixed(1)} ${b.toFixed(1)}" fill="none" stroke="${col[grades[gi]] || '#5d6d8c'}" stroke-width="3" stroke-linecap="round"/>`; });
    else for (let k = 1; k <= 4; k++) { const i = Math.floor(t.n * k / 5), [a, b] = o.px(t.x[i], t.z[i]); out += `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3.2" fill="#dcff52"/>`; }
    return out + `<circle cx="${o.start[0].toFixed(1)}" cy="${o.start[1].toFixed(1)}" r="3.6" fill="#080f1b" stroke="#dcff52" stroke-width="2"/></svg>`;
  }
  // Lumen Harbor drawn from the three real circuit outlines on a stylised coast.
  harborMap({ active, pin = '', done = {} }) {
    if (!this.cityCache) {
      let seed = 20261111; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, lit = ['#ffd9a0', '#ff4fb8', '#8fe9ff', '#ffd9a0', '#f4f0e6'];
      let blocks = '';
      for (let i = 0; i < 170; i++) { const x = 14 + rnd() * 690, y = 50 + rnd() * 222, w = 9 + rnd() * 22, h = 7 + rnd() * 15; if (y > 236 && (x < 70 || x > 600)) continue; if (y < 66 && x < 250) continue;
        blocks += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#1c2c49"/>`; if (rnd() > 0.35) blocks += `<rect x="${(x + 2 + rnd() * (w - 5)).toFixed(0)}" y="${(y + 2 + rnd() * (h - 4)).toFixed(0)}" width="2.6" height="2.2" fill="${lit[Math.floor(rnd() * lit.length)]}" opacity="${(0.55 + rnd() * 0.45).toFixed(2)}"/>`; }
      let waves = ''; for (let i = 0; i < 22; i++) { const x = rnd() * 700, y = (i % 4 ? 300 : 6) + rnd() * (i % 4 ? 70 : 18); waves += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}q8 -4 16 0t16 0" fill="none" stroke="#1f3554" stroke-width="1.2"/>`; }
      this.cityCache = `<defs><filter id="hmGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4.5"/></filter><linearGradient id="hmSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1c34"/><stop offset="1" stop-color="#081222"/></linearGradient></defs>
<rect width="720" height="380" fill="url(#hmSea)"/>${waves}
<path d="M0 72C100 42 250 30 400 36C540 42 660 32 720 62L720 236C660 262 590 276 500 282C400 290 330 300 230 290C140 282 60 262 0 236Z" fill="#12203a" stroke="#3c5682" stroke-width="1.6"/>${blocks}
<g stroke="#ff7a4a" stroke-width="2.2" fill="none" opacity=".9"><path d="M40 286v-40l26 14M40 258h20M84 300v-36l22 12M84 276h16M128 306v-30l18 10"/></g>
<g stroke="#3c5682" stroke-width="3" stroke-linecap="round"><path d="M176 292l10 40M214 294l8 34M540 280l14 40M590 274l16 36M636 264l18 32"/></g>
<g fill="none" stroke="#ff4fb8" stroke-width="1.6" opacity=".75"><path d="M470 30h220M500 30q30 -22 60 0q30 -22 60 0q30 -22 60 0"/></g>`;
    }
    let pinSvg = '';
    let out = `<svg class="harbor" viewBox="0 0 720 380" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of Lumen Harbor with three circuits">${this.cityCache}`;
    for (const c of CIRCUITS) {
      const m = MAP[c.id], o = this.outline(c.id, m.x, m.y, m.w, m.h), on = c.id === active, lw = c.name.length * 8.6 + (done[c.id] ? 44 : 26), lx = m.x + 6, ly = m.y - 12;
      out += `<path d="${o.d}" fill="none" stroke="#0a1220" stroke-width="11" stroke-linejoin="round"/><path d="${o.d}" fill="none" stroke="${m.c}" stroke-width="${on ? 9 : 6}" opacity="${on ? 0.6 : 0.28}" filter="url(#hmGlow)"/>
<path d="${o.d}" class="${on ? 'hm-trace' : ''}" fill="none" stroke="${m.c}" stroke-width="${on ? 3.4 : 2.2}" stroke-linejoin="round" opacity="${on ? 1 : 0.75}"/>
<g transform="translate(${lx} ${ly})"><path d="M8 0H${lw}L${lw - 8} 22H0Z" fill="#0b1322" stroke="${on ? m.c : '#33466a'}" stroke-width="${on ? 2 : 1.2}"/>${done[c.id] ? `<circle cx="20" cy="11" r="7" fill="none" stroke="${m.c}" stroke-width="1.8"/><path d="M16.5 11l2.6 2.6 4.6 -5" fill="none" stroke="${m.c}" stroke-width="1.8"/>` : ''}<text class="hm-label" x="${done[c.id] ? 34 : 14}" y="16">${esc(c.name)}</text></g>
<rect class="hm-hit" x="${m.x - 8}" y="${m.y - 30}" width="${m.w + 16}" height="${m.h + 40}" fill="transparent" data-act="map-circuit" data-id="${c.id}"/>`;
      if (on) pinSvg = `<g class="hm-pin" transform="translate(${o.start[0].toFixed(1)} ${o.start[1].toFixed(1)})" pointer-events="none"><ellipse cx="0" cy="2" rx="9" ry="3.5" fill="none" stroke="${m.c}" stroke-width="1.6"/><path d="M0 0C-13 -16 -15 -24 -15 -30A15 15 0 0 1 15 -30C15 -24 13 -16 0 0Z" fill="#dcff52"/><text x="0" y="-25" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-style="italic" font-size="15" fill="#0b1200">${esc(pin)}</text></g>`;
    }
    return out + pinSvg + '</svg>';
  }
  person(line) { const l = parseLine(line); return { ...l, portrait: `<span class="ol-portrait ${l.mono ? 'mono' : 'ol-portrait-' + l.id}" role="img" aria-label="${esc(l.name)}" style="--c:${l.color}">${l.mono ? esc(l.mono) : ''}</span>` }; }

  // ---------- home ----------
  v_hub() {
    const d = this.data, p = this.p, ride = getRide(p.ride), st = PG.carStats(PG.selectedCar(d)), state = this.story.state;
    const m = nextMission(state), allDone = MISSIONS.every(x => state.records[x.id]?.completed), goals = PG.goalList(d), goal = goals.find(g => g.done && !g.claimed) || goals.find(g => !g.claimed) || goals[0];
    const pop = this.goalsOpen ? `<div class="nc-card goals-pop"><h3>Today’s goals<small>${p.streak.n > 1 ? `${p.streak.n}-day streak` : 'New every day'}</small></h3>${goals.map(x => `<div class="goal${x.done ? ' done' : ''}${x.claimed ? ' claimed' : ''}"><p>${esc(x.text)}</p>${x.claimed ? '<span class="nc-tag">Collected</span>' : x.done ? `<button type="button" class="nc-btn buy sm" data-act="claim-goal" data-id="${x.id}">Collect ${x.pay}</button>` : `<span class="n">${Math.floor(x.have)} / ${x.goal} · ${x.pay}</span>`}<div class="pd-prog"><i style="--f:${pct(x.have / x.goal)}"></i></div></div>`).join('')}</div>` : '';
    return `<div class="home"><div class="rotate-zone" id="car-rotate-zone" aria-label="Drag to turn your car"></div>
<div class="home-left"><span class="nc-chip" data-in>Openline <i>/</i> Act ${String(m.chapter).padStart(2, '0')}</span>
 <h1 class="nc-hero" data-in>${allDone ? 'Season<br>complete' : twoLines(m.title)}</h1><p class="nc-sub" data-in>${esc(getCircuit(m.trackId).name)} · ${allDone ? 'Replay any event for more stars' : 'Next story event'}</p>
 <button type="button" class="nc-go shine" data-act="story-continue" data-in><span>${allDone ? 'Story tour' : 'Continue story'}</span>${ARROW}</button>
 <div class="pd-row" data-in><button type="button" class="nc-btn" data-act="quick">${icon('i-race')}Quick race</button><button type="button" class="nc-btn" data-act="free">${icon('i-road')}Free drive</button></div></div>
<div class="nc-cartag" data-in><b>${esc(ride.name)}</b><small>${esc(PG.RIDE_SHOP[ride.id].cls)} · PR ${st.pr}</small></div>
<button type="button" class="goalcard" data-act="goals" data-in aria-expanded="${this.goalsOpen}">${icon('i-target')}<b>${goal.done && !goal.claimed ? `Collect ${goal.pay} credits` : esc(goal.text)}</b><small>${goal.claimed ? 'All goals collected today' : `Today’s goal · ${Math.floor(goal.have)} of ${goal.goal}`}</small><span class="arr">›</span></button>${pop}
<span id="hub-next-title" hidden></span><span id="hub-next-detail" hidden></span></div>`;
  }

  // ---------- story ----------
  v_career() {
    const sc = this.story, state = sc.state, d = this.data;
    const m = MISSIONS.find(x => x.id === sc.focusMission) || nextMission(state); sc.focusMission = m.id;
    const act = Number.isFinite(sc.chapter) && sc.chapter >= 1 && sc.chapter <= ACTS.length ? sc.chapter : m.chapter; sc.chapter = act;
    const done = {}; for (const c of CIRCUITS) { const list = MISSIONS.filter(x => x.trackId === c.id); done[c.id] = list.length > 0 && list.every(x => state.records[x.id]?.completed); }
    const events = MISSIONS.filter(x => x.chapter === act).map(x => { const open = missionUnlocked(state, x.id), rec = state.records[x.id];
      return `<button type="button" class="ev${open ? '' : ' locked'}" data-act="event" data-id="${x.id}" aria-pressed="${x.id === m.id}"><span class="n">${String(x.index + 1).padStart(2, '0')}</span><b>${esc(x.title)}</b>${open ? stars(rec.stars, 3) : '<small class="pd-dim">Locked</small>'}</button>`; }).join('');
    const total = Object.values(state.records).reduce((a, r) => a + r.stars, 0);
    return `<div class="mapwrap">${this.harborMap({ active: m.trackId, pin: String(m.index + 1).padStart(2, '0'), done })}
<div class="map-title" data-in><h2 class="nc-h">Story tour<small>Lumen Harbor · ${total} of ${MISSIONS.length * 3} stars</small></h2></div>
<div class="acts" data-in><div class="nc-seg" role="group" aria-label="Acts">${ACTS.map((name, i) => `<button type="button" data-act="act" data-id="${i + 1}" aria-pressed="${i + 1 === act}">Act ${i + 1}</button>`).join('')}</div><div class="events">${events}</div></div>
<aside class="nc-card sheet" data-in>${sc.result ? this.storyResult(sc.result) : this.storySheet(m)}</aside></div>`;
  }
  storySheet(m) {
    const sc = this.story, state = sc.state, rec = state.records[m.id], open = missionUnlocked(state, m.id), t = this.trackFor(m.trackId), q = this.person(m.before[0]);
    const route = ['sprint', 'checkpoint'].includes(m.type) ? m.minDistance : t.length * Math.max(1, m.laps), left = (rec.completed ? 0 : m.reward) + (3 - rec.stars) * m.starReward;
    return `<div class="sheet-body scroll"><span class="nc-k">Act ${m.chapter} · ${esc(ACTS[m.chapter - 1])}</span><h2 class="nc-h">${esc(m.title)}<small>${TYPES[m.type]} · ${esc(getCircuit(m.trackId).name)}</small></h2>
<div class="obj on">${icon('i-flag')}<span>${esc(sc.completionGoal(m))}</span></div><div class="obj">${icon('i-clock')}<span>Beat ${fmtShort(m.targetTime)}</span></div><div class="obj">${icon('i-shield')}<span>No contact</span></div>
<div class="facts"><div><small>Route</small><b>${(route / 1000).toFixed(1)} km</b></div><div><small>Credits to earn</small><b>${left ? `+${left}` : 'All earned'}</b></div><div><small>Your stars</small><b>${stars(rec.stars, 3)}</b></div><div><small>Your best</small><b>${fmtShort(rec.bestTime)}</b></div></div>
<div class="quote" style="--c:${q.color}">${q.portrait}<b>${esc(q.name.split(' ')[0])}</b><p>${esc(q.text)}</p></div></div>
<div class="sheet-foot"><button type="button" class="nc-go" data-act="story-start" data-id="${m.id}"${open ? '' : ' disabled'}><span>${open ? (rec.completed ? 'Race again' : 'Start event') : 'Finish the event before'}</span>${ARROW}</button></div>`;
  }
  storyResult(r) {
    const sc = this.story, m = r.mission, rec = sc.state.records[m.id], proof = r.proof || {}, n = r.success ? (r.stars || 0) : 0, last = m.index === MISSIONS.length - 1;
    const line = r.success ? this.person(careerDialogue(sc.state, m.id, true)[0]) : null;
    return `<div class="sheet-body scroll"><span class="nc-k">${esc(m.title)}</span><h2 class="nc-h">${r.success ? (n === 3 ? 'Perfect run' : 'Event complete') : 'Not this time'}</h2>
<div class="bigstars" aria-label="${n} of 3 stars">${'<b>★</b>'.repeat(n)}${'★'.repeat(3 - n)}</div>
<div class="facts"><div><small>Time</small><b>${fmtShort(m.type === 'timetrial' ? proof.lapTime : proof.elapsed)}</b></div><div><small>Contacts</small><b>${proof.contacts ?? '–'}</b></div><div><small>Credits</small><b>+${r.earned || 0}</b></div><div><small>Your best</small><b>${fmtShort(rec.bestTime)}</b></div></div>
${line ? `<div class="quote" style="--c:${line.color}">${line.portrait}<b>${esc(line.name.split(' ')[0])}</b><p>${esc(line.text)}</p></div>` : `<p class="pd-note">${esc(r.reason || 'Try a different line or setup.')}</p>`}
${r.unlockedRide ? `<span class="nc-tag lime">${esc(getRide(r.unlockedRide).name)} added to your garage</span>` : ''}</div>
<div class="sheet-foot"><button type="button" class="nc-go" data-act="${r.success && !last ? 'story-next' : r.success ? 'story-map' : 'story-retry'}" data-id="${m.id}"><span>${r.success ? (last ? 'Continue' : 'Next event') : 'Try again'}</span>${ARROW}</button>
<button type="button" class="nc-btn sm" data-act="${r.success ? 'story-retry' : 'story-map'}" data-id="${m.id}">${r.success ? 'Race again' : 'Back to the map'}</button></div>`;
  }
  readyStory(id) {
    const g = this.game, sc = this.story, m = MISSIONS.find(x => x.id === id); if (!m || !missionUnlocked(sc.state, id)) return;
    sc.change('select', { missionId: id }, true); sc.focusMission = id; sc.result = null; g.raceOverride = null;
    if (!g.configureDrive(this.p.ride, m.trackId, sc.carFor(this.p.ride))) return;
    this.ready = { kind: 'story', id }; g.show('prep');
  }

  // ---------- garage ----------
  v_garage() {
    const d = this.data, p = this.p, owned = PG.ownedRides(d), level = PG.levelFor(d.career.xp).level, viewId = RIDES.some(r => r.id === this.viewRide) ? this.viewRide : p.ride;
    const view = getRide(viewId), has = owned.includes(viewId), car = has ? PG.selectedCar(d, viewId) : PG.buildCar(viewId), st = PG.carStats(car), shop = PG.RIDE_SHOP[viewId], bench = p.bench[viewId];
    const fresh = has && bench && bench.tag === PG.buildTag(d, viewId);
    const rides = RIDES.map(r => { const o = owned.includes(r.id);
      return `<button type="button" class="ride${o ? '' : ' locked'}" data-act="view-ride" data-id="${r.id}" aria-pressed="${r.id === viewId}"><b>${esc(r.name)}</b><small>${o ? (r.id === p.ride ? 'Race car' : esc(PG.RIDE_SHOP[r.id].cls)) : `${num(PG.RIDE_SHOP[r.id].price)} credits`}</small></button>`; }).join('');
    let sheet;
    if (!has) {
      const story = MISSIONS.find(m => m.id === shop.story), need = level < shop.level;
      sheet = `<h2 class="nc-h">${esc(view.name)}<small>${esc(shop.cls)}</small></h2><p>${esc(view.car.summary || view.tagline)}</p>
<p class="pd-note">${need ? `Reach driver level ${shop.level} to buy it` : `${num(shop.price)} credits`}${story ? `, or win it in the story event “${esc(story.title)}”.` : '.'}</p><span class="sp"></span>
<div class="sheet-foot"><button type="button" class="nc-go" data-act="buy-ride" data-id="${viewId}"${need || PG.credits(d) < shop.price ? ' disabled' : ''}><span>Buy · ${num(shop.price)}</span>${ARROW}</button><button type="button" class="nc-btn sm" data-nav="career">Story tour</button></div>`;
    } else {
      const tab = this.garTab;
      let body, foot = '';
      if (tab === 'parts') body = PG.SYSTEMS.map(s => { const stage = p.up[viewId][s.id], cost = PG.upgradeCost(d, viewId, s.id);
        return `<div class="up"><b>${s.name}</b><small>${esc(s.gain)}</small><div class="pd-pips" aria-label="Stage ${stage} of ${PG.MAX_STAGE}">${Array.from({ length: PG.MAX_STAGE }, (_, i) => `<i class="${i < stage ? 'on' : ''}"></i>`).join('')}</div>${cost === null ? '<span class="nc-tag lime">Maxed</span>' : `<button type="button" class="nc-btn buy sm" data-act="upgrade" data-id="${s.id}"${PG.credits(d) < cost ? ' disabled' : ''}><span class="nc-coin"></span>${num(cost)}</button>`}</div>`; }).join('') + `<p class="pd-note">Rivals keep their own cars, so every stage is a real advantage.${PG.crewPerk(d, 'tavi') ? ` Tavi saves you ${PG.crewPerk(d, 'tavi') * 3}%.` : ''}</p>`;
      else if (tab === 'tune') {
        const tune = p.tune[viewId], run = this.benchRun && this.benchRun.ride === viewId ? this.benchRun : null, mm = run ? run.result.metrics : (fresh ? bench : null), base = run?.stock?.metrics;
        const delta = (v, b, low, unit, dig) => { if (!b) return ''; const df = v - b; if (Math.abs(df) < Math.pow(10, -dig) / 2) return '<em class="pd-dim">stock</em>'; return `<em class="${(low ? df < 0 : df > 0) ? 'up-good' : 'up-bad'}">${df > 0 ? '+' : '−'}${Math.abs(df).toFixed(dig)} ${unit}</em>`; };
        body = `<div class="nc-seg" role="group" aria-label="Setup">${[['Speed', -2], ['Balanced', 0], ['Grip', 2]].map(([l, v]) => `<button type="button" data-act="wing" data-id="${v}" aria-pressed="${tune.wing === v}">${l}</button>`).join('')}</div>
${PG.TUNES.filter(t => t.id !== 'wing').map(t => `<div class="tune"><div class="hd"><span>${t.name}</span><span class="pd-num" id="tune-${t.id}-v">${tune[t.id] > 0 ? '+' : ''}${tune[t.id]}</span></div><input type="range" min="-3" max="3" step="1" value="${tune[t.id]}" data-tune="${t.id}" aria-label="${t.name}"><div class="ends"><span>${t.lo}</span><span>${t.hi}</span></div></div>`).join('')}
<div class="met"><div><span>0–100</span><b>${mm ? mm.accel.toFixed(2) + ' s' : '–'}</b>${mm ? delta(mm.accel, base?.accel, true, 's', 2) : ''}</div><div><span>100–0</span><b>${mm ? mm.brake.toFixed(1) + ' m' : '–'}</b>${mm ? delta(mm.brake, base?.brake, true, 'm', 1) : ''}</div><div><span>Top speed</span><b>${mm ? Math.round(mm.topKmh) : '–'}</b>${mm ? delta(mm.topKmh, base?.topKmh, false, 'km/h', 0) : ''}</div></div>
<p class="pd-note">The bench drives this exact car in the physics model.</p>`;
        foot = `<button type="button" class="nc-btn" data-act="bench"${this.benchBusy ? ' disabled' : ''}>${this.benchBusy ? 'Testing…' : 'Run bench test'}</button>`;
      } else {
        const liv = this.game.veh.car.liveries || [], cur = this.game.livery().id, cl = d.customLivery;
        body = `<div class="swatches" role="group" aria-label="Paint">${liv.map(l => `<button type="button" data-act="paint" data-id="${l.id}" aria-pressed="${l.id === cur}" aria-label="${esc(l.name)}" style="background:linear-gradient(135deg,${rgb(l.primary)} 52%,${rgb(l.secondary)} 52%)"></button>`).join('')}<button type="button" data-act="paint" data-id="custom" aria-pressed="${cur === 'custom'}" aria-label="Your own colours" style="background:linear-gradient(135deg,${esc(cl.primary)} 52%,${esc(cl.secondary)} 52%)"></button></div>
<p class="pd-note">${esc((liv.find(l => l.id === cur) || { name: 'Your own colours' }).name)}</p>
${cur === 'custom' ? `<div class="pd-row"><input type="color" data-paint="primary" value="${esc(cl.primary)}" aria-label="Body colour"><input type="color" data-paint="secondary" value="${esc(cl.secondary)}" aria-label="Aero colour"><input type="color" data-paint="accent" value="${esc(cl.accent)}" aria-label="Accent colour"><span class="pd-note">Body, aero, accent</span></div>` : ''}
`;
        foot = `<button type="button" class="nc-btn" id="btn-garage-photo" data-act="photo">${icon('i-camera')}Photo mode</button>`;
      }
      sheet = `<h2 class="nc-h">Make it yours</h2><div class="nc-seg" role="tablist">${[['paint', 'Paint'], ['parts', 'Parts'], ['tune', 'Tune']].map(([id, l]) => `<button type="button" role="tab" data-act="gar-tab" data-id="${id}" aria-pressed="${id === tab}">${l}</button>`).join('')}</div><div class="sheet-body scroll">${body}</div>
<div class="sheet-foot">${viewId === p.ride ? foot : `<button type="button" class="nc-go" data-act="pick-ride" data-id="${viewId}"><span>Race this car</span>${ARROW}</button>`}</div>`;
    }
    return `<div class="gar"><div id="sweep" aria-hidden="true"></div><div class="rotate-zone" id="car-rotate-zone" style="inset:16% 38% 24% 2%" aria-label="Drag to turn the car"></div>
<div class="gar-title" data-in><h1 class="nc-hero">Garage<i>/</i>${esc(view.name)}</h1></div>
<div class="gar-stats" data-in><div><b>${Math.round(fresh ? bench.topKmh : st.topKmh)}</b><small>km/h</small></div><div><b>${num(st.powerKw)}</b><small>kW</small></div><div><b>${st.pr}</b><small>Rating</small></div></div>
<div class="gar-rides" data-in>${rides}</div><aside class="nc-card sheet" data-in>${sheet}</aside></div>`;
  }

  // ---------- world ----------
  v_world() {
    const d = this.data, p = this.p, id = p.circuit, c = getCircuit(id), cs = p.circuits[id], t = this.trackFor(id), open = PG.circuitOpen(d, id), tab = this.worldTab, owned = PG.ownedRides(d);
    const done = {}; for (const x of CIRCUITS) done[x.id] = p.circuits[x.id].stars.length >= 6;
    let body, foot = '';
    if (tab === 'cups') {
      body = PG.CUPS.map(cup => { const rec = p.cups[cup.id], has = owned.includes(cup.ride), live = p.cup?.id === cup.id;
        return `<div class="cup"><b>${esc(cup.name)}</b><small>${esc(getRide(cup.ride).name)} · ${cup.rounds.length} rounds · ${AI_NAMES[cup.ai]} rivals${rec.best ? ` · Best P${rec.best}` : ''}</small>${has ? `<button type="button" class="nc-btn ${live ? 'lime' : ''} sm" data-act="${live ? 'cup-go' : 'cup-start'}" data-id="${cup.id}">${live ? `Round ${p.cup.round + 1}` : 'Enter'}</button>` : '<span class="nc-tag">Needs the car</span>'}</div>`; }).join('');
      if (p.cup) { const cup = PG.CUPS.find(x => x.id === p.cup.id), me = PG.cupTable(p.cup.points).find(r => r.code === 'YOU'); body += `<p class="pd-note">${esc(cup.name)}: round ${p.cup.round + 1} of ${cup.rounds.length} at ${esc(getCircuit(cup.rounds[p.cup.round]).name)}${me ? ` · ${me.pts} points` : ''}. <button type="button" class="nc-tag" data-act="cup-quit">Leave cup</button></p>`; }
      else body += '<p class="pd-note">Three rounds, points for every place, a prize for the podium.</p>';
    } else if (tab === 'school') {
      body = ACADEMY_DRILLS.map(dr => { const m = p.medals[dr.id] || 0;
        return `<div class="drill"><b>${esc(dr.title.replace(/^\d+ · /, ''))}<span class="medals" aria-label="${m} of 3 medals">${['B', 'S', 'G'].map((l, i) => `<span class="medal m${i + 1}${m > i ? ' on' : ''}">${l}</span>`).join('')}</span></b><small>${m >= 3 ? 'All three medals earned.' : esc(PG.DRILL_HINTS[dr.id][m])}${m < 3 ? ` · ${PG.MEDAL_PAY[m + 1] - PG.MEDAL_PAY[m]} credits` : ''}</small><button type="button" class="nc-btn ${m ? '' : 'lime'} sm" data-act="drill" data-id="${dr.id}">${m ? 'Again' : 'Start'}</button></div>`; }).join('') + '<p class="pd-note">Maela’s school runs in the Kestrel Sprint at Beacon Short.</p>';
    } else {
      const grades = t.segments.map((_, i) => PG.gradeFor(cs.sec[i])), S = this.game.S, ai = S.aiLevel || 'medium', laps = Number(S.raceLaps || 3);
      const tasks = PG.masteryTasks(id).map(x => `<div class="task${cs.stars.includes(x.id) ? ' on' : ''}"><i>★</i>${esc(x.text)}</div>`).join('');
      body = `<div class="pd-row">${this.miniMap(id, grades)}<div class="pd-col" style="gap:2px;flex:1">${tasks}</div></div>
<p class="pd-note">${open ? (grades.some(Boolean) ? 'Track colours are your grade in each section, from purple (best) to red.' : 'Set a valid lap to grade every section of this circuit.') : `Opens at driver level ${PG.CIRCUIT_LEVEL[id]}. Story events here are always open.`}</p>`;
      foot = `<button type="button" class="nc-go" data-act="mode" data-id="race"${open ? '' : ' disabled'}><span>Quick race</span>${ARROW}</button>
<div class="pd-row"><button type="button" class="nc-btn sm" style="flex:1" data-act="mode" data-id="timetrial"${open ? '' : ' disabled'}>Time trial</button><button type="button" class="nc-btn sm" style="flex:1" data-act="mode" data-id="practice"${open ? '' : ' disabled'}>Free drive</button></div>
<p class="pd-note">${laps} laps · ${AI_NAMES[ai]} rivals · a win pays ${Math.round(PG.PURSE[0] * PG.AI_PAY[ai] * laps / 3)}</p>`;
    }
    return `<div class="mapwrap">${this.harborMap({ active: id, pin: '', done })}
<div class="map-title" data-in><h2 class="nc-h">World<small>Lumen Harbor · ${PG.totalStars(d)} of 18 mastery stars</small></h2></div>
<aside class="nc-card sheet" data-in><div class="nc-seg" role="tablist">${[['circuit', 'Circuit'], ['cups', 'Cups'], ['school', 'School']].map(([k, l]) => `<button type="button" role="tab" data-act="world-tab" data-id="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>
<div class="sheet-body scroll">${tab === 'circuit' ? `<h2 class="nc-h">${esc(c.name)}<small>${(t.length / 1000).toFixed(2)} km · ${cs.best ? `Best ${fmtLap(cs.best)}` : 'No lap yet'} · ${cs.stars.length} of 6 stars</small></h2>` : ''}${body}</div><div class="sheet-foot">${foot}</div></aside></div>`;
  }

  // ---------- event ready ----------
  v_prep() {
    const g = this.game, d = this.data, p = this.p, r = this.ready || { kind: 'free', mode: g.pendingMode || 'practice' }, story = r.kind === 'story', sc = this.story;
    const m = story ? MISSIONS.find(x => x.id === r.id) : null, c = getCircuit(g.currentCircuitId), t = g.track, S = g.S, o = g.raceOverride, ride = getRide(g.baseRideId);
    const title = story ? m.title : o?.cup ? o.label.split(' · ')[0] : c.name;
    const type = story ? TYPES[m.type] : o?.cup ? o.label.split(' · ')[1] + ' · ' + c.name : r.mode === 'race' ? 'Grand Prix' : r.mode === 'timetrial' ? 'Time trial' : 'Free drive';
    const km = story && ['sprint', 'checkpoint'].includes(m.type) ? m.minDistance / 1000 : t.length / 1000;
    const count = story ? (['sprint', 'checkpoint'].includes(m.type) ? `${m.checkpoints} gates` : `${m.laps} lap${m.laps > 1 ? 's' : ''}${m.fieldSize > 1 ? ` · ${m.fieldSize - 1} rival${m.fieldSize > 2 ? 's' : ''}` : ''}`) : r.mode === 'race' ? `${o?.laps || S.raceLaps || 3} laps · 7 rivals` : r.mode === 'timetrial' ? '3 timed laps' : 'Free laps';
    const q = this.person(story ? m.before[m.before.length - 1] : RADIO[r.mode] || RADIO.practice);
    const setup = story ? `<div class="nc-seg" role="group" aria-label="Setup">${[['balanced', 'Balanced'], ['grip', 'Grip'], ['speed', 'Speed']].map(([v, l]) => `<button type="button" data-act="story-setup" data-id="${v}" aria-pressed="${sc.state.setup === v}">${l}</button>`).join('')}</div><div class="nc-seg" role="group" aria-label="Crew chief">${[['mentor', 'Maela · calm car'], ['engineer', 'Tavi · more aero']].map(([v, l]) => `<button type="button" data-act="story-crew" data-id="${v}" aria-pressed="${sc.state.crew === v}">${l}</button>`).join('')}</div>`
      : `<div class="nc-seg" role="group" aria-label="Setup">${[['Speed', -2], ['Balanced', 0], ['Grip', 2]].map(([l, v]) => `<button type="button" data-act="wing" data-id="${v}" aria-pressed="${p.tune[ride.id].wing === v}">${l}</button>`).join('')}</div>${r.mode === 'race' && !o?.cup ? `<div class="nc-seg" role="group" aria-label="Rivals">${['easy', 'medium', 'hard'].map(v => `<button type="button" data-act="ai" data-id="${v}" aria-pressed="${(S.aiLevel || 'medium') === v}">${AI_NAMES[v]}</button>`).join('')}</div>` : ''}`;
    return `<div class="ready"><div class="ready-left"><div class="pd-row" data-in><button type="button" class="nc-btn sm" data-act="ready-back" data-back>‹ Back</button><span class="nc-chip cy">${esc(type)}</span></div>
 <h1 class="nc-hero" data-in>${twoTone(title)}</h1>
 <div class="ready-facts" data-in>${this.miniMap(g.currentCircuitId)}<ul><li>${icon('i-flag')}${esc(story ? TYPES[m.type] : c.name)}</li><li>${icon('i-pin')}${km.toFixed(1)} km</li><li>${icon('i-gate')}${esc(count)}</li></ul></div></div>
<div class="radio" style="--c:${q.color}" data-in>${q.portrait}<b>${esc(q.name.split(' ')[0])}<span aria-hidden="true"><i></i><i></i><i></i><i></i></span></b><p>${esc(q.text)}</p></div>
<div class="ready-right"><div class="nc-card ridecard" data-in><small>Your ride</small><b>${esc(ride.name)}</b>${setup}</div>
 <div class="pd-row" data-in>${story ? `<button type="button" class="nc-btn" style="flex:1" data-act="ready-practice">${icon('i-cone')}Practice</button>` : ''}<button type="button" class="nc-btn" style="flex:1" data-act="assists">${icon('i-settings')}Assists</button></div>
 <button type="button" class="nc-go big shine" data-act="go" data-in><span>Let’s race</span>${ARROW}</button></div></div>`;
  }
  go() {
    const g = this.game, r = this.ready || { kind: 'free', mode: g.pendingMode || 'practice' }, label = r.kind === 'story' ? MISSIONS.find(x => x.id === r.id).title : getCircuit(g.currentCircuitId).name;
    if (this._going) return; this._going = true; setTimeout(() => { this._going = false; }, 1500);
    g.juice.tone('win');
    g.juice.shutter(() => {
      if (r.kind === 'story') g.storyCareer.begin(r.id);
      else { const ride = g.baseRideId; g.configureDrive(ride, g.currentCircuitId, PG.selectedCar(this.data, ride)); g.startRace(r.mode); }
    }, label);
  }

  // ---------- crew ----------
  v_team() {
    const p = this.p, sel = PG.CREW.find(c => c.id === this.viewCrew) || PG.CREW[0], info = id => STORY_CHARACTERS.find(c => c.id === id) || {};
    const cards = PG.CREW.map(c => { const lv = PG.bondLevel(p.bond[c.id]), prev = lv ? PG.BOND_STEPS[lv - 1] : 0, next = PG.BOND_STEPS[lv];
      return `<button type="button" class="crew" data-act="crew" data-id="${c.id}" aria-pressed="${c.id === sel.id}" style="--c:${info(c.id).color || '#dcff52'}" data-in><span class="ol-portrait ol-portrait-${c.id}" role="img" aria-label="${esc(c.name)}"></span><b>${esc(c.name)}</b><small>${esc(c.role)} · Bond ${lv} of 5</small><div class="pd-prog"><i style="--f:${next ? pct((p.bond[c.id] - prev) / (next - prev)) : '100%'}"></i></div></button>`; }).join('');
    const lv = PG.bondLevel(p.bond[sel.id]), ch = info(sel.id);
    const bios = BIO.map(([key, label], i) => (lv > i ? `<div class="bio"><b>${label}</b>${esc(ch[key] || '')}</div>` : `<div class="bio locked"><b>${label}</b>Unlocks at bond ${i + 1}</div>`)).join('');
    return `<div class="crewgrid"><div class="pd-col">${cards}<p class="pd-note" data-in>Your crew grows closer as you race. Each bond level makes their help stronger and opens more of their story.</p></div>
<div class="nc-card scroll" style="--c:${ch.color || '#dcff52'}" data-in><h2 class="nc-h">${esc(sel.name)}<small>${esc(sel.role)} · Bond ${lv} of 5</small></h2>
 <div class="obj on">${icon('i-star')}<span>${lv ? esc(sel.perk(lv)) : 'No bonus yet'}</span></div>
 ${lv < 5 ? `<p class="pd-note">Next: ${esc(sel.perk(lv + 1))}. ${esc(sel.name.split(' ')[0])} likes ${esc(sel.likes.toLowerCase())}.</p>` : '<p class="pd-note">Bond complete.</p>'}
 ${bios}<div class="pd-row"><button type="button" class="nc-btn sm" data-nav="story">Crew chapter: Light the Beacon</button></div></div></div>`;
  }

  // ---------- profile and trophies ----------
  v_records() {
    const d = this.data, p = this.p, lv = PG.levelFor(d.career.xp), f = PG.facts(d), team = this.team();
    const order = t => (t.done && !t.claimed ? 0 : t.claimed ? 2 : 1);
    const list = PG.trophyList(d).sort((a, b) => order(a) - order(b)).map(t => `<div class="troph${t.claimed ? ' claimed' : ''}"><div><b>${esc(t.name)}</b><small>${esc(t.text)}</small></div>${t.claimed ? '<span class="nc-tag">Collected</span>' : t.done ? `<button type="button" class="nc-btn buy sm" data-act="claim-trophy" data-id="${t.id}"><span class="nc-coin"></span>${num(t.cr)}</button>` : `<span class="nc-tag am">${num(t.cr)}</span>`}<div class="pd-prog"><i style="--f:${pct(t.have / t.goal)}"></i></div></div>`).join('');
    const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    const bests = CIRCUITS.map(c => `<div class="pd-row"><span>${esc(c.name)}</span><span class="sp"></span><span class="pd-num">${fmtLap(p.circuits[c.id].best)}</span>${stars(p.circuits[c.id].stars.length, 6)}</div>`).join('');
    const cups = PG.CUPS.map(c => `<div class="pd-row"><span>${esc(c.name)}</span><span class="sp"></span><span class="nc-tag ${p.cups[c.id].wins ? 'lime' : ''}">${p.cups[c.id].best ? `Best P${p.cups[c.id].best}` : 'Not entered'}</span></div>`).join('');
    return `<div class="profgrid"><div class="nc-card scroll" data-in><h2 class="nc-h">${esc(team.driver)}<small>Driver level ${lv.level} · ${lv.max ? 'top level' : `${num(lv.span - lv.into)} XP to level ${lv.level + 1}`}</small></h2>
 <div class="pd-prog"><i style="--f:${pct(lv.into / lv.span)}"></i></div>
 <div class="pd-row"><input type="text" id="driver-name" maxlength="12" value="${esc(team.driver)}" aria-label="Driver name" autocomplete="off"><input type="text" id="team-name" maxlength="24" value="${esc(team.name)}" aria-label="Team name" autocomplete="off"><input type="text" id="team-tag" maxlength="4" value="${esc(team.tag)}" aria-label="Team tag" style="width:66px" autocomplete="off"></div>
 <div class="stat-grid">${stat(num(f.validLaps), 'Valid laps')}${stat(num(f.races), 'Races')}${stat(num(f.wins), 'Wins')}${stat(num(f.podiums), 'Podiums')}${stat(num(f.km), 'Kilometres')}${stat(f.topKmh ? Math.round(f.topKmh) : '–', 'Top km/h')}</div>
 <span class="nc-k">Best laps</span>${bests}<span class="nc-k">Cups</span>${cups}</div>
<div class="nc-card scroll" data-in><h2 class="nc-h">Trophies<small>${p.trophies.length} of ${PG.TROPHIES.length} collected</small></h2>${list}</div></div>`;
  }

  // ---------- actions ----------
  act(name, el) {
    const g = this.game, d = this.data, p = this.p, id = el.dataset.id, before = PG.credits(d), j = g.juice, sc = this.story;
    const done = out => { this.save(); this.rerender(); this.wallet(before); if (out) this.celebrate(out); };
    switch (name) {
      case 'story-continue': { const m = nextMission(sc.state); sc.focusMission = m.id; sc.chapter = m.chapter; sc.result = null; g.navTo('career'); break; }
      case 'quick': this.launch('race'); break;
      case 'free': this.launch('practice'); break;
      case 'goals': this.goalsOpen = !this.goalsOpen; this.rerender(); if (this.goalsOpen) j.sheet(document.querySelector('.goals-pop')); break;
      case 'claim-goal': { const r = PG.claimGoal(d, id); if (r.ok) { j.pop(`+${r.cr}`, r.streak > 1 ? `${r.streak}-day streak` : 'Goal complete', 'coin'); done(); } break; }
      case 'claim-trophy': { const r = PG.claimTrophy(d, id); if (r.ok) { j.pop(`+${num(r.cr)}`, 'Trophy collected', 'win'); j.confetti(60); done(); } break; }
      case 'act': sc.chapter = Number(id) || 1; sc.focusMission = (MISSIONS.find(m => m.chapter === sc.chapter) || MISSIONS[0]).id; sc.result = null; this.rerender(); j.trace($('scr-career')); break;
      case 'event': sc.focusMission = id; sc.result = null; if (missionUnlocked(sc.state, id)) sc.change('select', { missionId: id }, true); this.rerender(); j.trace($('scr-career')); j.sheet(document.querySelector('#scr-career .sheet')); break;
      case 'story-start': case 'story-retry': sc.result = null; sc.start(id); break;
      case 'story-next': { sc.result = null; const m = nextMission(sc.state); sc.focusMission = m.id; sc.chapter = m.chapter; sc.change('select', { missionId: m.id }, true); this.rerender(); j.trace($('scr-career')); j.sheet(document.querySelector('#scr-career .sheet')); break; }
      case 'story-map': sc.result = null; this.rerender(); break;
      case 'story-setup': sc.change('setup', { setup: id }, true); this.rerender(); break;
      case 'story-crew': sc.change('crew', { choice: id }, true); this.rerender(); break;
      case 'map-circuit': if (g.screen === 'world') { if (p.circuit !== id) { p.circuit = id; this.worldTab = 'circuit'; this.save(); this.rerender(); j.trace($('scr-world')); j.sheet(document.querySelector('#scr-world .sheet')); } }
        else { const m = MISSIONS.find(x => x.trackId === id && missionUnlocked(sc.state, x.id) && !sc.state.records[x.id].completed) || MISSIONS.find(x => x.trackId === id); if (m) { sc.focusMission = m.id; sc.chapter = m.chapter; sc.result = null; this.rerender(); j.trace($('scr-career')); } } break;
      case 'world-tab': this.worldTab = id; this.rerender(); break;
      case 'gar-tab': this.garTab = id; this.rerender(); break;
      case 'paint': d.livery = id; this.save(); if (id === 'custom') g.renderer?.invalidateModel?.('custom'); g.renderer?.carModel(g.livery()); j.sweep(); this.rerender(); break;
      case 'view-ride': if (this.viewRide !== id) { this.viewRide = id; this.benchRun = null; this.rerender(); j.sweep(0.5); } break;
      case 'pick-ride': if (PG.selectRide(d, id)) { this.viewRide = id; j.tone('star'); done(); } break;
      case 'buy-ride': { const r = PG.buyRide(d, id); if (!r.ok) { this.toast(r.reason); break; } PG.selectRide(d, id); this.viewRide = id; j.pop(getRide(id).name, 'New car in your garage', 'win'); j.confetti(90); done(); break; }
      case 'upgrade': { const ride = this.viewRide || p.ride, r = PG.buyUpgrade(d, ride, id); if (!r.ok) { this.toast(r.reason); break; } j.tone('star'); j.sweep(); this.toast(`${PG.SYSTEMS.find(s => s.id === id).name} stage ${r.stage} fitted`); done(r); break; }
      case 'wing': { const ride = g.screen === 'garage' ? (this.viewRide || p.ride) : g.baseRideId; PG.setTune(d, ride, 'wing', Number(id)); this.save(); this.rerender(); break; }
      case 'ai': g.S.aiLevel = id; this.save(); this.rerender(); break;
      case 'bench': this.runBench(); break;
      case 'photo': g.openPhoto?.(); break;
      case 'mode': this.launch(id); break;
      case 'cup-start': { const r = PG.startCup(d, id); if (!r.ok) { this.toast(r.reason); break; } this.save(); this.launch('race', true); break; }
      case 'cup-go': this.launch('race', true); break;
      case 'cup-next': this.launch('race', true, true); break;
      case 'cup-quit': PG.quitCup(d); done(); break;
      case 'drill': this.startDrill(id); break;
      case 'crew': this.viewCrew = id; this.rerender(); j.sheet(document.querySelector('#scr-team .nc-card.scroll')); break;
      case 'ready-back': g.navTo(this.ready?.kind === 'story' ? 'career' : 'world'); break;
      case 'ready-practice': { const m = MISSIONS.find(x => x.id === this.ready?.id); if (m) { p.circuit = m.trackId; this.launch('practice', false, false, true); } break; }
      case 'assists': g.renderPrep(); $('prep-drawer').hidden = false; j.sheet($('prep-drawer')); break;
      case 'assists-close': $('prep-drawer').hidden = true; this.rerender(); break;
      case 'go': this.go(); break;
      case 'details': { const el2 = $('results-detail'); el2.hidden = !el2.hidden; if (!el2.hidden) j.sheet(el2); break; }
      case 'to-race': g.mode = 'menu'; g.clearRivals(); g.show('world'); break;
      default: break;
    }
  }
  input(el, commit = false) {
    const d = this.data, p = this.p, g = this.game;
    if (el.type === 'range') this.fillRange(el);
    if (el.dataset?.tune) { const ride = this.viewRide || p.ride; PG.setTune(d, ride, el.dataset.tune, Number(el.value)); const v = p.tune[ride][el.dataset.tune], out = $(`tune-${el.dataset.tune}-v`); if (out) out.textContent = (v > 0 ? '+' : '') + v; if (commit) this.save(); return; }
    if (el.dataset?.paint) { d.customLivery[el.dataset.paint] = el.value; d.livery = 'custom'; g.renderer?.invalidateModel?.('custom'); if (commit) { this.save(); g.juice.sweep(); } return; }
    if (['driver-name', 'team-name', 'team-tag'].includes(el.id)) { d.team = PG.normalizeTeam({ ...d.team, driver: $('driver-name')?.value, name: $('team-name')?.value, tag: $('team-tag')?.value }); if (commit) { this.save(); this.rerender(); } }
  }
  runBench() {
    if (this.benchBusy) return; this.benchBusy = true; this.rerender();
    setTimeout(() => {
      const d = this.data, ride = this.viewRide || this.p.ride;
      try {
        this.stockBench = this.stockBench || {};
        const stock = this.stockBench[ride] || (this.stockBench[ride] = benchCar(PG.buildCar(ride))), result = benchCar(PG.selectedCar(d, ride));
        this.benchRun = { ride, result, stock };
        const out = PG.recordBench(d, ride, result.metrics); this.save(); this.celebrate(out); this.game.juice.tone('star');
      } catch (e) { this.toast('The bench test could not finish. ' + e.message); }
      this.benchBusy = false; this.rerender(); this.game.juice.reveal(document.querySelectorAll('#scr-garage .met > div'));
    }, 60);
  }
  startDrill(id) { const g = this.game; if (!g.configureDrive('sprint', 'beacon_short', PG.buildCar('sprint'))) return; g.juice.shutter(() => g.startSchool(id), 'Driving school'); }
  onDrill(ev) {
    const out = PG.recordDrill(this.data, ev.drillId, ev.result || {}); this.save();
    const names = ['', 'Bronze', 'Silver', 'Gold'];
    if (out.medal > out.before) { this.game.juice.pop(`${names[out.medal]} medal`, out.cr ? `+${out.cr} credits` : '', 'win'); if (out.medal === 3) this.game.juice.confetti(70); }
    this.celebrate(out, true);
    return out.medal > out.before ? `${names[out.medal]} medal earned · +${out.cr} credits` : `${names[out.medal] || 'Bronze'} run. ${out.before >= 3 ? 'You already hold gold.' : PG.DRILL_HINTS[ev.drillId][Math.min(2, out.before)]}`;
  }
  // Crew bond and goal news after any action.
  celebrate(out, quiet = false) {
    const j = this.game.juice;
    for (const b of out.bonds || []) { const c = PG.CREW.find(x => x.id === b.id); setTimeout(() => j.pop(`${c.name.split(' ')[0]} · Bond ${b.level}`, c.perk(b.level), 'star'), quiet ? 1900 : 300); }
    for (const text of out.goalsDone || []) this.toast(`Goal complete: ${text}. Collect it on the home screen.`);
  }

  // ---------- starting races ----------
  launch(mode, cup = false, direct = false, anyCircuit = false) {
    const g = this.game, d = this.data, p = this.p;
    let ride = p.ride, circuit = p.circuit; g.raceOverride = null;
    if (cup && p.cup) { const c = PG.CUPS.find(x => x.id === p.cup.id); ride = c.ride; circuit = c.rounds[p.cup.round]; g.raceOverride = { cup: true, ai: c.ai, laps: c.laps, rivalStage: c.rivalStage, label: `${c.name} · Round ${p.cup.round + 1}` }; }
    else if (!anyCircuit && !PG.circuitOpen(d, circuit)) { circuit = 'beacon_short'; p.circuit = circuit; }
    if (!g.configureDrive(ride, circuit, PG.selectedCar(d, ride))) return;
    g.pendingMode = mode; this.ready = { kind: 'free', mode };
    if (!d.firstRunDone) { g.show('onboard'); return; }
    if (direct) g.startRace(mode); else g.show('prep');
  }
  // The upgrade stage rival cars run. Rivals never copy the player's car.
  rivalSetup(career) {
    const g = this.game, o = g.raceOverride, stage = career ? 0 : o ? o.rivalStage : PG.AI_STAGE[g.S.aiLevel || 'medium'] || 0;
    const car = PG.rivalCar(g.baseRideId, stage), c = getCircuit(g.currentCircuitId);
    return { car, track: new Track(c.track, c.world, car) };
  }

  // ---------- live session: section timing and race moments ----------
  sessionStart(mode, career) {
    const g = this.game, t = g.track, n = t.segments.length, ref = new Float64Array(n);
    for (let i = 0; i < t.n; i++) { const ds = (i + 1 < t.n ? t.s[i + 1] : t.length) - t.s[i]; ref[t.seg[i]] += ds / Math.max(1, t.lineSpeed[i]); }
    g.juice.clearMoments();
    this.session = { id: g.sessionId, mode, career: !!career, school: false, circuit: g.currentCircuitId, ride: g.baseRideId, n, ref, secT: new Float64Array(n), sections: new Array(n).fill(null),
      cleanLaps: 0, lapContacts: 0, contacts: 0, impact0: g.veh.impactCount || 0, carEpisodes: 0, carQuiet: 1, km: 0, top: 0, overtakes: 0, pos: null, posT: 0, slip: 0, slipShown: false,
      green: null, perfectStart: false, startChecked: false, levelBefore: PG.levelFor(this.data.career.xp).level };
  }
  sample(dt, raw) {
    const s = this.session, g = this.game, v = g.veh, race = g.race; if (!s || !race) return;
    const speed = Math.abs(v.forwardSpeed); s.km += speed * dt / 1000; if (speed * 3.6 > s.top) s.top = speed * 3.6;
    if (race.lapStart !== null && race.hint >= 0) s.secT[g.track.seg[race.hint]] += dt;
    const touching = !!v.carHits?.some(h => h.impulse > 0);
    if (touching) { if (s.carQuiet >= 0.25) s.carEpisodes++; s.carQuiet = 0; } else s.carQuiet += dt;
    s.contacts = Math.max(0, (v.impactCount || 0) - s.impact0) + s.carEpisodes;
    if (g.school || g.autopilot) return;
    const j = g.juice;
    if (g.field) {
      if (s.green === null) s.green = v.time;
      const since = v.time - s.green, me = g.field.entries[0];
      if (!s.startChecked && (raw?.throttle || 0) > 0.5) { s.startChecked = true; if (since < 0.45 && !g.assists().autoThrottle) { s.perfectStart = true; j.moment('Perfect start', '+25', 'cy'); } }
      if (since > 0.45) s.startChecked = true;
      if (s.pos === null) s.pos = me.pos;
      if (me.pos !== s.pos && since > 3 && !me.finished) {
        if (me.pos < s.pos && v.time - s.posT > 1.2) { s.overtakes += s.pos - me.pos; j.moment(`Overtake · P${me.pos}`, s.career ? '' : '+15', '', 'pass', 0.4); j.tone('star'); }
        s.posT = v.time; s.pos = me.pos;
      }
      if ((v.wake || 0) > 0.12 && speed > 25) { s.slip += dt; if (!s.slipShown && s.slip > 1.2) { s.slipShown = true; j.moment('Slipstream', '', 'pk'); } } else if (s.slipShown && (v.wake || 0) < 0.03) s.slipShown = false;
    }
  }
  onLap(lap) {
    const s = this.session; if (!s) return;
    if (lap.valid) {
      for (let i = 0; i < s.n; i++) if (s.secT[i] > 0.3 && s.ref[i] > 0) { const r = s.secT[i] / s.ref[i]; s.sections[i] = Math.min(s.sections[i] ?? Infinity, r); }
      if (s.contacts === s.lapContacts) { s.cleanLaps++; if (!this.game.school && !s.career) this.game.juice.moment('Clean lap', '', 'cy'); }
      if (lap.pb && !s.career) this.game.juice.moment('New best lap', '+60', 'pu', 'pb', 0);
    }
    s.lapContacts = s.contacts; s.secT.fill(0);
  }
  // Called once when a free-race session ends. Returns the reward breakdown and fills the results screen.
  sessionEnd(race, xp) {
    const s = this.session, g = this.game, host = $('results-rewards'); this.session = null;
    if ($('results-detail')) $('results-detail').hidden = true;
    if (!s || !race || s.career || s.school) { if (host) host.replaceChildren(); return null; }
    const me = g.field?.entries[0], laps = race.laps.filter(l => l.valid), o = g.raceOverride;
    const summary = { id: s.id, mode: race.mode, circuit: s.circuit, ride: s.ride, validLaps: laps.length, cleanLaps: s.cleanLaps, bestLap: laps.length ? Math.min(...laps.map(l => l.time)) : null,
      pb: race.laps.some(l => l.pb), finished: !!me?.finished, position: me?.pos, ai: o ? o.ai : g.S.aiLevel || 'medium', laps: race.targetLaps, contacts: s.contacts, km: s.km, topKmh: s.top,
      overtakes: s.overtakes, perfectStart: s.perfectStart, slipstream: s.slip, sections: s.sections, sectionCount: s.n, order: g.field ? g.field.order.map(e => (e.player ? 'YOU' : e.code)) : null, cup: !!o?.cup, xp, levelBefore: s.levelBefore };
    const before = PG.credits(this.data), out = PG.settleSession(this.data, summary); this.save();
    this.showRewards(out, before, summary);
    return out;
  }
  showRewards(out, before, summary) {
    const host = $('results-rewards'), j = this.game.juice; if (!host) return;
    const row = (cls, a, b) => `<div class="rw ${cls}"><span>${a}</span>${b !== undefined ? `<b>${b}</b>` : ''}</div>`;
    let html = out.lines.map(l => row('', esc(l.label), `+${num(l.cr)}`)).join('');
    if (out.cr) html += row('total', 'Credits', '<span class="pd-wallet-sum">0</span>');
    for (const s of out.stars) html += row('note', `★ ${esc(s)}`);
    for (const t of out.goalsDone) html += row('note cy', `Goal complete: ${esc(t)}`);
    if (out.xpBonus) html += row('note cy', `Neri’s coaching: +${out.xpBonus} XP`);
    if (out.cup) {
      html += `<div class="rw note"><span>${esc(out.cup.name)} · ${out.cup.done ? `finished P${out.cup.rank} overall` : `after round ${out.cup.round} of ${out.cup.rounds}`}</span></div><div class="cup-table rw">${out.cup.table.map((r, k) => `<span class="${r.code === 'YOU' ? 'me' : ''}">${k + 1}</span><span class="${r.code === 'YOU' ? 'me' : ''}">${esc(r.code)}</span><span class="pd-num ${r.code === 'YOU' ? 'me' : ''}">${r.pts}</span>`).join('')}</div>`;
      if (!out.cup.done) html += '<div class="pd-row rw" style="border:0"><button type="button" class="nc-btn lime" data-act="cup-next">Next round</button></div>';
    }
    host.innerHTML = html;
    if ($('btn-retry')) $('btn-retry').hidden = !!out.cup;
    j.reveal(host.querySelectorAll('.rw'));
    setTimeout(() => j.count(host.querySelector('.pd-wallet-sum'), out.cr, 600), 200);
    if (out.cr) j.tone('coin');
    const podium = summary.finished && summary.position <= 3;
    if (podium) { j.confetti(summary.position === 1 ? 150 : 80); j.tone('win'); }
    if (out.levelUp) setTimeout(() => j.pop(`Level ${out.levelUp}`, 'Driver level up', 'win'), 900);
    else if (out.cup?.done && out.cup.rank === 1) setTimeout(() => { j.pop('Champion', out.cup.name, 'win'); j.confetti(160); }, 900);
    else if (out.stars.length) setTimeout(() => j.pop(`${out.stars.length} mastery star${out.stars.length > 1 ? 's' : ''}`, getCircuit(summary.circuit).name, 'star'), 900);
    this.celebrate({ bonds: out.bonds }, true);
  }
  // Story Tour results feed XP, goals and crew bonds too.
  onStory(result) { const out = PG.recordStory(this.data, result); this.save(); this.celebrate(out, true); return out; }
}
