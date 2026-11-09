# VelocityVerse: product and production plan

9 November 2026. **Design and proposed targets, not shipped functionality or market evidence.** See [REQUIREMENTS.md](REQUIREMENTS.md) for implementation status. The current deliverable is a browser driving prototype; the proposed production game is Android-first.

## A. Product thesis and assumptions

“Master the car. Build your team. Race across worlds.” Earn attention through readable, satisfying single-seat handling, short skill-building challenges, and fair asynchronous team competition. A smaller original racing identity is more credible than a feature-for-feature imitation of an established franchise. The three advantages to test are: understandable vehicle behavior; lessons that teach real control/grip relationships; and team contributions capped so skill and participation matter more than spending or endless grinding.

Working audience: children 6–12 playing with family supervision, plus older racing learners. This audience assumption needs supervised testing and safeguarding review. No commercial success, player preference or competitor superiority has been demonstrated. Working title/trademarks are not cleared. No pay-to-win vehicle upgrades, loot boxes, advertising pressure on children or paid competitive boosts are planned. Cosmetics and optional family content are hypotheses.

## B. Platform, engine and hardware decision

Choose a native **Unity 6.3 LTS + URP, C# simulation, IL2CPP/ARM64 Android** production path. Keep browser builds as a development/handling reference. Avoid a simultaneous PC-simulation product launch; mobile needs touch ergonomics, short sessions, scalable effects and thermal discipline. iOS follows only after Android gates pass. Unity/Unreal do not automatically provide validated vehicle physics.

| Criterion | Unity 6.3 LTS / URP | Unreal mobile stack | Decision implication |
|---|---|---|---|
| Android rendering | URP scales graphics features and supports GLES/Vulkan | Dedicated mobile rendering paths and Android build tooling | Both viable; neither implies desktop feature/performance parity |
| Vehicle model | Port these plain simulation classes to C#; render separately | Port the model to C++ or validate an alternative plugin | Prefer the existing model, not a new unvalidated controller |
| Iteration/team | C# and a focused URP asset workflow are proposed | C++/Blueprint skills and a separate mobile art/performance workflow required | Team skill is currently unverified; choose one stack |
| Content/build cost | Measure actual asset/import/build size | Measure actual package/cook size | No unsupported claim that either is automatically smaller/faster |
| Services | Select/validate authority, identity and moderation backend separately | Same need | No engine choice implements the social product for us |
| Licensing | Personal financial eligibility up to $200k; 2026 Pro $2,310/seat/year prepaid ($210 monthly), subject to terms | Standard games royalty model applies above $1m lifetime product gross; published rate 5%, exclusions/alternative terms apply | Budget the actual licence agreement and revenue definitions |

Official checks on this date: Unity lists 6.3 LTS support through December 2027 ([support](https://unity.com/releases/unity-6/support)); the [2026 pricing notice](https://unity.com/products/pricing-updates) records the Personal/Pro thresholds and removal of Runtime Fee language. URP is a supported cross-platform pipeline with [platform/API compatibility](https://docs.unity.com/en-us/engine/6000.3/manual/render-pipelines/universal-render-pipeline/requirements). Epic's current [Android setup documentation](https://dev.epicgames.com/documentation/unreal-engine/android-quick-start) identifies UE 5.8 and its SDK/NDK/JDK prerequisites; verify those again when installing. [Epic licensing](https://www.unrealengine.com/license) describes the standard game royalty model. These facts do not establish performance in this project.

Proposed test tiers (purchase/compatibility validation still required): reference Samsung Galaxy A54 5G, 8GB; minimum candidate Snapdragon 695-class / 6GB / Android 12 with reduced effects; high candidate Snapdragon 8 Gen 2-class / 8GB. These are planning tiers, not claimed supported devices or benchmarks. Use the same reference device for competitor comparisons.

Proposed reference budgets: sustained60FPS (16.67ms), simulation/AI <=2ms CPU/frame for eight cars, render submission <=3ms CPU, GPU <=12ms; resident app memory <=750MB; cold launch <=8s; race load <=5s. Initial download target<=250MB. Battery target<=8 percentage points per20min, no sustained frame-rate collapse from thermal throttling. All are unverified and must be revised from device measurements. Minimum tier may target30FPS explicitly. URP's [performance guidance](https://docs.unity.com/en-us/engine/6000.3/manual/analysis/graphics-performance-profiling/in-urp/understand-performance/understand-performance) explains why render passes, texture memory, resolution and profiler measurements matter.

## C. Competitive scorecard and evidence gates

Asphalt's official site describes Manual/TouchDrive, cross-platform play, Clubs and private lobbies ([official feature page](https://asphaltlegends.com/)). Its [2024 cross-platform announcement](https://asphaltlegendsunite.com/news/asphalt-legends-unite-cross-platform-details) documents cross-play/cross-save plans at that time. Do not extrapolate every current platform feature from that announcement. No comparative build/player test has been conducted here.

| Area | VelocityVerse evidence now | Comparative acceptance experiment |
|---|---|---|
| Steering / satisfaction | Input smoothing, optional assists, model regression checks | Blind, counterbalanced same-device slalom/corner sessions; record errors and preference |
| Braking / weight / grip | Combined-slip model, load transfer, stop/corner tests | Repeated stopping distances and corner-entry control; assess whether novices understand mistakes |
| Speed / camera | Chase/cockpit, adjustable FOV/shake, telemetry-linked effects | Same-duration sessions; readability, discomfort and speed-estimation tasks |
| Art / environment | Original generated/procedural assets, still far below production benchmark | Consistent-resolution captures and motion; evaluate silhouette/material/readability separately |
| HUD / touch | Connected desktop/touch layouts | Look-time, missed inputs, cutout/thumb occlusion, accessibility at maximum text size |
| Audio / haptics | State-driven synthesis and limited vibration | Grip-warning recognition and fatigue; device audio listening tests still needed |
| Performance | Desktop browser measurements only |20-minute same-device runs: frame p50/p95/p99, memory, thermals, battery, loading |
| Fair progression | Local cosmetic driver XP; no performance purchases | Verify progression never modifies physics; test contribution caps and economies before sales |
| Community | Design only | Parent-approved ghost challenge pilot; invitations, completion, retention and moderation burden |

Subjective visual/feel assessments are not market facts. Claim an advantage only after predefined tasks and actual players support it.

## D. Vehicle physics and world specification

One model: SI metres/kilograms/seconds/Newtons/radians; x right/y up/z forward. Prototype chassis120Hz, four tire/wheel substeps480Hz; interpolate render poses without feeding interpolation into simulation. Current fidelity includes mass/inertia/CG, per-wheel suspension, longitudinal/lateral combined slip, load sensitivity/falloff, engine/gear/differential, drag/downforce, per-wheel ABS/TCS/ESC, planar barrier and car contacts. Parameter provenance stays fictional/estimated/tuned where applicable.

Prototype omissions: full vertical car contacts/airborne track geometry, camber/kinematic suspension, tire temperature/wear, physical damage and advanced aero maps. Brake temperature is cosmetic only. Introduce each only with a visible gameplay reason and dedicated validation. A force-based assist may alter steering/throttle/brake/gear or brake/engine torques; it may not teleport. Explicit race-control exercise/reset placement invalidates competitive attempts. Telemetry must keep its actual-state source.

| World design (only first playable now) | Gravity / air | Surface / weather / visibility | Geometry and learned consequence |
|---|---|---|---|
| Lumen Harbor |9.81m/s² /1.225kg/m³ | Current dry-grip simulation; reflective art does not certify a wet-tire model. Proposed later rain variations need friction data and separate PB class | Braking straights, medium bends, tight chicane, waterfront sight lines; downforce grows with speed |
| Mesa Ardent |9.81 /0.98 | Proposed desert, dusty runoff: asphalt μ scale.97, sand.55 (tuned targets), hot/hazy atmosphere | Proposed80–200m-radius sweepers,200–500m straights and exposed braking zones; less dense air reduces drag AND downforce; cooling/temperature not yet simulated |
| Halcyon Ring |6.87 /0.95 | Proposed pressurized orbital habitat; dry engineered asphalt μ scale.95; enclosed atmosphere | Proposed100–300m-radius planar circuit within the4km spin-radius habitat first. Lower gravity reduces mechanical grip; atmosphere still supports aero. No vacuum-downforce fiction |

Temperatures, precipitation and visibility are art/design specifications until modeled. No portals, gravity transitions or wall riding before normal racing meets the handling and device gates.

Physics acceptance: acceleration, ABS-on/off braking, coast-down drag/rolling resistance, constant-radius limit and understeer balance, slalom response/settling, curb-load changes, wall/car contact energy/momentum, tunneling, standstill/reverse stability and repeatability at different render rates. Existing regression targets are model checks, not measured F1 calibration. Preserve golden traces when porting; investigate tolerance failures instead of silently regenerating expected outcomes.

## E. Art, UX, sound and accessibility

Reference direction: futuristic stadium scale, a few expressive skyline silhouettes, cyan track structure and a warm/cool material contrast. Prioritize authored hero assets, physically plausible materials, believable architecture and stable lighting over more repeated boxes or stronger bloom. Replace procedural hero car/buildings/crowds with art-directed assets/LODs and packed albedo/normal/roughness maps; retain source/license records. AI texture generation is asset creation, not evidence that an entire scene is production-ready.

Flow: first launch -> assist choice or academy -> garage/paint/licence -> event/preparation -> race HUD -> pause/settings -> results/XP -> retry. Team hub/community screens follow an implemented service, not invented placeholder opponents. Future garage/driver/team customization must remain cosmetic. The current academy must assess real vehicle state and teach throttle, braking and grip.

HUD: speed/gear/time/lap/position first, meaningful warning only; no fake energy/damage bars. Touch targets>=44CSSpx, safe-area layouts, editable steering sensitivity, remapping, controller menu navigation, scalable text and reduced motion. Validate full layouts with large text, not only default screenshots. Chase/cockpit motion has adjustable FOV/shake. Audio layers should communicate engine load, actual shifts, tire limit, wind, curbs and collisions; replace prototype synthesis with recorded/designed licensed samples before a premium audio claim.

## F. Architecture, native handoff and milestones

Boundaries already present: `sim/vehicle`, `assists`, `race`, `traffic`, `ai`, `academy`; client input, camera, audio, renderer, telemetry, career/save and shell. Keep physics independent of DOM/rendering. Data/config and test fixtures are the common boundary for a native port. An installable WebView shell would preserve this JS prototype but would not be the proposed Unity product or proof of store acceptance.

Tool inspection found no Unity/Hub/Blender/Android Studio or Android SDK in the checked locations; Java/Gradle and adb exist, but no device/emulator was attached. No APK/native port is claimed. A native build requires those external tools and device validation.

1. **Current iteration:** close first-slice gaps: real academy, paint, local cosmetic progression, material/art detail, offline assets, fault/input regression and honest audit. Gate: connected browser tests plus actual screenshots and measured performance report.
2. **Native foundation:** install Unity6.3 LTS with Android IL2CPP/SDK modules; create a URP project; lock editor/package versions; port pure simulation/data types to C#, not WheelCollider by assumption. Set fixedDeltaTime1/120 and keep wheel substeps4. Convert JSON data with explicit units. Expose controls via an input adapter; separate interpolated visual transforms. Port each regression/golden trace to Unity tests. Gate: C# position within0.05m and speed within0.1% of agreed fixture at16s; all meaningful handling/contact checks pass. Cross-platform determinism remains unproven.
3. **Device proof:** ARM64 Android build with touch, pause/resume/audio, local saves and both orientations;20-minute eight-car sessions on proposed tiers. Capture profiler traces and battery/thermal baselines. Gate: stable performance and safe controls, or revise tiers/effects/simulation budget explicitly.
4. **Production art/audio:** one authored car, one finished circuit district/skyline, strong LOD/culling/texture budgets, licensed audio, photo/cockpit modes only if useful. Gate: matched-device/player visual-readability and driving tests.
5. **Small community release:** accounts/consent/moderation, verified asynchronous ghosts and one capped team challenge. Gate: abuse handling, replay validation, retention and operating cost evidence before real-time multiplayer.

Future real-time multiplayer: server owns race rules, authoritative position/contact outcomes and checkpoints; clients predict their own control stream and reconcile snapshots, interpolate rivals and use bounded correction. Test80/150/250ms RTT, jitter,2–5%loss and late joins. Quantization/physics divergence must be measured. Do not claim deterministic lockstep; no client-reported lap time is authoritative.

## G. Community, family safeguards and business validation

First social loop: a parent-approved asynchronous team ghost challenge. Race one comparable car/track/condition/assist class. Lock four-person squads before the week; larger clubs create independent squads, never aggregate unlimited contributions into one score. Example proposed score: driver skill=1000×clamp(referenceTime/verifiedBestTime,0,1); participation=min(100,20×validRaceCount); driver score=.9×skill+participation. Squad score=mean of four driver scores. Only one best verified lap counts; participation caps at five races. Ties: lower median verified lap, then fewer validated infringements, then shared rank. Smaller/unfilled squads remain provisional; do not populate fake human leagues. Early cohorts use explicitly labelled benchmark ghosts/cooperative goals until enough comparable squads exist. Promotion/relegation starts only after viable cohort sizes, not empty divisions.

Verify replay inputs/time, ordered checkpoints, track bounds, physics/config hashes, sane speed/acceleration and tamper signatures on a trusted backend; rate-limit retries/uploads and audit suspicious top runs. City/country affiliation is broad and voluntary; no continuous GPS. Driver and engineering/strategy participation use bounded preset tasks, not open chat by default.

Proposed family architecture: parent-managed account/consent and contacts, minimal child identifiers, preset names/messages, moderated uploads before sharing, report/block and trained escalation, deletion/retention/security controls and no behavioral advertising. These services do not exist yet. Offline local saves do not certify legal compliance. Current official [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) describes the amended rule and consent requirements; [Google Play Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en-GB) covers child-directed content/functionality and accurate declarations. Select intended markets with qualified privacy/store review before public accounts, purchases or data collection. Country-specific requirements remain unresolved. Bundle licensed fonts and inventory every network request/SDK; do not equate “no analytics” with zero data exposure.

All commercial numbers below are **planning assumptions, not benchmarks or forecasts**. Adult/family payer conversion and spend are hypotheses. Gross annual revenue=average MAU×payer fraction×monthly spend per payer×12. Model refund deduction3%, then assumed platform cost15%; actual store fee/tax/accounting terms must be checked.

| Scenario | MAU | Payers | $/payer/month | Gross/year | After assumed refunds/fees | Annual operating spend | Illustrative operating result |
|---|---:|---:|---:|---:|---:|---:|---:|
| Conservative |30,000|2%|6|43,200|35,618|405,000|−369,382|
| Base ambition |200,000|3.5%|12|1,008,000|831,096|870,000|−38,904|
| Optimistic |350,000|5%|14|2,940,000|2,424,030|1,840,000|584,030|

Spend assumptions (development/content/acquisition/hosting-moderation-support/overhead): conservative$240k/$60k/$45k/$30k/$30k; base$360k/$120k/$240k/$90k/$60k; optimistic$540k/$240k/$720k/$240k/$100k. Engine licence/payment processing/taxes/refund timing need actual contracts and separate cash-flow modeling. These operating results are before tax/financing and do not determine valuation. Revenue is not profit; cash flow depends on payment timing and upfront investment. A million in annual gross can still lose money.

Pilot with3–5 supervised communities, not national leagues. Predefine proposed expansion gates: onboarding>=80%, first-race completion>=85%, meaningful repeat racing, D7>=20%, D30>=10%, at least30% of activated households completing a second weekly challenge, no unresolved severe moderation incidents and sustainable support cost. These are chosen investment thresholds, not sourced industry norms. Observe invites accepted, lesson failures, voluntary team participation and adult willingness-to-pay in consented tests. Reject/iterate the concept if driving preference and retention do not justify further spend, even if screenshots improve.

## H. First-playable acceptance checklist

- One car/circuit/world; clean default launch and complete garage/race/results/retry flow.
- Real keyboard/touch driving and remapping; no stale holds after focus/pause; physical controller/tilt remain separately unverified.
- Timing/checkpoints/ghost/PB classes/local saves retain integrity; malformed saves fail safely.
- Real academy completion, retry/failure feedback and saved cosmetic progression; no fake online rankings.
- All regression checks pass; expected outputs and faults are meaningful, not blanket self-confirmation.
- No HDR/NaN blowout, no WebGL errors at supported presets; visual assets load offline in the distributable.
- Readable HUD and functional menus at minimum phone viewport, device safe areas and scaled text.
- Targets reported separately from observations. Native Android/sustained60FPS/commercial readiness remain unachieved until the native/device gates pass.
