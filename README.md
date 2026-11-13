# VELOCITYVERSE 0.8 — Neon Coast

*Working title, not yet cleared for trademarks or store names.*

## What changed in 0.8 (11 November 2026)

**Interface.** The menus were rebuilt on the Neon Coast concepts in `design/neon-coast-20261111/`: five destinations
(Home, Story, Garage, World, Crew) over the live 3D car and circuit, a single lime primary action per screen, and the
motion timings from the concept storyboard (home reveal, press feedback, garage sweep, route trace, start shutter,
reward reveal) driven by GSAP. Reduced-motion settings switch all of it off. Android is locked to landscape.

**Story.** Twelve events in four acts (Act 4, "The open season", is new, with Juno Venn, Patch and Veska). Every event
opens with a character cutscene, then an event-ready screen with the setup and crew-chief choice, and ends with a
star reveal and a debrief scene.

**Every menu feature now feeds the racing.**
- *Garage*: three cars; four upgrade systems with three stages each that change the real vehicle model; paint, photo
  mode, and a Tune tab whose bench test drives the exact car you race. Rivals keep their own cars, so upgrades are a
  real advantage.
- *World*: the three circuits with mastery stars and section grades taken from your own valid laps, quick race, time
  trial, free drive, three cups scored from real finishing orders, and Maela's driving school with bronze, silver and
  gold medals.
- *Crew*: Neri, Tavi, Maela and Sola each have a bond that grows from what you do and gives a real bonus; each bond
  level opens more of their story.
- *Home*: three daily goals with a streak bonus; *Profile*: trophies, cups and best laps.
- One wallet (credits) and one driver level across everything. Existing 0.7 saves keep their car, circuit, parts and
  school passes.

**Look.** The showroom is now a rainy night quay: a wet concrete floor that mirrors the car and a lit skyline (windows,
neon signs, searchlights, out-of-focus street lights), neon columns, tyre stacks and a tool chest. Races run under a
storm sky with falling rain, splashes, rain ripples on a wet road, spray from the rear tyres and a blinking rain light
on every car. Every frame goes through a camera grade with lens dirt, halation and grain. Screen changes glitch, headings
decode, the game opens on a title sequence, and the main buttons carry a light sweep. Settings › Weather switches the
rain off (it is visual only; grip does not change). Reduced motion turns the glitch, decode and title sequence off.

**Driving.** One fix in the automatic gearbox: wheelspin alone can no longer trigger an upshift. Before this, a
powerful car could hunt between second and third gear out of slow corners and lose all drive (the Vanta GT took
about seven seconds to reach 100 km/h on the bench with a small torque increase; it now takes 3.8). All 34 physics
checks still pass.

## Build and test

| What | Command |
| --- | --- |
| Play in a browser | open `dist/velocityverse.html` |
| Rebuild the game file | `npm run build` |
| Play Store bundle and installable APK | double-click `Build Android Release.command`, or `npm run build:release` — see [docs/PLAY_STORE.md](docs/PLAY_STORE.md) |
| Logic and physics tests | `npm test` (includes 16 progression checks and the 34 physics checks) |
| Menu and race flow in a real browser | `npm run test:paddock` (12 checks) |

Verified in this update: `npm test` suites and the 12-check browser flow passed in headless Chrome with software
WebGL at 915×412, and the signed release (`release/VelocityVerse-0.8.0.aab` and `.apk`, version code 8, target API 36)
built on this Mac with the bundled game file byte-identical to the tested `dist/velocityverse.html`. **Not verified:**
anything on a physical phone, and frame rate or battery use (the rain and reflections cost GPU time; Settings ›
Graphics and Settings › Weather are the levers if a phone struggles). The older browser tests that drive the 0.7
menus (`smoke`, `test:app`, `test:features`, `test:career`, `test:story`, `test:responsive`, `test:visual`) have not
been updated for the new screens and will fail on their old selectors.

The 3D car, circuits and city are still the procedural prototype art. The concept images are a target, not a
screenshot; this build does not claim parity with any commercial racing game.

---

# History: The Openline 0.6 and earlier

## New in Android 0.6

Open **Light the Beacon** from the paddock to join Neri, Tavi, Maela and Sola. Choose a guide, predict a grip tradeoff, run actual vehicle-model comparisons (or drive a measured braking trial), publish or repeat the evidence, and complete one clean homologation lap against the AI field. An optional supported exhibition uses the same physical simulation and stays separate from competitive records. Saved choices, a physical showroom beacon and a cosmetic livery persist through reload/replay.

The Universe archive contains 18 original character profiles, 10 city histories and 12 circuit concepts. **Harbor Loop remains the one playable circuit**; other locations are explicitly lore. NPC crew is local story, not online multiplayer.

[0.6 implementation and acceptance](docs/OPENLINE_06.md) · [Full long-term universe bible](reports/Project%20Apex%20universe%20strategy.md)

The current Android debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. Build with `npm run build:android`; test the chapter with `npm run test:story` after `npm run build`.


Milestone 0 is the smallest runnable slice of the studio plan. It includes:

- an engine-agnostic vehicle and race simulation (one car model for the player and the AI);
- a headless physics validation suite;
- a playable browser build: practice, time trial with a ghost, and a Grand Prix against seven AI rivals.

It is **not** the production game. The production target is **Unity 6.3 LTS (URP)**, and this simulation is the tested reference that gets ported to C# in Milestone 1.

## Run it (no installs, no dependencies)

| What | Command | Needs |
| --- | --- | --- |
| Play | Open `dist/velocityverse.html` in Chrome, Edge or Safari (desktop or phone) | A browser with WebGL 2 |
| Play from source | `python3 -m http.server 8080` in this folder, then open `http://localhost:8080/web/` | Python 3 (ES modules need a server) |
| Physics tests | `node tests/validate.mjs` | Node 18+ |
| Rebuild the single file | `node tools/build.mjs` | Node 18+ |
| Browser smoke test | `node tests/browser_smoke.mjs` | Playwright + Chrome (set `PLAYWRIGHT_PATH`, `CHROME_PATH`) |

To test on your Android phone, copy `dist/velocityverse.html` to the phone and open it in Chrome, or serve the source from your computer on the same local network. No hosted deployment is implied by the repository push. Hold the phone sideways. On a slow phone set Settings → Graphics to Medium or Low.

**Controls.** Keyboard: arrows or WASD, Q/E to shift (manual gears), C camera, T telemetry, F performance overlay, R reset to track, Esc pause. Gamepad: left stick steers, RT throttle, LT brake, LB/RB shift, Start pause. Touch: steering buttons or slider on the left, pedals on the right, camera and reset at the top left. With automatic gears, hold Brake at standstill to reverse. With auto-throttle, release Brake and the car returns to Drive once safely stopped; with manual throttle, press Gas at standstill to return to Drive. Tilt only works where the browser allows motion sensors; the claude.ai viewer blocks them.

## What is in the build

- **Flow:** title → world hub → racing/garage/academy/explorer/engineering/team/records. First racing entry introduces assist choices. Garage → event → preparation → race → results → retry stays connected.
- **Modes:** Practice (unlimited laps), Time trial (out-lap plus 3 timed laps against your ghost), and **Grand Prix** (3 or 5 laps, standing start from a grid of 8: you start sixth against seven AI rivals at Easy, Medium or Hard pace).
- **Race presentation:** five F1-style start lights in 3D on the gantry and in the HUD with a random hold before lights out, a cinematic grid camera, live position and timing tower, interval to the car ahead, rivals on the minimap, FINAL LAP and finish banners, a cool-down lap that the car drives itself, and a full classification.
- **Timing and ghost:** lap timing interpolated to the line crossing, 3 sectors, 12 ordered checkpoints, track limits, wrong-way detection, and a personal-best ghost with live delta (practice and time trial; races do not set personal bests because slipstream and traffic change lap times).
- **Assist presets:** Rookie, Racer and Pro, plus 9 individual toggles. Personal bests are kept separately for *assisted* and *standard* classes.
- **Graphics presets:** Ultra, High, Medium, Low and Auto (Auto starts at Ultra on desktop and High on touch devices, and steps down to Medium if frames run slow).
- **Settings, telemetry (T) and performance overlay (F):** as before; every telemetry value is read from simulation state.

## Rendering (WebGL 2, original geometry and generated materials)

- HDR scene (RGBA16F where supported) with 4× MSAA on High/Ultra.
- A live cube-map reflection probe around your car (one face per frame, mipmapped for rough reflections). It drives clear-coated car paint with metallic flake, carbon-fibre twill, tire rubber, machined metal and glass.
- Planar reflections for the wet-look track and the harbour on Ultra, blurred vertically like real wet asphalt, with puddles and a drier rubbered-in racing line.
- Track markings (edge lines, dashed lanes), red/white curbs and a chequered start line, plus grid boxes.
- Scenery: packed grandstands on both sides of the main straight with floodlit crowds, phone lights and camera flashes, under curved glass canopies. Also a pit building with lit garages, catch fences, floodlight towers and LED arches.
- Skyline and sky: needle spires and a city skyline with windows lit floor by floor (detail fades to its average when sub-pixel to avoid shimmer), an elevated S-curved overpass, a loop and a helix tower, and floating platforms. The sky has a Milky Way with dust lanes, a planet and moon, a spiral galaxy, a dusk glow at the end of the main straight, horizon clouds and height fog.
- Effects driven by simulation state:
  - camera-facing light trails (tail lights and wing tips) that fade before the camera;
  - sparks from barrier and car contacts and from the floor plank bottoming out at speed;
  - tire smoke and skid marks from sliding tires;
  - brake discs that glow with an estimated brake temperature;
  - exhaust glow with backfires on lift-off and downshifts;
  - speed streaks above about 110 km/h.
- Post-processing: dual-filter bloom, anamorphic lens streaks, ACES tone mapping with light grading, speed-scaled chromatic aberration, radial motion blur (Ultra), speed lines, vignette and grain.

## Layout

```
src/sim/      engine-agnostic simulation (no DOM): units, data, track, vehicle, assists, race rules,
              traffic (car contacts, slipstream), ai (rival drivers)
src/game/     browser client: WebGL2 renderer, car model, effects, procedural scene, camera, input, audio,
              saves, telemetry, game shell
web/          HTML/CSS design system and screens
tools/        build.mjs bundles everything into dist/velocityverse.html
tests/        validate.mjs (physics), browser_smoke.mjs (UI flow), golden/ traces for the C# port, results/
```

Car, world and track tuning is data-driven (`src/sim/data.js`), and every parameter group carries a provenance label: sourced, estimated, tuned or fictional.

## Simulation summary

- **Units and axes:** SI units; axes match Unity (x right, y up, z forward).
- **Loop:** fixed 120 Hz chassis step with 4 wheel/tire substeps (480 Hz); rendering is interpolated between steps.
- **Chassis:** 6-DOF (planar plus heave, pitch and roll); per-corner springs, asymmetric dampers, bump stops and anti-roll bars.
- **Tires:** combined-slip tire model with load sensitivity and post-peak falloff; relaxation-length slip states integrated exactly, so there is no 1/v singularity at low speed.
- **Wheels and drivetrain:** implicit wheel-spin update; torque curve, auto-clutch launch, 8-speed gearbox, 8% driveline loss, limited-slip differential.
- **Aero:** drag and downforce scale with each world's air density. Per-car multipliers carry slipstream (up to 35% less drag right behind another car, fading to nothing at 45 m) and dirty air (up to 25% less downforce, fading over 25 m). Wake values are **estimates for gameplay**, not measured data.
- **Car-to-car contact:** oriented-box footprints, separating-axis test, one restitution + friction impulse per pair at the contact point (equal and opposite, so momentum is conserved), and a positional correction that adds no velocity.
- **Contacts with the circuit:** curbs with sloped ends and band-limited ridges; barriers are half-spaces, so a fast car cannot tunnel through them.
- **Assists and AI:** assists act only through steering angle, throttle, brake, gear selection or per-wheel brake and engine torque. They never move the car directly. AI rivals drive the same car through the same controls: pure-pursuit steering, the reference speed profile scaled by a tuned pace, and racecraft. Racecraft means passing on a chosen side, giving room alongside, braking on time-to-contact, and slowing in dirty air and when off the ideal line. The only exception is race control: it resets an AI car that cannot move for 4 s.
- **Brake temperature:** an estimated thermal model used only for the glowing discs; it does not change grip.

## Test results (latest run in this repo)

- `tests/results/report.md`: 34/34 physics checks passed. The original 29 cover acceleration, braking (ABS on/off), coast-down, constant radius, slalom, curbs, barrier impact, tunneling, rest/creep stability, frame-rate independence, timestep convergence, world gravity and air density, bot laps and CPU cost. The 5 new ones:
  - car contact conserves linear and angular momentum to floating-point precision and dissipates energy;
  - a side-by-side squeeze at 50 m/s stays stable;
  - slipstream at 12 m cuts drag and adds speed;
  - an 8-car AI field finishes 2 laps from a standing start without NaN or hard impacts;
  - the AI field is deterministic.
- `tests/results/browser_smoke.json`: UI checks in headless Chrome (see the file for the latest count and details). They cover the full flow, a scripted lap, PB and ghost saving, every graphics preset with no WebGL errors and a lit frame, a Grand Prix (field, start lights, AI racing, classification), reload persistence and the touch layout.

Frame rates from headless Chrome use software rendering (SwiftShader) and are **not** device measurements. **No Android device has been measured yet.**

## Placeholder assets and replacement plan

| Asset | Now (temporary, original) | Replace in |
| --- | --- | --- |
| Car model | Procedural VX-1 with LOD0/LOD1, separate wheels (`src/game/carmodel.js`) | M2: modelled and textured VX-1 with LODs |
| Circuit, stadium and city | Procedural from track data (`src/game/world.js`) | M2: art pass on the same track data |
| Sky, lighting and reflections | Procedural shaders, live reflection probe | M2: baked lighting and reflection probes in Unity URP |
| Rival drivers and teams | Fictional names and liveries in `src/game/main.js` | Keep fictional, or license a roster |
| Engine, tire, wind, rival and backfire audio | WebAudio synthesis | M2: recorded or designed audio in FMOD/Wwise |
| Fonts | Inter and Barlow Condensed (SIL Open Font License), bundled locally and embedded in the standalone build | Keep, or license a display face |

Original geometry and synthesized audio are project-authored. The asphalt material is AI-generated; bundled Google Fonts retain their OFL licences. See assets/textures/README.md and assets/fonts/.

## Known limitations

- Flat track (no elevation). No tire temperature or wear, damage, wet-weather grip, or camber and kinematic suspension curves. The wet look is visual only.
- Car-to-car contact uses footprint boxes in the ground plane (no vertical contact, no wheel-to-wheel interlock). The wake model is a tuned estimate.
- The AI is competent but simple. It does not defend, has no strategy and no mistakes model, rubs wheels at the first corner in some starts, and drives Easy/Medium/Hard pace bands that have not been tuned against real players.
- ABS and TCS are threshold controllers defined at 120 Hz. Their limit cycles change if the step rate changes.
- Ghosts and bests live in this browser only. There are no accounts, no online leaderboards, no multiplayer and no data collection.
- The renderer's cost on phones is unmeasured; High/Ultra add MSAA, a live reflection probe and (Ultra) planar reflections.

## Next milestone (M1): Unity port and device proof

1. Create a Unity 6.3 LTS project with URP and Android (IL2CPP, ARM64) build support.
2. Port `src/sim/*.js` (including `traffic.js` and `ai.js`) 1:1 to plain C# classes (no MonoBehaviour in the core), keeping SI units and axes.
3. Load `tests/golden/vx1_scripted_v1.json` in a Unity Test Framework test. The C# port must match position within 0.05 m and speed within 0.1% at t = 16 s.
4. Port `tests/validate.mjs` to NUnit and keep all 34 checks green.
5. Drive the core from a fixed 120 Hz loop (`Time.fixedDeltaTime = 1/120`) and interpolate visuals in `Update`.
6. Build to the reference phone (Samsung Galaxy A54 5G) and capture a 20-minute session with the Unity Profiler and Android GPU Inspector. Report sustained frame time, thermal state and battery use against the budgets in the plan.

## Local review fixes (9 November 2026)

- Cleared keyboard, touch and smoothed pedal/steering state on focus loss, page hiding, pause and touch-control rebuilding. Touch buttons now track their owning pointer.
- Resume rebuilds touch controls from the current settings, so switching Buttons/Slider and pedal/gear options takes effect during an existing session.
- Cleared gamepad button history on disconnect so reconnecting does not swallow the first button press.
- Reduced the personal-best banner and moved it and notifications clear of telemetry.
- Browser tests now find a local Playwright installation and Chrome on macOS or Linux. Run `npm install`, `npm run smoke`, and `npm run test:controls` (override `CHROME_PATH` if needed).

Verification on this checkout: all 34 simulation checks, input regression checks, all 21 browser smoke checks, and the focused live control/HUD regression passed. Browser runs used software WebGL; their frame rate is not a phone measurement. The focused control test uses an actual held pointer on the pedal; the older smoke test's acceleration check also sets the touch state programmatically. No physical Android phone or gamepad was tested. Tilt sensor permissions and controller menu usability still need device validation. Screenshots are in `tests/results/`.

The reference images are concept-art direction, not a delivered quality level. This repository is a procedural browser prototype; a native Android/Unity project, production assets, online community systems, and device performance proof are not present.

### Graphics corruption and steering follow-up

The HDR shaders now clamp Fresnel inputs, avoid zero-vector normalization, use defined smoothstep ramps, and reject NaN/Infinity or excessive radiance before reflection sampling, bloom filtering and tone mapping. This prevents invalid HDR values from spreading across the frame; higher graphics presets retain their effects.

Assisted keyboard/button steering now has a progressive response, speed/load/surface-aware limits, and wheel-angle smoothing at the fixed simulation rate. The slip allowance retains the angle needed to corner; analog steering keeps its wider range. Slide recovery works through steering. ESC no longer adds rear-wheel braking to force an understeering car to rotate, and remains active when the driver countersteers. Pro/unassisted driving still requires throttle and steering discipline. If R is remapped to steering it no longer also triggers recovery; defaults remain A/D or arrows to steer, R to reset.

Targeted verification: 34/34 physics checks; 30 digital handling trials (72–288 km/h, left/right, lower grip, reversal, release, heading invariance, and Rookie auto-throttle with line guidance disabled for the isolated release check); two ESC countersteering checks; real A/D events at six circuit locations; 120 moving-camera frames each at Medium, High and Ultra; and an HDR regression that deliberately poisons the reflection map with NaN/Infinity. No WebGL errors or black/white blowout appeared in these graphics checks. These are software-WebGL regression checks, not a guarantee for every GPU or a mobile endurance measurement. Run `npm run test:handling`, `npm run test:hdr`, and `node tests/browser_graphics_handling.mjs`. Reload the open game after rebuilding.

The follow-up full browser regression also passed all 21 checks, including a valid lap and ghost save, Grand Prix flow, all graphics presets, persistence, and phone-sized controls.

## City and presentation art pass

The attached visual references informed the stadium canopy, luminous track edges and future-city scale. The playable browser scene now includes 51 detailed track-facing buildings, 115 layered city buildings, recessed lit windows, architectural floor plates/mullions, rooftop equipment, pit-bay depth, planted streets, service vans, freight stacks and a waterfront opening. Grandstands have real stair treads, benches and spectator silhouettes. The car has sculpted sidepod/engine cowls, cooling louvers, machined wheels, technical hardware and an open diffuser exit.

The UI uses Inter/Barlow Condensed with a charcoal/ivory/cyan palette, smaller race instrumentation and revised title/garage/settings presentation. Rendering adds cached directional shadow maps on Medium/High/Ultra, selective warm interiors, restrained bloom, filtered surface detail and original mipmapped circuit signage. Invalid HDR guards remain in place; a Metal-specific negative-base pow expression in the sky was replaced with multiplication.

Verification: 34/34 physics checks and 21/21 browser flow checks passed during the art pass. Final captures cover title, garage, settings, stadium/city/waterfront/chicane and an 844×390 touch layout; all final review views had no WebGL errors on Apple M1 Metal. Minimum touch target was 46 CSS px. The deliberate NaN/Infinity reflection-map regression also passed. Run `node tests/visual_review.mjs` to regenerate the actual-game screenshots in `tests/results/art_*.png`. `VV_NATIVE_GPU=1 npm run smoke` uses the available native GPU; the default smoke test uses SwiftShader.

This is original procedural prototype art, not production asset quality or verified superiority to another game. Additional detail raises GPU cost: a short 30-frame 1440×900 Ultra review was approximately 28 FPS on the tested M1 browser; this is not a sustained benchmark. Auto graphics/dynamic resolution remain available. No Android hardware performance has been measured.

## Latest iteration: Driving Lab 0.2

- A connected three-exercise academy teaches manual launch/speed control, measured braking and clean cornering using actual car/circuit data. Resets, teleports, wrong-way driving and absent player input cannot earn false passes. First-pass medals and cosmetic XP save locally. Academy setup explicitly positions the car; the instructor never applies hidden forces. Automatic reverse is disabled only during the exercises so a held brake means a controlled stop.
- Driver licences, capped session XP and personal three-color liveries add offline identity/progression. They do not change car performance or imply online teams/leaderboards. Empty or repeated result screens do not manufacture XP.
- Photo mode in the garage/pause flow offers orbit, height, distance and lens controls and saves a real rendered PNG without UI. Escape returns through paused menus; starting a fresh session clears audio's pause mute.
- District geometry mixes curved, canted and terraced towers, planted sky terraces and a waterfront Beacon landmark. The car has partial rear-wheel fairings and integrated lamps. Visual curb height now matches the physical 25 mm model (plus the render offset).
- The road uses a generated albedo texture with shader-derived bump detail; paint uses a revised energy-aware BRDF and fill lighting. All fonts/materials are local and embedded in the standalone HTML; the connected feature test verified zero external HTTP requests. Audio is still synthesized, but firing-pulse/load/intake/transmission/grip layers replace the former detuned saw timbre.

Run `npm test` for input, career, academy and 34 physics checks; `npm run test:features` for connected medals/paint/persistence; `npm run test:photo` for export and pause navigation; `npm run test:audio` for real OfflineAudioContext signal/lifecycle checks. Existing smoke/HDR/visual commands remain. Screenshots and JSON reports are in tests/results.

The answer to whether the entire original Claude brief is implemented remains **no**. See [the full requirement audit](docs/REQUIREMENTS.md) and [the sourced product/production plan](docs/PRODUCT_PLAN.md). Native Unity/Android builds, physical-device/sustained thermal proof, production art/audio, accounts, parent-managed online connections, moderation, verified leaderboards, multiplayer and community championships remain outside this build. Design documents are not shipped services. No Asphalt parity or commercial-readiness claim is made.


## Latest app iteration: World Hub 0.3

The floating-island home is original cinematic menu art inspired by the supplied reference. Seven real destination buttons lead to racing, the live 3D garage, academy, circuit explorer, engineering lab, local team identity and driver records. The scene is menu artwork, not extra playable tracks. XP, medals, personal times and licence progress come from local saves; there are no invented currencies, online ranks or live-event counters.

- **Circuit explorer:** an interactive map of the real 17-section Harbor Loop, with actual length/radius and modeled reference-speed guidance.
- **Engineering:** three isolated studies use the real Vehicle simulation at 120 Hz. Baseline 0–100: 3.208 s; 100–0: 24.902 m. Grip and aero studies show measured comparisons and speed traces. They never upgrade or alter the live race car.
- **Team clubhouse:** choose a local name, tag, color and optional broad affiliation; save an SVG achievement card with your actual local progress. Online members, leagues and communication remain unimplemented.
- **Driver archive:** saved clean laps, XP, medals, race finishes, podiums, assist-separated personal bests/ghost availability and recent lap history.
- **Presentation:** a responsive world hub, coherent academy/event/app pages, phone layouts at 130% text, native text-editing controls, and bounded circuit-map sizing. Opaque app pages suspend unnecessary 3D rendering. Race HUD and driving dynamics were kept as the accepted foundation in this app-focused pass.

Build: `npm run build`. Open `dist/velocityverse.html` directly; artwork, asphalt and licensed fonts are embedded for offline use. Run `npm run test:app` for connected app routes, real lab comparisons, record/identity persistence, safe text, download and mobile layout checks. The record fixtures in that test verify presentation; academy/race tests independently exercise earning real progress.

App artwork and the exact built-in imagegen prompt are in [assets/art/README.md](assets/art/README.md). Source bitmap: `assets/art/archipelago-source.png`; optimized runtime artwork: `assets/art/archipelago.jpg`. The original prompt's full current status is in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Native Android validation, production assets/audio and account-backed community competition remain open; this is an offline browser prototype.


## Android lobby 0.4

The hub now uses a game lobby layout in both phone orientations: seven compact touch destinations, a persistent dock, layered hologram/bridge/mote motion, illuminated selection, tap ripples and short panel transitions. This is a bundled app experience with no navigation URLs, store currency or artificial social feed. App and OS reduced-motion preferences stop both Canvas and CSS animation; the lobby loop stops while racing or hidden. Decorative animation is capped at 20 paint Hz/approximately 650k pixels on Low and 30 Hz/2.1M pixels otherwise.

The Android project in `android/` packages the offline WebGL reference in an immersive hardware-accelerated WebView. It has Android Back handling, native touch feedback, clipboard support, scoped PNG/SVG exports and lifecycle pause. No Internet, GPS or broad storage permissions are requested. Only the trusted embedded app document can reach the JavaScript bridge. This is **Android packaging of the prototype**, not the planned Unity/C# engine port.

Run `npm run build:android` after installing SDK Platform 36, Build Tools 36.0.0 and a compatible JDK. The checked-in Gradle wrapper pins the build tools; see [android/README.md](android/README.md) for exact setup and proof/limits. No physical Android device, emulator endurance run or Play Store release is implied by a successful APK build.

`npm test` also covers lobby animation lifecycle/resource limits. `npm run test:app` now verifies 35 connected checks, including actual animation pixels, OS/app reduced motion, native-bridge exports/Back behavior under a test double, seven mobile destinations and the persistent dock. Native bridge test doubles do not replace testing the installed APK on a phone. Actual browser captures are `tests/results/v4_hub_*.png`.
