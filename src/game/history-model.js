// Original period-inspired bodywork. Coordinates match the existing car meshes (+z forward).
import { MeshBuilder, STRIDE, circle, framesAlong } from './gfx.js';

const PAINT = 22, METAL = 14, RUBBER = 13, CARBON = 12, GLASS = 15, BRAKE = 16;
const alloy = [.60, .63, .67], steel = [.34, .37, .40], rubber = [.023, .024, .026];
const dark = [.035, .042, .047], bronze = [.49, .31, .19];
const light = [1, .07, .1, .24];

// The centre of each chassis is placed below the physical centre of mass. Longitudinal
// proportions follow the actual wheelbase, while wheel tracks and radii are set separately.
const bodies = {
  cigar: {
    shell: [[-2.3,.035,.045,.38,2],[-1.88,.21,.20,.43,2],[-1.20,.35,.27,.45,2.2],[-.74,.36,.17,.41,2.2],[-.38,.35,.16,.42,2.3],[-.03,.33,.26,.51,2],[.66,.35,.28,.51,2],[1.44,.33,.25,.48,2],[1.98,.29,.22,.44,2],[2.20,.22,.175,.44,2]],
    seat: { z: -.64, y: .64, width: .24, dash: 'analog' },
    wheels: [.16,.19], rim: .67, spokes: 24,
  },
  f2: {
    shell: [[-2.12,.027,.049,.365,2],[-1.74,.15,.153,.396,2],[-1.22,.268,.217,.438,2.4],[-.71,.285,.151,.382,2.6],[-.23,.28,.148,.386,2.6],[.17,.271,.217,.451,2.4],[.69,.25,.231,.454,2.3],[1.39,.246,.192,.413,2.2],[1.92,.225,.164,.382,2.2],[2.07,.147,.115,.376,2]],
    seat: { z: -.56, y: .545, width: .19, dash: 'analog' },
    wheels: [.145,.17], rim: .68, spokes: 23,
  },
  streamliner: {
    shell: [[-2.31,.105,.052,.348,2],[-2.04,.246,.127,.354,2.2],[-1.41,.30,.193,.416,2.6],[-.82,.337,.163,.396,2.8],[-.35,.341,.157,.397,2.7],[.05,.32,.25,.506,2.6],[.69,.33,.262,.479,2.7],[1.31,.323,.238,.438,2.7],[2.03,.317,.165,.371,2.5],[2.26,.245,.097,.339,2.2]],
    seat: { z: -.59, y: .57, width: .20, dash: 'analog' },
    wheels: [.175,.205], rim: .63, spokes: 10,
  },
  rear: {
    shell: [[-2.02,.038,.05,.36,2],[-1.68,.24,.19,.40,2.2],[-1.16,.30,.21,.43,2.4],[-.64,.30,.16,.40,2.3],[-.36,.29,.115,.33,2.5],[.12,.28,.125,.34,2.5],[.57,.26,.17,.38,2.6],[1.16,.24,.14,.34,2.3],[1.81,.19,.111,.29,2],[2.02,.115,.073,.282,2]],
    seat: { z: -.18, y: .49, width: .21, dash: 'analog' },
    wheels: [.18,.22], rim: .65, spokes: 6,
  },
  monocoque: {
    shell: [[-2.01,.09,.085,.35,2],[-1.67,.24,.19,.38,2.3],[-1.07,.29,.24,.43,2.4],[-.67,.29,.13,.34,2.7],[-.17,.29,.14,.34,2.7],[.40,.28,.19,.39,2.6],[.98,.24,.145,.33,2.4],[1.55,.21,.12,.29,2.2],[1.97,.15,.095,.27,2],[2.16,.03,.028,.26,2]],
    seat: { z: -.35, y: .52, width: .21, dash: 'analog' },
    wheels: [.19,.22], rim: .64, spokes: 8,
  },
  wing: {
    shell: [[-1.85,.07,.075,.30,2],[-1.55,.18,.14,.33,2.6],[-1.11,.24,.20,.43,2.6],[-.64,.23,.21,.43,2.8],[-.39,.25,.12,.36,3.1],[.18,.27,.12,.36,3.2],[.65,.32,.15,.35,3.4],[1.18,.39,.13,.31,3.5],[1.77,.36,.07,.24,4],[2.11,.28,.044,.196,4]],
    seat: { z: -.10, y: .51, width: .20, dash: 'analog' },
    wheels: [.25,.35], rim: .64, spokes: 5,
  },
  ground: {
    shell: [[-1.93,.10,.095,.32,2],[-1.51,.23,.16,.34,2.4],[-.88,.28,.24,.42,3],[-.43,.27,.14,.39,3],[-.02,.26,.14,.39,3],[.53,.26,.19,.40,3],[1.25,.23,.13,.32,3],[1.95,.17,.09,.28,3],[2.30,.10,.06,.23,2.3]],
    seat: { z: -.22, y: .55, width: .20, dash: 'analog' },
    wheels: [.26,.41], rim: .62, spokes: 5,
  },
  fan: {
    shell: [[-2.12,.235,.155,.437,3],[-1.61,.308,.20,.40,3.3],[-1.12,.31,.245,.434,3.1],[-.62,.28,.21,.434,3],[-.29,.279,.13,.385,3], [.27,.276,.135,.385,3.3],[.69,.271,.171,.396,3.5],[1.30,.253,.116,.322,3.6],[1.94,.23,.076,.252,3.7],[2.23,.18,.059,.224,3.7]],
    seat: { z: -.10, y: .535, width: .205, dash: 'analog' },
    wheels: [.26,.41], rim: .64, spokes: 6,
  },
  turbo: {
    shell: [[-1.99,.12,.11,.34,2.5],[-1.55,.26,.19,.34,3],[-.80,.32,.22,.42,3],[-.34,.29,.12,.36,3.6],[.12,.27,.115,.36,3.6],[.65,.26,.18,.40,3.3],[1.15,.21,.13,.35,3.3],[1.86,.17,.09,.28,3.5],[2.28,.14,.075,.26,3.5]],
    seat: { z: -.12, y: .50, width: .21, dash: 'boost' },
    wheels: [.28,.40], rim: .65, spokes: 6,
  },
  active92: {
    shell: [[-2.08,.074,.093,.32,2],[-1.65,.16,.146,.37,2.3],[-1.09,.26,.205,.46,2.5],[-.62,.31,.235,.49,2.8],[-.26,.30,.125,.47,3.2],[.21,.30,.125,.46,3.3],[.74,.28,.161,.45,3.1],[1.15,.235,.139,.416,3],[1.57,.196,.105,.387,2.6],[2.18,.158,.071,.387,2.4],[2.36,.063,.045,.327,2]],
    seat: { z: .02, y: .62, width: .20, dash: 'earlyDigital' },
    wheels: [.29,.39], rim: .63, spokes: 7,
  },
  v10: {
    shell: [[-2.03,.06,.095,.37,2],[-1.66,.15,.16,.42,2.4],[-1.12,.24,.21,.46,2.6],[-.58,.29,.28,.54,2.6],[-.27,.30,.16,.48,3.2],[.15,.31,.16,.46,3.2],[.67,.27,.22,.49,3.1],[1.27,.21,.15,.44,2.6],[1.88,.14,.09,.41,2.4],[2.31,.08,.052,.33,2]],
    seat: { z: -.07, y: .66, width: .21, dash: 'digital' },
    wheels: [.30,.38], rim: .61, spokes: 10,
  },
  v8: {
    shell: [[-2.17,.056,.09,.36,2],[-1.75,.14,.165,.43,2.5],[-1.24,.23,.20,.49,2.7],[-.66,.30,.262,.54,2.8],[-.32,.302,.15,.49,3.2],[.18,.29,.147,.47,3.2],[.68,.26,.209,.48,3.2],[1.28,.205,.148,.446,2.8],[1.91,.126,.080,.43,2.6],[2.30,.057,.05,.407,2.4],[2.40,.039,.031,.351,2]],
    seat: { z: -.07, y: .65, width: .205, dash: 'digital' },
    wheels: [.30,.38], rim: .62, spokes: 10,
  },
  hybrid: {
    shell: [[-2.10,.055,.13,.38,2.2],[-1.75,.11,.19,.45,2.4],[-1.28,.18,.25,.49,2.6],[-.69,.30,.29,.52,2.6],[-.30,.30,.16,.44,3.2],[.22,.30,.16,.42,3.2],[.77,.27,.23,.47,3.1],[1.29,.22,.14,.39,3.0],[1.98,.17,.07,.29,2.8],[2.37,.11,.055,.25,2.8]],
    seat: { z: -.09, y: .62, width: .21, dash: 'digital' },
    wheels: [.305,.385], rim: .61, spokes: 9,
  },
  wide: {
    shell: [[-2.15,.056,.12,.39,2.3],[-1.69,.13,.183,.45,2.6],[-1.16,.23,.249,.52,2.7],[-.62,.314,.257,.56,2.6],[-.32,.317,.16,.455,3.1],[.21,.303,.15,.435,3.1],[.73,.279,.223,.455,3.2],[1.32,.241,.133,.38,3.1],[1.97,.185,.063,.29,2.8],[2.39,.124,.049,.245,2.6]],
    seat: { z: -.09, y: .65, width: .22, dash: 'digital' },
    wheels: [.306,.405], rim: .63, spokes: 10,
  },
  floor22: {
    shell: [[-2.15,.081,.119,.405,2.5],[-1.83,.15,.18,.47,2.9],[-1.26,.24,.24,.48,3.3],[-.72,.32,.27,.55,3.5],[-.27,.32,.15,.475,3.3],[.17,.31,.15,.45,3.4],[.67,.31,.20,.46,3.4],[1.31,.26,.12,.39,3],[1.89,.21,.09,.30,3.3],[2.38,.13,.046,.239,3]],
    seat: { z: -.04, y: .66, width: .22, dash: 'digital' },
    wheels: [.315,.405], rim: .71, spokes: 8,
  },
  active: {
    shell: [[-2.02,.08,.12,.39,2.2],[-1.73,.15,.17,.42,2.6],[-1.20,.20,.24,.47,3],[-.72,.30,.31,.53,3],[-.32,.29,.155,.46,3.1],[.21,.29,.15,.44,3.1],[.76,.26,.21,.47,3],[1.28,.20,.14,.40,2.9],[1.91,.14,.075,.30,2.6],[2.31,.086,.045,.255,2.4]],
    seat: { z: -.02, y: .64, width: .21, dash: 'digital' },
    wheels: [.28,.36], rim: .72, spokes: 8,
  },
};

const longitudinalScale = car => car.wheelbase / 3;
const styleOf = car => car?.history?.body;
const preWing = style => ['cigar','f2','streamliner','rear','monocoque'].includes(style);
const earlyAeroStyle = style => ['wing','ground','fan','turbo'].includes(style);
const hasHalo = style => ['wide','floor22','active'].includes(style);

export function historicalEye(car) {
  const seat = bodies[styleOf(car)]?.seat;
  if (!seat) return { y: .93, z: .18 };
  return { y: seat.y + .23, z: (seat.z + .135) * longitudinalScale(car) };
}

function tube(mesh, points, radius, color, material, sides) {
  mesh.sweep(framesAlong(points), circle(radius, sides), color, material, true, false);
}

function loft(mesh, sections, segments, color, material = PAINT, x = 0) {
  mesh.loft(x, sections, segments, color, material);
}

// A shallow inverted section with the trailing edge raised. Both ends are closed so the
// wing reads correctly from the front, cockpit and rear, including in the showroom.
function wing(mesh, { span, chord, y, z, sweep = .04, rise = .04, angle = .12 }, color, lod) {
  const stations = lod ? 4 : 12;
  const thickness = chord * .065;
  const frames = Array.from({ length: stations + 1 }, (_, i) => {
    const t = 2 * i / stations - 1;
    return { p: [t * span / 2, y + rise * t * t, z - sweep * t * t], u: [0,0,1], v: [0,1,0] };
  });
  const trailing = angle * chord;
  mesh.sweep(frames, [
    [chord*.50,0], [chord*.30,thickness], [-chord*.16,thickness + trailing*.55],
    [-chord*.50,trailing], [-chord*.15,-thickness*.42 + trailing*.55], [chord*.28,-thickness*.66],
  ], color, PAINT, true, true);
}

function radialFace(mesh, x, inner, outer, count, color, material, skew = 0, halfWidth = .035) {
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    const point = (radius, a) => [x, Math.cos(a) * radius, Math.sin(a) * radius];
    mesh.quad(point(inner, angle - halfWidth), point(outer, angle + skew - halfWidth),
      point(outer, angle + skew + halfWidth), point(inner, angle + halfWidth), color, material, [1,0,0]);
  }
}

function longitudinalTube(mesh, x, y, z0, z1, radius, color, lod) {
  tube(mesh, [[x,y,z0],[x,y,z1]], radius, color, METAL, lod ? 5 : 10);
}

function instrument(mesh, x, y, z, radius, lod, needle = [.90,.43,.22]) {
  const segments = lod ? 8 : 20;
  mesh.loft(x, [[z,radius*.99,radius*.99,y,2],[z-.022,radius,radius,y,2]], segments, alloy, METAL);
  mesh.loft(x, [[z-.024,radius*.86,radius*.86,y,2],[z-.021,radius*.86,radius*.86,y,2]], segments, dark, CARBON);
  if (!lod) {
    for (let i = 0; i < 7; i++) {
      const angle = (i - 3) * .60;
      mesh.box(x + Math.sin(angle)*radius*.68, y + Math.cos(angle)*radius*.68, z-.026, .004,.006,.003, alloy,METAL);
    }
    tube(mesh, [[x,y,z-.028],[x+radius*.43,y+radius*.48,z-.028]], .0025, needle, PAINT, 4);
  }
}

function cockpit(mesh, style, trim, accent, lod) {
  const { z, y, width, dash } = bodies[style].seat;
  const count = lod ? 8 : 16;
  const modern = dash === 'digital' || dash === 'earlyDigital';
  loft(mesh, [[z-.36,.08,.055,y,2],[z-.20,width,.068,y-.017,2.5],[z+.24,width,.06,y-.023,2.4],[z+.43,.08,.033,y-.015,2]], count, dark, CARBON);
  for (const side of [-1,1]) {
    tube(mesh, [[side*.09,y+.018,z-.32],[side*width,y+.026,z-.18],[side*width,y+.017,z+.23],[side*.11,y+.018,z+.42]],
      modern ? .025 : .018, trim, PAINT, lod ? 5 : 8);
  }
  mesh.sphere(0,y+.12,z,.124,lod ? 5 : 10,lod ? 8 : 16,accent,PAINT,1.04);
  loft(mesh, [[z+.074,.105,.034,y+.146,2],[z+.123,.074,.026,y+.15,2]], count, dark, GLASS);
  if (dash === 'digital') {
    mesh.box(0,y+.077,z+.38,.255,.103,.05,dark,CARBON);
    mesh.box(0,y+.098,z+.353,.11,.041,.012,style === 'active' ? [.32,.71,.48] : [.39,.57,.66], GLASS);
    for (const side of [-1,1]) {
      mesh.box(side*.112,y+.075,z+.36,.038,.113,.044,rubber,RUBBER);
      mesh.box(side*.077,y+.101,z+.35,.014,.013,.008,accent,PAINT);
      mesh.box(side*.09,y+.106,z+.409,.033,.071,.014,alloy,METAL);
    }
  } else {
    const wood = ['cigar','f2','streamliner'].includes(style);
    const radius = wood ? .155 : .135;
    const rim = Array.from({length: count + 1}, (_, i) => {
      const a = i * Math.PI * 2 / count;
      return [Math.cos(a)*radius,y+.065+Math.sin(a)*radius*.67,z+.31+Math.sin(a)*.054];
    });
    tube(mesh,rim,.012,wood ? bronze : rubber,wood ? METAL : RUBBER,lod ? 4 : 7);
    mesh.box(0,y+.057,z+.315,.24,.014,.014,alloy,METAL);
    mesh.box(0,y-.001,z+.314,.013,.105,.013,alloy,METAL);
    if (dash === 'earlyDigital') {
      mesh.box(0,y+.075,z+.49,.31,.082,.03,dark,CARBON);
      mesh.box(0,y+.080,z+.468,.14,.040,.012,[.32,.63,.43],GLASS);
      for (let i = -3; i <= 3; i++) mesh.box(i*.019,y+.109,z+.468,.011,.009,.010,i < 1 ? [.55,.76,.35] : [.89,.42,.19],PAINT);
    } else {
      instrument(mesh,0,y+.087,z+.52,.059,lod);
      instrument(mesh,-.115,y+.061,z+.51,.035,lod);
      instrument(mesh,.115,y+.061,z+.51,dash === 'boost' ? .044 : .033,lod,[.67,.82,.33]);
    }
    tube(mesh,[[.19,y-.06,z+.05],[.21,y+.06,z+.07]],.008,alloy,METAL,5);
    mesh.sphere(.21,y+.067,z+.071,.020,4,6,dark,CARBON);
  }
  if (preWing(style)) {
    loft(mesh, [[z+.42,.20,.028,y+.035,2.7],[z+.48,.182,.060,y+.051,2.5],[z+.56,.13,.026,y+.036,2.3]], count, [.38,.53,.62],GLASS);
  }
  if (style !== 'cigar') {
    const rear = z-.35;
    tube(mesh,[[-width,y-.045,rear],[-width*.87,y+.23,rear-.04],[0,y+.30,rear-.061],
      [width*.87,y+.23,rear-.04],[width,y-.045,rear]], hasHalo(style) ? .034 : .024,
      preWing(style) ? alloy : dark,preWing(style) ? METAL : CARBON,lod ? 5 : 8);
  }
  if (hasHalo(style)) {
    const front = z+.56;
    tube(mesh,[[0,y+.05,front+.07],[0,y+.28,front]],.023,dark,CARBON,lod ? 5 : 8);
    for (const side of [-1,1]) {
      tube(mesh,[[0,y+.28,front],[side*.20,y+.28,front-.08],[side*.31,y+.26,z+.17],
        [side*.30,y+.235,z-.17],[side*.26,y+.04,z-.34]],.029,dark,CARBON,lod ? 5 : 8);
    }
  }
}

function suspension(mesh, car, style, lod) {
  const scale = longitudinalScale(car);
  const front = car.wheelbase * (1-car.frontWeight) / scale;
  const rear = -car.wheelbase * car.frontWeight / scale;
  const radius = car.wheelRadius;
  const visibleMetal = preWing(style);
  for (const side of [-1,1]) {
    for (const [z, track, isFront] of [[front, car.trackFront, true], [rear, car.trackRear, false]]) {
      const outer = side * (track / 2 - .075);
      const mount = side * (style === 'cigar' ? .24 : .17);
      for (const height of [-.095,.080]) {
        const y = radius + height;
        const arm = visibleMetal ? alloy : dark;
        const mat = visibleMetal ? METAL : CARBON;
        tube(mesh, [[mount,y+.035,z-.27],[outer,y,z],[mount,y+.025,z+.25]], .014, arm, mat, lod ? 4 : 7);
      }
      if (!lod) tube(mesh, [[mount,radius+.27,z-.095],[outer*.91,radius-.08,z+.034]], .012, steel, METAL, 7);
      if (isFront) tube(mesh, [[mount,radius,z+.13],[outer,radius,z+.095]], .011, steel, METAL,lod ? 4 : 6);
    }
  }
}

function preWingBody(mesh, car, style, primary, trim, lod) {
  if (style === 'streamliner') {
    const scale = longitudinalScale(car), radius = car.wheelRadius, steps = lod ? 7 : 16;
    // The outer body is split into wheel arches and shallow lower sill pieces. This
    // leaves room around the steering tyres and the rear wheel spin meshes.
    const f = 3*(1-car.frontWeight), r = -3*car.frontWeight;
    const frontWidth = car.history.wheelWidthFront ?? .175;
    const rearWidth = car.history.wheelWidthRear ?? .205;
    for (const side of [-1,1]) {
      const fairing = [[f,car.trackFront,frontWidth,.065],[r,car.trackRear,rearWidth,.025]];
      for (const [z,track,width,clearance] of fairing) {
        const inner = side*(track*.5-width*.5-clearance-.035);
        const outer = side*(track*.5+width*.5+clearance+.052);
        const shellRadius = radius + clearance + .06;
        const point = (x,a,offset=0) => [x,radius+(shellRadius-offset)*Math.cos(a),z+(shellRadius-offset)*Math.sin(a)/scale];
        const shoulder = angle => [side*.32,.398+.215*Math.cos(angle),z+shellRadius*Math.sin(angle)/scale];
        for (let i = 0; i < steps; i++) {
          const a0 = -.5*Math.PI + i*Math.PI/steps, a1 = -.5*Math.PI + (i+1)*Math.PI/steps;
          mesh.quad(point(inner,a0,.023),point(outer,a0),point(outer,a1),point(inner,a1,.023),primary,PAINT);
          mesh.quad(shoulder(a0),point(inner,a0,.023),point(inner,a1,.023),shoulder(a1),primary,PAINT);
          mesh.quad(point(outer,a1),point(outer,a0),point(outer,a0,.023),point(outer,a1,.023),trim,PAINT);
        }
      }
      // The pontoon merges both crowns with the long body along their inner edge.
      loft(mesh,[[-2.13,.09,.049,.335,2],[-1.82,.219,.158,.40,2.6],[-.79,.229,.155,.414,3.2],
        [.09,.230,.144,.428,3.3],[.95,.233,.167,.46,3],[1.74,.213,.151,.418,2.6],[2.20,.113,.079,.366,2.4]],lod?10:24,primary,PAINT,side*.421);
      longitudinalTube(mesh,side*.637,.271,-2.09,-.39,.020,steel,lod);
    }
    loft(mesh,[[2.197,.215,.085,.337,2.6],[2.28,.206,.082,.337,2.6],[2.30,.198,.075,.337,2.5]],lod?10:24,trim);
    loft(mesh,[[2.298,.175,.063,.337,2.5],[2.304,.175,.062,.337,2.5]],lod?10:22,dark,CARBON);
    return;
  }
  if (style === 'f2') {
    loft(mesh,[[2.05,.134,.107,.376,2],[2.10,.149,.110,.376,2],[2.12,.131,.093,.376,2]],lod?10:24,alloy,METAL);
    loft(mesh,[[2.117,.117,.078,.376,2],[2.122,.117,.078,.376,2]],lod?10:24,dark,CARBON);
    for (let k = -4; k <= 4; k++) mesh.box(k*.025,.376,2.124,.007,.116-Math.abs(k)*.01,.008,steel,METAL);
    longitudinalTube(mesh,.277,.363,-1.88,.68,.028,bronze,lod);
    for (let i = 0; i < 4; i++) {
      const z = .43+i*.16;
      tube(mesh,[[.234,.51,z],[.29,.44,z],[.277,.363,z-.10]],.017,steel,METAL,lod?5:8);
    }
    mesh.box(-.13,.637,.34,.113,.018,.20,trim,PAINT);
    loft(mesh,[[-.06,.039,.01,.674,2],[.68,.038,.011,.685,2],[1.86,.028,.008,.557,2]],lod?6:12,trim);
    return;
  }
  if (style === 'cigar') {
    // Tall front radiator and long external exhaust give the front-engine car its silhouette.
    loft(mesh, [[2.19,.200,.157,.44,2.2],[2.218,.204,.159,.44,2.2]],lod ? 10 : 26,alloy,METAL);
    loft(mesh, [[2.218,.185,.142,.44,2.1],[2.222,.185,.142,.44,2.1]],lod ? 10 : 24,dark,CARBON);
    for (let k = -5; k <= 5; k++) {
      const x = .029*k;
      const height = .265*Math.sqrt(1-(x/.186)**2);
      mesh.box(x,.44,2.225,.007,height,.009,steel,METAL);
    }
    longitudinalTube(mesh,-.343,.47,-1.69,.93,.031,bronze,lod);
    longitudinalTube(mesh,-.359,.47,-1.80,-1.59,.040,steel,lod);
    for (let i = 0; i < (lod ? 4 : 9); i++) {
      mesh.box(.23,.691-.006*i,.46+i*.106,.098,.014,.019,dark,CARBON);
    }
    loft(mesh, [[-.04,.043,.012,.774,2],[.62,.048,.014,.803,2],[1.68,.051,.008,.679,2]],lod?6:12,trim);
    mesh.box(0,.53,-1.69,.16,.018,.21,alloy,METAL);
  } else if (style === 'rear') {
    // Compact rear engine under a rounded cover, external headers, and a nose intake
    // instead of the long front-engine bonnet and exposed radiator grille.
    loft(mesh,[[-1.65,.135,.056,.569,2],[-1.14,.207,.094,.605,2.2],[-.75,.184,.072,.579,2.3]],lod?8:18,trim);
    loft(mesh,[[1.90,.139,.078,.284,2],[2.022,.114,.066,.282,2],[2.048,.077,.050,.282,2]],lod?8:18,trim);
    loft(mesh,[[2.046,.068,.044,.282,2],[2.049,.066,.043,.282,2]],lod?8:18,dark,CARBON);
    for (const side of [-1,1]) {
      const x = side*.271;
      longitudinalTube(mesh,x,.39,-2.12,-1.16,.031,alloy,lod);
      if (!lod) for (let i = 0; i < 4; i++) {
        tube(mesh,[[side*.219,.59,-1.38+i*.13],[side*.287,.52,-1.40+i*.11],[x,.40,-1.55+i*.095]],.019,bronze,METAL,6);
      }
      mesh.box(side*.216,.637,-1.09,.061,.028,.221,dark,CARBON);
    }
  } else {
    // Mid-engine tail with paired bright exhausts, intake trumpets and a low tapered nose.
    for (const side of [-1,1]) {
      longitudinalTube(mesh,side*.19,.42,-2.14,-1.19,.034,alloy,lod);
      if (!lod) for (let i = 0; i < 4; i++) {
        tube(mesh, [[side*.168,.58,-1.48+i*.115],[side*.21,.515,-1.53+i*.11],
          [side*.19,.426,-1.64+i*.10]],.019,bronze,METAL,6);
      }
    }
    loft(mesh,[[2.02,.14,.085,.28,2],[2.15,.103,.060,.268,2],[2.19,.045,.028,.264,2]],lod?8:18,trim);
    loft(mesh,[[.56,.034,.010,.57,2],[1.10,.036,.010,.465,2],[2.06,.030,.007,.35,2]],lod?6:10,trim);
    loft(mesh,[[-1.20,.09,.025,.644,2],[-.91,.14,.054,.654,2],[-.78,.105,.05,.649,2]],lod?8:18,primary);
  }
}

function earlyAero(mesh, style, primary, trim, accent, lod) {
  if (style === 'wing') {
    // Exposed engine and suspension behind the cockpit. Wing height stays below the
    // tall experimental wings of the preceding seasons.
    for (const side of [-1,1]) {
      loft(mesh,[[-1.18,.10,.056,.24,3.2],[-.49,.15,.102,.25,4],[.40,.13,.101,.25,4],[.86,.09,.064,.23,4]],lod?8:16,trim,PAINT,side*.37);
      mesh.taper(side*.524,-1.01,.57,.025,.028,.136,.181,.155,.190,accent,PAINT);
      mesh.box(side*.147,.514,-1.12,.193,.122,.49,steel,METAL);
      for (let i = 0; i < (lod ? 2 : 4); i++) {
        const z = -.86-i*.114;
        tube(mesh,[[side*.09,.55,z],[side*.23,.47,z-.09],[side*.265,.381,z-.21]],.02,bronze,METAL,lod?4:7);
      }
      longitudinalTube(mesh,side*.254,.382,-1.98,-1.19,.039,alloy,lod);
      mesh.taper(side*.535,-2.13,-1.76,.029,.024,.595,.858,.655,.824,trim,PAINT);
      mesh.taper(side*.174,-1.95,-1.58,.027,.035,.35,.76,.34,.57,steel,METAL);
    }
    wing(mesh,{span:1.07,chord:.32,y:.738,z:-1.94,rise:0,sweep:0},primary,lod);
    wing(mesh,{span:1.34,chord:.24,y:.16,z:1.96,rise:.02,sweep:.025},trim,lod);
    return;
  }
  if (style === 'fan') {
    for (const side of [-1,1]) {
      loft(mesh,[[-1.49,.13,.092,.27,3],[-1.02,.235,.153,.31,3.7],[-.31,.29,.166,.329,4.2],
        [.42,.30,.175,.336,4.7],[.91,.244,.123,.296,3.5]],lod?8:20,primary,PAINT,side*.492);
      mesh.taper(side*.765,-1.32,.79,.047,.043,.04,.195,.047,.176,trim,PAINT);
      mesh.box(side*.47,.301,.921,.30,.107,.020,dark,CARBON);
      mesh.taper(side*.65,-2.27,-1.78,.031,.032,.55,.965,.60,.866,trim,PAINT);
      mesh.taper(side*.26,-2.17,-1.62,.044,.043,.53,.785,.41,.635,steel,METAL);
    }
    mesh.taper(0,-1.64,.97,1.58,1.43,.052,.083,.055,.091,dark,CARBON);
    mesh.taper(0,-2.48,-1.91,.62,.55,.145,.672,.195,.65,primary,PAINT);
    const centerY = .424, ductZ = -2.502;
    const segments = lod ? 12 : 32;
    const ring = (radius,z,i) => [Math.cos(i*Math.PI*2/segments)*radius,centerY+Math.sin(i*Math.PI*2/segments)*radius,z];
    for (let i = 0; i < segments; i++) {
      mesh.quad(ring(.269,ductZ,i),ring(.269,ductZ,i+1),ring(.226,ductZ-.022,i+1),ring(.226,ductZ-.022,i),steel,METAL);
      mesh.quad(ring(.226,ductZ-.022,i),ring(.226,ductZ-.022,i+1),ring(.216,ductZ+.011,i+1),ring(.216,ductZ+.011,i),dark,CARBON);
    }
    mesh.loft(0,[[ductZ-.008,.219,.219,centerY,2],[ductZ-.005,.219,.219,centerY,2]],segments,dark,CARBON);
    wing(mesh,{span:1.27,chord:.39,y:.843,z:-2.04,rise:0,sweep:0},trim,lod);
    wing(mesh,{span:1.49,chord:.306,y:.154,z:2.14,rise:.038,sweep:.02},accent,lod);
    return;
  }
  const ground = style === 'ground';
  const podX = ground ? .51 : .49;
  for (const side of [-1,1]) {
    const x = side * podX;
    // Boxy Venturi pods carry visible skirt rails. The turbo model uses shorter wedge
    // pods and raised radiator mouths to distinguish its later flat-bottom architecture.
    const profile = ground ? [[-1.45,.16,.12,.26,4],[-1.03,.30,.17,.31,5],[-.28,.31,.19,.33,5],[.75,.29,.17,.31,4],[1.05,.22,.11,.26,3]]
      : [[-1.29,.11,.11,.29,3],[-.89,.23,.14,.31,3.4],[-.25,.27,.17,.34,4],[.37,.26,.17,.35,4],[.68,.235,.135,.325,3.6]];
    loft(mesh,profile,lod?8:18,primary,PAINT,x);
    const nose = ground ? 1.047 : .68;
    mesh.box(x,.284,nose,.31,.115,.016,dark,CARBON);
    if (!lod) for (let j = -2; j <= 2; j++) mesh.box(x+j*.051,.283,nose+.011,.012,.099,.012,steel,METAL);
    if (ground) mesh.taper(side*.78,-1.23,.89,.044,.041,.04,.182,.05,.173,trim,PAINT);
    else {
      mesh.taper(side*.67,-1.11,.45,.11,.13,.368,.397,.432,.469,trim,PAINT);
      for (let j = 0; j < (lod ? 2 : 5); j++) mesh.box(x,.485,.17-j*.119,.19,.019,.042,dark,CARBON);
      longitudinalTube(mesh,side*.36,.515,-1.49,-.99,.034,bronze,lod);
    }
    const wingX = side * (ground ? .62 : .69);
    mesh.taper(wingX,-2.42,-1.94,.030,.030,.62,1.00,.68,.91,accent,PAINT);
  }
  mesh.taper(0,-1.53,.88,1.59,1.48,.055,.087,.061,.090,dark,CARBON);
  for (const side of [-1,1]) {
    mesh.taper(side*.26,-2.17,-1.60,.035,.045,.42,.86,.39,.63,steel,METAL);
  }
  wing(mesh,{span:ground?1.25:1.39,chord:ground?.43:.36,y:ground?.875:.817,z:-2.14,sweep:0,rise:0,angle:.18},trim,lod);
  if (!ground) wing(mesh,{span:1.36,chord:.24,y:.945,z:-2.31,sweep:0,rise:0,angle:.24},primary,lod);
  wing(mesh,{span:ground?1.30:1.57,chord:.30,y:.174,z:2.11,rise:.025,sweep:.022,angle:.10},trim,lod);
  mesh.box(0,.385,-2.10,.12,.08,.06,light,5);
}

const contemporary = {
  active92: { podX:.48, frontSpan:1.53, rearSpan:1.24, frontZ:2.15, rearZ:-2.06, rearHeight:.925, wingRise:.037, airbox:1.04 },
  v10: { podX:.49, frontSpan:1.61, rearSpan:1.18, frontZ:2.16, rearZ:-2.09, rearHeight:.89, wingRise:.10, airbox:1.02 },
  v8: { podX:.48, frontSpan:1.62, rearSpan:1.16, frontZ:2.22, rearZ:-2.13, rearHeight:.91, wingRise:.113, airbox:1.035 },
  hybrid: { podX:.52, frontSpan:1.69, rearSpan:1.04, frontZ:2.22, rearZ:-2.16, rearHeight:1.04, wingRise:.053, airbox:1.08 },
  wide: { podX:.55, frontSpan:1.83, rearSpan:1.24, frontZ:2.23, rearZ:-2.10, rearHeight:.96, wingRise:.083, airbox:1.07 },
  floor22: { podX:.55, frontSpan:1.82, rearSpan:1.26, frontZ:2.23, rearZ:-2.11, rearHeight:1.02, wingRise:.075, airbox:1.09 },
  active: { podX:.52, frontSpan:1.66, rearSpan:1.13, frontZ:2.17, rearZ:-2.11, rearHeight:.99, wingRise:.064, airbox:1.08 },
};

function modernAero(mesh, style, primary, trim, accent, lod) {
  const v10 = style === 'v10', active = style === 'active', v8 = style === 'v8';
  const floor22 = style === 'floor22', earlyDigital = style === 'active92', wide = style === 'wide';
  const raisedNose = earlyDigital || v10 || v8;
  const d = contemporary[style];
  for (const side of [-1,1]) {
    const x = side * d.podX;
    // The 2004 concept has raised cooling chimneys. The 2014 volume houses
    // intercoolers, and the 2026 channels leave a clear undercut above the floor edge.
    const pod = earlyDigital ? [[-1.43,.071,.06,.267,2],[-1.02,.18,.121,.318,3],[-.44,.225,.134,.34,4],[.27,.24,.148,.36,4],[.72,.221,.118,.34,3.7],[.82,.185,.102,.328,3.6]]
      : v10 || v8 ? [[-1.45,.048,.039,.28,2],[-1.08,.093,.079,.31,2.6],[-.51,.19,.13,.34,3.2],[.08,.218,.15,.37,3.3],[.49,.205,.142,.375,3.2],[.65,.16,.106,.37,2.8]]
      : floor22 ? [[-1.47,.096,.058,.263,2.7],[-1.12,.17,.093,.31,3.4],[-.49,.23,.129,.385,4],[.11,.242,.157,.444,4.2],[.59,.224,.137,.445,4],[.81,.175,.085,.425,3.5]]
      : wide ? [[-1.48,.061,.048,.281,2],[-1.04,.139,.097,.343,3.3],[-.39,.202,.149,.40,3.5],[.16,.235,.165,.437,4],[.59,.222,.134,.449,3.8],[.82,.177,.082,.445,3]]
      : active ? [[-1.49,.064,.044,.244,2],[-1.07,.114,.08,.292,3],[-.45,.18,.11,.348,3.3],[.20,.214,.123,.41,3.6],[.58,.206,.117,.422,3.5],[.74,.155,.075,.413,3]]
      : [[-1.49,.047,.041,.29,2],[-1.07,.14,.09,.33,2.6],[-.45,.20,.15,.36,3.3],[.10,.215,.18,.39,3.4],[.55,.207,.151,.408,3.4],[.76,.166,.117,.403,2.7]];
    loft(mesh,pod,lod?9:21,primary,PAINT,x);
    const [nose,,height,y] = pod.at(-1);
    mesh.box(x,y,nose+.005,.239,height*1.45,.016,dark,CARBON);
    mesh.taper(side*(d.podX+.14),-1.10,.54,.024,.037,.346,.371,.483,.51,trim,PAINT);
    if (v10) {
      mesh.taper(side*.48,-.83,-.58,.142,.105,.398,.63,.456,.535,primary,PAINT);
      mesh.box(side*.48,.617,-.824,.094,.045,.014,dark,CARBON);
      mesh.taper(side*.58,-1.10,-.62,.065,.050,.42,.57,.39,.46,trim,PAINT);
    }
    if (v8) {
      // Short cooling shoulders and separate mid-body turning vanes for the early V8 shape.
      mesh.taper(side*.566,-.94,-.53,.092,.077,.374,.598,.412,.562,trim,PAINT);
      mesh.taper(side*.635,.49,1.02,.018,.025,.094,.403,.111,.35,accent,PAINT);
      mesh.taper(side*.684,.41,.66,.017,.02,.134,.304,.153,.323,primary,PAINT);
    }
    if (earlyDigital) {
      mesh.taper(side*.365,.31,.71,.027,.019,.103,.43,.127,.356,trim,PAINT);
      mesh.box(side*.156,.248,1.98,.049,.222,.133,steel,METAL);
    }
    if (wide) {
      mesh.taper(side*.751,.52,1.13,.022,.030,.103,.40,.085,.345,trim,PAINT);
      mesh.taper(side*.660,.47,.97,.021,.022,.116,.401,.094,.372,dark,CARBON);
      mesh.taper(side*.805,-1.47,.52,.021,.024,.062,.132,.053,.102,dark,CARBON);
    }
    if (floor22) {
      // Tall floor entries and exposed tunnel fences are independent of the narrow 2026 flaps.
      mesh.taper(side*.67,.42,1.03,.036,.049,.068,.274,.086,.204,dark,CARBON);
      mesh.taper(side*.76,.38,.94,.027,.039,.06,.226,.078,.176,trim,PAINT);
      mesh.taper(side*.86,-1.68,.73,.035,.036,.061,.119,.074,.149,dark,CARBON);
      mesh.taper(side*.91,1.96,2.40,.035,.031,.084,.27,.112,.245,primary,PAINT);
    }
    if (!lod) for (let j = 0; j < 4; j++) mesh.box(x,.49-j*.017,-.26-j*.12,.122,.008,.027,dark,CARBON);
    mesh.taper(side*d.rearSpan*.50,d.rearZ-.31,d.rearZ+.20,.022,.030,d.rearHeight-.47,d.rearHeight+.12,d.rearHeight-.42,d.rearHeight+.078,primary,PAINT);
    mesh.taper(side*d.frontSpan*.50,d.frontZ-.22,d.frontZ+.20,.023,.028,.085,.27,.10,.236,trim,PAINT);
    mesh.taper(side*.72,-1.77,.76,.035,.040,.052,.112,.054,.091,dark,CARBON);
  }
  loft(mesh,[[-.95,.061,.068,.75,2],[-.56,.105,.135,.81,2.5],[-.36,.117,.154,.88,2.6],[-.13,.091,.076,d.airbox-.07,2.4]],lod?9:22,primary);
  loft(mesh,[[-.15,.081,.042,d.airbox-.04,2.5],[-.121,.078,.046,d.airbox-.043,2.4]],lod?8:18,dark,CARBON);
  mesh.box(0,d.airbox+.02,-.28,.116,.044,.18,trim,PAINT);
  mesh.taper(0,-1.94,1.19,floor22||wide?1.79:active?1.66:1.51,raisedNose?1.13:1.34,.045,.080,.047,.087,dark,CARBON);
  mesh.quad([-.55,.264,-2.10],[.55,.264,-2.10],[.49,.085,-1.54],[-.49,.085,-1.54],dark,CARBON);
  for (const x of [-.36,-.18,.18,.36]) mesh.taper(x,-2.10,-1.54,.018,.014,.061,.26,.053,.090,dark,CARBON);
  mesh.box(0,.414,-2.11,.11,.08,.042,light,5);
  longitudinalTube(mesh,0,.549,-2.07,-1.77,.038,alloy,lod);
  wing(mesh,{span:d.frontSpan,chord:raisedNose?.35:.30,y:raisedNose?.125:.093,z:d.frontZ,rise:d.wingRise,sweep:.065},primary,lod);
  wing(mesh,{span:d.rearSpan,chord:.32,y:d.rearHeight-.10,z:d.rearZ,rise:.012,sweep:active?.10:.027},trim,lod);
  if (wide) wing(mesh,{span:1.74,chord:.117,y:.273,z:2.017,rise:.052,sweep:.075,angle:.21},accent,lod);
  if (!active) {
    wing(mesh,{span:d.frontSpan*.94,chord:.20,y:raisedNose?.207:.177,z:d.frontZ-.17,rise:d.wingRise,sweep:.055,angle:.23},trim,lod);
    wing(mesh,{span:d.rearSpan*.96,chord:.21,y:d.rearHeight+.016,z:d.rearZ-.153,rise:.013,angle:.26},accent,lod);
  }
}

function scaleLongitudinal(mesh, scale) {
  for (let i = 0; i < mesh.v.length; i += STRIDE) {
    mesh.v[i+2] *= scale;
    const nx = mesh.v[i+3], ny = mesh.v[i+4], nz = mesh.v[i+5] / scale;
    const length = Math.hypot(nx,ny,nz) || 1;
    mesh.v[i+3] = nx / length;
    mesh.v[i+4] = ny / length;
    mesh.v[i+5] = nz / length;
  }
  return mesh;
}

export function buildHistoricalBody(car, livery, lod = 0) {
  const style = styleOf(car);
  const body = bodies[style];
  if (!body) throw new Error(`Unknown historical body style: ${style}`);
  const mesh = new MeshBuilder();
  const { primary, secondary: trim, accent } = livery;
  loft(mesh,body.shell,lod?11:28,primary);
  if (preWing(style)) preWingBody(mesh,car,style,primary,trim,lod);
  else if (earlyAeroStyle(style)) earlyAero(mesh,style,primary,trim,accent,lod);
  else modernAero(mesh,style,primary,trim,accent,lod);
  cockpit(mesh,style,trim,accent,lod);
  suspension(mesh,car,style,lod);
  return scaleLongitudinal(mesh,longitudinalScale(car));
}

export function buildHistoricalFlaps(car, livery, lod = 0) {
  if (styleOf(car) !== 'active') return [];
  const d = contemporary.active;
  const scale = longitudinalScale(car);
  const front = new MeshBuilder(), rear = new MeshBuilder();
  wing(front,{span:d.frontSpan*.94,chord:.19,y:0,z:0,sweep:.059,rise:d.wingRise,angle:.21},livery.secondary,lod);
  wing(rear,{span:d.rearSpan*.95,chord:.22,y:0,z:0,sweep:.09,rise:.015,angle:.23},livery.accent,lod);
  return [
    {mesh:scaleLongitudinal(front,scale),y:.165,z:(d.frontZ-.171)*scale},
    {mesh:scaleLongitudinal(rear,scale),y:d.rearHeight+.021,z:(d.rearZ-.139)*scale},
  ];
}

export function buildHistoricalFan(car, livery, lod = 0) {
  if (styleOf(car) !== 'fan') return null;
  const mesh = new MeshBuilder(), blades = lod ? 7 : 11;
  for (let i = 0; i < blades; i++) {
    const angle = i * Math.PI * 2 / blades;
    const point = (r,a,z) => [r*Math.cos(angle+a),r*Math.sin(angle+a),z];
    mesh.quad(point(.046,-.24,-.003),point(.216,.115,-.021),point(.216,.282,-.012),point(.048,.22,.008),alloy,METAL);
  }
  mesh.sphere(0,0,-.012,.060,lod?4:7,lod?8:15,livery.accent,PAINT);
  return { mesh,y:.424,z:-2.532*longitudinalScale(car) };
}

export function buildHistoricalWheel(car, front, side, lod = 0) {
  const style = styleOf(car);
  const body = bodies[style];
  const radius = car.wheelRadius;
  const width = front ? (car.history.wheelWidthFront ?? body.wheels[0]) : (car.history.wheelWidthRear ?? body.wheels[1]);
  const w = width / 2, bead = radius * body.rim;
  const count = lod ? 14 : 36;
  const mesh = new MeshBuilder();
  const crossPly = preWing(style);
  const shoulder = crossPly ? width*.28 : width*.16;
  const tread = [[-w,bead],[-w-.005,radius*.83],[-w+shoulder*.40,radius*.963],[-w+shoulder,radius]];
  const colors = tread.map(() => rubber);
  if ((style === 'v10' || style === 'v8') && !lod) for (const fraction of [-.27,-.09,.09,.27]) {
    const center = fraction * width;
    tread.push([center-.009,radius],[center-.005,radius-.006],[center+.005,radius-.006],[center+.009,radius]);
    colors.push(rubber,[.011,.012,.013],[.011,.012,.013],rubber);
  }
  tread.push([w-shoulder,radius],[w-shoulder*.40,radius*.963],[w+.005,radius*.83],[w,bead]);
  colors.push(rubber,rubber,rubber,rubber);
  mesh.lathe(tread,count,rubber,RUBBER,colors);
  if (crossPly && !lod) {
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      const p = (x,a) => [x,Math.cos(a)*radius*1.001,Math.sin(a)*radius*1.001];
      mesh.quad(p(-w*.50,angle-.025),p(0,angle+.042),p(0,angle+.062),p(-w*.50,angle-.007),[.009,.01,.012],RUBBER);
      mesh.quad(p(0,angle+.042),p(w*.50,angle-.025),p(w*.50,angle-.007),p(0,angle+.062),[.009,.01,.012],RUBBER);
    }
  }
  mesh.lathe([[-w+.013,bead*.96],[w-.018,bead*.96],[w-.009,bead],[w+.001,bead*.945],[w-.019,bead*.875]],count,alloy,METAL);
  if (style === 'cigar' || style === 'f2') {
    // Wire wheels expose the inboard drum. The spoke meshes stay part of the moving wheel.
    mesh.lathe([[-w*.72,0],[-w*.72,bead*.64],[-w*.31,bead*.64],[-w*.31,0]],count,steel,METAL);
    radialFace(mesh,w-.016,bead*.16,bead*.94,lod?12:body.spokes,alloy,METAL,.43,.017);
    if (!lod) radialFace(mesh,w-.032,bead*.17,bead*.93,body.spokes,steel,METAL,-.41,.016);
  } else if (style === 'floor22') {
    // The visually distinctive 18-inch-era outer wheel cover stays part of the wheel mesh.
    mesh.lathe([[w-.018,bead*.98],[w+.008,bead*.95],[w+.018,bead*.72],[w+.021,bead*.18],[w+.021,0]],count,[.25,.27,.30],METAL);
    radialFace(mesh,w+.023,bead*.23,bead*.81,5,[.047,.050,.056],CARBON,.22,.09);
  } else {
    mesh.lathe([[-w*.70,0],[-w*.70,bead*.72],[-w*.43,bead*.72],[-w*.43,0]],count,steel,BRAKE);
    radialFace(mesh,w-.018,bead*.17,bead*.94,body.spokes,style === 'active' ? steel : alloy,METAL,.10,.111);
  }
  mesh.lathe([[w-.023,bead*.26],[w+.011,bead*.20],[w+.018,bead*.11],[w+.018,0]],lod?8:16,steel,METAL);
  if (side < 0) for (let i = 0; i < mesh.v.length; i += STRIDE) {
    mesh.v[i] *= -1;
    mesh.v[i+3] *= -1;
  }
  return mesh;
}
