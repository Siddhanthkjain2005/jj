// VELOCITYVERSE client: WebGL2 renderer.
//  HDR scene target (MSAA where supported) · live cube-map reflection probe around the player's car (one face per
//  frame) for car paint, glass and metal · optional planar reflections for the wet track and water · bloom
//  (dual filter) + anamorphic streaks · ACES tone mapping, grading, chromatic aberration, speed lines, vignette.
// Quality presets trade effects for speed: low · medium · high · ultra.
import { M4, compile, upload, dynamicMesh } from './gfx.js';
import { buildWorld, buildRacingLine, buildSoftQuad, buildRing, NEON, LANES } from './world.js';
import { buildCarLOD0, buildCarLOD1, buildWheel } from './carmodel.js';
import { FX } from './fx.js';
import { ASPHALT_URL } from './assets.js';

export const QUALITY = {
  low: { shadow: 0, bloom: 0, refl: false, msaa: 0, radial: false, lines: false, streak: false, probe: 'static', probeSize: 64, smoke: false },
  medium: { shadow: 1024, bloom: 4, refl: false, msaa: 0, radial: false, lines: true, streak: false, probe: 'slow', probeSize: 96, smoke: true },
  high: { shadow: 1536, bloom: 5, refl: false, msaa: 4, radial: false, lines: true, streak: true, probe: 'live', probeSize: 128, smoke: true },
  ultra: { shadow: 2048, bloom: 5, refl: true, msaa: 4, radial: true, lines: true, streak: true, probe: 'live', probeSize: 128, smoke: true },
};

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec4 aCol; layout(location=3) in float aMat; layout(location=4) in vec2 aUV;
uniform mat4 uVP; uniform mat4 uModel;
out vec3 vW; out vec3 vN; out vec4 vC; out float vM; out vec2 vUV; out vec3 vO;
void main(){ vec4 w = uModel * vec4(aPos,1.0); vW = w.xyz; vO = aPos; vN = mat3(uModel) * aNor; vC = vec4(pow(max(aCol.rgb, vec3(0.0)), vec3(2.2)), aCol.a); vM = aMat; vUV = aUV; gl_Position = uVP * w; }`;

const NOISE = `
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }`;

// Bound radiance before filtering: one invalid HDR texel otherwise contaminates
// the probe mip chain and the whole bloom pyramid. NaN fails these comparisons.
const SAFE_GLSL = `
float finiteRadiance(float x) { return (isnan(x) || isinf(x)) ? 0.0 : clamp(x, 0.0, 40.0); }
vec3 safeHDR(vec3 c) { return vec3(finiteRadiance(c.r), finiteRadiance(c.g), finiteRadiance(c.b)); }
vec3 safeNormalize(vec3 v) { return v * inversesqrt(max(dot(v, v), 1e-12)); }
`;

const FS_MAIN = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec3 vW; in vec3 vN; in vec4 vC; in float vM; in vec2 vUV; in vec3 vO;
uniform vec3 uCam, uMoon, uMoonCol, uSkyAmb, uGndAmb, uFog, uTint, uSunDir, uSunCol;
uniform float uTime, uFogD, uReflOn, uPass, uTintK, uAlpha, uEnvOn, uBrake, uStart, uHW, uLane, uFlood;
uniform sampler2D uSign, uRoad;
uniform mat4 uShadowVP; uniform sampler2D uShadow; uniform float uShadowOn, uShadowSize;
uniform vec2 uRes; uniform sampler2D uRefl; uniform samplerCube uEnv;
out vec4 o;
${NOISE}
float shadowAt(vec3 pos, vec3 normal) {
  if (uShadowOn < 0.5) return 1.0;
  vec3 p = (uShadowVP * vec4(pos + normal * 0.08, 1.0)).xyz * 0.5 + 0.5;
  if (min(p.x,p.y) < 0.005 || max(p.x,p.y) > 0.995 || p.z < 0.0 || p.z > 1.0) return 1.0;
  float bias = 0.00025 + 0.0006 * (1.0 - max(dot(normal,uMoon),0.0)), vis = 0.0;
  for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++)
    vis += step(p.z - bias, texture(uShadow,p.xy + vec2(float(x),float(y)) / uShadowSize).r);
  float fade = smoothstep(0.40,0.49,max(abs(p.x-0.5),abs(p.y-0.5)));
  return mix(0.25 + 0.75 * vis / 9.0, 1.0, fade);
}
vec3 skyEnv(vec3 d){ // analytic environment (used while the probe itself is being rendered)
  vec3 c = mix(vec3(0.05,0.11,0.22), vec3(0.004,0.008,0.03), smoothstep(-0.05, 0.6, d.y));
  vec3 hd = safeNormalize(vec3(d.x, 0.0, d.z) + 1e-5), sd = safeNormalize(vec3(uSunDir.x, 0.0, uSunDir.z));
  c += uSunCol * pow(max(dot(hd, sd), 0.0), 5.0) * exp(-max(d.y, 0.0) * 9.0);
  c += vec3(0.12, 0.28, 0.55) * pow(max(0.0, 1.0 - abs(d.y) * 5.0), 3.0) * 0.5;
  return mix(c, vec3(0.025, 0.03, 0.045), (1.0 - smoothstep(-0.25, 0.0, d.y)));
}
vec3 envAt(vec3 d, float lod){ return uEnvOn > 0.5 ? safeHDR(textureLod(uEnv, d, lod).rgb) : skyEnv(d); }
float D_GGX(float NdH, float a){ float a2 = a * a, d = NdH * NdH * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d + 1e-5); }
vec3 surface(vec3 base, float metal, float rough, float clear, vec3 n, vec3 v){
  float NdV=clamp(dot(n,v),0.001,1.0),NdL=max(dot(n,uMoon),0.0);
  vec3 h=safeNormalize(v+uMoon),R=reflect(-v,n);
  float NdH=max(dot(n,h),0.0),VdH=clamp(dot(v,h),0.0,1.0);
  rough=clamp(rough,0.08,0.95);float a=rough*rough,k=(rough+1.0)*(rough+1.0)/8.0;
  float G=(NdV/(NdV*(1.0-k)+k))*(NdL/(NdL*(1.0-k)+k));
  vec3 f0=mix(vec3(0.04),base,metal),F=f0+(1.0-f0)*pow(1.0-VdH,5.0);
  vec3 spec=D_GGX(NdH,a)*G*F/max(4.0*NdV*NdL,0.001);
  vec3 diffuse=(1.0-F)*(1.0-metal)*base/3.14159;
  vec3 col=(diffuse+min(spec,vec3(8.0)))*uMoonCol*NdL*3.2*shadowAt(vW,n);
  vec3 irr=envAt(n,6.0)*0.65+mix(uGndAmb,uSkyAmb,n.y*0.5+0.5)*1.6;
  vec3 Fe=f0+(1.0-f0)*pow(1.0-NdV,5.0);
  col+=base*(1.0-metal)*irr+envAt(R,rough*6.0)*Fe*(1.0-0.45*rough);
  // A broad, cool stadium fill reveals curved bodywork; warm pit-side bounce gives contrast.
  col+=base*(1.0-metal)*(vec3(0.15,0.20,0.26)*max(dot(n,safeNormalize(vec3(-0.5,0.8,0.2))),0.0)
    +vec3(0.14,0.09,0.045)*max(dot(n,safeNormalize(vec3(0.7,0.25,-0.3))),0.0));
  if(clear>0.0){float fc=0.04+0.96*pow(1.0-NdV,5.0);col=col*(1.0-fc*clear)+envAt(R,0.5)*fc*clear;}
  return col;
}

vec3 planarRefl(float spread, float wob){
  vec2 suv = gl_FragCoord.xy / uRes + (vec2(vn(vW.xz * 0.45), vn(vW.zx * 0.5 + 7.0)) - 0.5) * wob;
  vec3 rc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 6; i++) { float fi = float(i) - 2.5, wt = exp(-fi * fi * 0.18); rc += safeHDR(texture(uRefl, suv + vec2(0.0, fi * spread)).rgb) * wt; ws += wt; }
  return rc / ws;
}
void main(){
  if (uPass > 0.5 && vW.y < 0.06) discard;
  int m = int(vM + 0.5);
  vec3 base = vC.rgb;
  vec3 n = safeNormalize(vN); vec3 v = safeNormalize(uCam - vW); if (dot(n, v) < 0.0) n = -n;
  vec3 amb = mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5);
  float shadow = shadowAt(vW,n);
  float NdL = max(dot(n, uMoon), 0.0) * shadow;
  vec3 col; float em = 0.0;
  if (m == 5) { col = base * (0.45 + 4.6 * vC.a); em = 1.0; }
  else if (m == 6) {
    float ph = fract((vUV.y - uTime * 48.0) / 22.0);
    col = base * (0.25 + 6.0 * pow(1.0 - ph, 10.0) + 1.0 * pow(1.0 - ph, 2.0)) * (0.4 + vC.a); em = 1.0;
  } else if (m == 7) { // crowd: floodlit people, phone lights, camera flashes
    vec2 g = vUV * vec2(1.9, 1.75); vec2 cell = floor(g); vec2 f = fract(g) - 0.5; float r = h2(cell);
    float det = 1.0 - smoothstep(0.14, 0.42, max(fwidth(g.x), fwidth(g.y)));
    float person = (1.0 - smoothstep(0.2, 0.44, length(f * vec2(1.0, 0.75))));
    vec3 cloth = mix(vec3(0.16, 0.16, 0.19), vec3(h2(cell + 1.3), h2(cell + 2.7), h2(cell + 4.1)), 0.4 * step(0.55, h2(cell + 9.1)) + 0.12);
    float phone = step(0.965, r) * (0.55 + 0.45 * sin(uTime * (1.0 + r * 5.0) + r * 50.0));
    float flash = step(0.9987, h2(cell + floor(uTime * 6.0))) * 18.0;
    vec3 light = amb + uFlood * 0.55;
    col = base * 0.4 * light + mix(vec3(0.085, 0.085, 0.1) * light, cloth * person * light * 0.8, det) + vec3(1.0, 0.95, 0.85) * (phone * 1.8 * det + flash * det + 0.05);
    em = 0.5;
  } else if (m == 8) { // Original motorsport signage, mipmapped for readable distant panels.
    col = safeHDR(texture(uSign,clamp(vUV,0.0,1.0)).rgb) * 1.65;
    col *= 0.97 + 0.03*sin(vUV.y*512.0*3.14159); em=1.0;
  } else if (m == 4 || m == 18) { // Recessed interiors behind individually shaded architectural glass.
    float seed = vC.a, glass = m == 18 ? 1.0 : 0.0;
    vec2 grid = vUV / vec2(m == 18 ? 1.8 : 2.6, 3.6);
    vec2 cell = floor(grid), f = fract(grid);
    vec2 aa = max(fwidth(grid),vec2(0.001));
    float detail = 1.0 - smoothstep(0.22,0.65,max(aa.x,aa.y));
    vec2 edge = min(f,1.0-f);
    float pane = smoothstep(0.07-aa.x,0.07+aa.x,edge.x) * smoothstep(0.095-aa.y,0.095+aa.y,edge.y);
    vec3 tangent = safeNormalize(cross(vec3(0,1,0),n));
    vec2 parallax = vec2(dot(v,tangent),v.y) / max(dot(n,v),0.25) * 0.12;
    vec2 room = clamp(f + parallax,0.0,1.0);
    float occupancy = step(0.63,h2(vec2(floor(cell.x/2.0),cell.y)+seed*73.1));
    float floorOn = step(0.23,h2(vec2(cell.y,seed*93.0)));
    float lit = occupancy * floorOn;
    float blind = step(0.72,h2(cell+seed*21.0));
    float slats = 0.58 + 0.42 * smoothstep(0.28,0.7,fract(f.y*12.0));
    float depth = mix(0.32,0.85,smoothstep(0.08,0.5,room.y));
    float ceiling = smoothstep(0.74,0.80,room.y)*(1.0-smoothstep(0.85,0.91,room.y));
    float partitions = (1.0-smoothstep(0.016,0.04,abs(room.x-0.45))) * 0.65;
    vec3 warm = mix(vec3(1.0,0.65,0.32),vec3(0.52,0.72,0.90),step(0.84,h2(cell.yx+seed*41.0)));
    vec3 reflected = skyEnv(reflect(-v,n));
    reflected += vec3(0.035,0.055,0.085) * (0.5+0.5*sin(vW.y*0.018+seed*12.0));
    float fres = 0.10 + 0.55 * pow(1.0-clamp(dot(n,v),0.0,1.0),5.0);
    vec3 glazing = reflected * (fres+0.13) * mix(0.72,1.08,h2(cell+seed));
    vec3 interior = warm * (depth + ceiling*0.65) * (1.0-partitions) * mix(1.0,slats,blind) * lit * 0.52;
    vec3 wall = base * (amb*1.7 + uMoonCol*NdL*0.65) + vec3(0.012,0.017,0.023);
    wall *= 0.75 + 0.25*vn(vW.xz*0.35+vW.y);
    vec3 panel = glazing + mix(vec3(0.004,0.006,0.009),interior,pane);
    vec3 resolved = mix(wall,panel,pane);
    // Unresolved windows converge to a dark average, never a pale noisy facade.
    col = mix(glazing*0.65 + warm*0.035,resolved,detail);
    col *= 0.7 + 0.3*smoothstep(0.0,14.0,vW.y);
    em = lit * pane * detail * 0.5;
  } else if (m == 17) { // canopy glass: triangulated panels with glowing frames; the underside is lit
    vec2 q = vUV / 3.2;
    float aw = (fwidth(q.x) + fwidth(q.y)) * 1.2 + 0.004;
    float l1 = abs(fract(q.x) - 0.5), l2 = abs(fract(q.y) - 0.5), l3 = abs(fract(q.x + q.y) - 0.5);
    float grid = max(max(smoothstep(0.5 - aw * 2.0, 0.5, l1), smoothstep(0.5 - aw * 2.0, 0.5, l2)), smoothstep(0.5 - aw * 2.0, 0.5, l3));
    float det = 1.0 - smoothstep(0.03, 0.12, aw);
    float under = vC.a, edgeGlow = smoothstep(18.0, 36.0, vUV.y); // brighter toward the cantilevered edge
    vec3 lineCol = vec3(0.16, 0.38, 0.58);
    col = surface(base, 0.0, under > 0.5 ? 0.3 : 0.07, 0.0, n, v) + lineCol * mix(0.07, grid, det) * (0.9 + under * (0.45 + 0.65 * edgeGlow)) + vec3(0.06, 0.22, 0.6) * under * (0.12 + 0.35 * edgeGlow);
    em = 0.6;
  } else if (m == 20) { // start lights (uv.x = column index)
    float on = step(floor(vUV.x) + 0.5, uStart);
    col = mix(vec3(0.05, 0.004, 0.006), vec3(1.0, 0.04, 0.05) * 9.0, on); em = on;
  } else if (m == 1) { // asphalt: aggregate, painted lines, puddles, wet reflections, glints
    float d = vUV.x, s = vUV.y, rub = vC.a;
    vec2 roadUV=vW.xz/2.0;
    vec3 stone=texture(uRoad,roadUV).rgb;
    float hE=textureOffset(uRoad,roadUV,ivec2(1,0)).r,hW=textureOffset(uRoad,roadUV,ivec2(-1,0)).r;
    float hN=textureOffset(uRoad,roadUV,ivec2(0,1)).r,hS=textureOffset(uRoad,roadUV,ivec2(0,-1)).r;
    vec3 roadN=safeNormalize(vec3((hW-hE)*2.4,1.0,(hS-hN)*2.4));
    float g=dot(stone,vec3(0.333))*8.0;
    float aw = fwidth(d) + 0.002, as = fwidth(s) + 0.002;
    float edge = (1.0 - smoothstep(0.1 - aw, 0.1 + aw, abs(abs(d) - (uHW - 0.42))));
    float ph = fract(s / 12.0), dash = smoothstep(0.0, as * 2.0 / 12.0 + 0.01, ph) * (1.0 - smoothstep(0.5 - as * 2.0 / 12.0 - 0.01, 0.5, ph));
    float lanes = (1.0 - smoothstep(0.07 - aw, 0.07 + aw, abs(abs(d) - uLane))) * dash;
    float paint = clamp(edge + lanes, 0.0, 1.0);
    float wet = smoothstep(0.38, 0.72, vn(vW.xz * 0.06 + 3.1) * 0.65 + vn(vW.xz * 0.27) * 0.35) * (1.0 - 0.6 * rub);
    wet = max(wet, 0.22) * (1.0 - paint * 0.6);
    vec3 light = amb * 1.2 + uMoonCol * NdL * 0.5 + vec3(uFlood) * (0.4+0.5*shadow);
    float fine = clamp(g*0.7,0.0,1.0), wear = vn(vec2(d*1.8,s*0.11));
    vec3 asphalt = stone * vec3(0.42,0.46,0.51) * (1.0-0.24*rub);
    float seams = (1.0-smoothstep(0.018,0.045,abs(fract(s/32.0)-0.5))) * 0.15;
    asphalt *= (1.0-seams) * (0.92+0.08*wear);
    col = mix(asphalt, vec3(0.56,0.59,0.61), paint*(0.85+0.15*fine)) * light;
    float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 4.0);
    vec3 refl = (uReflOn > 0.5 && uPass < 0.5) ? planarRefl(0.003, 0.0015) : envAt(reflect(-v,roadN),1.0+3.5*(1.0-wet));
    col += refl * (0.025+0.34*wet*wet)*(0.25+0.75*fres);
    col += uMoonCol*pow(max(dot(reflect(-uMoon,roadN),v),0.0),100.0)*wet*0.12;

  } else if (m == 2 || m == 3) { // run-off / ground, harbour water
    float g = vn(vW.xz * 2.7) * 0.5 + vn(vW.xz * 0.33) * 0.5;
    col = base * (0.72 + 0.5 * g) * (amb * 1.2 + uMoonCol * NdL + vec3(uFlood) * (m == 2 ? 0.5 : 0.0));
    float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), m == 3 ? 3.0 : 4.0), k = m == 3 ? 0.85 : 0.1;
    vec3 refl = (uReflOn > 0.5 && uPass < 0.5) ? planarRefl(m == 3 ? 0.01 : 0.012, m == 3 ? 0.03 : 0.006) : envAt(reflect(-v, vec3(0.0, 1.0, 0.0)), m == 3 ? 1.0 : 4.0);
    col += refl * k * (0.25 + 0.75 * fres);
    if (m == 3) col += vec3(0.01, 0.04, 0.09) * vn(vW.xz * 0.08 + uTime * 0.04);
  } else if (m == 19) { // floodlit paint (markings, curbs, barriers)
    float roughness = vn(vW.xz*11.0+vW.y*2.0);
    float grime = mix(0.6,1.0,smoothstep(0.0,1.8,vW.y));
    col = base * (0.82+0.25*roughness) * grime * (amb*1.4 + uMoonCol*NdL*0.6 + vec3(uFlood)*(0.35+0.65*shadow)) + skyEnv(reflect(-v,n))*0.015;
  } else if (m == 24) { // Round shaded spectator-head impostor, not square head cards.
    vec2 q=vUV*2.0-1.0;float rr=dot(q,q);if(rr>1.0)discard;
    float headLight=0.35+0.65*sqrt(max(0.0,1.0-rr));
    col=base*headLight*(amb*1.3+uMoonCol*0.5+vec3(uFlood)*0.4);
  } else if (m == 23) { // foliage: broadleaf color variation, soft sky transmission
    float mottled = vn(vW.xz*4.0+vW.y*2.0);
    col = base*(0.65+0.5*mottled)*(amb*2.0+uMoonCol*(0.2+0.6*NdL)) + vec3(0.008,0.018,0.009);
  } else if (m == 22) { // car paint: clear-coated with fine metallic flake
    float flake = step(0.984, h2(floor(vO.xz * 700.0) + floor(vO.y * 700.0) * 3.1)) * (1.0-smoothstep(0.2,1.0,length(fwidth(vO*700.0))));
    col = surface(base, 0.3, 0.22, 0.75, n, v) + uMoonCol * flake * NdL * 0.25;
  } else if (m == 12) { // carbon fibre: 2×2 twill weave in object space
    vec2 q = (abs(n.y) > 0.6 ? vO.xz : (abs(n.x) > 0.6 ? vO.zy : vO.xy)) * 140.0;
    float tw = step(0.5, fract((floor(q.x) + floor(q.y)) * 0.25 + 0.01));
    float fib = mix(0.5, 0.5 + 0.5 * sin((tw > 0.5 ? q.x : q.y) * 6.283), 1.0-smoothstep(0.25,1.0,max(fwidth(q.x),fwidth(q.y))));
    col = surface(base * (0.75 + 0.5 * mix(fib, 1.0 - fib, tw)), 0.0, 0.3, 0.85, n, v);
  } else if (m == 13) { col = surface(base, 0.0, 0.82, 0.0, n, v); }
  else if (m == 14) { col = surface(clamp(base * 2.6, 0.0, 1.0), 1.0, 0.33, 0.0, n, v); }
  else if (m == 15) { col = surface(base, 0.0, 0.03, 0.0, n, v); }
  else if (m == 16) { // brake disc: glows from dark red to orange with temperature (uBrake 0..1)
    col = surface(base, 0.0, 0.5, 0.0, n, v);
    float t = uBrake; col += mix(vec3(0.5, 0.02, 0.0), vec3(1.0, 0.42, 0.06), smoothstep(0.45, 1.0, t)) * smoothstep(0.05, 0.6, t) * 7.0 * t; em = t;
  } else { col = base * (amb * 1.3 + uMoonCol * NdL) + envAt(reflect(-v, n), 5.0) * 0.03; }
  if (uTintK > 0.0) { float scan = 0.65 + 0.35 * sin(vW.y * 70.0 - uTime * 12.0); col = mix(col, uTint * 1.6 * scan, uTintK); em = 1.0; }
  float dist = length(vW - uCam), hf = exp(-max(vW.y, 0.0) / 140.0);
  float fog = 1.0 - exp(-uFogD * dist * (0.35 + 0.65 * hf));
  vec3 vd = (vW - uCam) / max(dist, 1e-3);
  float sunAmt = pow(max(dot(safeNormalize(vec3(vd.x, 0.0, vd.z) + 1e-5), safeNormalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 4.0);
  col = mix(col, uFog + uSunCol * 0.22 * sunAmt, clamp(fog * (1.0 - 0.55 * em), 0.0, 1.0));
  o = vec4(safeHDR(col), uAlpha);
}`;

const FS_FX = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec3 vW; in vec3 vN; in vec4 vC; in float vM; in vec2 vUV; in vec3 vO;
uniform vec3 uCam, uFog; uniform float uFogD, uIntensity, uTime, uAlphaMode, uNear;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
void main(){
  int m = int(vM + 0.5);
  vec3 c = vC.rgb; float a = vC.a;
  if (m == 9) { // catch-fence wire mesh
    vec2 q = vec2(vUV.x, vUV.y * 1.95) / 0.12;
    float aw = fwidth(q.x) + fwidth(q.y);
    float g = max(smoothstep(0.5 - aw, 0.5, abs(fract(q.x + q.y) - 0.5)), smoothstep(0.5 - aw, 0.5, abs(fract(q.x - q.y) - 0.5)));
    a = mix(0.05, g * 0.45, 1.0 - smoothstep(0.25, 0.7, aw)) * (0.55 + 0.45 * vUV.y);
  } else if (m == 10) { a *= pow(max(0.0, 1.0 - length(vUV)), 1.6); }
  else if (m == 11) { a *= pow(max(0.0, 1.0 - abs(vUV.x)), 1.4); }
  else if (m == 21) { float r = length(vUV); a *= (1.0 - smoothstep(0.15, 1.0, r)) * (0.65 + 0.35 * h(floor(vUV * 3.0 + 7.0))); }
  float d = length(vW - uCam); float f = clamp(1.0 - exp(-uFogD * d), 0.0, 1.0);
  if (uNear > 0.0) a *= smoothstep(uNear * 0.35, uNear, d); // fade ground overlays right under the camera
  if (uAlphaMode > 0.5) o = vec4(safeHDR(mix(c, uFog, f)), clamp(a, 0.0, 1.0));
  else o = vec4(safeHDR(c * uIntensity * a * (1.0 - f * 0.75)), 1.0);
}`;

// Directional depth map grounds architecture and the car in the same light.
const FS_DEPTH = `#version 300 es
precision highp float;
in float vM;
void main(){ int m=int(vM+0.5); if(m==3 || m==5 || m==6 || m==8 || m==17) discard; }
`;

const VS_QUAD = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUV; out vec2 vP;
void main(){ vP = aP; vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.9999, 1.0); }`;

const FS_SKY = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec2 vP; in vec2 vUV; uniform mat4 uInv; uniform vec3 uCam, uSunDir, uSunCol; uniform float uTime; out vec4 o;
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec4 p = uInv * vec4(vP, 1.0, 1.0); vec3 d = safeNormalize(p.xyz / p.w - uCam);
  float y = d.y;
  vec3 c = mix(vec3(0.05, 0.11, 0.22), vec3(0.008, 0.016, 0.055), smoothstep(0.0, 0.42, y));
  c = mix(c, vec3(0.002, 0.004, 0.02), smoothstep(0.42, 1.0, y));
  vec3 hd = safeNormalize(vec3(d.x, 0.0, d.z) + 1e-5), sd = safeNormalize(vec3(uSunDir.x, 0.0, uSunDir.z));
  float az = max(dot(hd, sd), 0.0), glow = pow(az, 5.0) * exp(-max(y, 0.0) * 9.0);
  c += uSunCol * glow * 1.25 + vec3(1.0, 0.72, 0.42) * pow(az, 48.0) * exp(-abs(y) * 28.0) * 2.2;
  vec3 gn = safeNormalize(vec3(-0.45, 0.62, 0.64)); float b = dot(d, gn);
  float band = exp(-b * b / 0.024), neb = vn3(d * 5.0) * 0.55 + vn3(d * 13.0) * 0.3 + vn3(d * 33.0) * 0.15;
  float dust = smoothstep(0.42, 0.75, vn3(d * 9.0 + 4.0)) * exp(-b * b / 0.004);
  vec3 mw = mix(vec3(0.22, 0.3, 0.6), vec3(0.78, 0.62, 0.58), vn3(d * 3.0));
  c += mw * band * neb * 0.55 * (1.0 - 0.8 * dust) * smoothstep(0.02, 0.25, y);
  vec3 sp = d * 380.0; vec3 cell = floor(sp); float r = h3(cell);
  float star = step(0.9963 - band * 0.006, r) * (1.0 - smoothstep(0.0, 0.55, length(fract(sp) - 0.5)));
  c += vec3(0.85, 0.9, 1.0) * star * (0.55 + 0.45 * sin(uTime * 2.3 + r * 100.0)) * (1.2 + 6.0 * fract(r * 13.0)) * smoothstep(0.03, 0.2, y);
  vec3 pd = safeNormalize(vec3(0.62, 0.30, 0.72)); float pr = 0.085, cd = dot(d, pd);
  if (cd > 0.0) { // a distant planet with an atmosphere rim, and its moon
    vec3 px = safeNormalize(cross(vec3(0.0, 1.0, 0.0), pd)), py = cross(pd, px);
    vec2 q = vec2(dot(d, px), dot(d, py)); float rl = length(q);
    float disc = (1.0 - smoothstep(pr - 0.0025, pr, rl));
    vec3 sn = safeNormalize(vec3(q, sqrt(max(pr * pr - rl * rl, 0.0))));
    float lit = clamp(dot(sn, safeNormalize(vec3(-0.75, 0.35, 0.45))), 0.0, 1.0);
    vec3 pc = mix(vec3(0.05, 0.08, 0.16), vec3(0.28, 0.42, 0.62), vn3(vec3(q * 40.0, 1.0)) * 0.6 + q.y * 3.0);
    c = mix(c, pc * (0.08 + 1.1 * lit), disc);
    c += vec3(0.25, 0.55, 1.0) * (1.0 - smoothstep(pr * 0.99, pr * 1.18, rl)) * (1.0 - disc) * (0.25 + 0.5 * lit) * 0.9;
    vec2 mq = q - vec2(-0.16, 0.06); float md = (1.0 - smoothstep(0.0145, 0.016, length(mq)));
    c = mix(c, vec3(0.5, 0.52, 0.56) * (0.25 + 0.75 * clamp(-mq.x * 60.0 + 0.5, 0.0, 1.0)), md);
  }
  vec3 gd = safeNormalize(vec3(-0.3, 0.55, -0.78)); float gc = dot(d, gd);
  if (gc > 0.95) { // spiral galaxy
    vec3 gx = safeNormalize(cross(vec3(0.0, 1.0, 0.0), gd)), gy = cross(gd, gx); vec2 q = vec2(dot(d, gx), dot(d, gy)) * 18.0;
    float rr = length(q * vec2(1.0, 2.4)), ang = atan(q.y * 2.4, q.x); float arm = 0.5 + 0.5 * sin(ang * 2.0 - log(rr + 0.05) * 4.0);
    c += vec3(0.55, 0.62, 1.0) * exp(-rr * 3.0) * (0.35 + 0.65 * arm) * 0.9 + vec3(1.0, 0.9, 0.8) * exp(-rr * 18.0) * 1.5; }
  float cl = vn3(vec3(d.x * 5.0 + uTime * 0.004, y * 26.0, d.z * 5.0)) * 0.7 + vn3(vec3(d.x * 14.0, y * 60.0, d.z * 14.0)) * 0.3;
  float clouds = smoothstep(0.52, 0.82, cl) * smoothstep(0.015, 0.05, y) * (1.0 - smoothstep(0.1, 0.28, y));
  c = mix(c, vec3(0.07, 0.09, 0.17) + uSunCol * glow * 0.7, clouds * 0.65);
  float azm = atan(d.x, d.z);
  for (int i = 0; i < 4; i++) { float fi = float(i), baz = -2.6 + fi * 1.7 + 0.3 * sin(uTime * 0.21 + fi * 2.1);
    float beam = (azm - baz) * (12.0 + 30.0 * y);
    c += vec3(0.25, 0.5, 1.0) * exp(-beam * beam) * smoothstep(-0.01, 0.06, y) * (1.0 - smoothstep(0.05, 0.8, y)) * 0.12; }
  c = mix(c, vec3(0.03, 0.05, 0.09), (1.0 - smoothstep(-0.06, 0.0, y)));
  o = vec4(safeHDR(c), 1.0);
}`;

const FS_PRE = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh; out vec4 o;
void main(){
  vec3 c = (safeHDR(texture(uTex, vUV + uTexel * vec2(-1,-1)).rgb) + safeHDR(texture(uTex, vUV + uTexel * vec2(1,-1)).rgb) + safeHDR(texture(uTex, vUV + uTexel * vec2(-1,1)).rgb) + safeHDR(texture(uTex, vUV + uTexel * vec2(1,1)).rgb)) * 0.25;
  float br = max(c.r, max(c.g, c.b)), knee = uThresh * 0.5;
  float soft = clamp(br - uThresh + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
  o = vec4(min(c * max(soft, br - uThresh) / max(br, 1e-4), vec3(40.0)), 1.0);
}`;
const FS_DOWN = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 h = uTexel * 0.5;
  vec3 s = safeHDR(texture(uTex, vUV).rgb) * 4.0 + safeHDR(texture(uTex, vUV - h).rgb) + safeHDR(texture(uTex, vUV + h).rgb) + safeHDR(texture(uTex, vUV + vec2(h.x, -h.y)).rgb) + safeHDR(texture(uTex, vUV - vec2(h.x, -h.y)).rgb);
  o = vec4(s / 8.0, 1.0); }`;
const FS_UP = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uGain; out vec4 o;
void main(){ vec2 h = uTexel;
  vec3 s = safeHDR(texture(uTex, vUV + vec2(-h.x * 2.0, 0.0)).rgb) + safeHDR(texture(uTex, vUV + vec2(h.x * 2.0, 0.0)).rgb) + safeHDR(texture(uTex, vUV + vec2(0.0, h.y * 2.0)).rgb) + safeHDR(texture(uTex, vUV + vec2(0.0, -h.y * 2.0)).rgb);
  s += (safeHDR(texture(uTex, vUV + vec2(-h.x, h.y)).rgb) + safeHDR(texture(uTex, vUV + vec2(h.x, h.y)).rgb) + safeHDR(texture(uTex, vUV + vec2(h.x, -h.y)).rgb) + safeHDR(texture(uTex, vUV + vec2(-h.x, -h.y)).rgb)) * 2.0;
  o = vec4(s / 12.0 * uGain, 1.0); }`;
const FS_STREAK = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = -14; i <= 14; i++) { float fi = float(i), w = exp(-abs(fi) * 0.15); vec3 t = safeHDR(texture(uTex, vUV + vec2(fi * uTexel.x * 3.0, 0.0)).rgb); s += max(t - 0.15, 0.0) * w; ws += w; }
  o = vec4(s / ws, 1.0); }`;
const FS_COMP = `#version 300 es
precision highp float;
${SAFE_GLSL}
in vec2 vUV; uniform sampler2D uScene, uBloom, uStreak; uniform float uBloomK, uStreakK, uExposure, uSpeed, uTime, uLines, uRadial, uAberr; uniform vec2 uRes; out vec4 o;
vec3 aces(vec3 x){ x = safeHDR(x); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUV, dc = uv - 0.5; float r = length(dc);
  float ab = uAberr * (0.00008 + 0.00065 * uSpeed) * r * 4.0;
  vec3 col = vec3(safeHDR(texture(uScene, uv - dc * ab).rgb).r, safeHDR(texture(uScene, uv).rgb).g, safeHDR(texture(uScene, uv + dc * ab).rgb).b);
  if (uRadial > 0.5 && uSpeed > 0.02) {
    vec3 acc = vec3(0.0);
    for (int i = 1; i <= 6; i++) acc += safeHDR(texture(uScene, uv - dc * float(i) * 0.002 * uSpeed).rgb);
    col = mix(col, acc / 6.0, smoothstep(0.14, 0.58, r) * uSpeed * 0.35);
  }
  col += safeHDR(texture(uBloom, uv).rgb) * uBloomK + safeHDR(texture(uStreak, uv).rgb) * uStreakK * vec3(0.55, 0.8, 1.25);
  if (uLines > 0.5) {
    float ang = atan(dc.y, dc.x), id = floor(ang * 54.0 / 3.14159), rnd = fract(sin(id * 91.7) * 43758.5453);
    float streak = step(0.82, rnd) * smoothstep(0.3, 0.74, r) * pow(fract(r * 1.4 - uTime * (1.4 + rnd * 2.2) + rnd), 10.0);
    col += vec3(0.55, 0.9, 1.0) * streak * uSpeed * 1.6;
  }
  col = aces(col * uExposure);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, 1.08);
  col *= mix(vec3(0.94, 0.98, 1.08), vec3(1.04, 1.0, 0.95), smoothstep(0.15, 0.75, l));
  col *= 1.0 - smoothstep(0.45, 0.98, r) * 0.55;
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col += (fract(sin(dot(uv * uRes + fract(uTime) * 100.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.003;
  o = vec4(col, 1.0);
}`;

const FACE = [ // cube-map faces: screen x axis, screen y axis, view axis (OpenGL cube-map convention)
  [[0, 0, -1], [0, -1, 0], [1, 0, 0]], [[0, 0, 1], [0, -1, 0], [-1, 0, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[1, 0, 0], [0, -1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],
];
function cubeFaceVP(o, f, c, near, far) {
  const [S, T, M] = FACE[f], a = (far + near) / (far - near), b = (-2 * far * near) / (far - near);
  const dot = (v) => v[0] * c[0] + v[1] * c[1] + v[2] * c[2];
  o[0] = S[0]; o[4] = S[1]; o[8] = S[2]; o[12] = -dot(S);
  o[1] = T[0]; o[5] = T[1]; o[9] = T[2]; o[13] = -dot(T);
  o[2] = a * M[0]; o[6] = a * M[1]; o[10] = a * M[2]; o[14] = -a * dot(M) + b;
  o[3] = M[0]; o[7] = M[1]; o[11] = M[2]; o[15] = -dot(M);
  return o;
}

export class Renderer {
  constructor(canvas, track, car) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available on this device or browser.');
    this.gl = gl; this.canvas = canvas; this.car = car; this.track = track;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    this.depthP = compile(gl, VS, FS_DEPTH);
    this.main = compile(gl, VS, FS_MAIN); this.fx = compile(gl, VS, FS_FX); this.sky = compile(gl, VS_QUAD, FS_SKY);
    this.pre = compile(gl, VS_QUAD, FS_PRE); this.down = compile(gl, VS_QUAD, FS_DOWN); this.up = compile(gl, VS_QUAD, FS_UP);
    this.streakP = compile(gl, VS_QUAD, FS_STREAK); this.comp = compile(gl, VS_QUAD, FS_COMP);
    const t0 = performance.now();
    const { world, water, fence, artStats } = buildWorld(track);
    this.artStats = artStats;
    this.worldMesh = upload(gl, world); this.waterMesh = upload(gl, water); this.fenceMesh = upload(gl, fence);
    this.lineMesh = upload(gl, buildRacingLine(track));
    this.shadow = upload(gl, buildSoftQuad(1.2, 2.95, 0.008, [0, 0, 0, 0.82]));
    this.ringA = upload(gl, buildRing(3.6, 3.63, [...NEON.cyan, 0.7])); this.ringB = upload(gl, buildRing(4.2, 4.22, [...NEON.white, 0.35]));
    this.buildMs = performance.now() - t0;
    this.models = new Map();
    this.quadVao = gl.createVertexArray(); gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    this.fxAdd = dynamicMesh(gl, 30000); this.fxAlpha = dynamicMesh(gl, 14000);
    this.fxSys = new FX();
    this.vp = M4.create(); this.view = M4.create(); this.proj = M4.create(); this.inv = M4.create(); this.model = M4.create(); this.ident = M4.create();
    this.vpR = M4.create(); this.viewR = M4.create(); this.invR = M4.create(); this.mirror = M4.create(); this.mirror[5] = -1;
    this.vpF = M4.create(); this.invF = M4.create();
    this.shadowVP = M4.create(); this.shadowView = M4.create(); this.shadowProj = M4.create(); this.shadowMap = null; this.shadowCenter = null;
    // lighting: moon key light, cool ambient, dusk glow in the direction the main straight points
    const sp = track.pointAt(track.def.lineS, 0, {});
    this.L = { moon: norm([0.35, 0.72, -0.6]), moonCol: [0.70, 0.78, 0.94], sky: [0.10, 0.14, 0.22], gnd: [0.025, 0.03, 0.042], fog: [0.035, 0.055, 0.09], fogD: 1 / 2300,
      sun: norm([Math.sin(sp.heading), 0.02, Math.cos(sp.heading)]), sunCol: [0.72, 0.36, 0.18], flood: 0.45 };
    this.triangles = this.worldMesh.tris + this.waterMesh.tris + this.fenceMesh.tris;
    this.drawCalls = 0; this.targets = null; this.qName = 'high'; this.q = QUALITY.high;
    this.signTex = this._makeSign();
    this.roadTex = this._makeRoadTexture();
    this.black2D = this._solidTex(gl.TEXTURE_2D); this.blackCube = this._solidTex(gl.TEXTURE_CUBE_MAP);
    this.probe = null; this.probeFace = 0; this.probeFrame = 0; this.probePos = [1e9, 0, 0];
  }

  _makeRoadTexture() {
    const gl=this.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([75,75,75,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.assetsReady=new Promise(resolve=>{
      const img=new Image();img.onload=()=>{
        gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,img);
        gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
        const aniso=gl.getExtension('EXT_texture_filter_anisotropic');if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        this.materialLoaded=true;resolve(true);
      };img.onerror=()=>{this.materialLoaded=false;resolve(false);};img.src=ASPHALT_URL;
    });return tex;
  }

  _makeSign() {
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#0a171f';ctx.fillRect(0,0,2048,512);
    ctx.fillStyle='#72c4cf';ctx.fillRect(0,0,2048,12);ctx.fillRect(0,500,2048,12);
    ctx.fillStyle='#bfdfe1';
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(90+i*45,132);ctx.lineTo(120+i*45,132);ctx.lineTo(180+i*45,328);ctx.lineTo(150+i*45,328);ctx.fill();}
    ctx.font='bold 130px Arial, sans-serif';ctx.fillText('VELOCITYVERSE',330,250);
    ctx.font='38px Arial, sans-serif';ctx.fillStyle='#87a8b4';ctx.fillText('L U M E N  H A R B O R    /    G R A N D  P R I X',338,334);
    ctx.fillStyle='#d4ad7a';ctx.fillRect(1810,135,110,8);ctx.fillRect(1810,162,76,8);
    const gl=this.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return tex;
  }

  _solidTex(target) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(target, t);
    const px = new Uint8Array([0, 0, 0, 255]);
    if (target === gl.TEXTURE_2D) gl.texImage2D(target, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    else for (let f = 0; f < 6; f++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  }

  setQuality(name) { if (QUALITY[name] && name !== this.qName) { this.qName = name; this.q = QUALITY[name]; this._freeTargets(); this._freeProbe(); this._freeShadow(); } }

  // Car meshes per livery (LOD0/LOD1 bodies, four wheels each, underglow) — built once and cached.
  carModel(livery) {
    let m = this.models.get(livery.id);
    if (m) return m;
    const gl = this.gl, c = this.car, stripe = livery.stripe || [0.95, 0.12, 0.12];
    const wheels = (lod) => [[0.30, -1], [0.30, 1], [0.38, -1], [0.38, 1]].map(([w, s]) => upload(gl, buildWheel(w, s, livery.secondary, stripe, lod)));
    m = { livery, lod0: upload(gl, buildCarLOD0(c, livery)), lod1: upload(gl, buildCarLOD1(c, livery)), wheels: wheels(0), wheelsLod: wheels(1),
      glow: upload(gl, buildSoftQuad(1.2, 2.8, 0.02, [...livery.accent, 0.09])), trail: { tail: [1.0, 0.06, 0.16], tip: livery.secondary } };
    this.models.set(livery.id, m);
    return m;
  }

  invalidateModel(id) {
    const m=this.models.get(id);if(!m)return;const gl=this.gl;
    for(const mesh of [m.lod0,m.lod1,m.glow,...m.wheels,...m.wheelsLod]){gl.deleteBuffer(mesh.vb);gl.deleteBuffer(mesh.ib);gl.deleteVertexArray(mesh.vao);}
    this.models.delete(id);
  }
  resize(pixelRatio) {
    const c = this.canvas;
    const w = Math.max(1, Math.round(c.clientWidth * pixelRatio)), h = Math.max(1, Math.round(c.clientHeight * pixelRatio));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; this._freeTargets(); }
    return [w, h];
  }

  _tex(w, h) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (this.hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  _target(w, h, depth, samples) {
    const gl = this.gl, T = { w, h, tex: this._tex(w, h), fb: gl.createFramebuffer() };
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
    if (depth && !samples) { T.depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, T.depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, T.depth); }
    if (samples) {
      T.msFb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, T.msFb);
      T.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, T.msColor);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, this.hdr ? gl.RGBA16F : gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, T.msColor);
      T.msDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, T.msDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, T.msDepth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { T.msFb = null; T.ms = 0; T.depth = gl.createRenderbuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.bindRenderbuffer(gl.RENDERBUFFER, T.depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, T.depth); }
      else T.ms = samples;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return T;
  }
  _freeTargets() {
    const gl = this.gl; if (!this.targets) return;
    const all = [this.targets.scene, this.targets.refl, this.targets.streak, ...this.targets.bloom].filter(Boolean);
    for (const T of all) { gl.deleteTexture(T.tex); gl.deleteFramebuffer(T.fb); if (T.depth) gl.deleteRenderbuffer(T.depth); if (T.msFb) { gl.deleteFramebuffer(T.msFb); gl.deleteRenderbuffer(T.msColor); gl.deleteRenderbuffer(T.msDepth); } }
    this.targets = null;
  }
  _ensureTargets() {
    if (this.targets) return;
    const c = this.canvas, q = this.q;
    const samples = q.msaa ? Math.min(q.msaa, this.maxSamples) : 0;
    const scene = this._target(c.width, c.height, true, samples);
    const refl = q.refl ? this._target(Math.max(1, c.width >> 1), Math.max(1, c.height >> 1), true, 0) : null;
    const bloom = [];
    let w = c.width >> 1, h = c.height >> 1;
    for (let k = 0; k < q.bloom; k++) { bloom.push(this._target(Math.max(1, w), Math.max(1, h), false, 0)); w >>= 1; h >>= 1; if (w < 2 || h < 2) break; }
    const streak = q.streak && bloom.length > 1 ? this._target(bloom[1].w, bloom[1].h, false, 0) : null;
    this.targets = { scene, refl, bloom, streak };
  }

  _freeShadow() {
    if (!this.shadowMap) return;
    const gl=this.gl; gl.deleteTexture(this.shadowMap.tex); gl.deleteFramebuffer(this.shadowMap.fb);
    this.shadowMap=null; this.shadowCenter=null;
  }
  _updateShadow(focus,cars) {
    if (!this.q.shadow || !focus) return;
    const gl=this.gl, size=this.q.shadow;
    if (!this.shadowMap) {
      const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,tex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) {gl.deleteFramebuffer(fb);gl.deleteTexture(tex);return;}
      this.shadowMap={tex,fb,size};
    }
    // Static scenery is cached between nearby frames; car contact uses the soft ground shadow.
    if (this.shadowCenter && Math.hypot(focus.x-this.shadowCenter[0],focus.z-this.shadowCenter[1])<10) return;
    const extent=180, snap=2*extent/size, x=Math.round(focus.x/snap)*snap,z=Math.round(focus.z/snap)*snap;
    const light=this.L.moon;
    M4.lookAtLH(this.shadowView,x+light[0]*900,25+light[1]*900,z+light[2]*900,x,25,z);
    const p=this.shadowProj;p.fill(0);p[0]=p[5]=1/extent;p[10]=2/1800;p[14]=-1;p[15]=1;
    M4.mul(this.shadowVP,p,this.shadowView);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowMap.fb);gl.viewport(0,0,size,size);gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.depthP.p);gl.uniformMatrix4fv(this.depthP.u.uVP,false,this.shadowVP);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,2.0);
    this._draw(this.depthP,this.worldMesh);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    this.shadowCenter=[focus.x,focus.z];
  }

  // ---------- reflection probe (cube map with a mip chain for rough reflections) ----------
  _freeProbe() {
    const gl = this.gl, P = this.probe; if (!P) return;
    gl.deleteTexture(P.tex); P.fbs.forEach((f) => gl.deleteFramebuffer(f)); gl.deleteRenderbuffer(P.depth);
    this.probe = null;
  }
  _ensureProbe() {
    if (this.probe) return this.probe;
    const gl = this.gl, size = this.q.probeSize, levels = Math.floor(Math.log2(size)) + 1;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, levels, this.hdr ? gl.RGBA16F : gl.RGBA8, size, size);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, size, size);
    const fbs = [];
    for (let f = 0; f < 6; f++) {
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      fbs.push(fb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.probe = { tex, fbs, depth, size, ready: 0 };
    this.probeFace = 0;
    return this.probe;
  }
  _renderProbeFace(f, pos, time) {
    const gl = this.gl, P = this.probe;
    cubeFaceVP(this.vpF, f, pos, 0.3, 4000); M4.invert(this.invF, this.vpF);
    gl.bindFramebuffer(gl.FRAMEBUFFER, P.fbs[f]); gl.viewport(0, 0, P.size, P.size);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cam = { eye: pos };
    this._sky(cam, time, this.invF, false);
    gl.depthFunc(gl.LEQUAL);
    this._uniformsMain(cam, time, this.vpF, 0, P.size, P.size, false);
    this._draw(this.main, this.worldMesh); this._draw(this.main, this.waterMesh);
  }
  _updateProbe(pos, time) {
    const q = this.q, P = this._ensureProbe(), gl = this.gl;
    const moved = Math.hypot(pos[0] - this.probePos[0], pos[2] - this.probePos[2]);
    let faces = 0;
    if (!P.ready || (q.probe === 'static' && moved > 180)) faces = 6;           // full refresh
    else if (q.probe === 'live') faces = 1;                                      // one face per frame
    else if (q.probe === 'slow') faces = (this.probeFrame++ % 3 === 0) ? 1 : 0;  // every third frame
    if (!faces) return;
    if (faces === 6 || this.probeFace === 0) this.probePos = pos.slice();
    for (let k = 0; k < faces; k++) { this._renderProbeFace(this.probeFace, this.probePos, time); this.probeFace = (this.probeFace + 1) % 6; }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, P.tex); gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    P.ready = 1;
  }

  // ---------- effects ----------
  updateFx(dt, cars, time, opts) { this.fxSys.update(dt, cars, time, opts); }

  // ---------- frame helpers ----------
  _uniformsMain(cam, time, vp, reflPass, w, h, envOn) {
    const gl = this.gl, u = this.main.u, L = this.L;
    gl.useProgram(this.main.p);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform3f(u.uCam, cam.eye[0], reflPass ? -cam.eye[1] : cam.eye[1], cam.eye[2]);
    gl.uniform3fv(u.uMoon, L.moon); gl.uniform3fv(u.uMoonCol, L.moonCol); gl.uniform3fv(u.uSkyAmb, L.sky); gl.uniform3fv(u.uGndAmb, L.gnd);
    gl.uniform3fv(u.uFog, L.fog); gl.uniform1f(u.uFogD, L.fogD); gl.uniform3fv(u.uSunDir, L.sun); gl.uniform3fv(u.uSunCol, L.sunCol);
    gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,this.roadTex);gl.uniform1i(u.uRoad,4);
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.signTex);gl.uniform1i(u.uSign,3);
    gl.uniformMatrix4fv(u.uShadowVP,false,this.shadowVP);
    gl.uniform1f(u.uShadowOn,this.shadowMap ? 1 : 0);gl.uniform1f(u.uShadowSize,this.shadowMap ? this.shadowMap.size : 1);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.shadowMap ? this.shadowMap.tex : this.black2D);gl.uniform1i(u.uShadow,2);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uPass, reflPass ? 1 : 0); gl.uniform1f(u.uTintK, 0); gl.uniform1f(u.uAlpha, 1);
    gl.uniform1f(u.uBrake, 0); gl.uniform1f(u.uStart, this.startLights || 0); gl.uniform1f(u.uHW, this.track.halfWidth); gl.uniform1f(u.uLane, Math.abs(LANES[0])); gl.uniform1f(u.uFlood, L.flood);
    gl.uniform2f(u.uRes, w, h);
    const useRefl = !reflPass && this.targets && this.targets.refl && this.drawingMain;
    gl.uniform1f(u.uReflOn, useRefl ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, useRefl ? this.targets.refl.tex : this.black2D); gl.uniform1i(u.uRefl, 0);
    const env = envOn && this.probe && this.probe.ready;
    gl.uniform1f(u.uEnvOn, env ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_CUBE_MAP, env ? this.probe.tex : this.blackCube); gl.uniform1i(u.uEnv, 1);
    gl.activeTexture(gl.TEXTURE0);
  }
  _draw(prog, mesh, model) {
    const gl = this.gl;
    gl.uniformMatrix4fv(prog.u.uModel, false, model || this.ident);
    gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0); this.drawCalls++;
  }
  _sky(cam, time, inv, reflPass) {
    const gl = this.gl, u = this.sky.u, L = this.L;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.sky.p); gl.uniformMatrix4fv(u.uInv, false, inv);
    gl.uniform3f(u.uCam, cam.eye[0], reflPass ? -cam.eye[1] : cam.eye[1], cam.eye[2]); gl.uniform1f(u.uTime, time);
    gl.uniform3fv(u.uSunDir, L.sun); gl.uniform3fv(u.uSunCol, L.sunCol);
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLES, 0, 3); this.drawCalls++;
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
  // car: { pose, model, brakes[4] (0..1 glow), ghost }
  _drawCar(prog, car, eye, lodFar) {
    const c = this.car, p = car.pose, mdl = car.model, a = c.wheelbase * (1 - c.frontWeight), b = c.wheelbase * c.frontWeight;
    const far = lodFar || Math.hypot(p.x - eye[0], p.z - eye[2]) > 45, ghost = car.ghost;
    this._draw(prog, far ? mdl.lod1 : mdl.lod0, M4.fromPose(this.model, p.x, ghost ? 0 : -p.h, p.z, p.yaw, ghost ? 0 : p.pitch, ghost ? 0 : p.roll));
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), gl = this.gl;
    const corners = [[-c.trackFront / 2, a], [c.trackFront / 2, a], [-c.trackRear / 2, -b], [c.trackRear / 2, -b]];
    for (let i = 0; i < 4; i++) {
      const [lx, lz] = corners[i];
      const y = 0.33 + (ghost ? 0 : (p.road ? p.road[i] : 0));
      if (prog === this.main) gl.uniform1f(prog.u.uBrake, car.brakes ? car.brakes[i] : 0);
      this._draw(prog, (far ? mdl.wheelsLod : mdl.wheels)[i], M4.fromPose(this.model, p.x + cy * lx + sy * lz, y, p.z - sy * lx + cy * lz, p.yaw + (i < 2 ? p.steer : 0), ghost ? 0 : (p.spin ? p.spin[i] : 0), 0));
    }
    if (prog === this.main) gl.uniform1f(prog.u.uBrake, 0);
  }
  _fxProg(cam, alphaMode, intensity, time) {
    const gl = this.gl, u = this.fx.u, L = this.L;
    gl.useProgram(this.fx.p); gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniform3fv(u.uCam, cam.eye); gl.uniform3fv(u.uFog, L.fog); gl.uniform1f(u.uFogD, L.fogD);
    gl.uniform1f(u.uIntensity, intensity); gl.uniform1f(u.uAlphaMode, alphaMode); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uNear, 0);
  }
  _pass(prog, target, src, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(prog.u.uTex, 0);
    if (prog.u.uTexel) gl.uniform2f(prog.u.uTexel, 1 / src.w, 1 / src.h);
    if (setup) setup(prog.u);
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLES, 0, 3); this.drawCalls++;
  }

  // scene: { cam:{eye,target,fov}, cars:[{pose, model, brakes, ghost}], focus (pose for the probe and showroom),
  //          showLine, time, fxTime, speed (0..1), showroom, motion, startLights (0..5), fxOpts }
  render(scene) {
    const gl = this.gl, c = this.canvas, cam = scene.cam, q = this.q, time = scene.time;
    this.drawCalls = 0; this.startLights = scene.startLights || 0;
    this._ensureTargets();
    const T = this.targets, cars = scene.cars || [], focus = scene.focus;
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
    this.drawingMain = false;
    this._updateShadow(focus,cars);
    if (focus) this._updateProbe([focus.x, 1.1, focus.z], time);
    M4.perspectiveLH(this.proj, cam.fov, c.width / c.height, 0.25, 7000);
    M4.lookAtLH(this.view, cam.eye[0], cam.eye[1], cam.eye[2], cam.target[0], cam.target[1], cam.target[2]);
    M4.mul(this.vp, this.proj, this.view); M4.invert(this.inv, this.vp);
    if (T.refl) { // planar reflections: the scene through a mirror at y = 0, half resolution
      M4.mul(this.viewR, this.view, this.mirror); M4.mul(this.vpR, this.proj, this.viewR); M4.invert(this.invR, this.vpR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.refl.fb); gl.viewport(0, 0, T.refl.w, T.refl.h);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this._sky(cam, time, this.invR, true);
      gl.depthFunc(gl.LEQUAL);
      this._uniformsMain(cam, time, this.vpR, 1, T.refl.w, T.refl.h, true);
      this._draw(this.main, this.worldMesh);
      for (const car of cars) if (!car.ghost) this._drawCar(this.main, car, cam.eye, true);
    }
    this.drawingMain = true;
    const S = T.scene;
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.ms ? S.msFb : S.fb); gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this._sky(cam, time, this.inv, false);
    gl.depthFunc(gl.LEQUAL);
    this._uniformsMain(cam, time, this.vp, 0, S.w, S.h, true);
    this._draw(this.main, this.worldMesh); this._draw(this.main, this.waterMesh);
    for (const car of cars) if (!car.ghost) this._drawCar(this.main, car, cam.eye, false);
    // transparent and additive layers
    gl.enable(gl.BLEND); gl.depthMask(false);
    this._fxProg(cam, 1, 1, time); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const car of cars) if (!car.ghost) this._draw(this.fx, this.shadow, M4.fromPose(this.model, car.pose.x, 0, car.pose.z, car.pose.yaw, 0, 0));
    this._fxProg(cam, 0, 0.7, time); gl.blendFunc(gl.ONE, gl.ONE);
    this._draw(this.fx, this.fenceMesh);
    if (scene.showLine) { this._fxProg(cam, 0, 0.42, time); gl.uniform1f(this.fx.u.uNear, 14); this._draw(this.fx, this.lineMesh); gl.uniform1f(this.fx.u.uNear, 0); }
    this._fxProg(cam, 0, 1.0, time);
    for (const car of cars) if (!car.ghost) this._draw(this.fx, car.model.glow, M4.fromPose(this.model, car.pose.x, 0, car.pose.z, car.pose.yaw, 0, 0));
    if (scene.showroom && focus) { this._fxProg(cam, 0, 0.32, time); const m = M4.fromPose(this.model, focus.x, 0, focus.z, time * 0.3, 0, 0); this._draw(this.fx, this.ringA, m); this._draw(this.fx, this.ringB, m); }
    const V = this.view, fo = scene.fxOpts || {};
    this.fxSys.build(this.fxAdd, this.fxAlpha, cam.eye, [V[0], V[4], V[8]], [V[1], V[5], V[9]], scene.fxTime !== undefined ? scene.fxTime : time,
      { trails: true, smoke: q.smoke, streakK: q.lines ? (fo.streakK || 0) : 0, speed: fo.speed || 0, fwd: fo.fwd || [0, 1], smokeCol: [0.28, 0.32, 0.4], trailCols: (id) => (fo.trailCols ? fo.trailCols(id) : { tail: [1, 0.06, 0.16], tip: NEON.cyan }) });
    const flush = (mesh) => { gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.data, 0, mesh.count * 13); gl.uniformMatrix4fv(this.fx.u.uModel, false, this.ident); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); this.drawCalls++; };
    if (this.fxAdd.count) { this._fxProg(cam, 0, 1.9, time); flush(this.fxAdd); }
    if (this.fxAlpha.count) { this._fxProg(cam, 1, 1, time); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); flush(this.fxAlpha); }
    const ghosts = cars.filter((x) => x.ghost);
    if (ghosts.length) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this._uniformsMain(cam, time, this.vp, 0, S.w, S.h, true);
      gl.uniform3f(this.main.u.uTint, 0.35, 0.75, 1.0); gl.uniform1f(this.main.u.uTintK, 0.7); gl.uniform1f(this.main.u.uAlpha, 0.4);
      for (const g of ghosts) this._drawCar(this.main, g, cam.eye, false);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    if (S.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.msFb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.fb);
      gl.blitFramebuffer(0, 0, S.w, S.h, 0, 0, S.w, S.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    // bloom: bright pass → downsample chain → weighted additive upsample; anamorphic streaks from level 1
    const B = T.bloom;
    gl.disable(gl.DEPTH_TEST);
    if (B.length) {
      this._pass(this.pre, B[0], S, (u) => gl.uniform1f(u.uThresh, this.hdr ? 1.25 : 0.7));
      for (let k = 1; k < B.length; k++) this._pass(this.down, B[k], B[k - 1]);
      if (T.streak) this._pass(this.streakP, T.streak, B[1]);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let k = B.length - 1; k > 0; k--) this._pass(this.up, B[k - 1], B[k], (u) => gl.uniform1f(u.uGain, 0.62));
      gl.disable(gl.BLEND);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, c.width, c.height);
    const cp = this.comp; gl.useProgram(cp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.uniform1i(cp.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.length ? B[0].tex : this.black2D); gl.uniform1i(cp.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.streak ? T.streak.tex : this.black2D); gl.uniform1i(cp.u.uStreak, 2);
    gl.uniform1f(cp.u.uBloomK, B.length ? (this.hdr ? 0.30 : 0.25) : 0); gl.uniform1f(cp.u.uStreakK, T.streak ? 0.12 : 0);
    gl.uniform1f(cp.u.uExposure, 1.2); gl.uniform1f(cp.u.uSpeed, scene.motion ? scene.speed : 0); gl.uniform1f(cp.u.uTime, time);
    gl.uniform1f(cp.u.uLines, q.lines && scene.motion ? 1 : 0); gl.uniform1f(cp.u.uRadial, q.radial && scene.motion ? 1 : 0); gl.uniform1f(cp.u.uAberr, scene.motion ? 1 : 0.3);
    gl.uniform2f(cp.u.uRes, c.width, c.height);
    gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLES, 0, 3); this.drawCalls++;
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
  }
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
