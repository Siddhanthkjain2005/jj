# UNRULED feasibility and implementation recommendation

## What game should we build, and how should it relate to VelocityVerse?

### Takeaway

Recommend **UNRULED**, a separate seated Quest project built around one rule: **“You cannot create magic. You can only move it.”** The first playable should be a complete **6–8 minute** miniature adventure, rather than an extra destination inside VelocityVerse.

### Cited Findings

- The shared-chat concept, as supplied by the coordinator, transfers FLOAT, BOUNCY, MAGNETIC and FAST properties between objects or hands, with the source losing its property; it includes a floating island and whale rescue. This researcher did not independently extract the shared conversation, so its wording and provenance should be checked against the coordinator’s retrieved transcript. — [Shared conversation](https://chatgpt.com/share/6af339ce-c5e8-83ee-97d4-472322a3e1ec)
- VelocityVerse currently implements a sequential eight-event racing career with three rides, three circuits, authored dialogue, earned upgrades and validated driving outcomes. Its actual objectives are sprint/checkpoint, duel, clean lap, time trial and classified race. — [Career definitions](/Users/swetha/Downloads/Android/VelocityVerse/src/game/career-mode.js:15), [Circuit definitions](/Users/swetha/Downloads/Android/VelocityVerse/src/sim/circuits.js:10), [Ride definitions](/Users/swetha/Downloads/Android/VelocityVerse/src/sim/rides.js:23)
- The Android app is an embedded WebView host serving bundled content. Its manifest defines an ordinary launcher activity; inspection found no Quest, OpenXR, WebXR or hand-tracking implementation in the current source. — [Android manifest](/Users/swetha/Downloads/Android/VelocityVerse/android/app/src/main/AndroidManifest.xml:1), [Android host](/Users/swetha/Downloads/Android/VelocityVerse/android/app/src/main/java/com/velocityverse/game/MainActivity.java:87), [Android documentation](/Users/swetha/Downloads/Android/VelocityVerse/android/README.md:5)

### Inferences

- A separate project preserves the racing work while allowing the new concept’s interactions, scale, camera and art to be designed for hands. An Android APK alone is not evidence of a native VR experience.
- Proposed first story: **“The Last Lift.”** A tiny sky-whale courier is stranded at a broken floating village. The player moves three finite properties to repair its launch dock. Every transfer produces an immediate visible change in both source and destination.
- Proposed sequence: move FLOAT from a lantern to fallen wreckage; move BOUNCE from a toy drum to the player’s magical palm tool to launch a glowing seed; move MAGNETIC from a crane to a held tool to gather bridge fragments. The finale recombines these learned rules to return the whale home. The village responds in animation, light and sound; completion is not principally a text panel.
- Art direction: one jewel-like floating diorama, tactile ceramic and fabric materials, luminous peeled ribbons, an expressive whale and a restrained midnight-blue/coral/gold palette. Spend detail where hands touch and where the whale reacts. Surrounding space can be atmospheric and simple. This is a proposed style, not art already produced or evidence of performance.
- Keep the camera and player stationary. Island changes should happen in front of the player, not throw the player through space. Avoid a gravity-collapse finale that makes involuntary camera movement the spectacle.
- Defer FAST from the first slice: three well-tested properties allow compositional puzzles without adding high-speed collision and runaway-object risks.
- Add depth through finite property ownership, consistent behavior and two valid solutions to the finale. A short optional remix can rearrange the same property sources and objects. More verbs, worlds and menus should follow only if this core is enjoyable.
- Dreamweaver remains a plausible alternative, but freeform thread interpretation and precise continuous drawing introduce more interaction ambiguity. A miniature theatrical comedy using transferable prop properties is a second alternative, but would require more character animation. UNRULED is the preferred bounded bet, not a guaranteed original genre or winning entry.

### Gaps

- No novice playtest or actual headset interaction validates that peeling and transferring properties is intuitive or enjoyable.
- No novelty search establishes that property transfer is unprecedented. Do not pitch it as an invention without precedent.
- The miniature story, finale and art described here are proposals; no UNRULED build exists in the inspected repository.

## What can we reuse, and what must be built and validated?

### Takeaway

Reuse tested architectural ideas, not the car game’s rendering and controls. The largest uncertainty is reliable physical interaction with tracked hands; simulator progress can reduce risk but cannot settle hand comfort or tracking quality.

### Cited Findings

- The career separates observed gameplay from reward decisions, checks valid measurements, rejects resets and handles previously recorded attempts without duplicating rewards. — [Objective observer](/Users/swetha/Downloads/Android/VelocityVerse/src/game/story-career.js:85), [Career result validation](/Users/swetha/Downloads/Android/VelocityVerse/src/game/career-mode.js:65), [Reward state changes](/Users/swetha/Downloads/Android/VelocityVerse/src/game/career-mode.js:78)
- The existing Openline chapter has a bounded state machine, authored character callbacks and a saved completion memory reflected in the showroom. These are useful examples of visible, attributable progress. — [Openline state](/Users/swetha/Downloads/Android/VelocityVerse/src/game/openline-state.js:92), [Memory synchronization](/Users/swetha/Downloads/Android/VelocityVerse/src/game/openline.js:58), [Chapter implementation notes](/Users/swetha/Downloads/Android/VelocityVerse/docs/OPENLINE_06.md:14)
- Existing racing ghosts store car position, yaw and steering samples. They are car-specific playback, not a general hand-interaction replay system. — [Ghost recording and playback](/Users/swetha/Downloads/Android/VelocityVerse/src/sim/race.js:87)
- The saved career test report records 9 of 10 checks passing; the seventh driving event failed and the eighth was not reached in that report. Existing racing acceptance is therefore incomplete. — [Career flow evidence](/Users/swetha/Downloads/Android/VelocityVerse/tests/results/career_flow.json)
- The coordinator reports that the official-rules researcher verified simulator evidence is explicitly permitted together with the required playable build/access. Lack of a headset must therefore not be described as automatically disqualifying. This is a cross-researcher finding, not an independent rules review by this researcher. — [Competition rules](https://start-developer-competition-26.devpost.com/rules)

### Inferences

- Reuse patterns for a small objective state machine, durable completion, idempotent rewards, explicit supported versus manual outcomes, and bounded dialogue. Port only small engine-independent logic after reviewing its actual suitability.
- New work includes XR project setup, tracked-hand interaction, peel/select affordances, property ownership rules, constrained physics, scene construction, character animation/audio, comfort controls, tracking recovery, target-device optimization and submission packaging.
- Model property transfer as an atomic transaction: a property has exactly one owner; an invalid target leaves the source unchanged; undo restores both owners and object state. This is a design proposal that should be tested independently of hand tracking.
- Use large peel tabs and generous snap regions. Support either hand, one-handed completion, comfortable forward reach, recentering and reversible actions. Avoid tiny pinch targets, mandatory floor reaching and repeated precise two-hand gestures.
- A “bouncy palm” should be an explicit magical tool with a bounded collision proxy. Tracking jumps must not impart unlimited impulses. On tracking loss, held objects should pause or settle safely and resume predictably.
- The practical first gate is one greybox two-property puzzle: unfamiliar testers can identify a source, peel a property, transfer it, recognize that the source lost it, and undo without coaching. A proposed initial sample is five testers; this is formative feedback, not statistical proof.
- Because the user has no headset, arrange a borrowed/rented device or a remote Quest tester if feasible. Simulator checks are legitimate development/submission evidence where the rules allow them, but should be labeled honestly. Do not claim physical tracking, seated comfort or device frame performance from a desktop recording.

### Gaps

- The user’s no-headset status is conversation context, not a repository fact. No physical test device or external tester is committed.
- No UNRULED engine version, team capacity, XR package compatibility, hardware performance budget or asset pipeline has yet been verified.
- A physical-device test may reveal interaction changes that require revising the artistic reveal or puzzle timing. Reserve scope for this rather than treating it as a final ceremonial check.

## How should an eight-day opportunity be triaged without overpromising?

### Takeaway

Treat eight days as a prioritization window with explicit stop decisions, not a promise that a polished submission can be built in eight days. The demo should prove one satisfying interaction and one complete emotional ending before adding breadth.

### Cited Findings

- The project’s earlier research already warns that content expansion should follow demonstrated interaction quality and voluntary return; additional cities and menus cannot substitute for a functioning core experience. — [Project Apex product notes](/Users/swetha/Downloads/Android/VelocityVerse/research_notes/Project%20Apex%20universe%20strategy/product.md:251)
- The inspected codebase contains no implemented XR hand-interaction foundation, and the current game still has an incomplete end-to-end career report. This argues against promising a low-cost reskin or assuming existing race tests validate the new concept. — [Android manifest](/Users/swetha/Downloads/Android/VelocityVerse/android/app/src/main/AndroidManifest.xml:1), [Career test report](/Users/swetha/Downloads/Android/VelocityVerse/tests/results/career_flow.json)

### Inferences

The following is a proposed triage order. Each day’s next step depends on the preceding gate; it is not an effort estimate or guaranteed schedule.

| Window | Priority | Decision gate |
| --- | --- | --- |
| Day 1 | Confirm official entry eligibility/deadlines/access requirements with the rules researcher; establish separate XR project; contact possible device testers; design one interaction scene. | A runnable project and a credible route to testing exist. Do not spend the day on a logo or franchise bible. |
| Day 2 | Implement one property, ownership transfer, obvious source loss, valid/invalid targets and undo. | Interaction works consistently in the available simulator. If not, reduce gesture complexity. |
| Day 3 | Add a second property and one causal puzzle; test either-hand use, tracking-loss recovery and safe physics limits. | A player can explain why the puzzle worked. If not, fix feedback rather than add content. |
| Day 4 | Obtain the earliest possible physical headset feedback; add the third property only if the first two are robust. | Record exactly what was verified on hardware versus simulator. Cut mechanics that demand uncomfortable reach or unreliable gestures. |
| Day 5 | Build the complete 6–8 minute story in greybox, including whale rescue and reset/retry. | The entire experience is playable without a developer advancing state. Cut the remix before cutting the ending. |
| Day 6 | Art/audio pass focused on touch objects, whale reactions and finale. | Interaction readability survives the art pass. No mandatory camera movement, illegible labels or distracting effects. |
| Day 7 | Novice playtests, performance/comfort checks where hardware is available, save/reset recovery, instructions and access verification. | Repair blockers; do not add another property or level. Unverified areas remain explicitly disclosed. |
| Day 8 | Build freeze, clean-install/access check, truthful demo capture and submission materials against the actual official checklist. | The submitted build matches the demonstrated experience. Use simulator evidence only within verified rules and label it accordingly. |

- First cuts: FAST, online multiplayer, cloud accounts, procedural story, a creator economy, multiple worlds, real-time generated dialogue and a broad collectible system.
- Preserve: responsive hand interaction, visible source/destination consequences, reliable undo, a complete miniature story, comfortable play and an honest runnable submission.
- If the core peel/transfer interaction remains unreliable after early testing, reduce it to large selectable property tokens with the same conservation rule. A clear complete game is a stronger prototype than an impressive-looking gesture that fails repeatedly.

### Gaps

- The exact remaining deadline, team availability and eligibility must come from the official-rules researcher and user context; this document does not independently establish them.
- No delivery commitment, winning probability or performance claim can be supported before the interaction prototype and actual build exist.
