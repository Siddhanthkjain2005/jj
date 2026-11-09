// Offline driver progression. Cosmetic identity only: never changes the car's performance.
export const LICENCES = [
  { xp: 0, name: 'Club entrant' }, { xp: 150, name: 'Circuit driver' },
  { xp: 450, name: 'Apex specialist' }, { xp: 1000, name: 'Harbor champion' },
];
export function defaultCareer() { return { xp: 0, validLaps: 0, completedRaces: 0, podiums: 0, school: {}, paidSessions: [] }; }
export function normalizeCareer(value) {
  const c = value && typeof value === 'object' ? value : {};
  const num = k => Number.isFinite(c[k]) ? Math.max(0, Math.floor(c[k])) : 0;
  return { xp: num('xp'), validLaps: num('validLaps'), completedRaces: num('completedRaces'), podiums: num('podiums'),
    school: Object.fromEntries(['launch','braking','cornering'].filter(id => c.school?.[id] === true).map(id => [id,true])),
    paidSessions: Array.isArray(c.paidSessions) ? c.paidSessions.filter(id=>typeof id==='string').slice(-100) : [] };
}
export function licenceFor(xp) { return [...LICENCES].reverse().find(l=>xp>=l.xp) || LICENCES[0]; }
export function awardLesson(value,id) {
  const c=normalizeCareer(value);
  if (!['launch','braking','cornering'].includes(id) || c.school[id]) return {career:c,earned:0};
  c.school[id]=true;c.xp+=100;return {career:c,earned:100};
}
export function awardSession(value,session) {
  const c=normalizeCareer(value),id=session.id;
  if(typeof id!=='string'||!id||c.paidSessions.includes(id))return {career:c,earned:0};
  const valid=Number.isFinite(session.validLaps)?Math.max(0,Math.floor(session.validLaps)):0;
  let earned=Math.min(3,valid)*25;
  if(valid>0&&session.personalBest)earned+=10;
  if(session.finishedRace===true) {c.completedRaces++;earned+=60;if(session.position>=1&&session.position<=3){c.podiums++;earned+=15;}}
  c.xp+=earned;c.validLaps+=valid;c.paidSessions.push(id);c.paidSessions=c.paidSessions.slice(-100);
  return {career:c,earned};
}
export function colorRGB(hex) {
  const h=/^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#b9c7cd';
  return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
}
export function personalLivery(data) {
  const d=data||{};return {id:'custom',name:'Personal build',primary:colorRGB(d.primary||'#c9d1d5'),secondary:colorRGB(d.secondary||'#167c97'),accent:colorRGB(d.accent||'#d1a05b')};
}
