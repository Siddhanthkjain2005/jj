# VelocityVerse Android prototype host

This is an Android application project that packages the existing offline WebGL simulation and app interface. It adds an original adaptive launcher icon, immersive edge-to-edge display, AndroidX system Back routing (including Android 16 gestures), pause/resume handling, racing-only screen wake, touch haptics and local PNG/SVG exports. It is a **WebView-based prototype**, not the planned Unity/C# port and not a production store release.

No Internet, location, camera, microphone or broad storage permission is requested. `WebViewAssetLoader` serves one trusted bundled document from a stable local HTTPS origin; file/content access, external navigation, network loading, frames and mixed content are blocked. Local progress belongs to this application installation. Browser saves are separate. Uninstalling or clearing app data removes local progress.

## Build

Requirements: Node 18+, JDK 17+, Android SDK Platform 36 and Build Tools 36.0.0. The Gradle wrapper is pinned to 9.3.1; Android Gradle Plugin 9.1.1 and AndroidX WebKit 1.15.0 and Activity 1.10.1 are pinned.

```sh
# From the repository root; set this to your SDK location.
export ANDROID_HOME="$HOME/Library/Android/sdk"
./tools/android-build.sh
# Install on an attached test phone:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The package name is `com.velocityverse.game.debug` for this debug build. Launch it from the device launcher. It supports both device orientations and retains the same WebView across rotation. The game itself asks for landscape while driving. The debug APK uses the normal local debug signing key and allows WebView debugging; it is for development, not distribution through Play.

The Gradle `syncGameAssets` task copies the current `dist/velocityverse.html` into generated app assets. Run the root build script for a fresh game bundle before packaging. Generated SDK caches, Gradle outputs, keystores and local SDK paths are excluded from Git.

## Native bridge contract

Only the trusted, offline bundled page can reach `NativeBridge`:

- `copyText(text)` copies locally generated telemetry to the Android clipboard after the player chooses Copy.
- `haptic()` triggers Android's system-respecting touch feedback.
- `setKeepScreenOn(boolean)` holds the display awake only while the app is active and racing.
- `saveFile(filename, mime, base64)` accepts PNG/SVG only, with a 20 MiB decoded limit. Android 10+ writes to `Downloads/VelocityVerse` using MediaStore. Android 8–9 uses the system create-document picker. No broad storage permission is used.

System Back calls `window.__vv.androidBack()`; returning `true` handles the navigation in the game. Returning `false` displays a native Leave/Stay dialog. Exports report their result through `window.__vv.nativeSaveResult(success, message)`. The Activity pauses active racing before backgrounding; returning to the app leaves the session paused for the player.

## Verification boundary

Build/lint/package evidence is recorded after the local build. There is no attached physical Android device or installed emulator in this workspace. Building an APK does not verify WebGL support, touch latency, motion sensors, audio focus, safe-area behavior, export behavior or sustained performance on an actual phone. Those remain required device checks.

## Official tooling references (checked 9 November 2026)

- [AGP 9.1.1 compatibility](https://developer.android.com/build/releases/agp-9-1-0-release-notes): Gradle 9.3.1, JDK 17 and SDK support.
- [Load in-app content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content): secure `WebViewAssetLoader` local origins and restricted access.
- [AndroidX WebKit release history](https://developer.android.com/jetpack/androidx/releases/webkit): pinned stable 1.15.0; the project only uses its established asset loader.
- [MediaStore Downloads](https://developer.android.com/reference/android/provider/MediaStore.Downloads): scoped downloads on Android 10+.
- [Official command-line tools](https://developer.android.com/studio#command-line-tools-only): the Mac ARM command-tools archive used locally was SHA-256 verified against `835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`.
