import { TRACK_HARBOR, WORLDS } from './data.js';

// Original closed courses. Opposing straights and equal quarter turns close analytically.
function historicalVenue(id, name, width, long, short, radius, detail, condition) {
  const shape = [['S', long], ['R', radius, 90], ['S', short], ['R', radius, 90]];
  const grip = { dry: 1, damp: .82, rain: .66 }[condition] ?? 1;
  const world = { ...WORLDS.lumen_harbor, surfaces: {
    asphalt: { ...WORLDS.lumen_harbor.surfaces.asphalt, mu: grip },
    curb: { ...WORLDS.lumen_harbor.surfaces.curb, mu: .91 * grip },
    runoff: { ...WORLDS.lumen_harbor.surfaces.runoff, mu: .55 * Math.sqrt(grip) },
  } };
  return { id, name, detail, world, track: {
    ...TRACK_HARBOR, id, name, width, archive: id, start: { x: 0, z: -100, heading: 0 },
    lineS: 145, gridS: 75, segments: [...shape, ...shape],
    curbMaxRadius: 0, curbExtend: 0, runoffStraight: width - 3, runoffCorner: width + 2,
  } };
}

export const HISTORY_VENUES = [
  { id: 'archive_airfield', name: 'West Apron', description: 'An airfield-inspired course with long straights and broad turns.' },
  { id: 'archive_road', name: 'Foundry Road', description: 'A compact closed road course for braking and change of direction.' },
  { id: 'archive_test', name: 'Meridian Proving Ground', description: 'A wider test course with long energy deployment zones.' },
];

export function historyCircuit(id, condition = 'dry') {
  if (id === 'archive_road') return historicalVenue(id, 'Foundry Road', 10, 245, 85, 37, HISTORY_VENUES[1].description, condition);
  if (id === 'archive_test') return historicalVenue(id, 'Meridian Proving Ground', 16, 520, 125, 79, HISTORY_VENUES[2].description, condition);
  return historicalVenue('archive_airfield', 'West Apron', 13, 410, 170, 65, HISTORY_VENUES[0].description, condition);
}
