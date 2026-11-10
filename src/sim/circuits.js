// Three original closed venues in Lumen Harbor. These are playable geometry, not atlas cards.
import { TRACK_HARBOR, WORLDS } from './data.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const venue=(id,name,width,segments,extra={})=>({...copy(TRACK_HARBOR),id,name,width,start:{x:0,z:-100,heading:0},segments,lineS:75,gridS:20,runoffStraight:9,runoffCorner:15,cornerNames:[],...extra});
// Four changing-radius right turns plus opposed equal straights: analytically closed.
const beacon=venue('beacon_short','Beacon Short',13,[['S',180],['R',42,90],['S',90],['R',42,90],['S',180],['R',42,90],['S',90],['R',42,90]],{curbMaxRadius:80,cornerNames:['Lantern','Schoolhouse','Slipway','Beacon Return']});
// Long straight, fast sweep, short cross-link, fast sweep, mirrored return.
const breakwater=venue('breakwater','Breakwater Speedway',15,[['S',440],['R',95,90],['S',100],['R',95,90],['S',440],['R',95,90],['S',100],['R',95,90]],{curbMaxRadius:110,lineS:140,gridS:65,cornerNames:['Outer Wall','Salt Sweep','Tide Turn','Dock Return']});
export const CIRCUITS=freeze([
 {id:'harbor_loop',name:'Harbor Loop',tagline:'The full harbor challenge',track:copy(TRACK_HARBOR),world:copy(WORLDS.lumen_harbor),unlock:0,environment:'blue-hour harbor',category:'Technical Grand Prix',description:'A long waterfront straight, linked esses and the tight Customs Hairpin reward a complete driver.'},
 {id:'beacon_short',name:'Beacon Short',tagline:'Find your rhythm',track:beacon,world:copy(WORLDS.lumen_harbor),unlock:0,environment:'community training apron',category:'Club Sprint',description:'Four compact bends and short links make this the crew’s quick, readable proving ground.'},
 {id:'breakwater',name:'Breakwater Speedway',tagline:'Commit to the sweep',track:breakwater,world:copy(WORLDS.lumen_harbor),unlock:2,environment:'outer harbor speed course',category:'High-speed Cup',description:'Long straights and wide ninety-five-metre-radius turns put power, clean exits and braking commitment on display.'}
]);
export function getCircuit(id){return CIRCUITS.find(c=>c.id===id)||CIRCUITS[0];}
