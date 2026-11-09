# VELOCITYVERSE — original brief implementation audit

Audit date: 9 November 2026. Historical baseline: `ddccf991388b42a312da60694d5ac383c9ab3754` (`ddccf99`). The current summary and iteration deltas below supersede historical baseline findings where evidence is listed. This is an engineering checklist, not a claim that the complete commercial product has shipped.

**Answer to “has everything in the Claude prompt been implemented?”: no.** The repository now has a connected offline racing prototype, real academy exercises, cosmetic local progression, paint/photo tools, local discovery/engineering/identity destinations, an animated app lobby, and an A–H product/production planning document. Android WebView host source and packaging have also been added; build/lint/package proof and its limits are recorded in [android/README.md](../android/README.md). The planned Unity/C# native port is absent. Physical phone performance, online communities/championships, multiple playable worlds and parity with Asphalt remain unproven or unimplemented. Menu artwork is not additional playable content.

The brief deliberately has two scopes: a broad product/studio design and a narrow first playable. Section 10 explicitly defers large career systems, live multiplayer, open worlds, track editors and multiple playable universes. Deferring those systems is consistent with the brief; presenting them as implemented would not be.

## Current coverage — read before the historical checklist

The supplied prompt was checked across all eleven sections, including deliveries A–H. A written design, working offline feature, connected browser test and production service are different deliverables.

| Prompt area | Current coverage | Remaining acceptance gap |
|---|---|---|
| 1. Product vision | Original car/circuit, paint, academy and local progression work; product thesis is written | Community identity and competition require real services; no player preference evidence |
| 2. Audience/platform | Android-first recommendation, family assumptions and proposed device tiers are documented; an offline Android WebView application host and packaging project exist | The planned Unity/C# native port and iOS implementation are absent; no physical reference-device or target-audience validation |
| 3. Competitive scorecard | Nine required axes, three proposed differentiators and dated primary-source research are in [PRODUCT_PLAN.md](PRODUCT_PLAN.md) | No controlled build comparison, matched hardware benchmark or demonstrated superiority |
| 4. Physics | One coherent fixed-step model, optional assists, real-state telemetry and regression tests | Fictional/tuned parameters; no real-car validation, production damage/wear/temperature or unrestricted 3D road model |
| 5. Multiverse | One playable world; three world designs and their physical consequences are documented | Mesa Ardent and Halcyon Ring are designs, not selectable/drivable worlds; floating hub islands are scenic art |
| 6. Visuals/UI/sound | Connected offline race flows, academy, paint, photo export, local progression and scenic app hub destinations are implemented at prototype fidelity | Production asset/audio quality and physical-device accessibility/comfort remain unverified |
| 7. Community | Capped asynchronous team-loop and family safeguards are specified; local team identity belongs only to this device | No accounts, actual members/invites, weekly leagues, moderation/reporting, parent-managed connections or city/national competition |
| 8. Engineering/performance | Modular reference engine, current engine comparison, budgets, Android host source, and Unity-port/authority/prediction designs | WebView packaging is not the Unity port; no sustained physical Android thermal/battery/GPU evidence or online authority |
| 9. Business | Three revenue/cost scenarios, labelled assumptions and pilot gates are written | No demand/retention/willingness-to-pay study, actual purchases, operating service or validated commercial outcome |
| 10. First playable | Most functional browser slice items work with automated coverage; Android host packages the same reference implementation | Physical Android installation/runtime, human handling/accessibility and sustained performance gates remain open |
| 11. Deliveries A–H | All eight planning headings have substantive coverage in [PRODUCT_PLAN.md](PRODUCT_PLAN.md); exact browser setup and tests are available | Planning completion does not establish a shipped commercial product or satisfy the unresolved acceptance gates |

The current production priorities are final Android package verification followed by physical-device proof, supervised beginner/family playtests, and authored asset/audio quality with measured performance. A successful APK assembly establishes packaging, not those runtime gates. Account-backed community work follows its documented safety and validation gates. No shop, invented currency balance, fake global rank or artificial live-event countdown is needed to make the offline app feel complete.

## Historical baseline checklist

The numbered sections below describe `ddccf99`. For example, “Missing” academy or product-plan entries are historical findings corrected by the later verified deltas; they are not the current status.

Status terms:

- **Implemented**: connected source exists at prototype fidelity; the evidence column states the relevant limits.
- **Partial**: some required behavior or specification exists, but substantial parts are absent.
- **Missing**: no supporting implementation or deliverable was found in the baseline.
- **Deferred**: intentionally excluded from the first playable by the brief or a documented fidelity choice.
- **Unverified**: a target, capability or claim lacks the required measurement/research/playtest.

## 1. Product vision

| Requirement | Status | Baseline evidence and remaining gap |
|---|---|---|
| Original single-seat car and racing foundation | Implemented | [Car data](../src/sim/data.js), [procedural model](../src/game/carmodel.js), [vehicle simulation](../src/sim/vehicle.js), and connected Practice/Time Trial/Grand Prix in [game shell](../src/game/main.js). One car; provisional original procedural assets. |
| Extraordinary worlds and discovery | Partial | One rendered circuit in [world.js](../src/game/world.js). Two further world parameter records exist, but are explicitly `playable: false`. No exploration or discovery loop. |
| Team/player identity, drivers, garages and liveries | Partial | Three fixed liveries are selectable and saved. Rival team/driver names in `RIVALS` are AI presentation data, not a player team system. No driver/avatar or garage customization. |
| Learn driving and engineering through interactive challenges | Missing | Assist selection and transient coaching text exist; there is no scored lesson/challenge sequence or demonstrated engineering exercise. |
| City/national/community competition and lasting social relationships | Deferred | No accounts, online team membership, messaging, championships or shared backend. These are beyond the brief's first slice. |
| Concise product thesis, assumptions and reasons to choose the game | Partial | Tagline and M0/Unity intent in [README](../README.md). No complete product thesis or tested differentiator evidence. |

## 2. Audience and platform

| Requirement | Status | Baseline evidence and remaining gap |
|---|---|---|
| Children 6–12/families as an evaluated audience assumption | Missing | No age-specific UX validation, parent interaction design or audience rationale document. A beginner assist preset does not establish suitability for children. |
| Beginner-to-expert accessibility | Partial | Rookie/Racer/Pro and individual assists in [assists.js](../src/sim/assists.js); keyboard, gamepad, touch buttons/slider/tilt in [input.js](../src/game/input.js). No observed beginner/family playtests or completed skill onboarding. |
| Android-first commercial choice with iOS path | Partial | README declares the intended direction. Executable artifact is browser HTML; no Android or iOS project/build exists in the baseline. |
| Named reference/minimum/high tier devices | Partial / Unverified | README names a proposed Samsung Galaxy A37 5G for a future Unity milestone, but no supporting device selection research or minimum/high tier specification exists. Treat the named target as unverified. |
| Sustained device validation and mobile-vs-PC recommendation | Missing | Phone-sized browser captures exist. No physical Android session, thermal/battery record, native profiling or reasoned platform tradeoff comparison. |

## 3. “Better than Asphalt” scorecard

No controlled comparison or competitor research exists in the baseline. The following axes have prototype evidence, but **none establishes superiority**:

| Axis required by brief | What is actually evidenced | Status against competitor claim |
|---|---|---|
| Steering response/driving satisfaction | Simulation and automated digital-input trials; no player preference study | Unverified |
| Braking, grip and weight | Headless braking/cornering/coast-down/curb checks against this fictional model's own targets | Unverified against real vehicles or another game |
| Speed perception/camera behavior | Chase/cockpit cameras, adjustable FOV/shake, speed effects | Unverified player comfort/readability |
| Visual identity/environment quality | Original procedural city/car plus actual-game review captures | Unverified comparable quality; assets remain visibly prototype fidelity |
| HUD clarity | Responsive desktop/touch layouts and flow tests | Partial; no fast-race usability study with target audience |
| Audio/haptics | Synthesized engine/tire/wind/curb/collision audio; browser vibration calls | Unverified on physical devices/headphones/controllers |
| Performance on comparable hardware | Short M1 browser captures and a low-resolution browser smoke run | Unverified; no matched Android comparison |
| Fair progression | Separate assisted/standard PB classes and no purchases | Partial; no progression economy or competitive service exists |
| Social/community value | Fictional AI team labels only | Deferred; no social loop to compare |

Dated official-source competitor/engine research, subjective-vs-factual labels and a prioritized differentiator scorecard are **missing**. No market, licensing or current product capability claim should be inferred from this table.

## 4. Driving physics

| Requirement | Status | Baseline evidence and fidelity |
|---|---|---|
| Mass, CG, inertia, springs/dampers, load transfer | Implemented at prototype fidelity | [data.js](../src/sim/data.js), `Vehicle.step()` in [vehicle.js](../src/sim/vehicle.js). Planar x/z/yaw motion plus chassis heave/pitch/roll, four corner loads and anti-roll/bump stops. Flat ground; not unrestricted 3D road/suspension kinematics. |
| Longitudinal slip, lateral slip, combined grip, load sensitivity and falloff | Implemented at prototype fidelity | `Vehicle._combined()`, `_mu()`, per-wheel relaxation states and substeps. Fictional/tuned parameters, not measured tire data or a validated “F1 simulation.” |
| Engine curve, gearing, losses and differential | Implemented at prototype fidelity | Torque curve and ratios in data; driveline/shift/clutch/LSD behavior in `Vehicle`. |
| Drag/downforce, gravity/air density, brake balance and wheel lockup | Implemented at prototype fidelity | Aero forces use `world.airDensity`; ABS/TCS/ESC and torque balance in vehicle core. Reduced-gravity/vacuum regressions exist. |
| Curbs/barriers/car contacts | Partial | Curbs and barrier half-space contacts plus planar oriented-box car-to-car contacts in [traffic.js](../src/sim/traffic.js). No vertical car contact or wheel interlock. Baseline visual curb geometry multiplies physical curb height by four in `buildWorld()`; visual/contact correspondence needs correction. |
| Consistent SI units and parameter provenance | Implemented | [units.js](../src/sim/units.js), data comments/provenance and garage labels. Unity is the intended matching-axis convention; there is no completed Unity port. |
| Fixed stepping/render interpolation/numerical guards | Implemented with measured limits | 120 Hz and four wheel substeps; snapshots/interpolation and max catch-up in game shell. Under overload, steps can be dropped; that counter must remain visible in performance reports. |
| Telemetry | Implemented | [telemetry.js](../src/game/telemetry.js) reads real speed, acceleration, slip, loads, suspension travel, steering, drag and downforce; CSV copy in game shell. Not mocked production sensor data. |
| Assists through controls/forces | Implemented | [assists.js](../src/sim/assists.js), vehicle electronics. Recovery/reset is explicitly a separate lap-invalidating action; AI stuck recovery is race control. |
| Acceleration/braking/coast-down/radius/slalom/curb/collision validation | Implemented as model regression | [validate.mjs](../tests/validate.mjs), [handling_regression.mjs](../tests/handling_regression.mjs), and result artifacts. Tests detect stability/regression against specified prototype expectations; they do not validate user satisfaction or real-car accuracy. |
| Tire temperature, wear, damage, advanced aero fidelity choices | Deferred, incompletely specified | No wear/damage/tire temperature performance model. Brake temperature is an estimated glow input only. No camber curves, aero map, stall or cooling model. A formal staged fidelity specification is still needed. |

## 5. Physically coherent multiverse

| Requirement | Status | Evidence and gap |
|---|---|---|
| Three distinct world designs with identity and physical rules | Partial | `lumen_harbor`, `mesa_ardent`, `halcyon_ring` in [data.js](../src/sim/data.js) define gravity, air density, surface coefficients and short weather labels. Narrative, track geometry, visibility rules and cooling consequences are incomplete for the latter two. |
| One playable ordinary-gravity world first | Implemented | Lumen Harbor / Harbor Loop is selected directly by the game shell. |
| Lower gravity/vacuum consistency | Implemented as regression | Lower-gravity and zero-density tests exist; downforce scales with density. No claim that aerodynamic downforce works in vacuum. |
| Weather affecting physical grip | Deferred | Lumen Harbor is physically dry. Wet-looking reflections are visual; rain, water film and weather-dependent grip are not simulated. |
| Gravity transitions, portals, loops as drivable track | Deferred | Loop/helix/floating platforms are scenery. The playable circuit is flat and ordinary gravity; those shapes must not be advertised as drivable features. |

## 6. Premium visuals, UI and sound

| Requirement | Status | Evidence and gap |
|---|---|---|
| Original design language/system | Implemented at prototype fidelity | CSS tokens, typography, spacing, focus, panels and motion behavior in [index.html](../web/index.html); procedural materials/lighting in [renderer.js](../src/game/renderer.js). Production art direction/style validation remains open. |
| First launch → garage → event → prep → race → pause/settings → results/retry | Implemented | Connected screens/actions in game shell; [browser_smoke.mjs](../tests/browser_smoke.mjs). Vehicle choice means one car/three liveries; event choice means modes on one circuit. |
| Progression, team hub, community championship flows | Missing / Deferred | PB/history exist. No rewards/lesson progression or player team hub. No community championship service. |
| Decision-focused actual-state HUD | Implemented | Speed, gear, lap/sector information; position/timing tower in Grand Prix; track/wrong-way warnings; real-state telemetry. No dummy energy/tire-wear bars. |
| Text scaling, reduced motion, focus and remapping | Partial | Settings for text scale/motion and keyboard driving remaps; focus states and basic controller menu navigation. Needs screen-reader, contrast, enlarged-text, alternate keybinding and physical controller coverage. |
| Comfortable touch/cutout layouts | Partial / Unverified | Safe-area CSS and phone-sized screenshots; captured targets >=44 CSS px. Physical finger reach, notches, orientation changes and sustained use remain unverified. |
| Chase/cockpit/FOV/shake configuration | Implemented | [camera.js](../src/game/camera.js) and settings. Comfort needs actual users/devices. |
| Engine/transmission/tire/aero/collision sound and tactile feedback | Partial | [audio.js](../src/game/audio.js) synthesizes RPM/load, shifts, scrub, wind, curbs, backfire and impacts, with a nearby rival voice. Haptics use optional `navigator.vibrate`. No designed/recorded production audio, environment soundscape, spatial mix or physical-device tactile QA. |
| Original/licensed assets and replacement plan | Partial | Original procedural geometry/shaders; Google Fonts with system fallback; README replacement table. No production UV/PBR asset pipeline, asset LOD baking, authored animation or commissioned environment kit. Original code is not proof of production asset quality. |

## 7. Community as product advantage

All account-backed community functionality is **deferred**, not implemented: player-created teams, capped weekly scoring, promotion/relegation, cooperative goals, city/national affiliations, invitations, shared achievements, reporting, moderated creations and preset communication. No network service or social database exists. There is no monetization or paid power advantage, but that alone is not a complete fair-progression design.

A first-community-loop specification is **missing**: contribution cap/formula, tie breaks, anti-cheat validation, sparse-league grouping and example calculations. Child/family account design and current intended-market legal review are also **missing**. Do not enable accounts, analytics, purchases or user communication merely to fill an audit box; they need the actual product and service safeguards first.

## 8. Engineering and performance

| Requirement | Status | Evidence and gap |
|---|---|---|
| Current Unity/Unreal stack comparison and official verification | Missing | README declares Unity 6.3 LTS/URP intent, but there is no dated official-source capability/license/cost comparison. The stated version/device target remains unverified. |
| Separation of simulation/input/rules/AI/camera/UI/world/saves/services | Partial | Simulation, AI, traffic, input, audio, camera, saves and rendering modules are separated. Game shell still owns multiple UI/race orchestration responsibilities. No online services layer. |
| Data-driven vehicle/world tuning | Implemented | Data records and units module. Much visual tuning remains embedded in renderer/world generation. |
| Instrumented frame/sim/render cost | Implemented at browser level | `PerfStats`, quality/resolution adaptation, dropped-step count, triangle/draw counters. CPU-side timing is not a GPU trace; heap reporting is browser-dependent. |
| Sustained 60 FPS reference Android proof | Unverified | No native Android build/device result. Desktop evidence is not a phone result. See measured evidence below. |
| Frame/memory/loading/battery/thermal budgets | Missing | Isolated targets appear in test text/README; no complete budget document or sustained representative-session record. |
| Multiplayer authority/prediction/reconciliation/latency/leaderboard validation design | Missing / Deferred | Offline ghosts are implemented. No server authority implementation or architecture specification; no cross-device deterministic-physics claim is established. |
| Exact setup/run and usable source | Implemented for browser | [README](../README.md), [package.json](../package.json), [build tool](../tools/build.mjs), distributable single HTML. Native integration is still a future milestone, not an existing build. |

## 9. Business design

The baseline has no conservative/base/optimistic revenue model, platform-fee/refund/acquisition assumptions, cost/cash-flow treatment, launch-community experiment, retention/onboarding metrics plan or willingness-to-pay study. This section is **missing**. No commercial-success, market benchmark, trademark clearance, profitability or valuation claim is supported. The “million-dollar company” line remains ambition rather than evidence.

## 10. First playable acceptance

| Required first-slice item | Baseline status | Acceptance needed before marking production-ready |
|---|---|---|
| One car/circuit/environment and functional vehicle simulation | Implemented prototype | Representative mobile sessions and player handling tests |
| Touch + keyboard/controller development support | Implemented / Unverified hardware | Physical Android and controller scenarios, lifecycle/orientation/interruption tests |
| Optional beginner assists | Implemented | First-time player task completion and comfort evidence |
| Practice/time trial, lap timing/checkpoints/personal ghost | Implemented | Continue regression coverage, malformed-save tests and repeated-session checks |
| Garage → race → results → retry | Implemented | Physical mobile flow/readability and accessible text/focus checks |
| Functional settings and local saves | Implemented with limits | Validated saved-data schema/range handling, storage failure and upgrade recovery |
| Telemetry/performance instrumentation | Implemented browser-level | On-device profiler, CPU/GPU attribution and sustained thermal/memory record |
| Premium visual and sound quality | Partial | Current procedural art/synthesized audio remains a prototype; production asset/mix pipeline and side-by-side art review are necessary |
| First driving introduction | Partial | Replace one-shot coach messages with explicit, measurable learn-by-driving tasks |

The baseline satisfies much of the **functional browser slice**, not the entire launch-quality product. Native packaging, visual polish and accessibility/performance validation must not be collapsed into a single “done” label.

## 11. Required deliveries A–H and milestone reporting

| Deliverable | Status |
|---|---|
| A. Product thesis + explicit assumptions | Partial: tagline/M0 intent only |
| B. Audience/platform/engine recommendation | Partial: target stated, evaluation and current verification missing |
| C. Three differentiators + sourced scorecard | Missing |
| D. Vehicle specification + fidelity levels | Partial: substantial source/data comments; staged fidelity specification missing |
| E. Art direction + main flows | Partial: working first-slice flows and code design system; full product flows absent |
| F. Architecture + prioritized milestones | Partial: module structure and future Unity checklist; schedule/gates/budgets incomplete |
| G. Business validation plan | Missing |
| H. First-playable acceptance criteria | Partial: executable regressions exist; this audit adds explicit remaining gates |

README milestone reports describe implementation, tests and limitations, but a passing test suite is not a completed product brief. Reports must name the tested artifact/commit, device/runtime, preset/resolution, sample duration, observations and unresolved limits.

## Recorded baseline evidence — what the numbers mean

These are committed report artifacts inspected during this audit, not fresh measurements performed by this documentation task:

- [Physics report](../tests/results/report.json): 34 model regression entries. The expected values are this fictional prototype's acceptance targets, not measurements from a real racing car.
- [Browser smoke report](../tests/results/browser_smoke.json): 21/21 checks, started `2026-11-09T04:36:18.204Z`. Desktop sample: about 58.8 FPS at **480×270**, Medium, with 70 recorded dropped simulation steps. This is not 60 FPS at native phone resolution.
- [Visual review](../tests/results/visual_review.json): Apple M1 / ANGLE Metal; desktop Ultra review at 1440×900 with no GL errors in four fixed views. The recorded 30 frames / 1,209.5 ms is about **24.8 FPS**, a short capture rather than a sustained gameplay or thermal benchmark. Another earlier README sample was around 28 FPS; keep the samples distinct.
- [HDR guard report](../tests/results/hdr_guard_check.json): deliberately poisoned reflection map remained free of GL errors and frame-wide black/white blowout under that harness. It does not prove every GPU/driver combination is fault-free.
- [Graphics/handling report](../tests/results/graphics_handling_regression.json): six circuit locations with real A/D events, plus 120 moving-camera frames each at Medium/High/Ultra. Not a mobile endurance session or human handling study.

Environment inspection on 9 November 2026 found Chrome, Node, Python, `adb`, Java 25 and Gradle 9.3.1. No Unity/Unity Hub/Blender/Android Studio application was found at the checked standard application paths, and no `unity`/`blender` executable was on PATH. `~/Library/Android/sdk`, Android SDK environment variables and `sdkmanager` were absent at the checked locations. `adb devices -l` listed no connected device or emulator. This is a bounded inspection, not proof that no installation exists anywhere on the machine.

## Highest-value next gates at the baseline

1. **Complete the first-time driving loop.** Implement measurable steering/braking/clean-lap tasks, clear success/retry feedback and saved local completion. Accept when an actual beginner can finish the introduction without explanation; automated tests must also prove the objective triggers derive from simulation state.
2. **Replace the visible prototype art bottlenecks.** Build a coherent, licensed/original asset/material workflow with reference-matched car/environment detail, grounded scale, readable track landmarks, stable anti-aliasing and controlled lighting. Accept fixed-camera before/after reviews and an in-motion mobile readability/performance check; adding polygon count alone is insufficient.
3. **Prove the target runtime.** First resolve SDK/engine tooling and a real reference device. A WebView package could be a useful explicitly labelled Android browser-runtime prototype, but it is not a Unity port or evidence of native production performance. Profile an offline representative session for 20 minutes; report frame-time distribution, dropped steps, CPU/GPU cost, memory, loading, battery and thermal behavior.
4. **Add modest local mastery/progression.** Reward learning/clean racing with cosmetic identity or milestones, not car performance. Retain assisted/standard distinctions. Do not invent online opponents, team contributions or league data to populate screens.
5. **Finish the product plan before community investment.** Deliver A–H with dated primary-source competitor/engine research and labelled assumptions. Choose and specify one capped community loop. Review intended markets/child safeguards before collecting accounts or connecting users.
6. **Gate expansion on evidence.** Multiple worlds, broader career content, live competition and spending systems follow stable driving, an adequate first-time experience and sustained device performance. Track editors/open worlds remain outside this slice.

## Verified iteration delta: Driving Lab 0.2

This delta updates the baseline findings above; it does not turn planned online/native features into implementations.

| Baseline gap | Added runtime behavior | Evidence / remaining limit |
|---|---|---|
| Assist-choice-only introduction | Three optional academy drills reachable on first launch and from the garage; real speed/braking/circuit-slip assessment and retry/pass flow | tests/academy.mjs uses actual Vehicle cases and false-credit rejection; tests/feature_flow.mjs exercises real keyboard launch/braking and a simulation-driven real corner through the connected game |
| Preset-only livery | Live three-color personal paint, bounded custom mesh replacement and local save | Connected feature test verifies paint changes, rendered model state and reload persistence |
| PB/history-only progression | Cosmetic driver licences, first-pass medals, capped valid-session XP, duplicate/empty-result exclusion | tests/career.mjs and feature_flow.json; purely local/tamperable, not a secure online economy or large career |
| Limited visual asset pipeline | Generated road material embedded in distributable, revised BRDF, varied tower forms, Beacon landmark and car fairings | Actual WebGL captures, material-load assertion and source asset/prompt provenance; still prototype art, no production/competitor parity |
| Generic synthesized engine | State-driven firing-pulse/load/coast/intake/gear/grip layers and bounded voice cleanup | Six actual OfflineAudioContext render cases finite/unclipped, silence and load contrast checked; human listening/recorded assets still needed |
| No shareable visual capture | Orbit/lens photo mode with real scene PNG export | tests/photo_flow.mjs verifies actual960×540 PNG, paused car, back navigation; no online sharing service |
| Remote font fetches | Licensed fonts and material bundled/embedded | feature_flow.json records zero external HTTP requests in standalone run; not a general child-privacy compliance certificate |
| Missing A–H planning package | Sourced docs/PRODUCT_PLAN.md covers audience, engine choice, scorecard, physics/world fidelity, UX, architecture, community, family safeguards, financial assumptions and acceptance gates | Design only. Country-specific legal review, native production build, actual demand/research and device benchmarking remain unresolved |

The remaining scope gap is not solved by declaring the browser build production-ready. Android WebView host source has since been added; physical Android proof, the planned Unity/C# port and authored production assets remain separate production gates, with the existing model and tests as the reference.

## App hub iteration — implementation and integration evidence

The latest user direction accepts the race screen/driving work and requests the surrounding app. The reference image informs the floating-island navigation composition; its F1 branding, portrait/legend licensing, currency balances and claimed live leagues are not copied into functional claims.

| Destination | Scope and boundary | Evidence status |
|---|---|---|
| Floating-world home | Implemented at prototype fidelity: original AI-generated scenic menu art behind seven actual interactive destinations, plus real local licence/XP/academy progress | [hub.js](../src/game/hub.js), [app.css](../web/app.css), [art provenance and exact prompt](../assets/art/README.md), and [animated-lobby desktop capture](../tests/results/v4_hub_desktop.png). The image is a backdrop, not a 3D explorable multiworld map. |
| Racing / garage / academy | Implemented at prototype fidelity: home routes to offline events, VX-1 showroom, personal paint, photo export and three real driving drills | [app flow harness](../tests/app_flow.mjs) exercises the first-launch introduction and all seven destination routes. Earlier feature/photo/flow tests cover the underlying features. |
| Circuit explorer | Implemented at prototype fidelity: inspect actual Harbor Loop geometry and segment information rather than an invented course or extra world | [app.js](../src/game/app.js) reads `Track.segments` and reference-speed data; the app flow harness selects every section. Guidance is modeled, not a recorded lap or guaranteed grip limit. Map containment is covered by an explicit layout regression. |
| Engineering lab | Implemented at prototype fidelity: three isolated studies run the real `Vehicle` model on a flat straight at 120 Hz: baseline, +15% peak tire friction, or +30% downforce with an assumed +18% drag penalty | [lab.js](../src/sim/lab.js), [lab.mjs](../tests/lab.mjs), [browser measurements](../tests/results/app_flow.json) and [lab capture](../tests/results/v3_lab_desktop.png). Repeatability, physical tradeoffs, finite state and unchanged race parameters are checked. |
| Local team identity | Implemented at prototype fidelity: device-local name/tag/color/voluntary affiliation and downloadable SVG achievement card; no account, public upload, members, matchmaking or invitation service | App flow checks native text editing, hostile input rendered as text, file contents and persistence after reload. Exporting a file is not secure team verification, cloud backup or a moderated social feature. |
| Driver records | Implemented at prototype fidelity: actual local PBs, earned medals/XP and recorded sessions; honest empty states for a new save | App flow uses explicit saved-record fixtures to check assisted/standard separation. No populated fake online ranking or national/city league is presented. Local saves remain user-editable. |

The [app flow report](../tests/results/app_flow.json) is generated from actual Chrome/ANGLE Metal interactions on Apple M1. Coverage includes 390×844 and 844×390 viewports at 130% text, minimum 44 CSS-pixel controls, navigation, simulation traces, input safety, save/reload and export. The final 35/35 app report passes explorer-map containment, enlarged-text card bounds, long-profile-name regressions, live animation pixels, reduced-motion behavior and connected Android-bridge test doubles. Automated desktop/browser emulation is not physical Android, native performance, human accessibility or Asphalt-comparison proof.

### Actual engineering results

Measured by `node tests/lab.mjs` on 9 November 2026. These are computed fictional-model outcomes, not real-car or Android-device measurements. Braking begins at the first simulation step reaching 100 km/h (actual entries 100.02–100.17 km/h); neutral coast begins at 150.14–150.22 km/h and ends at 100 km/h. Setup changes exist only inside fresh lab instances.

| Study | 0–100 km/h | ABS stopping distance | Neutral 150–100 km/h | Coast distance |
|---|---:|---:|---:|---:|
| Race baseline | 3.208 s | 24.90 m | 13.57 s | 460.42 m |
| Grip +15% | 2.675 s | 22.15 m | 13.54 s | 459.39 m |
| Downforce +30%, drag +18% | 3.170 s | 24.42 m | 11.65 s | 395.06 m |

The higher-downforce setup can improve the traction-limited launch slightly while its drag penalty shortens neutral coasting. Results are calculated, not chosen to force every change to look like an upgrade. These studies do not add car purchases, paid performance or live-race tuning.

### Still incomplete against the full prompt

- The planned Unity/C# native port, iOS implementation, physical Android installation/runtime checks, controls/tilt/controller validation, sustained 60 FPS and thermal/battery profiling on the named reference device. The added Android WebView package does not close these gates.
- Online identity, parent-managed connections, moderated names/creations, reporting/blocking, real team membership, anti-cheat/replay authority, weekly promotion/relegation and city/national/community championships.
- Multiple playable universes, real weather-dependent grip and authored production assets/audio. Menu islands and world-design cards do not close these items.
- Human playtesting, accessibility and family usability studies, comparable Asphalt testing, retention/commercial evidence and country-specific legal/store review.

The app provides a coherent offline prototype while these production systems remain explicitly deferred or unverified. A working menu destination or passing browser test does not close the outstanding native, production-quality, social or human-validation requirements.


### Animated Android lobby delta — 0.4

`src/game/lobby.js` adds capped Canvas hologram rings, bridge glints and motes; `web/app.css` adds panel/selection/touch motion and compact phone game-lobby layouts with a persistent dock. `tests/lobby.mjs` verifies animation shutdown, cadence and resource limits. `tests/app_flow.mjs` verifies actual pixel changes and OS/app reduced-motion freezing. Motion stops off-hub and while hidden. No race HUD or vehicle forces were changed for this app-focused iteration.

`src/game/navigation.js` and `src/game/platform.js` connect Android Back semantics, haptics, native scoped file exports and clipboard operations to the app. `android/` is an offline WebView host for the existing reference engine. APK/build evidence and limits are recorded in `android/README.md`; it must not be called a Unity/C# port, a physical-phone performance result or a commercial release. Online accounts, parent-managed relationships, moderation, multiplayer and championships remain absent.

The current [app flow report](../tests/results/app_flow.json) passes **35/35** browser checks, including actual animated-canvas pixel changes, OS/app reduced-motion freezing, Android Back routing and scoped SVG/PNG export calls through an explicitly marked native-bridge test double. This proves the JavaScript side of those contracts, not Android MediaStore, native haptics, gesture behavior or export results on a phone. [Portrait capture](../tests/results/v4_hub_390.png) and [landscape capture](../tests/results/v4_hub_844.png) show the compact phone lobby layouts under browser emulation.

The Android project is implementation source rather than a menu mockup. Initial APK assembly has been reported during this iteration; final assembly/lint/package verification is being recorded by the Android build task in [android/README.md](../android/README.md). No attached physical device or emulator has been used for runtime acceptance. Debug packaging is not a signed production/store release or evidence that the game sustains its target frame rate.
