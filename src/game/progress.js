// VELOCITYVERSE progression. One wallet (the Story Tour credits), car upgrades and setups that
// change the real vehicle, circuit mastery from real laps, crew bonds, daily goals, cups and trophies.
// Pure logic with no DOM access, so the same rules run in the game and in node tests.
import { RIDES, getRide } from '../sim/rides.js';
import { CIRCUITS } from '../sim/circuits.js';

const clone = v => JSON.parse(JSON.stringify(v));
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const int = (n, lo, hi) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : lo);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const RIDE_IDS = RIDES.map(r => r.id), CIRCUIT_IDS = CIRCUITS.map(c => c.id);

// ---------- driver level ----------
export const MAX_LEVEL = 30;
export const levelFloor = L => 25 * (L - 1) * (L + 2); // XP needed to hold level L: 0, 100, 250, 450, 700 ...
export function levelFor(xp) {
  const x = Math.max(0, Number.isFinite(xp) ? xp : 0);
  let level = 1;
  while (level < MAX_LEVEL && x >= levelFloor(level + 1)) level++;
  const floor = levelFloor(level), next = level < MAX_LEVEL ? levelFloor(level + 1) : floor;
  return { level, into: x - floor, span: Math.max(1, next - floor), next, max: level >= MAX_LEVEL };
}

// ---------- cars ----------
export const RIDE_SHOP = {
  sprint: { price: 0, level: 1, cls: 'Club class', story: null },
  vx1: { price: 1400, level: 2, cls: 'Formula class', story: 'beacon-rush' },
  vanta_gt: { price: 3200, level: 4, cls: 'GT class', story: 'safe-passage' },
};
export const MAX_STAGE = 3;
export const SYSTEMS = [
  { id: 'engine', name: 'Powertrain', gain: 'More torque and faster shifts for the straights', base: 240 },
  { id: 'tires', name: 'Tyres', gain: 'More grip to brake later and corner faster', base: 260 },
  { id: 'aero', name: 'Aero kit', gain: 'More downforce in fast corners', base: 200 },
  { id: 'weight', name: 'Lightweighting', gain: 'Less mass to move, stop and turn', base: 220 },
];
const STAGE_COST = [1, 1.9, 3.2], RIDE_COST = { sprint: 1, vx1: 1.4, vanta_gt: 1.9 };
export const TUNES = [
  { id: 'wing', name: 'Wing angle', lo: 'Low drag', hi: 'High grip' },
  { id: 'bias', name: 'Brake bias', lo: 'Rearward', hi: 'Forward' },
  { id: 'balance', name: 'Balance', lo: 'Agile', hi: 'Stable' },
];
const SYS_IDS = SYSTEMS.map(s => s.id), TUNE_IDS = TUNES.map(t => t.id);

function stages(v) { const o = obj(v), out = {}; for (const id of SYS_IDS) out[id] = int(o[id], 0, MAX_STAGE); return out; }
function tuneOf(v) { const o = obj(v), out = {}; for (const id of TUNE_IDS) out[id] = Number.isFinite(o[id]) ? clamp(Math.round(o[id]), -3, 3) : 0; return out; }

// Builds the car that actually races: stock ride + bought stages + the saved setup.
export function buildCar(rideId, upgrades = {}, tune = {}) {
  const ride = getRide(rideId), car = clone(ride.car), u = stages(upgrades), t = tuneOf(tune);
  car.engine.curve = car.engine.curve.map(([rpm, tq]) => [rpm, tq * (1 + 0.05 * u.engine)]);
  car.gearbox.shiftTime *= 1 - 0.15 * u.engine;
  car.gearbox.efficiency = Math.min(0.975, car.gearbox.efficiency + 0.006 * u.engine);
  car.tire.mu *= 1 + 0.02 * u.tires;
  car.aero.clA *= (1 + 0.08 * u.aero) * (1 + 0.05 * t.wing);
  car.aero.cdA *= (1 + 0.015 * u.aero) * (1 + 0.035 * t.wing);
  const m = 1 - 0.03 * u.weight;
  car.mass *= m; car.yawInertia *= m; car.pitchInertia *= m; car.rollInertia *= m;
  car.brakes.bias = clamp(car.brakes.bias + 0.015 * t.bias, 0.5, 0.72);
  car.susp.arbF *= 1 + 0.12 * t.balance; car.susp.arbR *= 1 - 0.12 * t.balance;
  return car;
}
export const rivalCar = (rideId, stage = 0) => buildCar(rideId, Object.fromEntries(SYS_IDS.map(id => [id, int(stage, 0, MAX_STAGE)])));

// Headline numbers calculated from the built car's parameters (the lab bench measures them in the sim).
export function carStats(car) {
  const eff = car.gearbox.efficiency, rho = 1.225, g = 9.81;
  const watts = Math.max(...car.engine.curve.map(([rpm, tq]) => rpm * tq * Math.PI / 30)) * eff;
  const vDrag = Math.cbrt(2 * watts / (rho * car.aero.cdA));
  const topRatio = car.gearbox.ratios[car.gearbox.ratios.length - 1] * car.gearbox.final;
  const vGear = car.engine.limiterRpm * Math.PI / 30 / topRatio * car.wheelRadius;
  const top = Math.min(vDrag, vGear), v = 150 / 3.6;
  const latG = car.tire.mu * (1 + 0.5 * rho * car.aero.clA * v * v / (car.mass * g));
  const brakeG = car.tire.mu * (1 + 0.5 * rho * car.aero.clA * 28 * 28 / (car.mass * g));
  const pw = watts / car.mass; // W/kg
  const bars = {
    accel: clamp((pw - 280) / (720 - 280), 0.04, 1), top: clamp((top * 3.6 - 220) / (350 - 220), 0.04, 1),
    grip: clamp((latG - 1.5) / (2.9 - 1.5), 0.04, 1), brake: clamp((brakeG - 1.4) / (2.2 - 1.4), 0.04, 1),
  };
  const pr = Math.round(300 + 600 * (0.3 * bars.accel + 0.2 * bars.top + 0.35 * bars.grip + 0.15 * bars.brake));
  return { powerKw: watts / 1000, mass: car.mass, topKmh: top * 3.6, latG, pr, bars };
}

// ---------- circuits ----------
export const CIRCUIT_LEVEL = { beacon_short: 1, harbor_loop: 2, breakwater: 4 };
export const LAP_TARGETS = { beacon_short: [36, 31, 27.5], harbor_loop: [66, 58, 52.5], breakwater: [47, 41, 37] };
export const GRADES = [['S', 1.06], ['A', 1.13], ['B', 1.22], ['C', 1.35]];
export const gradeFor = ratio => (!Number.isFinite(ratio) || ratio <= 0 ? null : (GRADES.find(([, max]) => ratio <= max) || ['D'])[0]);
const lapText = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
export function masteryTasks(circuitId) {
  const t = LAP_TARGETS[circuitId] || LAP_TARGETS.harbor_loop;
  return [
    { id: 'lap', text: 'Set a valid lap' }, { id: 't1', text: `Lap in ${lapText(t[0])} or faster` },
    { id: 't2', text: `Lap in ${lapText(t[1])} or faster` }, { id: 't3', text: `Lap in ${lapText(t[2])} or faster` },
    { id: 'win', text: 'Win a race here' }, { id: 'sections', text: 'Grade B or better in every section' },
  ];
}
export const STAR_REWARD = 100;

// ---------- crew ----------
export const BOND_STEPS = [10, 30, 65, 115, 180];
export const CREW = [
  { id: 'neri', name: 'Neri Vale', role: 'Test driver', likes: 'Race finishes, overtakes and podiums', perk: l => `+${l * 5}% driver XP from every session` },
  { id: 'tavi', name: 'Tavi Pell', role: 'Engineer', likes: 'Upgrades and bench tests', perk: l => `${l * 3}% off every upgrade` },
  { id: 'maela', name: 'Maela Rook', role: 'Mentor', likes: 'Clean laps, clean races and school medals', perk: l => `+${l * 12} credits for every clean race` },
  { id: 'sola', name: 'Sola Kest', role: 'Rival', likes: 'Best laps, time trials and mastery stars', perk: l => `+${l * 6}% credits from time trials and best laps` },
];
export const bondLevel = pts => BOND_STEPS.filter(s => (pts || 0) >= s).length;

// ---------- daily goals ----------
export const GOALS = [
  { id: 'laps3', text: 'Set 3 valid laps', stat: 'validLaps', goal: 3, cr: 120 },
  { id: 'race', text: 'Finish a race', stat: 'races', goal: 1, cr: 110 },
  { id: 'podium', text: 'Finish a race in the top three', stat: 'podiums', goal: 1, cr: 190 },
  { id: 'win', text: 'Win a race', stat: 'wins', goal: 1, cr: 260 },
  { id: 'clean', text: 'Finish a race without touching anything', stat: 'cleanRaces', goal: 1, cr: 210 },
  { id: 'pb', text: 'Beat one of your best laps', stat: 'pbs', goal: 1, cr: 150 },
  { id: 'tt', text: 'Set 2 valid time-trial laps', stat: 'ttLaps', goal: 2, cr: 130 },
  { id: 'pass', text: 'Overtake 4 cars', stat: 'overtakes', goal: 4, cr: 150 },
  { id: 'km', text: 'Drive 10 km', stat: 'km', goal: 10, cr: 140 },
  { id: 'bench', text: 'Test a setup on the lab bench', stat: 'benches', goal: 1, cr: 80 },
  { id: 'story', text: 'Complete a Story Tour event', stat: 'storyWins', goal: 1, cr: 170 },
];
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNumber = key => { const [y, m, d] = String(key).split('-').map(Number); return Math.floor(Date.UTC(y || 2026, (m || 1) - 1, d || 1) / 86400000); };

// ---------- cups ----------
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export const CUPS = [
  { id: 'club', name: 'Club Cup', ride: 'sprint', ai: 'easy', rivalStage: 0, laps: 3, rounds: ['beacon_short', 'harbor_loop', 'breakwater'], prize: [900, 500, 300] },
  { id: 'formula', name: 'Formula Cup', ride: 'vx1', ai: 'medium', rivalStage: 1, laps: 3, rounds: ['harbor_loop', 'breakwater', 'beacon_short'], prize: [1600, 900, 500] },
  { id: 'crown', name: 'Crown GT Cup', ride: 'vanta_gt', ai: 'hard', rivalStage: 2, laps: 4, rounds: ['breakwater', 'beacon_short', 'harbor_loop'], prize: [2600, 1500, 800] },
];
export const PURSE = [220, 150, 110, 80, 60, 45, 30, 20];
export const AI_PAY = { easy: 0.75, medium: 1, hard: 1.35 };
export const AI_STAGE = { easy: 0, medium: 0, hard: 1 }; // upgrade stage rival cars run in single races

// ---------- trophies ----------
export const TROPHIES = [
  { id: 'first_lap', name: 'On the board', text: 'Set your first valid lap', stat: 'validLaps', goal: 1, cr: 100 },
  { id: 'laps50', name: 'Lap counter', text: 'Set 50 valid laps', stat: 'validLaps', goal: 50, cr: 500 },
  { id: 'first_win', name: 'Top step', text: 'Win a race', stat: 'wins', goal: 1, cr: 200 },
  { id: 'wins10', name: 'Serial winner', text: 'Win 10 races', stat: 'wins', goal: 10, cr: 700 },
  { id: 'hard_win', name: 'No easy way', text: 'Win against Hard rivals', stat: 'hardWins', goal: 1, cr: 400 },
  { id: 'clean5', name: 'Paint intact', text: 'Finish 5 races without contact', stat: 'cleanRaces', goal: 5, cr: 350 },
  { id: 'pass25', name: 'Coming through', text: 'Overtake 25 cars', stat: 'overtakes', goal: 25, cr: 300 },
  { id: 'km100', name: 'Hundred up', text: 'Drive 100 km', stat: 'km', goal: 100, cr: 400 },
  { id: 'pb10', name: 'Always faster', text: 'Beat your best lap 10 times', stat: 'pbs', goal: 10, cr: 350 },
  { id: 'up10', name: 'Spanner time', text: 'Fit 10 upgrades', stat: 'upgrades', goal: 10, cr: 300 },
  { id: 'stars9', name: 'Local knowledge', text: 'Earn 9 mastery stars', stat: 'stars', goal: 9, cr: 500 },
  { id: 'stars18', name: 'Harbor master', text: 'Earn every mastery star', stat: 'stars', goal: 18, cr: 1500 },
  { id: 'cup1', name: 'Silverware', text: 'Win a cup', stat: 'cupWins', goal: 1, cr: 600 },
  { id: 'cups3', name: 'Triple crown', text: 'Win all three cups', stat: 'cupWins', goal: 3, cr: 2000 },
  { id: 'garage3', name: 'Full garage', text: 'Own all three cars', stat: 'rides', goal: 3, cr: 500 },
  { id: 'gold3', name: 'Top of the class', text: 'Earn gold in every school drill', stat: 'golds', goal: 3, cr: 500 },
  { id: 'crew5', name: 'Family', text: 'Reach bond level 5 with a crew member', stat: 'maxBond', goal: 5, cr: 600 },
  { id: 'story', name: 'The line stays open', text: 'Finish the Story Tour', stat: 'storyDone', goal: 1, cr: 1000 },
];
const STAT_IDS = ['validLaps', 'races', 'podiums', 'wins', 'hardWins', 'cleanRaces', 'pbs', 'ttLaps', 'overtakes', 'km', 'benches', 'storyWins', 'upgrades', 'goals', 'crEarned', 'topKmh'];

// ---------- team identity ----------
export function normalizeTeam(value) {
  const t = obj(value);
  const clean = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n) : '');
  return {
    driver: clean(t.driver, 12) || 'Driver',
    name: clean(t.name, 24) || 'Openline Garage',
    tag: clean(t.tag, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'OLG',
    region: typeof t.region === 'string' ? t.region.slice(0, 20) : '',
    color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#22e4f2',
  };
}

// ---------- state ----------
export function defaultProgress() {
  return { v: 1, ride: 'sprint', circuit: 'beacon_short', ai: 'easy', laps: 3, bought: [], up: {}, tune: {}, circuits: {}, medals: {}, bench: {},
    bond: { neri: 0, tavi: 0, maela: 0, sola: 0 }, goals: { day: '', ids: [], prog: {}, claimed: [] }, streak: { day: '', n: 0 },
    stats: {}, trophies: [], cup: null, cups: {}, settled: [], legacy: false };
}
const TASK_IDS = masteryTasks('harbor_loop').map(t => t.id);
function circuitState(v) {
  const c = obj(v);
  return { best: Number.isFinite(c.best) && c.best > 5 ? c.best : null, laps: int(c.laps, 0, 1e6), wins: int(c.wins, 0, 1e6),
    sec: Array.isArray(c.sec) ? c.sec.slice(0, 40).map(x => (Number.isFinite(x) && x > 0.5 && x < 20 ? x : null)) : [],
    stars: Array.isArray(c.stars) ? [...new Set(c.stars.filter(id => TASK_IDS.includes(id)))] : [] };
}
// `data` is the whole save; it seeds a first-time migration so nobody loses what they already earned.
export function normalizeProgress(value, data = {}) {
  const d = defaultProgress(), first = !value || typeof value !== 'object', v = obj(value);
  const career = obj(data.career), story = obj(data.storyCareer);
  if (first) {
    const played = (career.validLaps || 0) > 0 || (career.completedRaces || 0) > 0;
    d.legacy = played;
    if (played) { d.bought = ['vx1']; d.ride = 'vx1'; d.circuit = 'harbor_loop'; d.ai = 'medium'; }
    const parts = obj(story.parts);
    for (const id of RIDE_IDS) d.up[id] = stages({ tires: parts.grip, aero: parts.aero, engine: parts.gearing });
    for (const id of ['launch', 'braking', 'cornering']) if (obj(career.school)[id]) d.medals[id] = 1;
    d.stats = { validLaps: int(career.validLaps, 0, 1e6), races: int(career.completedRaces, 0, 1e6), podiums: int(career.podiums, 0, 1e6) };
  } else {
    d.legacy = v.legacy === true;
    d.bought = Array.isArray(v.bought) ? RIDE_IDS.filter(id => id !== 'sprint' && v.bought.includes(id)) : [];
    for (const id of RIDE_IDS) d.up[id] = stages(obj(v.up)[id]);
    for (const id of ['launch', 'braking', 'cornering']) { const m = int(obj(v.medals)[id], 0, 3); if (m) d.medals[id] = m; }
    d.stats = obj(v.stats);
    d.ride = RIDE_IDS.includes(v.ride) ? v.ride : 'sprint'; d.circuit = CIRCUIT_IDS.includes(v.circuit) ? v.circuit : 'beacon_short';
    d.ai = ['easy', 'medium', 'hard'].includes(v.ai) ? v.ai : 'easy'; d.laps = v.laps === 5 ? 5 : 3;
  }
  for (const id of RIDE_IDS) d.tune[id] = tuneOf(obj(v.tune)[id]);
  for (const id of RIDE_IDS) {
    const b = obj(obj(v.bench)[id]);
    if ([b.accel, b.brake, b.topKmh].every(Number.isFinite)) d.bench[id] = { accel: b.accel, brake: b.brake, topKmh: b.topKmh, tag: String(b.tag || '').slice(0, 40) };
  }
  for (const id of CIRCUIT_IDS) d.circuits[id] = circuitState(obj(v.circuits)[id]);
  for (const c of CREW) d.bond[c.id] = int(obj(v.bond)[c.id], 0, 9999);
  const stats = {};
  for (const id of STAT_IDS) stats[id] = Number.isFinite(d.stats[id]) ? Math.max(0, id === 'km' || id === 'topKmh' ? d.stats[id] : Math.floor(d.stats[id])) : 0;
  d.stats = stats;
  const g = obj(v.goals), known = id => GOALS.some(x => x.id === id);
  d.goals = { day: typeof g.day === 'string' ? g.day.slice(0, 10) : '', ids: Array.isArray(g.ids) ? g.ids.filter(known).slice(0, 3) : [],
    prog: Object.fromEntries(Object.entries(obj(g.prog)).filter(([k, n]) => known(k) && Number.isFinite(n)).map(([k, n]) => [k, Math.max(0, n)])),
    claimed: Array.isArray(g.claimed) ? g.claimed.filter(known).slice(0, 3) : [] };
  const s = obj(v.streak); d.streak = { day: typeof s.day === 'string' ? s.day.slice(0, 10) : '', n: int(s.n, 0, 9999) };
  d.trophies = Array.isArray(v.trophies) ? [...new Set(v.trophies.filter(id => TROPHIES.some(t => t.id === id)))] : [];
  for (const cup of CUPS) { const r = obj(obj(v.cups)[cup.id]); d.cups[cup.id] = { best: int(r.best, 0, 8), wins: int(r.wins, 0, 1e6) }; }
  const cup = obj(v.cup), def = CUPS.find(c => c.id === cup.id);
  d.cup = def && Number.isFinite(cup.round) && cup.round >= 0 && cup.round < def.rounds.length ? { id: def.id, round: Math.floor(cup.round),
    points: Object.fromEntries(Object.entries(obj(cup.points)).filter(([k, n]) => k.length <= 8 && Number.isFinite(n)).slice(0, 8).map(([k, n]) => [k, Math.max(0, Math.floor(n))])) } : null;
  d.settled = Array.isArray(v.settled) ? v.settled.filter(x => typeof x === 'string' && x.length <= 100).slice(-80) : [];
  return d;
}
const P = data => (data.progress && data.progress.v === 1 && Array.isArray(data.progress.settled) && data.progress.stats ? data.progress : (data.progress = normalizeProgress(data.progress, data)));
const wallet = data => (data.storyCareer = obj(data.storyCareer));
const pay = (data, cr) => { const w = wallet(data), n = Math.max(0, Math.round(cr)); w.credits = int((w.credits || 0) + n, 0, 1e7); P(data).stats.crEarned += n; return n; };
export const credits = data => int(wallet(data).credits, 0, 1e7);
export const progressOf = data => P(data);

// ---------- ownership and unlocks ----------
export function ownedRides(data) {
  const p = P(data), story = obj(wallet(data).records), owned = ['sprint'];
  for (const id of RIDE_IDS) if (id !== 'sprint' && (p.bought.includes(id) || obj(story[RIDE_SHOP[id].story]).completed === true)) owned.push(id);
  return owned;
}
export function circuitOpen(data, id) {
  const p = P(data);
  if (!CIRCUIT_IDS.includes(id)) return false;
  return levelFor(obj(data.career).xp).level >= CIRCUIT_LEVEL[id] || (p.legacy && id !== 'breakwater') || p.circuits[id].laps > 0;
}
export const totalStars = data => CIRCUIT_IDS.reduce((n, id) => n + P(data).circuits[id].stars.length, 0);
export const crewPerk = (data, id) => bondLevel(P(data).bond[id]);
export function upgradeCost(data, rideId, sysId) {
  const p = P(data), sys = SYSTEMS.find(s => s.id === sysId), stage = p.up[rideId]?.[sysId];
  if (!sys || stage === undefined || stage >= MAX_STAGE) return null;
  return Math.round(sys.base * STAGE_COST[stage] * RIDE_COST[rideId] * (1 - 0.03 * crewPerk(data, 'tavi')) / 10) * 10;
}
function addBond(data, id, pts, out) {
  const p = P(data), before = bondLevel(p.bond[id]);
  p.bond[id] = int(p.bond[id] + Math.max(0, Math.round(pts)), 0, 9999);
  const after = bondLevel(p.bond[id]);
  if (after > before && out) out.bonds.push({ id, level: after });
}
export function selectedCar(data, rideId) { const p = P(data), id = RIDE_IDS.includes(rideId) ? rideId : p.ride; return buildCar(id, p.up[id], p.tune[id]); }
export const buildTag = (data, rideId) => { const p = P(data); return SYS_IDS.map(id => p.up[rideId][id]).join('') + '/' + TUNE_IDS.map(id => p.tune[rideId][id]).join(','); };

// ---------- actions ----------
export function buyRide(data, id) {
  const p = P(data), shop = RIDE_SHOP[id];
  if (!shop) return { ok: false, reason: 'Unknown car.' };
  if (ownedRides(data).includes(id)) return { ok: false, reason: 'Already in your garage.' };
  if (levelFor(obj(data.career).xp).level < shop.level) return { ok: false, reason: `Reach driver level ${shop.level} first.` };
  if (credits(data) < shop.price) return { ok: false, reason: `You need ${shop.price - credits(data)} more credits.` };
  wallet(data).credits = credits(data) - shop.price; p.bought.push(id);
  return { ok: true, cost: shop.price };
}
export function selectRide(data, id) { if (!ownedRides(data).includes(id)) return false; P(data).ride = id; return true; }
export function selectCircuit(data, id) { if (!circuitOpen(data, id)) return false; P(data).circuit = id; return true; }
export function buyUpgrade(data, rideId, sysId) {
  const p = P(data), out = { bonds: [] };
  if (!ownedRides(data).includes(rideId)) return { ok: false, reason: 'Own this car first.' };
  const cost = upgradeCost(data, rideId, sysId);
  if (cost === null) return { ok: false, reason: 'Already at the top stage.' };
  if (credits(data) < cost) return { ok: false, reason: `You need ${cost - credits(data)} more credits.` };
  wallet(data).credits = credits(data) - cost; p.up[rideId][sysId]++; p.stats.upgrades++;
  addBond(data, 'tavi', 4, out);
  return { ok: true, cost, stage: p.up[rideId][sysId], bonds: out.bonds };
}
export function setTune(data, rideId, key, value) {
  const p = P(data);
  if (!RIDE_IDS.includes(rideId) || !TUNE_IDS.includes(key) || !Number.isFinite(value)) return false;
  p.tune[rideId][key] = clamp(Math.round(value), -3, 3); return true;
}
export function recordBench(data, rideId, metrics, day = dayKey()) {
  const p = P(data), out = { bonds: [], goalsDone: [] };
  if (!RIDE_IDS.includes(rideId) || !metrics || ![metrics.accel, metrics.brake, metrics.topKmh].every(Number.isFinite)) return out;
  p.bench[rideId] = { accel: metrics.accel, brake: metrics.brake, topKmh: metrics.topKmh, tag: buildTag(data, rideId) };
  addStats(data, { benches: 1 }, day, out); addBond(data, 'tavi', 2, out);
  return out;
}
// School medals: 1 bronze (pass), 2 silver, 3 gold. Graded from what the instructor measured.
export function gradeDrill(drillId, result) {
  const r = obj(result);
  if (drillId === 'launch') return r.elapsed <= 3.4 && r.peakSlip < 1.2 ? 3 : r.elapsed <= 5.5 ? 2 : 1;
  if (drillId === 'braking') { const k = r.brakingDistance / Math.max(1, r.stoppingBudget); return k <= 0.42 ? 3 : k <= 0.62 ? 2 : 1; }
  if (drillId === 'cornering') { const kmh = r.distance / Math.max(0.1, r.elapsed) * 3.6; return kmh >= 78 ? 3 : kmh >= 67 ? 2 : 1; }
  return 0;
}
export const DRILL_HINTS = {
  launch: ['Reach 60 km/h and hold it', 'Silver: get there within 5.5 seconds', 'Gold: within 3.4 seconds with no big wheelspin'],
  braking: ['Stop from 70 km/h inside the marked distance', 'Silver: press harder and stop in under two thirds of it', 'Gold: firm, steady pedal and stop in well under half of it'],
  cornering: ['Carry the car cleanly through the bend', 'Silver: average 67 km/h from the start to the exit', 'Gold: average 78 km/h without sliding'],
};
export const MEDAL_PAY = [0, 60, 150, 300];
export function recordDrill(data, drillId, result) {
  const p = P(data), medal = gradeDrill(drillId, result), before = p.medals[drillId] || 0, out = { medal, before, cr: 0, bonds: [] };
  if (!medal) return out;
  if (medal > before) { p.medals[drillId] = medal; out.cr = pay(data, MEDAL_PAY[medal] - MEDAL_PAY[before]); addBond(data, 'maela', 6 * (medal - before), out); }
  return out;
}
export function recordStory(data, result, day = dayKey()) {
  const out = { bonds: [], goalsDone: [], xp: 0 };
  if (!result || !result.success) return out;
  addStats(data, { storyWins: 1 }, day, out);
  const xp = (result.first ? 60 : 0) + int(result.newStars, 0, 3) * 20;
  if (xp) { data.career = obj(data.career); data.career.xp = int((data.career.xp || 0) + xp, 0, 1e7); out.xp = xp; }
  if (result.first) for (const c of CREW) addBond(data, c.id, 3, out);
  return out;
}

// ---------- goals, streak, trophies ----------
export function rollGoals(data, day = dayKey()) {
  const p = P(data);
  if (p.goals.day === day && p.goals.ids.length === 3) return p.goals;
  const pool = GOALS.slice(), ids = [], seen = new Set();
  let h = hash('vv-' + day);
  while (ids.length < 3 && pool.length) {
    const g = pool.splice(h % pool.length, 1)[0];
    h = (Math.imul(h ^ (h >>> 13), 2654435761) >>> 0) || 1;
    if (seen.has(g.stat)) continue; // never two goals that count the same thing on one day
    seen.add(g.stat); ids.push(g.id);
  }
  p.goals = { day, ids, prog: {}, claimed: [] };
  return p.goals;
}
export const streakBonus = n => Math.min(0.5, Math.max(0, n - 1) * 0.1);
export function streakToday(data, day = dayKey()) {
  const s = P(data).streak, gap = dayNumber(day) - dayNumber(s.day);
  return s.day === day ? s.n : gap === 1 ? s.n + 1 : 1; // the streak a claim made today would hold
}
export function goalList(data, day = dayKey()) {
  const g = rollGoals(data, day), mult = 1 + streakBonus(streakToday(data, day));
  return g.ids.map(id => {
    const def = GOALS.find(x => x.id === id), have = Math.min(def.goal, g.prog[id] || 0);
    return { ...def, have, done: have >= def.goal, claimed: g.claimed.includes(id), pay: Math.round(def.cr * mult) };
  });
}
export function claimGoal(data, id, day = dayKey()) {
  const p = P(data), goal = goalList(data, day).find(g => g.id === id);
  if (!goal || !goal.done || goal.claimed) return { ok: false };
  p.streak = { day, n: streakToday(data, day) };
  p.goals.claimed.push(id); p.stats.goals++;
  return { ok: true, cr: pay(data, goal.pay), streak: p.streak.n };
}
function addStats(data, delta, day, out) {
  const p = P(data), g = rollGoals(data, day);
  for (const [k, n] of Object.entries(delta)) {
    if (!STAT_IDS.includes(k) || !Number.isFinite(n) || n <= 0) continue;
    if (k === 'topKmh') { p.stats.topKmh = Math.max(p.stats.topKmh, n); continue; }
    p.stats[k] += n;
    for (const id of g.ids) {
      const def = GOALS.find(x => x.id === id);
      if (def.stat !== k || g.claimed.includes(id)) continue;
      const before = g.prog[id] || 0; g.prog[id] = before + n;
      if (before < def.goal && g.prog[id] >= def.goal && out) out.goalsDone.push(def.text);
    }
  }
}
export function facts(data) {
  const p = P(data), story = Object.values(obj(wallet(data).records)), done = story.filter(r => obj(r).completed).length;
  return { ...p.stats, km: Math.floor(p.stats.km), stars: totalStars(data), cupWins: CUPS.filter(c => p.cups[c.id].wins > 0).length, rides: ownedRides(data).length,
    golds: Object.values(p.medals).filter(m => m >= 3).length, maxBond: Math.max(...CREW.map(c => bondLevel(p.bond[c.id]))), storyDone: story.length > 0 && done >= story.length ? 1 : 0 };
}
export function trophyList(data) {
  const f = facts(data), p = P(data);
  return TROPHIES.map(t => { const have = Math.min(t.goal, f[t.stat] || 0); return { ...t, have, done: have >= t.goal, claimed: p.trophies.includes(t.id) }; });
}
export function claimTrophy(data, id) {
  const t = trophyList(data).find(x => x.id === id);
  if (!t || !t.done || t.claimed) return { ok: false };
  P(data).trophies.push(id); return { ok: true, cr: pay(data, t.cr) };
}
export const claimable = (data, day = dayKey()) => ({ goals: goalList(data, day).filter(g => g.done && !g.claimed).length, trophies: trophyList(data).filter(t => t.done && !t.claimed).length });

// ---------- cups ----------
export function startCup(data, cupId) {
  const p = P(data), cup = CUPS.find(c => c.id === cupId);
  if (!cup) return { ok: false, reason: 'Unknown cup.' };
  if (!ownedRides(data).includes(cup.ride)) return { ok: false, reason: `You need the ${getRide(cup.ride).name} for this cup.` };
  p.cup = { id: cup.id, round: 0, points: {} };
  return { ok: true };
}
export function quitCup(data) { P(data).cup = null; }
export function cupTable(points) {
  return Object.entries(obj(points)).map(([code, pts]) => ({ code, pts }))
    .sort((a, b) => b.pts - a.pts || (a.code === 'YOU' ? -1 : b.code === 'YOU' ? 1 : a.code.localeCompare(b.code)));
}

// ---------- session settlement ----------
// summary: { id, mode, circuit, ride, validLaps, cleanLaps, bestLap, pb, finished, position, ai, laps, contacts, km, topKmh,
//            overtakes, perfectStart, slipstream, sections:[ratio|null], sectionCount, order:[codes], cup, xp, levelBefore }
export function settleSession(data, summary, day = dayKey()) {
  const p = P(data), s = obj(summary);
  data.career = obj(data.career);
  const out = { lines: [], cr: 0, xpBonus: 0, stars: [], bonds: [], goalsDone: [], levelUp: 0, cup: null, already: false };
  if (typeof s.id !== 'string' || !s.id || p.settled.includes(s.id)) { out.already = true; return out; }
  p.settled.push(s.id); p.settled = p.settled.slice(-80);
  const line = (label, cr) => { const n = Math.round(cr); if (n > 0) { out.lines.push({ label, cr: n }); out.cr += n; } };
  const valid = int(s.validLaps, 0, 200), clean = int(s.cleanLaps, 0, 200), race = s.mode === 'race', finished = race && s.finished === true;
  const pos = int(s.position, 1, 8), ai = AI_PAY[s.ai] ? s.ai : 'easy', sola = 1 + 0.06 * crewPerk(data, 'sola'), passes = int(s.overtakes, 0, 60);
  const inCup = !!(s.cup && p.cup);
  if (finished) {
    line(`Finished P${pos}`, PURSE[pos - 1] * AI_PAY[ai] * (int(s.laps, 1, 20) / 3) * (inCup ? 1.25 : 1));
    if (s.contacts === 0) line('Clean race', 50 + 12 * crewPerk(data, 'maela'));
    if (passes) line(`${passes} overtake${passes > 1 ? 's' : ''}`, Math.min(8, passes) * 15);
    if (s.perfectStart) line('Perfect start', 25);
    if (s.slipstream >= 4) line('Slipstream', 15);
  } else if (!race) {
    const n = Math.min(3, valid), tt = s.mode === 'timetrial';
    if (n) line(`${n} valid lap${n > 1 ? 's' : ''}`, n * (tt ? 28 * sola : 14));
  }
  if (s.pb) line('New best lap', 60 * sola);
  // circuit mastery from this session's real laps
  const c = p.circuits[s.circuit];
  if (c) {
    c.laps += valid;
    if (valid && Number.isFinite(s.bestLap) && s.bestLap > 5) c.best = Math.min(c.best ?? Infinity, s.bestLap);
    if (finished && pos === 1) c.wins++;
    if (Array.isArray(s.sections)) s.sections.slice(0, 40).forEach((r, i) => { if (Number.isFinite(r) && r > 0.5) c.sec[i] = Math.min(c.sec[i] ?? Infinity, r); });
    const t = LAP_TARGETS[s.circuit], n = int(s.sectionCount, 0, 40);
    const earned = { lap: c.laps > 0, t1: c.best !== null && c.best <= t[0], t2: c.best !== null && c.best <= t[1], t3: c.best !== null && c.best <= t[2], win: c.wins > 0,
      sections: n > 0 && Array.from({ length: n }, (_, i) => c.sec[i]).every(r => Number.isFinite(r) && r <= GRADES[2][1]) };
    for (const task of masteryTasks(s.circuit)) {
      if (!earned[task.id] || c.stars.includes(task.id)) continue;
      c.stars.push(task.id); out.stars.push(task.text); line('Mastery star', STAR_REWARD); addBond(data, 'sola', 6, out);
    }
  }
  // stats, goals and crew bonds
  addStats(data, { validLaps: valid, races: finished ? 1 : 0, podiums: finished && pos <= 3 ? 1 : 0, wins: finished && pos === 1 ? 1 : 0,
    hardWins: finished && pos === 1 && ai === 'hard' ? 1 : 0, cleanRaces: finished && s.contacts === 0 ? 1 : 0, pbs: s.pb ? 1 : 0,
    ttLaps: s.mode === 'timetrial' ? valid : 0, overtakes: finished ? passes : 0, km: Number.isFinite(s.km) ? clamp(s.km, 0, 500) : 0,
    topKmh: Number.isFinite(s.topKmh) ? clamp(s.topKmh, 0, 600) : 0 }, day, out);
  if (finished) addBond(data, 'neri', 3 + Math.min(5, passes) + (pos <= 3 ? 4 : 0), out);
  addBond(data, 'maela', Math.min(3, clean) * 2 + (finished && s.contacts === 0 ? 5 : 0), out);
  addBond(data, 'sola', (s.pb ? 5 : 0) + (s.mode === 'timetrial' ? Math.min(3, valid) : 0), out);
  // cup round
  if (finished && inCup && Array.isArray(s.order)) {
    const cup = CUPS.find(x => x.id === p.cup.id);
    s.order.slice(0, 8).forEach((code, i) => { if (typeof code === 'string' && code.length <= 8) p.cup.points[code] = (p.cup.points[code] || 0) + CUP_POINTS[i]; });
    p.cup.round++;
    const table = cupTable(p.cup.points), rank = table.findIndex(r => r.code === 'YOU') + 1;
    out.cup = { id: cup.id, name: cup.name, round: p.cup.round, rounds: cup.rounds.length, table, rank, done: p.cup.round >= cup.rounds.length, prize: 0 };
    if (out.cup.done) {
      const rec = p.cups[cup.id]; rec.best = rec.best ? Math.min(rec.best, rank) : rank; if (rank === 1) rec.wins++;
      if (rank >= 1 && rank <= 3) { out.cup.prize = cup.prize[rank - 1]; line(`${cup.name} · P${rank} overall`, cup.prize[rank - 1]); }
      p.cup = null;
    }
  }
  // Neri's XP bonus on what the session already earned, then level rewards
  const bonus = Math.round(int(s.xp, 0, 5000) * 0.05 * crewPerk(data, 'neri'));
  if (bonus) { data.career.xp = int((data.career.xp || 0) + bonus, 0, 1e7); out.xpBonus = bonus; }
  const level1 = levelFor(data.career.xp).level, before = Number.isFinite(s.levelBefore) ? s.levelBefore : level1;
  if (level1 > before) { out.levelUp = level1; let reward = 0; for (let L = before + 1; L <= level1; L++) reward += 50 * L; line(`Driver level ${level1}`, reward); }
  pay(data, out.cr);
  return out;
}
