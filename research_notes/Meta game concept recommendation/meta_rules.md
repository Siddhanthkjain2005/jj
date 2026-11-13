# Meta competition requirements and headset gap

Research checked 10 November 2026. Interpretations below distinguish eligibility, explicit requirements, design guidance, and our delivery recommendations. This is a focused product-planning extraction, not a substitute for the full official rules.

## What must the entry actually deliver?

### Takeaway

A playable hands-first Meta VR experience is essential. An Android phone game alone does not demonstrate this requirement.

### Cited Findings

- Hard requirement: usable with hands throughout; controllers optional. Seated play, a two-foot interaction radius, quick pause/resume and a satisfying experience within ten minutes are **design guidelines**, not separately labeled hard requirements. — [Competition overview](https://start-developer-competition-26.devpost.com/)
- New division: conceived and built from September 24, 2026; no pre-existing codebase. Adapted division covers projects existing before that date, with meaningful new functionality; cosmetic tweaks and bug fixes are insufficient. — [Competition overview](https://start-developer-competition-26.devpost.com/)
- Native/engine submissions need an APK in a new **Competition** release channel plus judge invite URL; IWSDK/WebXR submissions use an accessible hosted link. Submit a public YouTube/Vimeo demonstration under three minutes and completed form. Simulator/equivalent-emulator footage is explicitly allowed. — [Competition overview](https://start-developer-competition-26.devpost.com/)
- Deadline: November 18, 2026, noon PST. This converts to **November 19, 2026, 01:30 IST**. — [Competition overview](https://start-developer-competition-26.devpost.com/)

### Inferences

- Keep the proposed Quest experience separate from VelocityVerse unless there is an actual gameplay reason to integrate it. A fresh project can preserve a clear provenance record; merely creating a new repository does not itself establish New-division eligibility.
- The deadline leaves roughly eight calendar days from this research date. Submit earlier than the last moment.

### Gaps

- User's membership status, team eligibility, and origin dates of any reused code/art are unverified.

## What do judges reward and what eligibility needs checking?

### Takeaway

The brief values a complete, reliable experience as strongly as inventiveness. Awards are not a prediction of success.

### Cited Findings

- Entrants must satisfy adult/territorial eligibility; developer access is required, and the submitting representative must hold Start membership by submission. One entry per submitter/representative; non-representative team participation is treated differently. — [Official rules](https://start-developer-competition-26.devpost.com/rules)
- Innovation, experience design, technical implementation, and polish/presentation each receive **25%**. Criteria emphasize clear onboarding, meaningful spatial features, narrow-field-of-view awareness, and repeat use. Passthrough should make the actual room matter. Its technical criterion names MRUK/room anchoring and **minimum 60 fps on Meta Quest hardware**. — [Official rules](https://start-developer-competition-26.devpost.com/rules)
- Showcase actual gameplay honestly. Projects need consistent operation, remain freely accessible through the winner announcement, and must not change after the deadline. Licensed third-party resources are subject to authorization; originality and other content restrictions also apply. — [Official rules](https://start-developer-competition-26.devpost.com/rules)
- Awards include New Gaming, First Five Minutes, Reason to Come Back, and Boldest Original Concept. Only **one prize per entry**. The last category asks whether the core loop depends on spatial presence, scale, depth, or eyes/hands. — [Official rules](https://start-developer-competition-26.devpost.com/rules)

### Inferences

- Aim at Gaming with a strong opening and a genuinely spatial manipulation mechanic. Do not add AI or multiplayer solely to chase additional categories.
- The 60 fps statement is a technical scoring expectation; do not conflate it with a complete release-performance certification.
- A tabletop backdrop by itself is weak evidence of purposeful mixed reality. Surface size/position should affect placement, reach, occlusion, or puzzle constraints, while unsupported/unsuitable rooms need a working fallback.

### Gaps

- No official assurance of acceptance, prize eligibility, or winning probability can be made for this unbuilt concept.

## What can we do without a Quest headset?

### Takeaway

No-headset development and simulator video are possible. They do not establish the feel, comfort, tracking resilience, or frame rate of a headset build.

### Cited Findings

- Meta XR Simulator runs Unity Editor applications with simulated head/hand input on Windows and Apple Silicon macOS. Meta calls it useful for layout/interaction checks and explicitly advises testing a device build on a headset before release. — [Meta deploy and test guide](https://developers.meta.com/vr/documentation/unity/unity-deploy-and-test/)
- Meta recommends direct manipulation, a small set of familiar gestures, generous interaction targets, and planned recovery from occlusion/tracking loss. Fast precise timing, wide swings, and feedback relying on haptics suit controllers better. XR Simulator and the IWSDK emulator support developing hand interactions before hardware testing. — [Meta hands-only design guidance, October 29, 2026](https://developers.meta.com/vr/blog/what-makes-a-meta-vr-title-work-hands-only/)
- Official competition resources provide both Unity XR Simulator and IWSDK Immersive Web Emulator paths, alongside device performance tools and release-channel setup. — [Competition resources](https://start-developer-competition-26.devpost.com/resources)

### Inferences

- Prefer deliberate pinch–peel–place transfers with forgiving target snapping over rapid flicking, throwing, complex knots, or sustained palm balancing for the first prototype.
- Start with simulated interaction, automated property-state checks, deterministic puzzle fixtures, and explicitly labeled emulator capture. In parallel, seek a borrowed/rented headset or a collaborator who can run the candidate build. That is our quality recommendation, not a statement that hardware ownership is an eligibility requirement.
- Include tracking-loss recovery, safe drop behavior, reset/undo, height/reach adjustment, and controller-free menu/pause/restart in the first playable definition.
- Do not label simulator frame rate as measured Quest performance or a rendered concept film as gameplay.

### Gaps

- User confirms no Quest headset. Access to a remote tester, installed Unity/XR tools, developer account, and Start approval remains unknown. The submission rules do not say that personally owning a headset is mandatory.
