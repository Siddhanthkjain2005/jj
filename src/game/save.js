// VELOCITYVERSE client: local saves (settings, personal bests, best-lap ghosts). Browser storage can be missing
// or throw in some contexts, so every access is guarded and the game still runs without it.
import { ASSIST_PRESETS } from '../sim/assists.js';
import { DEFAULT_KEYS } from './input.js';
import { defaultCareer, normalizeCareer } from './career.js';
import { defaultOpenline, normalizeOpenline } from './openline-state.js';
import { defaultStoryCareer, normalizeStoryCareer } from './career-mode.js';
import { HISTORY_RIDES } from '../sim/history-rides.js';

const SAVE_KEY = 'velocityverse.m0.save';
export const SAVE_VERSION = 1;

export function defaultSave() {
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
  const touch = (navigator.maxTouchPoints || 0) > 0;
  return {
    version: SAVE_VERSION, firstRunDone: false, livery: 'nova', preset: 'rookie',
    assists: { ...ASSIST_PRESETS.rookie },
    settings: {
      layout: touch ? 'buttons' : 'keyboard', steerSpeedRef: 25, haptics: true, camera: 'chase', fov: 62, shake: 0.6,
      motion: true, reducedMotion: reduced, renderScale: 'auto', graphics: 'auto', weather: 'rain', units: 'kmh', textScale: 1, showTelemetry: false, showPerf: false,
      volMaster: 0.8, volEngine: 0.8, volFx: 0.8, keys: { ...DEFAULT_KEYS },
    },
    pbs: {}, history: [], career: defaultCareer(), openline: defaultOpenline(), storyCareer: defaultStoryCareer(), timePortal: { completed: [] }, customLivery: { primary: '#c9d1d5', secondary: '#167c97', accent: '#d1a05b' },
  };
}

export class SaveStore {
  constructor() {
    this.available = false;
    this.data = defaultSave();
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      this.available = true;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SAVE_VERSION) {
          const d = defaultSave();
          this.data = { ...d, ...parsed, settings: { ...d.settings, ...parsed.settings, keys: { ...d.settings.keys, ...(parsed.settings || {}).keys } }, assists: { ...d.assists, ...parsed.assists } };
        }
      }
    } catch (e) { this.available = false; }
    this.data.career = normalizeCareer(this.data.career);
    this.data.openline = normalizeOpenline(this.data.openline);
    this.data.storyCareer = normalizeStoryCareer(this.data.storyCareer);
    const chapters = Object.values(HISTORY_RIDES).sort((a, b) => a.history.year - b.history.year);
    const completed = this.data.timePortal?.completed;
    const earned = [];
    for (const car of chapters) {
      if (!Array.isArray(completed) || !completed.includes(car.id)) break;
      earned.push(car.id);
    }
    this.data.timePortal = { completed: earned };
    this.data.customLivery = { ...defaultSave().customLivery, ...(this.data.customLivery && typeof this.data.customLivery === 'object' ? this.data.customLivery : {}) };
  }
  save() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); this.available = true; return true; }
    catch (e) { this.available = false; return false; }
  }
  reset() { this.data = defaultSave(); this.data.firstRunDone = true; try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } this.save(); }
}

export function encodeGhost(f32) {
  const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function decodeGhost(b64) {
  try {
    const s = atob(b64); const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  } catch (e) { return null; }
}
