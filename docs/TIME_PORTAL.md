# Time Portal research and implementation

## Historical catalogue and provenance

The archive contains 102 entries across 13 eras. It selects one representative chassis for each of the 77 Championship seasons from 1950 through 2026 and includes 25 additional entries for variants and experiments. A representative records a relevant design used in that season. Selection emphasizes engineering differences, so the archive includes cars outside the winning constructors. The pre-Championship introduction covers 1947–1949, with the 1948 Maserati 4CLT/48 as an example. [Catalogue source](../src/sim/history-data.js) · [Goodwood event archive](https://api.goodwood.com/grr/event-coverage/goodwood-revival/maserati-spotters-guide-for-the-2026-goodwood-revival/)

The catalogue uses the season entrants, chassis and engine tables from **F1DB by Marcel Overdijk and contributors**, release `v2026.20.0`, licensed under **CC BY 4.0**. This is a curated adaptation. The selected rows were reduced to a compact set, identifiers and engine classifications were normalized, and independently sourced descriptions and specifications were added. Season results provide a second, official competition reference. They typically identify the constructor or entrant, so chassis and engine assignments come from the dated index or an explicit manufacturer source. The 1956 Ferrari D50 designation follows Ferrari’s own heritage material. [F1DB release](https://github.com/f1db/f1db/releases/tag/v2026.20.0) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [Formula 1 results archive](https://www.formula1.com/en/results) · [Ferrari heritage](https://www.ferrari.com/content/dam/ferrari-fcom/old/pdf/pr_90_years_eng_fin.pdf)

The archive distinguishes nominal engine classes from sourced exact measurements. A null field means the archive has no confirmed value for that specification. The raceable original cars use a separate set of game parameters for mass, torque curves, tyres, drag and downforce. Those values describe the simulation. The data attribution covers the curated historical facts and descriptions.

## Engineering timeline

| Years | Era | Main development |
| --- | --- | --- |
| 1947–1953 | Birth of formula racing | Early supercharged and naturally aspirated front-engine cars. The World Championship began in 1950. The 1952 and 1953 Championship Grands Prix used Formula 2 rules, with Indianapolis retaining its own rules. |
| 1954–1960 | Classic Grand Prix machines | A 2.5-litre era encompassing open-wheel and specialized streamlined front-engine cars, followed by the rear-engine Cooper breakthrough. |
| 1961–1967 | Lightweight revolution | The 1.5-litre formula, aluminium monocoques, and the move to naturally aspirated engines of up to 3 litres in 1966. |
| 1968–1976 | Aerodynamic revolution | Early wings, revised radiator packaging and experimental alternatives such as the turbine Lotus 56B and six-wheel Tyrrell P34. |
| 1977–1982 | Ground effect and early turbo power | Sidepod tunnels, skirts, early Renault turbo engines, the Brabham fan car and the carbon-fibre monocoque. |
| 1983–1988 | Turbo years | Flat-bottom rules and growing turbo adoption. Engine output depended on car, boost setting, session and year. |
| 1989–1997 | Naturally aspirated power and electronics | V8, V10 and V12 layouts. Some designs used active suspension and other aids before the 1994 restrictions. |
| 1998–2005 | High-revving V10s | Narrower cars, grooved dry tyres and sophisticated naturally aspirated V10s. |
| 2006–2013 | V8s and advanced aerodynamics | The main 2.4-litre V8 formula, return of slicks, KERS, double and blown diffusers, and DRS. |
| 2014–2016 | Turbo-hybrid revolution | A 1.6-litre turbo V6 combined with MGU-K and MGU-H. Energy management and the eight-speed gearbox changed the operating strategy. |
| 2017–2021 | Wide, high-downforce hybrids | Wider tyres and bodies, Halo from 2018, and refinements such as the W11’s Dual Axis Steering. |
| 2022–2025 | Modern ground effect | Underfloor tunnels and 18-inch wheels. Individual cars used different aerodynamic solutions and development paths. |
| 2026 | Active aero and electrical strategy | Adjustable front and rear wings, greater kinetic electrical power, and removal of the MGU-H. |

Sources for the broad regulation transitions include the FIA’s historic car classification, Formula 1’s technical history and the Lotus and Mercedes team archives. Specific cars link to their own evidence in the museum. [FIA Appendix K](https://www.fia.com/sites/default/files/appendix_k_2025_2.pdf) · [Formula 1 regulation changes](https://www.formula1.com/en/latest/article/the-key-regulation-changes-in-f1-history-and-the-teams-that-nailed-them.2iq8c5E6S1HOffT5PBLl6i) · [Lotus heritage](https://www.lotuscars.com/en-GB/lotus-story/about-lotus?channel=app) · [Mercedes-AMG era review](https://www.mercedesamgf1.com/news/the-past-six-new-f1-eras-what-changed-and-what-happened)

## Competition and variant status

The catalogue distinguishes the open-wheel and streamlined W 196 R bodies and separately records the Ferrari 500’s 1952 and 1953 campaigns. The 56B turbine car entered both Championship and non-Championship events, while the BT46B fan car won on its sole Championship appearance. The P34 made Championship starts with four small front wheels and two rear wheels. The Lotus 88 appears as an experimental entry without a Championship race start. These records describe historical participation. The playable collection is a separate set of original game cars, and the 25 foundation slots describe the intended breadth of that collection. [Mercedes-Benz Classic](https://media.mercedes-benz.com/en/article/29004d7c-53c6-4531-89b1-4bf163ec3b8e) · [Ferrari heritage](https://www.ferrari.com/content/dam/ferrari-fcom/old/pdf/pr_90_years_eng_fin.pdf) · [Formula 1 experimental designs](https://www.formula1.com/en/latest/article/from-the-six-wheeled-tyrrell-to-the-dual-rear-wing-ferrari-10-of-the.1uvMU2qhHxAphWRhgjxwCj)

## 2026 rules snapshot

Reviewed 13 November 2026 against FIA Technical Section C issue 21, dated 19 October, and Sporting Section B issue 09, dated 1 October. Section C, articles C5.2.7–8, sets a 350 kW absolute electrical DC limit for ERS-K. Actual allowed propulsion power depends on speed, mode and the power-limited circuit sectors applicable to the session. In those specified Race or Sprint sectors the lower curve limits power to 250 kW below 310 km/h. These figures describe regulatory electrical limits. [FIA Technical Section C issue 21](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_21_-_2026-10-19.pdf)

Sections B7.1–2 distinguish driver-adjustable bodywork from the energy deployment rules. The front and rear wings can change configuration within authorized activation zones. Overtake depends on sporting eligibility and is disabled in declared Low Grip Conditions. The October sporting issue permits Boost under Low Grip Conditions only to inhibit a reduction in maximum driver power demand. Competition-specific parameters also apply. The MCL40 team specification documents an eight-speed transmission, 18-inch wheels, a 1.6-litre turbo V6 and both adjustable wings. Its February publication describes the launch hardware, so the October FIA issues take precedence for operating limits. [FIA Sporting Section B issue 09](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_09_-_2026-10-01.pdf) · [Formula 1 mode terminology](https://corp.formula1.com/f1-2026-regulations-terminology-update/) · [McLaren MCL40 specification](https://www.mclaren.com/racing/formula-1/2026/what-is-the-technical-specification-of-our-2026-formula-1/)

## How Time Portal fits Neon Coast

Neon Coast builds each session with `Vehicle`, a `Track` reference line, `DriverInput`, `RaceSession` and `RaceField`. `Paddock` manages the original Garage, World and progression. `Renderer` handles existing camera, lighting, meshes and effects, while `benchCar` runs a separate instance of the same model on a controlled straight. The Android Gradle project copies the standalone HTML into the APK at build time. The design boards and art folders were reviewed for continuity with the existing interface.

Time Portal opens from Garage and World. Its venue, weather, presets and progression have their own state. The original five destinations and the current save version continue to work. A valid lap in a History Career chapter adds its car ID to a sequential completion list in `timePortal`. Historical results leave the original cups, goals, credits, lap history and ghost records available for Neon Coast events. Returning to the original Garage restores the selected Neon Coast build.

The twelve existing Neon Coast story events remain available. Historical chapters are short car-specific briefings with a timed-lap objective. Free drive is available from the start. Same-era exhibitions use five AI cars on the same profile as the player. In cross-era races, the selected challenger uses its own physical definition, racing line and render model. Balanced races apply fictional power-to-mass, grip, aero and brake targets while preserving the underlying layouts and engine responses. This reduces some performance gaps and does not guarantee equal lap times.

## Playable vehicles

Each row is an original driving interpretation with a separate chassis, cockpit, wheels, engine curve, gearing, tyre and suspension setup. The historical catalogue entries are references. Sixteen archetypes have playable interpretations and nine foundation archetypes remain open, including the six-wheel P34 and four-wheel-drive turbine car. The current wheel and drivetrain model supports four contact patches and rear drive.

| Inspiration year | Playable vehicle | Mechanical focus |
| --- | --- | --- |
| 1950 | Aureline S8 | Supercharged front-engine layout, narrow tyres, soft suspension and zero modelled downforce |
| 1952 | Canto F2 | Formula 2 architecture, naturally aspirated inline-four and gradual momentum building |
| 1954 | Silhouette S54 | Front-engine streamliner with wheel fairings and lower drag |
| 1959 | Switchback R59 | Rear-engined packaging and a lighter, more responsive chassis |
| 1962 | Mistral M15 | Lightweight 1.5-litre monocoque |
| 1970 | Keel W70 | Early wings, wedge body and wide treaded tyres |
| 1978 | Venturi G78 | Ride-height-sensitive floor and tall rear wing |
| 1978 | Vortex F12 | Engine-driven suction approximation with animated rear fan |
| 1986 | Sable T86 | High-boost turbo torque with distinct spool and decay |
| 1992 | Datum A92 | Bounded active levelling forces reduce chassis movement |
| 2004 | Pulse V10 | High rev limit, close ratios and grooved tyres |
| 2006 | Flint V8 | High-revving V8 and a different aerodynamic package |
| 2014 | Vector H14 | Energy store, axle deployment and rear braking recovery |
| 2018 | Broadline H18 | Wide hybrid chassis, broader tyres and Halo |
| 2022 | Undertow F22 | Modern tunnel-floor sensitivity, large wheels and Halo |
| 2026 | Helix A26 | Higher electric contribution and working front and rear flaps |

West Apron, Foundry Road and Meridian Proving Ground have original layouts, terrain and roadside scenery. Dry, damp and rain choose different friction values for tarmac and kerbs and set corresponding render intensity. Tyre compounds are tuned per car. Wet tyres, standing-water physics and thermal degradation are future work. The period setup choices cover gearing, brake balance and wing changes where available. The first car on the bench uses the chosen setup. The second provides a stock comparison.

The 2026 preview uses an energy store, braking recovery, the normal published speed-curve shape, a simple driver enable control, and course-defined long-straight logic. The energy model estimates delivered axle power. Event-specific FIA electric limits, detailed Boost and Overtake eligibility, Low Grip rules and full brake-by-wire are documented historical context. The available keyboard controls are B and V, with corresponding touch toggles and gamepad stick-button inputs. Era cockpit shapes render in the existing cockpit camera. The supplementary readout can be hidden while the original HUD remains visible.

The most important remaining work is the nine unimplemented driving archetypes, additional period circuits, per-car tyre and brake thermodynamics, full manual clutch/H-pattern controls, advanced hybrid regulation logic, qualifying boost reliability, and representative testing on physical Android hardware. Catalogue-only cars include years without a playable interpretation and the separate experimental entries. Time Portal content is original and uses no official car mesh, recording, sponsor texture or track scan.

## Verification

`npm test` runs the original progression and physics suites. `npm run test:history` checks the year index, unique IDs, 13-era coverage, geometry and physics for all 16 cars, full valid laps by the shared AI, wet braking, save migration and the fan, floor, turbo, active suspension, battery and adjustable-wing behaviours. `npm run test:history-browser` exercises the actual browser routes, vehicle selection, fixed-step career progress, model loading, two-car bench, reload and mobile viewport layouts. `npm run test:paddock` checks the original story, shop, tuning, classroom, cups and rewards. The browser build bundles 41 modules and the existing offline assets.

Representative dry bench results are gameplay measurements at 120 Hz with the same driver controls and solver used in racing. Peak lateral values come from an assisted AI lap at Beacon Short and describe that run, including intentional safety margins.

| Vehicle | 0–100 km/h | 100–0 km/h | Assisted peak lateral acceleration |
| --- | ---: | ---: | ---: |
| 1950 Aureline S8 | 7.74 s | 44.25 m | 0.42 g |
| 1978 Venturi G78 | 2.96 s | 27.38 m | 1.13 g |
| 1986 Sable T86 | 3.58 s | 26.63 m | 1.14 g |
| 2004 Pulse V10 | 3.12 s | 24.56 m | 1.33 g |
| 2014 Vector H14 | 3.43 s | 23.40 m | 1.34 g |
| 2026 Helix A26 | 3.94 s | 23.76 m | 1.27 g |

Chrome rendered all 16 cars during visual review. These browser and solver checks supply no device FPS, battery or thermal measurements. The Windows release attempt hit the existing Bash script’s CRLF line endings and this machine lacks the exact Android SDK Platform 36 expected by the release script. The existing release APK and AAB are from Neon Coast 0.8. The rebuilt standalone HTML is ready for the Android project’s existing asset sync on a configured build host.

## Local changelog

- Added `src/sim/history-data.js`, `history-rides.js` and `history-circuits.js` for the archive, original car profiles and venues.
- Added `src/game/time-portal.js`, `history-model.js` and `web/time-portal.css` for the screens, controls and procedural assets.
- Extended `src/sim/vehicle.js`, `track.js`, `lab.js` and `ai.js` for historical car systems, reference speeds and bench measurements.
- Integrated the feature in `src/game/main.js`, `input.js`, `save.js`, `navigation.js` and `paddock.js`. Added geometry, camera, course and synthesis hooks in `renderer.js`, `carmodel.js`, `world.js`, `camera.js` and `audio.js`.
- Updated `tools/build.mjs`, `web/index.html`, `package.json`, the lockfile and `dist/velocityverse.html`. Added three historical test files and corrected Windows file-URL handling in the existing paddock test.
