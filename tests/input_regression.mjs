import assert from 'node:assert/strict';
import { Input } from '../src/game/input.js';
const listeners = {};
globalThis.window = { addEventListener: (name, cb) => { listeners[name] = cb; } };
globalThis.document = { hidden: false, addEventListener: (name, cb) => { listeners[name] = cb; } };
let pads = [];
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });
const input = new Input({ querySelectorAll: () => [] });
input.keys.add('ArrowUp'); input.touch.left = true; input.touch.gas = true;
input.touch.padActive = true; input.touch.padSteer = 1;
input.poll(0.1);
listeners.blur();
let raw = input.poll(0.01);
assert.equal(raw.throttle, 0); assert.equal(raw.steer, 0); assert.equal(raw.brake, 0);
input.touch.brake = true; input.touchEdges.add('recover'); document.hidden = true;
listeners.visibilitychange(); raw = input.poll(0.01);
assert.equal(raw.brake, 0); assert.equal(raw.recover, false);
const button = (pressed = false) => ({ pressed, value: Number(pressed) });
pads = [{ connected: true, id: 'test', axes: [0], buttons: Array.from({length: 16}, (_, i) => button(i === 5)) }];
assert.equal(input.poll(0.01).shiftUp, true);
assert.equal(input.poll(0.01).shiftUp, false);
pads = []; input.poll(0.01); assert.equal(input.padConnected, false);
pads = [{ connected: true, id: 'test', axes: [0], buttons: Array.from({length: 16}, (_, i) => button(i === 5)) }];
assert.equal(input.poll(0.01).shiftUp, true);
console.log('PASS input regression: blur, visibility, stale touch edges, gamepad disconnect/reconnect');

input.reset(); input.bindings.right = 'KeyR';
listeners.keydown({code:'KeyR',preventDefault(){}});
raw = input.poll(1/60);
assert.ok(raw.steer > 0); assert.equal(raw.recover,false); assert.equal(raw.digitalSteer,true);
console.log('PASS remapped R steers without resetting the car');

for(const [key,action] of [['KeyC','camera'],['KeyT','telemetry'],['KeyF','perf'],['KeyP','pause']]){
 input.reset();input.bindings.right=key;listeners.keydown({code:key,preventDefault(){}});raw=input.poll(1/60);
 assert.ok(raw.steer>0);assert.equal(raw[action],false);
}
console.log('PASS remapped driving keys do not trigger camera, telemetry, performance or pause shortcuts');

input.reset();input.inRace=false;
for(const tagName of ['INPUT','SELECT','TEXTAREA']){
 for(const code of ['KeyF','ArrowLeft','ArrowRight'])listeners.keydown({code,target:{tagName},preventDefault(){}});
 raw=input.poll(1/60);assert.equal(raw.perf,false);assert.equal(raw.navNext,false);assert.equal(raw.navPrev,false);
}
console.log('PASS native text/select keyboard editing does not trigger game shortcuts or menu navigation');
