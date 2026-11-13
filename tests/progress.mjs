// Progression rules: upgrades and setups change the real car, rewards come only from real results,
// each session pays once, saves migrate, and tampered values are clamped.
import assert from 'node:assert/strict';
import * as P from '../src/game/progress.js';
import { benchCar } from '../src/sim/lab.js';
import { MISSIONS, defaultStoryCareer } from '../src/game/career-mode.js';

const fresh = () => ({ career: { xp: 0, validLaps: 0, completedRaces: 0, podiums: 0, school: {} }, storyCareer: defaultStoryCareer() });
let checks = 0; const ok = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
const DAY = '2026-11-11';

ok('a new driver starts in the Kestrel Sprint at Beacon Short with 200 credits', () => {
  const d = fresh(), p = P.progressOf(d);
  assert.equal(p.ride, 'sprint'); assert.equal(p.circuit, 'beacon_short'); assert.deepEqual(P.ownedRides(d), ['sprint']); assert.equal(P.credits(d), 200);
  assert.ok(P.circuitOpen(d, 'beacon_short') && !P.circuitOpen(d, 'harbor_loop'));
});
ok('an existing 0.7 save keeps the VX-1, Harbor Loop, workshop parts and school passes', () => {
  const d = fresh(); d.career = { xp: 300, validLaps: 4, completedRaces: 1, podiums: 1, school: { launch: true } }; d.storyCareer.parts = { grip: 2, aero: 1, gearing: 0 };
  const p = P.progressOf(d);
  assert.ok(P.ownedRides(d).includes('vx1') && p.ride === 'vx1' && p.circuit === 'harbor_loop' && P.circuitOpen(d, 'harbor_loop'));
  assert.equal(p.up.vx1.tires, 2); assert.equal(p.up.vx1.aero, 1); assert.equal(p.medals.launch, 1); assert.equal(p.stats.validLaps, 4);
});
ok('every upgrade system changes the physical car in the right direction', () => {
  const base = P.buildCar('vx1');
  const e = P.buildCar('vx1', { engine: 3 }), t = P.buildCar('vx1', { tires: 3 }), a = P.buildCar('vx1', { aero: 3 }), w = P.buildCar('vx1', { weight: 3 });
  assert.ok(e.engine.curve[3][1] > base.engine.curve[3][1] * 1.14 && e.gearbox.shiftTime < base.gearbox.shiftTime);
  assert.ok(t.tire.mu > base.tire.mu * 1.05); assert.ok(a.aero.clA > base.aero.clA * 1.2 && a.aero.cdA > base.aero.cdA); assert.ok(w.mass < base.mass * 0.92);
  assert.ok(P.carStats(P.rivalCar('vx1', 3)).pr > P.carStats(base).pr + 80);
});
ok('the bench measures what upgrades and wing really do', () => {
  const stock = benchCar(P.buildCar('vx1')).metrics, tires = benchCar(P.buildCar('vx1', { tires: 3 })).metrics, low = benchCar(P.buildCar('vx1', {}, { wing: -3 })).metrics, high = benchCar(P.buildCar('vx1', {}, { wing: 3 })).metrics;
  assert.ok(tires.brake < stock.brake - 0.5 && tires.accel < stock.accel - 0.1, 'stage 3 tyres stop and launch better');
  assert.ok(low.topKmh > stock.topKmh + 5 && high.topKmh < stock.topKmh - 5, 'wing trades top speed for grip');
});
ok('a powerful car launches cleanly at every powertrain stage (no gear hunting)', () => {
  for (const stage of [0, 1, 2, 3]) { const m = benchCar(P.buildCar('vanta_gt', { engine: stage })).metrics; assert.ok(m.accel < 4.2, `Vanta GT stage ${stage}: 0-100 in ${m.accel.toFixed(2)} s`); }
});
ok('buying needs credits, spends them once and Tavi’s bond lowers prices', () => {
  const d = fresh(); assert.equal(P.buyUpgrade(d, 'sprint', 'tires').ok, false);
  d.storyCareer.credits = 5000; const cost = P.upgradeCost(d, 'sprint', 'tires'), r = P.buyUpgrade(d, 'sprint', 'tires');
  assert.ok(r.ok && r.cost === cost && P.credits(d) === 5000 - cost && P.progressOf(d).up.sprint.tires === 1);
  assert.equal(P.buyUpgrade(d, 'vx1', 'tires').ok, false, 'cannot upgrade a car you do not own');
  const before = P.upgradeCost(d, 'sprint', 'aero'); P.progressOf(d).bond.tavi = 200; assert.ok(P.upgradeCost(d, 'sprint', 'aero') < before);
  for (let i = 0; i < 5; i++) P.buyUpgrade(d, 'sprint', 'tires'); assert.equal(P.progressOf(d).up.sprint.tires, P.MAX_STAGE);
});
ok('cars are bought with credits at the right level, or won in the story', () => {
  const d = fresh(); d.storyCareer.credits = 9000; assert.equal(P.buyRide(d, 'vx1').ok, false, 'level gate');
  d.career.xp = 2000; assert.ok(P.buyRide(d, 'vx1').ok && P.ownedRides(d).includes('vx1') && P.credits(d) === 9000 - P.RIDE_SHOP.vx1.price);
  const s = fresh(); s.storyCareer.records = { 'safe-passage': { completed: true, stars: 1 } }; assert.ok(P.ownedRides(s).includes('vanta_gt'));
});
ok('a race session pays once, from the real result', () => {
  const d = fresh(), sum = { id: 's1', mode: 'race', circuit: 'beacon_short', ride: 'sprint', validLaps: 3, cleanLaps: 3, bestLap: 30.5, finished: true, position: 1, ai: 'easy', laps: 3, contacts: 0, km: 2.5, topKmh: 165, overtakes: 5, perfectStart: true, slipstream: 6, sections: Array(8).fill(1.1), sectionCount: 8, xp: 150, levelBefore: 1 };
  const before = P.credits(d), out = P.settleSession(d, sum, DAY);
  assert.ok(out.cr > 300 && P.credits(d) === before + out.cr); assert.ok(out.lines.some(l => /Finished P1/.test(l.label)) && out.lines.some(l => /Clean race/.test(l.label)) && out.lines.some(l => /overtake/.test(l.label)));
  assert.equal(out.stars.length, 5, 'lap, three lap targets, win and sections'); assert.equal(P.totalStars(d), 5); assert.equal(P.progressOf(d).stats.wins, 1);
  const again = P.settleSession(d, sum, DAY); assert.ok(again.already && again.cr === 0 && P.credits(d) === before + out.cr, 'the same session never pays twice');
  const dnf = P.settleSession(d, { ...sum, id: 's2', finished: false, position: 8, validLaps: 0, pb: false, sections: [] }, DAY); assert.equal(dnf.cr, 0, 'an unfinished race pays nothing');
});
ok('section grades come from pace against the car’s own limit', () => {
  assert.equal(P.gradeFor(1.03), 'S'); assert.equal(P.gradeFor(1.1), 'A'); assert.equal(P.gradeFor(1.2), 'B'); assert.equal(P.gradeFor(1.3), 'C'); assert.equal(P.gradeFor(1.6), 'D'); assert.equal(P.gradeFor(null), null);
});
ok('daily goals are three different tasks, progress from play and pay once with a streak bonus', () => {
  const d = fresh(), goals = P.goalList(d, DAY); assert.equal(goals.length, 3); assert.equal(new Set(goals.map(g => g.stat)).size, 3);
  assert.deepEqual(P.goalList(d, DAY).map(g => g.id), goals.map(g => g.id), 'stable within a day');
  const p = P.progressOf(d); p.goals = { day: DAY, ids: ['race', 'laps3', 'pb'], prog: {}, claimed: [] };
  P.settleSession(d, { id: 'g1', mode: 'race', circuit: 'beacon_short', validLaps: 3, finished: true, position: 4, ai: 'easy', laps: 3, contacts: 2 }, DAY);
  const after = P.goalList(d, DAY); assert.ok(after.find(g => g.id === 'race').done && after.find(g => g.id === 'laps3').done && !after.find(g => g.id === 'pb').done);
  const c0 = P.credits(d), r = P.claimGoal(d, 'race', DAY); assert.ok(r.ok && P.credits(d) === c0 + r.cr && r.streak === 1); assert.equal(P.claimGoal(d, 'race', DAY).ok, false); assert.equal(P.claimGoal(d, 'pb', DAY).ok, false);
  p.goals = { day: '2026-11-12', ids: ['race', 'laps3', 'pb'], prog: { race: 1 }, claimed: [] }; const next = P.claimGoal(d, 'race', '2026-11-12'); assert.ok(next.ok && next.streak === 2 && next.cr > r.cr, 'day two pays the streak bonus');
});
ok('crew bonds grow from what each person cares about and change real numbers', () => {
  const d = fresh(); d.storyCareer.credits = 99999;
  for (let i = 0; i < 4; i++) P.settleSession(d, { id: 'b' + i, mode: 'race', circuit: 'beacon_short', validLaps: 3, cleanLaps: 3, finished: true, position: 1, ai: 'easy', laps: 3, contacts: 0, overtakes: 5, xp: 100 }, DAY);
  const p = P.progressOf(d); assert.ok(P.bondLevel(p.bond.neri) >= 2 && P.bondLevel(p.bond.maela) >= 2, JSON.stringify(p.bond));
  const out = P.settleSession(d, { id: 'b9', mode: 'race', circuit: 'beacon_short', validLaps: 3, cleanLaps: 3, finished: true, position: 1, ai: 'easy', laps: 3, contacts: 0, xp: 100 }, DAY);
  assert.ok(out.xpBonus >= 10, 'Neri adds XP'); assert.ok(out.lines.find(l => l.label === 'Clean race').cr > 50, 'Maela adds to the clean-race bonus');
});
ok('school medals are graded from the measured run and pay only for improvement', () => {
  assert.equal(P.gradeDrill('launch', { elapsed: 2.4, peakSlip: 0.6 }), 3); assert.equal(P.gradeDrill('launch', { elapsed: 2.1, peakSlip: 1.8 }), 2); assert.equal(P.gradeDrill('launch', { elapsed: 9, peakSlip: 0.3 }), 1);
  assert.equal(P.gradeDrill('braking', { brakingDistance: 13, stoppingBudget: 35 }), 3); assert.equal(P.gradeDrill('cornering', { distance: 180, elapsed: 10 }), 1);
  const d = fresh(), a = P.recordDrill(d, 'braking', { brakingDistance: 24, stoppingBudget: 35 }), b = P.recordDrill(d, 'braking', { brakingDistance: 13, stoppingBudget: 35 }), c = P.recordDrill(d, 'braking', { brakingDistance: 13, stoppingBudget: 35 });
  assert.ok(a.medal === 1 && a.cr === P.MEDAL_PAY[1] && b.medal === 3 && b.cr === P.MEDAL_PAY[3] - P.MEDAL_PAY[1] && c.cr === 0);
});
ok('a cup scores every round from the real finishing order and pays the podium', () => {
  const d = fresh(); assert.ok(P.startCup(d, 'club').ok); assert.equal(P.startCup(d, 'formula').ok, false, 'needs the VX-1');
  const order = ['YOU', 'KMO', 'AVA', 'LST', 'MOK', 'TRE', 'YHA', 'NHA']; let out;
  for (let r = 0; r < 3; r++) out = P.settleSession(d, { id: 'c' + r, mode: 'race', circuit: P.CUPS[0].rounds[r], validLaps: 3, finished: true, position: 1, ai: 'easy', laps: 3, contacts: 1, order, cup: true }, DAY);
  assert.ok(out.cup.done && out.cup.rank === 1 && out.cup.prize === P.CUPS[0].prize[0] && out.cup.table[0].pts === 30); assert.equal(P.progressOf(d).cup, null); assert.equal(P.progressOf(d).cups.club.wins, 1);
});
ok('trophies unlock from real totals and are collected once', () => {
  const d = fresh(); assert.ok(!P.trophyList(d).find(t => t.id === 'first_lap').done);
  P.settleSession(d, { id: 't1', mode: 'practice', circuit: 'beacon_short', validLaps: 1, bestLap: 33 }, DAY);
  const c0 = P.credits(d); assert.ok(P.claimTrophy(d, 'first_lap').ok && P.credits(d) === c0 + 100); assert.equal(P.claimTrophy(d, 'first_lap').ok, false); assert.equal(P.claimTrophy(d, 'wins10').ok, false);
});
ok('a tampered save is clamped back to legal values', () => {
  const p = P.normalizeProgress({ v: 1, ride: 'rocket', circuit: 'moon', bought: ['vx1', 'tank'], up: { sprint: { tires: 99, engine: -4 } }, tune: { sprint: { wing: 40 } }, bond: { neri: -5 }, medals: { launch: 9 }, stats: { wins: 'many', km: -3 }, settled: 'x', trophies: ['nope'], cup: { id: 'club', round: 12 } }, fresh());
  assert.equal(p.ride, 'sprint'); assert.equal(p.circuit, 'beacon_short'); assert.deepEqual(p.bought, ['vx1']); assert.equal(p.up.sprint.tires, P.MAX_STAGE); assert.equal(p.up.sprint.engine, 0);
  assert.equal(p.tune.sprint.wing, 3); assert.equal(p.bond.neri, 0); assert.equal(p.medals.launch, 3); assert.equal(p.stats.wins, 0); assert.deepEqual(p.trophies, []); assert.equal(p.cup, null);
  assert.equal(P.normalizeTeam({ driver: '<b>Sid</b>'.repeat(4), tag: 'a!b' }).driver.includes('<'), false);
});
ok('the story has four acts and twelve events, each with a briefing and a debrief', () => {
  assert.equal(MISSIONS.length, 12); assert.deepEqual([...new Set(MISSIONS.map(m => m.chapter))], [1, 2, 3, 4]);
  for (const m of MISSIONS) assert.ok(m.before.length >= 2 && m.after.length >= 2 && m.objective.length > 20, m.id);
});
console.log(`${checks}/${checks} progression checks passed`);
