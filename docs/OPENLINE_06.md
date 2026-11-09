# The Openline 0.6 implementation

This release implements the first local story slice from the Project Apex bible. It does not implement every proposed platform service.

## Play the chapter

1. Open Light the Beacon in the paddock. Choose Neri, Tavi, Maela or Sola as guide.
2. Continue and predict shorter/longer stopping distance, or choose unsure.
3. Run the supported comparison. Both complete traces come from fresh actual Vehicle simulations at the same entry speed. Optionally drive the academy controlled-stop exercise first; its actual result returns to the chapter.
4. Publish the result with its limits, or repeat the study. The model changes only peak tire friction; race-car performance remains unchanged.
5. Drive one clean timed homologation lap against an AI field including Sola. Position is not an objective. Alternatively watch the supported AI exhibition, explicitly classified story-supported. Contacts, resets and invalid laps do not earn completion; cross the line and retry freely.
6. Return to the crew: the teaching-room permit, signed card and beacon memory are saved once. Equip the optional cosmetic livery. A physical display beacon now lights in the showroom. Replay preserves the earned memory.

## Implementation

- Four original guides with distinct dialogue, portraits, motivations and stage callbacks.
- Campaign state machine with validated measurement/traces, persisted choices, manual/supported routes, durable completion ledger and idempotent cosmetic reward.
- 18 complete character profiles, 10 city histories and 12 circuit records in the Universe archive. Only Harbor Loop has a driving action; other places are lore.
- Real simulation measurements and braking traces, clean-lap objective, actual Sola AI rival and clear assisted classification.
- Local saves migrate missing campaign state without replacing existing paint/settings/records. Invalid campaign data is normalized. Storage failure reports session-only progress.
- Android Back/pause/background behavior, safe exit from story driving, reduced motion, large text and 48-pixel chapter controls. A compact mission objective avoids touch driving controls.

## Verification

`npm test` includes campaign false-credit, migration and replay checks as well as existing simulation regressions. `npm run test:app` covers existing app navigation and saves. `npm run test:story` covers the actual connected chapter, including real AI lap completion, real manual braking, actual lab traces, persistence, archive, reward, replay and 200% text at 360×792 and 792×360. Test artifacts are in `tests/results/openline_flow.json` and related captures.

These are automated desktop Chrome/WebGL and touch-emulated checks. ADB did not list an attached phone during the 0.6 build; this version has no new physical-phone runtime acceptance or thermal benchmark. The earlier 0.5 APK was installed on an Oppo in project history. The Android build remains an offline WebView host, not a Unity port or Play production release.

## Remaining production scope

Online accounts, real friend crews, matchmaking, authoritative competition, public creator tools/marketplace, generated runtime dialogue, additional playable cities, weather/energy powertrains and production character cinematics remain staged work. The chapter uses original illustrated crew artwork and bounded authored dialogue. No fake online activity, payments or competitive upgrades are added.
