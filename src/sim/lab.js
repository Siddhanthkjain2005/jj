// Engineering Lab: isolated, repeatable experiments using the actual VX-1 simulation.
// These fictional setup studies never modify the race car, saved assists or world.
import { CAR_VX1, WORLDS } from './data.js';
import { Track } from './track.js';
import { Vehicle } from './vehicle.js';

export const LAB_SETUPS = [
  { id: 'baseline', name: 'Race baseline', description: 'The same VX-1 parameters used on Harbor Loop.', changes: 'Standard tires · standard aero', tireScale: 1, downforceScale: 1, dragScale: 1 },
  { id: 'grip', name: 'Grip study', description: 'Study a fictional tire with 15% more peak friction. Mass, power and aero stay fixed.', changes: 'Peak tire friction +15%', tireScale: 1.15, downforceScale: 1, dragScale: 1 },
  { id: 'aero', name: 'High downforce', description: 'Study 30% more downforce with an assumed 18% drag penalty. Both effects reach the simulation.', changes: 'Downforce +30% · drag +18%', tireScale: 1, downforceScale: 1.30, dragScale: 1.18 },
];

export const LAB_PROTOCOL = {
  title: 'Controlled straight-line study', frequencyHz: 120,
  environment: 'Flat dry asphalt · 9.81 m/s² · 1.225 kg/m³',
  acceleration: 'Full throttle from rest to 100 km/h; automatic gears and traction control.',
  braking: 'Accelerate to 100 km/h, then apply full brake with ABS. Stop threshold: 0.18 km/h.',
  coast: 'Accelerate to 150 km/h, select neutral, then coast to 100 km/h without pedals.',
  caveat: 'Computed from this fictional vehicle model, not real vehicle measurements. Setup changes apply only inside this lab.',
};

// Wide rectangular test circuit; every measured run ends on its initial 6 km straight.
const LAB_TRACK = {
  id: 'engineering_straight', name: 'Engineering straight', start: { x: 0, z: 0, heading: 0 },
  width: 40, curbWidth: 1.2, curbHeight: 0.025, curbRidge: 0.008, curbRidgePeriod: 0.5,
  curbMaxRadius: 0, curbExtend: 0, runoffStraight: 40, runoffCorner: 40, lineS: 100, gridS: 50,
  segments: [['S',6000],['R',300,90],['S',600],['R',300,90],['S',6000],['R',300,90],['S',600],['R',300,90]],
};
const DT = 1 / LAB_PROTOCOL.frequencyHz;
const controls = () => ({steerAngle:0,throttle:0,brake:0,autoGears:true,gearRequest:'D',abs:true,tcs:true,esc:false});

function setupCar(setup) {
  // Only these parameter groups are varied. Nested engine/gearbox data is read-only in Vehicle.
  return { ...CAR_VX1, tire: {...CAR_VX1.tire, mu:CAR_VX1.tire.mu*setup.tireScale},
    aero: {...CAR_VX1.aero, clA:CAR_VX1.aero.clA*setup.downforceScale, cdA:CAR_VX1.aero.cdA*setup.dragScale} };
}

function sample(v, time0, z0) {
  return {time:v.time-time0,speedKmh:v.forwardSpeed*3.6,distance:v.z-z0};
}

function accelerate(v,ctl,targetKmh,samples) {
  const startTime=v.time,startZ=v.z,target=targetKmh/3.6;
  ctl.throttle=1;ctl.brake=0;
  if(samples)samples.push(sample(v,startTime,startZ));
  let previous=0,previousTime=v.time;
  for(let i=0;i<120*30;i++) {
    previous=v.forwardSpeed;previousTime=v.time;v.step(DT,ctl);
    if(samples && (i%24===23 || v.forwardSpeed>=target))samples.push(sample(v,startTime,startZ));
    if(v.forwardSpeed>=target) {
      const fraction=(target-previous)/Math.max(1e-9,v.forwardSpeed-previous);
      return previousTime-startTime+fraction*DT;
    }
  }
  throw new Error('Engineering acceleration did not reach its target.');
}

export function runLabExperiment(setupId = 'baseline') {
  const setup=LAB_SETUPS.find(s=>s.id===setupId);
  if(!setup)throw new Error('Unknown engineering setup: '+setupId);
  const car=setupCar(setup),world=WORLDS.lumen_harbor;
  const track=new Track(LAB_TRACK,world,car),v=new Vehicle(car,world,track),ctl=controls();
  const samples={acceleration:[],braking:[],coast:[]};
  v.reset(50,0);
  const accelerationSeconds=accelerate(v,ctl,100,samples.acceleration);
  const brakingEntryKmh=v.forwardSpeed*3.6,brakeTime=v.time,brakeZ=v.z;
  ctl.throttle=0;ctl.brake=1;
  samples.braking.push(sample(v,brakeTime,brakeZ));
  let stopped=false;
  for(let i=0;i<120*15;i++) {
    v.step(DT,ctl);
    if(i%12===11 || v.forwardSpeed<0.05)samples.braking.push(sample(v,brakeTime,brakeZ));
    if(v.forwardSpeed<0.05){stopped=true;break;}
  }
  if(!stopped)throw new Error('Engineering braking did not reach a standstill.');
  const brakingMetres=v.z-brakeZ,brakingSeconds=v.time-brakeTime;
  let guardTrips=v.guardTrips+v.nanResets,contacts=v.impactCount;
  v.reset(50,0);
  accelerate(v,ctl,150);
  const coastEntryKmh=v.forwardSpeed*3.6,coastTime=v.time,coastZ=v.z;
  ctl.throttle=0;ctl.brake=0;ctl.autoGears=false;v.gear=0;
  samples.coast.push(sample(v,coastTime,coastZ));
  let coasted=false;
  for(let i=0;i<120*90;i++) {
    v.step(DT,ctl);
    if(i%60===59 || v.forwardSpeed<=100/3.6)samples.coast.push(sample(v,coastTime,coastZ));
    if(v.forwardSpeed<=100/3.6){coasted=true;break;}
  }
  if(!coasted)throw new Error('Engineering coast-down did not reach 100 km/h.');
  guardTrips+=v.guardTrips+v.nanResets;contacts+=v.impactCount;
  const metrics={accelerationSeconds,brakingMetres,brakingSeconds,brakingEntryKmh,
    coastSeconds:v.time-coastTime,coastMetres:v.z-coastZ,coastEntryKmh};
  const valid=guardTrips===0 && contacts===0 && Object.values(metrics).every(Number.isFinite);
  if(!valid)throw new Error('Engineering experiment encountered an invalid simulation state.');
  return {setupId:setup.id,metrics,samples,protocol:LAB_PROTOCOL,valid,guardTrips,contacts,
    parameters:{massKg:car.mass,peakFriction:car.tire.mu,dragAreaM2:car.aero.cdA,downforceAreaM2:car.aero.clA}};
}
