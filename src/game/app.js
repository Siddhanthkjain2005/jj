// Offline app destinations. All records are read from this device; no online roster or rank is implied.
import { licenceFor, normalizeCareer } from './career.js';
import { downloadBlob } from './platform.js';

const $ = id => document.getElementById(id);
const REGIONS = ['', 'Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];
const CORNERS = ['Lighthouse', 'Esses · entry', 'Esses · exit', 'Crane Sweep', 'Customs Hairpin', 'Ferry Chicane · entry', 'Ferry Chicane · exit', 'Warehouse', 'Quay'];
const time = t => {
  if (!Number.isFinite(t) || t <= 0) return 'No time yet';
  const ms = Math.round(t * 1000), minutes = Math.floor(ms / 60000);
  return `${minutes}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;
};
const escapeXML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const textNode = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; };

export function normalizeTeam(value) {
  const t = value && typeof value === 'object' ? value : {};
  const clean = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n) : '';
  return {
    name: clean(t.name, 24) || 'Kestrel Works',
    tag: clean(t.tag, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'VXR',
    region: REGIONS.includes(t.region) ? t.region : '',
    color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#51d9ee',
  };
}

export class AppFeatures {
  constructor(game) { this.game = game; this.selected = 0; this.wired = false; }

  wire() {
    if (this.wired) return;
    this.wired = true;
    $('team-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const team = this.readTeam();
      this.game.save.data.team = team;
      const saved = this.game.save.save();
      this.renderTeam();
      $('team-save-note').textContent = saved ? 'Team identity saved on this device.' : 'Team identity updated for this session. Storage is unavailable.';
    });
    for (const id of ['team-name', 'team-tag', 'team-region', 'team-color']) {
      $(id)?.addEventListener('input', () => this.renderTeamPreview(this.readTeam()));
    }
    $('btn-team-export')?.addEventListener('click', () => this.exportTeam());
  }

  render(screen) {
    if (screen === 'explorer') this.renderExplorer();
    if (screen === 'records') this.renderRecords();
    if (screen === 'team') this.renderTeam();
  }

  team() { return normalizeTeam(this.game.save.data.team); }
  readTeam() { return normalizeTeam({ name: $('team-name')?.value, tag: $('team-tag')?.value, region: $('team-region')?.value, color: $('team-color')?.value }); }

  segmentNames() {
    let corner = 0, straight = 0;
    return this.game.track.segments.map(g => g.kind === 'S' ? `Straight ${String(++straight).padStart(2, '0')}` : CORNERS[corner++] || `Corner ${corner}`);
  }

  renderExplorer() {
    const track = this.game.track, map = $('explorer-map'), list = $('explorer-segments');
    if (!map || !list) return;
    const ns = 'http://www.w3.org/2000/svg', names = this.segmentNames();
    const minX = Math.min(...track.x), maxX = Math.max(...track.x), minZ = Math.min(...track.z), maxZ = Math.max(...track.z);
    const scale = Math.min(480 / Math.max(1, maxX - minX), 330 / Math.max(1, maxZ - minZ));
    const ox = (560 - (maxX - minX) * scale) / 2, oy = (410 - (maxZ - minZ) * scale) / 2;
    const xy = i => `${(ox + (track.x[i] - minX) * scale).toFixed(2)},${(oy + (maxZ - track.z[i]) * scale).toFixed(2)}`;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 560 410'); svg.setAttribute('class', 'explorer-map-svg');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${track.name}, ${Math.round(track.length)} metre circuit. Select a section below to inspect it.`);
    const title = document.createElementNS(ns, 'title'); title.textContent = track.name; svg.append(title);
    const path = document.createElementNS(ns, 'path');
    const full = Array.from({ length: track.n }, (_, i) => `${i ? 'L' : 'M'}${xy(i)}`).join(' ') + ' Z';
    path.setAttribute('d', full); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#283d50'); path.setAttribute('stroke-width', '15'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path);
    this.mapPaths = [];
    track.segments.forEach((g, gi) => {
      const indices = Array.from({ length: track.n }, (_, i) => i).filter(i => track.seg[i] === gi);
      if (!indices.length) return;
      indices.push((indices[indices.length - 1] + 1) % track.n);
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', indices.map((i, k) => `${k ? 'L' : 'M'}${xy(i)}`).join(' '));
      p.setAttribute('fill', 'none'); p.setAttribute('stroke-width', '5'); p.setAttribute('stroke-linecap', 'round'); p.style.cursor = 'pointer';
      p.addEventListener('click', () => this.selectSegment(gi));
      const pt = document.createElementNS(ns, 'title'); pt.textContent = names[gi]; p.append(pt); svg.append(p); this.mapPaths[gi] = p;
    });
    const start = track.pointAt(track.def.lineS, 0, {}), sx = ox + (start.x - minX) * scale, sy = oy + (maxZ - start.z) * scale;
    const marker = document.createElementNS(ns, 'circle'); marker.setAttribute('cx', sx); marker.setAttribute('cy', sy); marker.setAttribute('r', '7'); marker.setAttribute('fill', '#fff'); marker.setAttribute('stroke', '#061321'); marker.setAttribute('stroke-width', '3'); svg.append(marker);
    const label = document.createElementNS(ns, 'text'); label.setAttribute('x', sx + 13); label.setAttribute('y', sy + 5); label.setAttribute('fill', '#fff'); label.setAttribute('font-size', '12'); label.textContent = 'START / FINISH'; svg.append(label);
    map.replaceChildren(svg);
    list.replaceChildren(); this.segmentButtons = [];
    track.segments.forEach((g, i) => {
      const button = textNode('button', 'segment-button', `${String(i + 1).padStart(2, '0')}  ${names[i]}`);
      button.type = 'button'; button.addEventListener('click', () => this.selectSegment(i)); list.append(button); this.segmentButtons.push(button);
    });
    this.selectSegment(Math.min(this.selected, track.segments.length - 1));
  }

  selectSegment(index) {
    const track = this.game.track, g = track.segments[index], host = $('explorer-detail');
    if (!g || !host) return;
    this.selected = index;
    this.mapPaths?.forEach((p, i) => { if(p) { p.setAttribute('stroke', i === index ? '#fff' : '#51d9ee'); p.setAttribute('stroke-width', i === index ? '9' : '5'); } });
    this.segmentButtons?.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === index)); b.classList.toggle('selected', i === index); });
    const speeds = Array.from(track.lineSpeed).filter((_, i) => track.seg[i] === index);
    const mph = this.game.S?.units === 'mph', factor = mph ? 2.2369363 : 3.6;
    const low = Math.round(Math.min(...speeds) * factor), high = Math.round(Math.max(...speeds) * factor);
    host.replaceChildren(textNode('span', 'eyebrow', `SECTION ${String(index + 1).padStart(2, '0')} / ${track.segments.length}`), textNode('h3', '', this.segmentNames()[index]));
    const metrics = textNode('div', 'explorer-facts', `${Math.round(g.len)} m · ${g.kind === 'S' ? 'Straight' : `${g.kind === 'R' ? 'Right' : 'Left'} turn · ${Math.round(g.R)} m radius`} · ${track.def.width} m road width`);
    host.append(metrics, textNode('p', '', g.kind === 'S' ? 'Unwind the steering before adding full throttle. Look ahead to the next turn and brake while the car is straight.' : g.R <= 45 ? 'A slow technical corner. Brake early in a straight line, release the brake progressively, then add power as you open the steering.' : 'A flowing corner. Settle the car before turn-in, use a smooth steering input and leave room for the exit. Reduce speed if the front tires slide.'));
    host.append(textNode('p', 'muted', `Modeled guidance: ${low}–${high} ${mph ? 'mph' : 'km/h'} across this section. This is the same approximate reference used by driving assists, not a recorded lap or a guaranteed grip limit.`));
  }

  renderRecords() {
    const career = normalizeCareer(this.game.save.data.career), summary = $('records-summary');
    if (!summary) return;
    summary.replaceChildren();
    for (const [value, label] of [[career.xp, 'DRIVER XP'], [career.validLaps, 'VALID LAPS'], [career.completedRaces, 'RACE FINISHES'], [career.podiums, 'PODIUMS'], [Object.keys(career.school).length + ' / 3', 'ACADEMY MEDALS']]) {
      const card = textNode('div', 'metric-card', ''); card.append(textNode('strong', 'num stat-value', value), textNode('span', 'stat-label', label)); summary.append(card);
    }
    const host = $('records-bests'), entries = Object.entries(this.game.save.data.pbs || {}).filter(([k, v]) => k.startsWith(this.game.track.def.id + '|') && v && Number.isFinite(v.time) && v.time > 0);
    host.replaceChildren(textNode('h3', '', `${licenceFor(career.xp).name} · Harbor personal bests`));
    if (!entries.length) host.append(textNode('p', 'muted', 'Your first valid practice or time-trial lap will appear here. Assisted and standard times stay separate.'));
    entries.sort((a, b) => a[1].time - b[1].time).forEach(([key, pb]) => {
      const row = textNode('div', 'record-best', '');
      row.append(textNode('span', '', key.endsWith('|assisted') ? 'Assisted' : 'Standard'), textNode('strong', 'num', time(pb.time)), textNode('span', 'muted', typeof pb.ghost === 'string' && pb.ghost.length ? 'Personal ghost saved' : 'No ghost available'));
      host.append(row);
    });
    const history = $('records-history'); history.replaceChildren();
    const laps = Array.isArray(this.game.save.data.history) ? this.game.save.data.history.filter(l => l && Number.isFinite(l.t) && l.t > 0).slice(0, 12) : [];
    if (!laps.length) { history.append(textNode('p', 'muted', 'No recorded laps on this device yet. Your recent sessions will build a driving journal here.')); return; }
    const table = document.createElement('table'); table.className = 'app-table';
    const head = document.createElement('thead'), hr = document.createElement('tr');
    for (const label of ['Lap time', 'Result', 'Event', 'Assists']) hr.append(textNode('th', '', label)); head.append(hr); table.append(head);
    const body = document.createElement('tbody');
    laps.forEach(l => { const row = document.createElement('tr'); row.append(textNode('td', 'num', time(l.t)), textNode('td', l.valid ? 'valid' : 'invalid', l.valid ? '✓ Valid' : '✕ Invalid'), textNode('td', '', l.mode === 'race' ? 'Grand Prix' : l.mode === 'timetrial' ? 'Time trial' : 'Practice'), textNode('td', '', l.cls === 'assisted' ? 'Assisted' : 'Standard')); body.append(row); });
    table.append(body); history.append(table);
  }

  renderTeam() {
    const team = this.team();
    for (const [id, value] of [['team-name', team.name], ['team-tag', team.tag], ['team-region', team.region], ['team-color', team.color]]) if ($(id)) $(id).value = value;
    if ($('team-save-note')) $('team-save-note').textContent = this.game.save.available ? 'Private, local identity. No account, chat, location tracking or online membership.' : 'Storage is unavailable. Changes last for this session only.';
    this.renderTeamPreview(team);
  }

  renderTeamPreview(team) {
    const host = $('team-preview'); if (!host) return;
    const career = normalizeCareer(this.game.save.data.career);
    host.classList.add('team-identity'); host.style.setProperty('--team-color', team.color); host.replaceChildren();
    host.append(textNode('div', 'team-crest', team.tag), textNode('span', 'eyebrow', 'YOUR LOCAL TEAM IDENTITY'), textNode('h3', '', team.name), textNode('p', 'muted', team.region ? `${team.region} · voluntarily selected affiliation` : 'Independent · choose an affiliation if you want'), textNode('p', 'team-record', `${licenceFor(career.xp).name} · ${career.xp} XP · ${Object.keys(career.school).length}/3 academy medals`));
  }

  exportTeam() {
    const t = this.readTeam(), c = normalizeCareer(this.game.save.data.career), esc = escapeXML;
    const nameSize = Math.min(54, Math.floor(800 / (t.name.length * 0.95))), tagSize = t.tag.length > 3 ? 36 : 48;
    const best = Object.values(this.game.save.data.pbs || {}).filter(p => p && Number.isFinite(p.time) && p.time > 0).sort((a,b) => a.time - b.time)[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#081726"/><stop offset="1" stop-color="#142e42"/></linearGradient><linearGradient id="accent"><stop stop-color="${esc(t.color)}"/><stop offset="1" stop-color="#b4e2ee"/></linearGradient></defs><rect width="1200" height="675" fill="url(#bg)"/><path d="M0 540L1200 110M0 580L1200 150" stroke="${esc(t.color)}" stroke-opacity=".16" stroke-width="2"/><path d="M80 120H190L220 170V285L135 335L50 285V170Z" fill="none" stroke="url(#accent)" stroke-width="5"/><text x="135" y="245" text-anchor="middle" font-family="Arial,sans-serif" font-size="${tagSize}" fill="${esc(t.color)}" font-weight="700">${esc(t.tag)}</text><g font-family="Arial,sans-serif" fill="#f5f8fb"><text x="280" y="155" fill="${esc(t.color)}" letter-spacing="5" font-size="20">VELOCITYVERSE / TEAM IDENTITY</text><text x="280" y="230" font-size="${nameSize}" font-weight="700">${esc(t.name)}</text><text x="280" y="275" fill="#a8bdcd" font-size="23">${esc(t.region || 'Independent')} · ${esc(licenceFor(c.xp).name)}</text><text x="80" y="425" font-size="25">${c.xp} DRIVER XP</text><text x="450" y="425" font-size="25">${Object.keys(c.school).length} / 3 ACADEMY MEDALS</text><text x="80" y="485" fill="#a8bdcd" font-size="22">${c.validLaps} valid laps · ${c.completedRaces} race finishes · ${c.podiums} podiums</text><text x="80" y="535" fill="#a8bdcd" font-size="22">Local personal best: ${esc(best ? time(best.time) : 'Not set')}</text><text x="80" y="615" fill="#7e9bae" font-size="16">OFFLINE DRIVER CARD · Local records are unverified · No online team membership implied</text></g></svg>`;
    const target=downloadBlob(new Blob([svg],{type:'image/svg+xml'}),`velocityverse-${t.tag.toLowerCase()}-identity.svg`);
    if ($('team-save-note')) $('team-save-note').textContent = target==='native' ? 'Saving your identity card…' : 'Identity card downloaded with your current local achievements.';
  }
}
