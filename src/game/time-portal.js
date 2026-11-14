import { HISTORY_CATALOGUE, HISTORY_ERAS, HISTORY_RULES_2026 } from '../sim/history-data.js';
import { HISTORY_RIDES } from '../sim/history-rides.js';
import { HISTORY_VENUES, historyCircuit } from '../sim/history-circuits.js';
import { benchCar } from '../sim/lab.js';
import { ASSIST_PRESETS } from '../sim/assists.js';

const cars = Object.values(HISTORY_RIDES).sort((a, b) => a.history.year - b.history.year);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const option = (value, title) => `<option value="${esc(value)}">${esc(title)}</option>`;
const modeNames = { drive: 'Free historical drive', career: 'History career', era: 'Same-era exhibition', mixed: 'Multiverse race', balance: 'Balanced multiverse race' };
const styles = ['Arcade', 'Simcade', 'Simulation'];
const setups = { standard:'Standard', shorter:'Shorter final drive', braking:'Forward brake bias', wing:'More wing' };
const sourceLink = (url, label) => /^https:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '';

// Fictional equalization. Shared target power-to-mass, tyre grip, braking and aero
// narrow the spread, while chassis layout, response and gearbox stay specific to the car.
export function portalBalance(car) {
  const peak = Math.max(...car.engine.curve.map(([rpm, torque]) => rpm * torque * Math.PI / 30));
  const electric = car.history.tech.hybrid?.deployKW ?? 0;
  const powerFactor = (car.mass * 450 - electric * 300) / peak;
  return {
    ...car,
    engine: { ...car.engine, curve: car.engine.curve.map(([rpm, torque]) => [rpm, torque * powerFactor]) },
    tire: { ...car.tire, mu: 1.50 },
    aero: { ...car.aero, cdA: .92, clA: 1.55 },
    brakes: { ...car.brakes, maxTorque: car.mass * car.wheelRadius * 15 },
  };
}

const specLabels = { enginePlacement: 'Engine placement', engineLayout: 'Engine layout', displacementCc: 'Displacement (cc)', nominalDisplacementL: 'Nominal displacement (L)', aspiration: 'Induction', power: 'Documented power', rpmLimit: 'RPM limit', transmission: 'Transmission', gears: 'Gears', massKg: 'Mass (kg)', tyreType: 'Tyres', aero: 'Aerodynamics', brakes: 'Brakes', suspension: 'Suspension', energy: 'Energy' };

function archiveEntry(entry) {
  const specs = Object.entries(specLabels).filter(([key]) => ['number','string'].includes(typeof entry.historicalSpecs?.[key]));
  return `<section class="tp-entry"><span class="tp-kicker">HISTORICAL REFERENCE</span><h3>${esc(entry.name)}</h3><p>${esc(entry.summary)}</p><p>${esc(entry.formula)} · ${esc(entry.competition)}</p>
    ${specs.length ? `<dl class="tp-specs">${specs.map(([key, title]) => `<dt>${title}</dt><dd>${esc(entry.historicalSpecs[key])}</dd>`).join('')}</dl>` : ''}
    <p class="tp-note">${esc(entry.confidence)}</p>${sourceLink(entry.source, entry.sourceLabel || 'Historical source')} ${sourceLink(entry.seasonSource, 'Official season results')} ${(entry.additionalSources || []).map(link => typeof link === 'string' ? sourceLink(link, 'Additional source') : sourceLink(link.url, link.label || link.title || 'Additional source')).join(' ')}</section>`;
}

export class TimePortal {
  constructor(game) {
    this.game = game;
    this.year = 1950;
    this.view = 'museum';
    this.selected = cars[0].id;
    this.comparison = cars.at(-1).id;
    this.venue = HISTORY_VENUES[0].id;
    this.condition = 'dry';
    this.style = 'Arcade';
    this.setup = 'standard';
    this.bench = new Map();
    this.session = null;
    $('toast').insertAdjacentHTML('beforebegin', `<section id="scr-time-portal" class="screen" aria-labelledby="tp-heading">
      <div class="tp-shell">
        <header class="tp-header"><div><span class="tp-kicker">VELOCITYVERSE / HISTORICAL MOTORSPORT</span><h1 id="tp-heading">Time <em>Portal</em></h1></div>
        <nav aria-label="Time Portal navigation"><button class="nc-btn sm" data-nav="garage" data-back type="button">Garage</button><button class="nc-btn sm" data-nav="world" type="button">World</button></nav></header>
        <nav class="tp-tabs" aria-label="Historical activities"><button data-tp-view="museum" type="button">Museum</button><button data-tp-view="drive" type="button">Drive &amp; race</button><button data-tp-view="career" type="button">History career</button><button data-tp-view="bench" type="button">Engineering bench</button></nav>
        <div id="tp-content" class="tp-content"></div>
      </div>
    </section>
    <aside id="tp-hud" class="tp-hud" hidden aria-label="Historical vehicle instruments"><div id="tp-readout"></div><div class="tp-controls"><button id="tp-boost" type="button" aria-pressed="true">Deploy</button><button id="tp-wing" type="button" aria-pressed="true">Straight aero</button><button id="tp-universal" type="button" aria-pressed="false">Hide era HUD</button></div></aside>`);
    $('scr-time-portal').addEventListener('click', event => this.click(event));
    $('scr-time-portal').addEventListener('change', event => this.change(event.target));
    $('tp-boost').addEventListener('click', () => this.toggle('deploy'));
    $('tp-wing').addEventListener('click', () => this.toggle('straight'));
    $('tp-universal').addEventListener('click', () => this.toggle('instruments'));
  }

  state() {
    const save = this.game.save.data;
    if (!save.timePortal) save.timePortal = { completed: [] };
    return save.timePortal;
  }

  render() {
    document.querySelectorAll('[data-tp-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tpView === this.view)));
    const renderers = { museum: () => this.museum(), drive: () => this.driving(), career: () => this.career(), bench: () => this.lab() };
    $('tp-content').innerHTML = renderers[this.view]();
  }

  museum() {
    const era = HISTORY_ERAS.find(item => this.year >= item.from && this.year <= item.to) || HISTORY_ERAS[0];
    const entries = HISTORY_CATALOGUE.filter(entry => this.year === 1947 ? entry.year < 1950 : entry.year === this.year);
    const playable = cars.filter(car => car.history.year === this.year);
    return `<div class="tp-columns"><aside class="tp-panel"><h2>Engineering timeline</h2><div class="tp-era-list">${HISTORY_ERAS.map(item => `<button type="button" data-tp-era="${esc(item.id)}" aria-pressed="${era.id === item.id}"><span>${item.from}${item.from === item.to ? '' : '–' + item.to}</span>${esc(item.title)}</button>`).join('')}</div></aside>
      <article class="tp-panel"><label for="tp-year">Championship year</label><select id="tp-year" data-tp-field="year">${option(1947, '1947–1949 / Origins')}${Array.from({length:77}, (_, index) => option(index + 1950, index + 1950)).join('')}</select>
      <h2 class="tp-year">${this.year === 1947 ? '1947–1949' : this.year}</h2><h3>${esc(era.title)}</h3><p>${esc(era.summary)}</p>
      ${sourceLink(era.source, 'Era overview')}${entries.map(archiveEntry).join('')}
      ${this.year === 2026 ? `<section class="tp-entry"><h3>2026 rulebook</h3>${HISTORY_RULES_2026.facts.map(fact => `<p>${esc(fact)}</p>`).join('')}${HISTORY_RULES_2026.sources.map((source, index) => sourceLink(source, ['FIA Technical Regulations','FIA Sporting Regulations','Formula 1 terminology'][index])).join(' ')}</section>` : ''}
      ${playable.length ? playable.map(car => `<section class="tp-entry"><span class="tp-kicker">DRIVABLE SIMULATION</span><h3>${esc(car.name)}</h3><p>${esc(car.history.focus)}</p><button class="nc-go" type="button" data-tp-pick="${car.id}">Drive ${esc(car.name)}</button></section>`).join('') : '<p class="tp-note">Historical archive. Choose Drive &amp; race for the playable collection.</p>'}
      <p class="tp-note">Selected season entries adapted from F1DB v2026.20.0 by Marcel Overdijk and contributors. ${sourceLink('https://github.com/f1db/f1db/releases/tag/v2026.20.0','Data attribution')} ${sourceLink('https://creativecommons.org/licenses/by/4.0/','CC BY 4.0')}</p></article></div>`;
  }

  carOptions() { return cars.map(car => option(car.id, `${car.history.year} · ${car.name}`)).join(''); }

  configured(car) {
    if (this.setup === 'shorter') return { ...car, gearbox: { ...car.gearbox, final: car.gearbox.final * 1.06 } };
    if (this.setup === 'braking') return { ...car, brakes: { ...car.brakes, bias: car.brakes.bias + .025 } };
    if (this.setup === 'wing' && car.aero.clA > .2) return { ...car, aero: { ...car.aero, clA: car.aero.clA * 1.10, cdA: car.aero.cdA * 1.07 } };
    return car;
  }

  controls() {
    return `<div class="tp-fields"><label>Circuit<select data-tp-field="venue">${HISTORY_VENUES.map(venue => option(venue.id, venue.name)).join('')}</select></label>
      <label>Surface<select data-tp-field="condition">${option('dry','Dry')}${option('damp','Damp')}${option('rain','Heavy rain')}</select></label>
      <label>Handling<select data-tp-field="style">${styles.map(style => option(style, style)).join('')}</select></label></div>`;
  }

  driving() {
    const car = HISTORY_RIDES[this.selected];
    return `<div class="tp-columns"><article class="tp-panel"><label>Choose your car<select data-tp-field="selected">${this.carOptions()}</select></label>
      <h2 class="tp-year">${car.history.year}</h2><h3>${esc(car.name)}</h3><p>${esc(car.history.focus)}</p>
      <dl class="tp-specs"><dt>Architecture</dt><dd>${esc(car.history.layout)}</dd><dt>Tyres</dt><dd>${esc(car.history.tyres)}</dd><dt>Transmission</dt><dd>${esc(car.history.transmission)}</dd><dt>Simulation mass</dt><dd>${car.mass} kg</dd><dt>Simulation downforce area</dt><dd>${car.aero.clA.toFixed(2)} m²</dd></dl>
      <p class="tp-note">Original car inspired by ${esc(car.history.historicalReference)}. Displayed masses, force coefficients and setup values tune the game.</p>${sourceLink(car.history.source,'Read about the historical reference')}
      <label>Period setup<select data-tp-field="setup">${Object.entries(setups).filter(([key]) => key !== 'wing' || car.aero.clA > .2).map(([key, label]) => option(key, label)).join('')}</select></label>
      <div class="tp-actions"><button class="nc-btn" type="button" data-tp-action="inspect">Inspect in photo mode</button><button class="nc-btn" type="button" data-tp-action="bench">Compare on the bench</button></div></article>
      <article class="tp-panel"><h2>Choose a session</h2>${this.controls()}<p class="tp-note">${esc(HISTORY_VENUES.find(venue => venue.id === this.venue)?.description)} These are original courses. Damp and rain affect grip in Time Portal sessions.</p>
      <label>Cross-era opponent<select data-tp-field="comparison">${this.carOptions()}</select></label>
      <div class="tp-actions"><button class="nc-go" type="button" data-tp-launch="drive">Free historical drive</button><button class="nc-btn" type="button" data-tp-launch="era">Same-era exhibition</button><button class="nc-btn" type="button" data-tp-launch="mixed">Race across eras</button><button class="nc-btn" type="button" data-tp-launch="balance">Balanced race</button></div>
      <p class="tp-note">Exhibitions are three laps against five AI drivers. The balanced option uses fictional power, grip, braking and aero targets. Arcade uses Rookie assists, Simcade uses Racer assists, and Simulation uses Pro controls.</p></article></div>`;
  }

  career() {
    const {completed} = this.state();
    return `<div class="tp-panel"><h2>Race through ${cars.length} chapters</h2><p>Bring back one valid timed lap to complete a chapter and open the next. Use any handling preset. Free historical drive is open for all cars.</p>${this.controls()}
      <div class="tp-chapters">${cars.map((car, index) => `<article class="tp-entry"><span class="tp-kicker">${car.history.year} / ${completed.includes(car.id) ? 'COMPLETE' : index <= completed.length ? 'AVAILABLE' : 'LOCKED'}</span><h3>${esc(car.name)}</h3><p>${esc(car.history.focus)}</p><button class="nc-btn" type="button" data-tp-chapter="${car.id}" ${index > completed.length ? 'disabled' : ''}>${completed.includes(car.id) ? 'Revisit' : 'Start chapter'}</button></article>`).join('')}</div></div>`;
  }

  lab() {
    return `<div class="tp-panel"><h2>Compare two generations</h2><div class="tp-fields"><label>First car<select data-tp-field="selected">${this.carOptions()}</select></label><label>Second car<select data-tp-field="comparison">${this.carOptions()}</select></label></div><p>Measure 0–100 km/h, stopping distance from 100 km/h, and top speed using the same simulation as the race. Tests use dry asphalt, automatic shifts and driving assists.</p>
      <button class="nc-go" type="button" data-tp-action="measure">Run comparison</button><div id="tp-metrics" role="status"></div></div>`;
  }

  syncFields() {
    document.querySelectorAll('#scr-time-portal [data-tp-field]').forEach(field => { field.value = String(this[field.dataset.tpField]); });
  }

  open() { this.render(); this.syncFields(); }

  click(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const data = button.dataset;
    if (data.tpView) { this.view = data.tpView; this.open(); }
    if (data.tpEra) { this.year = HISTORY_ERAS.find(era => era.id === data.tpEra)?.from ?? 1950; this.open(); }
    if (data.tpPick) { this.selected = data.tpPick; this.view = 'drive'; this.open(); }
    if (data.tpLaunch) this.launch(data.tpLaunch);
    if (data.tpChapter) this.launch('career', data.tpChapter);
    if (data.tpAction === 'bench') { this.view = 'bench'; this.open(); }
    if (data.tpAction === 'measure') this.measure();
    if (data.tpAction === 'inspect') this.inspect();
  }

  change(field) {
    const key = field.dataset.tpField;
    if (!key) return;
    this[key] = key === 'year' ? Number(field.value) : field.value;
    if (key === 'selected' && this.setup === 'wing' && HISTORY_RIDES[this.selected].aero.clA <= .2) this.setup = 'standard';
    if (key === 'year' || key === 'selected' || key === 'venue') this.open();
  }

  measure() {
    const host = $('tp-metrics');
    host.textContent = 'Running the shared vehicle simulation…';
    const ids = [this.selected, this.comparison];
    const firstCar = this.configured(HISTORY_RIDES[this.selected]);
    const setup = this.setup;
    requestAnimationFrame(() => setTimeout(() => {
      try {
        host.innerHTML = `<table><thead><tr><th>Car</th><th>0–100 km/h</th><th>100–0 km/h</th><th>Top speed</th></tr></thead><tbody>${ids.map((id, index) => {
          const car = index ? HISTORY_RIDES[id] : firstCar;
          const label = index ? 'standard' : setup;
          const key = `${id}:${label}`;
          if (!this.bench.has(key)) this.bench.set(key, benchCar(car).metrics);
          const metrics = this.bench.get(key);
          return `<tr><th>${car.history.year} ${esc(car.name)} <small>${setups[label]}</small></th><td>${metrics.accel.toFixed(2)} s</td><td>${metrics.brake.toFixed(1)} m</td><td>${metrics.topKmh.toFixed(0)} km/h</td></tr>`;
        }).join('')}</tbody></table><p class="tp-note">Simulation results for original vehicles under this test protocol.</p>`;
      } catch (error) { host.textContent = `Comparison unavailable. ${error.message}`; }
    }, 0));
  }

  inspect() {
    const game = this.game;
    const car = HISTORY_RIDES[this.selected];
    const preview = historyCircuit(this.venue);
    if (game.configureDrive(car.id, this.venue, this.configured(car), preview)) game.openPhoto();
  }

  launch(mode, id = this.selected) {
    const game = this.game;
    const chosen = HISTORY_RIDES[id];
    if (!chosen || !modeNames[mode]) return;
    if (mode === 'career' && cars.indexOf(chosen) > this.state().completed.length) return;
    game.campaign.leaveDrive();
    game.storyCareer.abort();
    game.careerMission = null;
    game.raceOverride = null;
    const circuit = historyCircuit(this.venue, this.condition);
    const mixed = mode === 'mixed' || mode === 'balance';
    const player = mode === 'balance' ? portalBalance(chosen) : mode === 'drive' || mode === 'mixed' ? this.configured(chosen) : chosen;
    const opponent = mixed ? HISTORY_RIDES[this.comparison] : chosen;
    const rival = mode === 'balance' ? portalBalance(opponent) : opponent;
    if (!game.configureDrive(id, circuit.id, player, circuit)) return;
    const preset = ASSIST_PRESETS[{ Arcade:'rookie', Simcade:'racer', Simulation:'pro' }[this.style]];
    const assists = this.style === 'Arcade' && chosen.history.year <= 1954 ? { ...preset, speedScale: .52 + .26 * circuit.world.surfaces.asphalt.mu } : preset;
    this.session = { mode, id, circuit, rival, assists, condition: this.condition, deploy: true, straight: true, instruments: true, settled: false };
    game.startRace(['era', 'mixed', 'balance'].includes(mode) ? 'race' : 'practice');
    game.coach(chosen.history.focus, 8);
  }

  toggle(key) {
    if (!this.session || this.game.paused) return;
    this.session[key] = !this.session[key];
    this.updateHud();
  }

  updateHud() {
    const game = this.game, session = this.session, car = game.veh.car;
    const show = session && game.mode === 'race' && !game.paused;
    $('tp-hud').hidden = !show;
    if (!show) return;
    const tech = car.history.tech;
    $('tp-boost').hidden = !tech.hybrid;
    $('tp-wing').hidden = !tech.activeAero;
    $('tp-boost').textContent = 'Deploy · B';
    $('tp-wing').textContent = 'Straight aero · V';
    $('tp-boost').setAttribute('aria-pressed', String(session.deploy));
    $('tp-wing').setAttribute('aria-pressed', String(session.straight));
    $('tp-universal').setAttribute('aria-pressed', String(!session.instruments));
    $('tp-universal').textContent = session.instruments ? 'Hide era HUD' : 'Show era HUD';
    const readout = $('tp-readout');
    readout.hidden = !session.instruments;
    readout.classList.toggle('tp-analog', car.history.year < 1990);
    const vehicle = game.veh;
    const status = [tech.turbo && `Boost ${Math.round(vehicle.turboSpool * 100)}%`, tech.ground && `Floor ${Math.round(vehicle.floorEfficiency * 100)}%`, tech.fan && `Fan ${Math.round(vehicle.fanSpeed * 100)}%`, tech.hybrid && `Battery ${Math.round(vehicle.energyKJ / tech.hybrid.capacityKJ * 100)}% · ${vehicle.electricKW < 0 ? 'recharge' : 'deploy'} ${Math.round(Math.abs(vehicle.electricKW))} kW`, tech.activeAero && (vehicle.straightMode ? 'Straight Mode' : 'Corner Mode')].filter(Boolean);
    readout.textContent = `${car.history.year} · ${Math.round(vehicle.rpm)} rpm · Gear ${vehicle.gear}${status.length ? ' · ' + status.join(' · ') : ''}`;
  }

  finish() {
    const session = this.session, game = this.game;
    if (!session || session.settled) return;
    session.settled = true;
    const state = this.state();
    const valid = game.race.laps.filter(lap => lap.valid).length;
    const next = cars[state.completed.length];
    const newChapter = session.mode === 'career' && valid > 0 && next?.id === session.id;
    if (newChapter) state.completed.push(session.id);
    const saved = !newChapter || game.save.save();
    $('results-eyebrow').textContent = `${modeNames[session.mode]} · ${session.circuit.name}`;
    $('results-progression').textContent = newChapter ? `${saved ? 'Chapter completed' : 'Chapter completed for this session'} · ${state.completed.length}/${cars.length} chapters` : `${valid} valid timed lap${valid === 1 ? '' : 's'} · Time Portal`;
    $('results-rewards').replaceChildren();
    $('results-detail').hidden = true;
    $('btn-retry').hidden = false;
  }
}
