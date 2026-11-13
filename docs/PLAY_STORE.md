# Getting VelocityVerse onto Google Play

Written 11 November 2026 for version 0.8.0. Check the linked Google pages before you submit; their rules change.

## 1. Build the release files (about five minutes)

On the Mac that has the Android SDK, double-click **`Build Android Release.command`** in the project folder
(or run `npm run build:release` in Terminal). It will:

1. rebuild the game into `dist/velocityverse.html`;
2. create your **upload key** the first time (`android/upload-keystore.jks` and `android/keystore.properties`);
3. build and sign the Android release;
4. put two files in the `release/` folder:
   - `VelocityVerse-0.8.0.aab` — the file you upload to Google Play (Play only accepts app bundles for new apps);
   - `VelocityVerse-0.8.0.apk` — the same build as an installable file, for testing on your own phone.

**Back up the upload key and its properties file.** Every future update has to be signed with the same key. They are
deliberately kept out of git.

Needs: Node 18+, JDK 17+, Android SDK Platform 36 and Build-Tools 36.0.0 (the same setup that built the 0.7 debug APK).
This script has not been run on a Mac yet — it was written and syntax-checked in a Linux workspace that has no
Android SDK. If Gradle stops with an error, the message it prints is the thing to fix.

## 2. Test on a real phone before uploading

Install `release/VelocityVerse-0.8.0.apk` (`adb install -r …` or copy it to the phone). Uninstall the old
`0.7.0-debug` app first if you want a clean start; the two can also sit side by side because the debug build uses a
different package name.

Check at least: the game opens in landscape, Home → Story → first event → finish, a Quick race on Low and High
graphics, sound, the Android Back button, and that progress is still there after closing the app. Nothing in this
repository has measured frame rate, heat or battery on a physical phone for 0.8.

## 3. What Google Play will ask for

| Item | Status |
| --- | --- |
| Developer account (US$25 once) | Yours to create at play.google.com/console |
| Target API level | The app targets API 36, which is what Play requires for new apps since 31 August 2026 |
| App bundle signed with an upload key | Produced by step 1; enrol in Play App Signing when you create the app |
| Closed test before production | New personal developer accounts must run a closed test with at least 12 testers for 14 days before they can apply for production access. Organisation accounts are exempt |
| Privacy policy URL | Required for a game aimed at children. `docs/PRIVACY_POLICY.md` is a starting text; host it on any public page |
| Data safety form | The app requests no permissions, has no accounts, ads, analytics or network access. Declare "no data collected" |
| Content rating questionnaire | No violence, gambling, chat or purchases |
| Target audience | If you select ages under 13, Google's Families Policy applies in full. Read it before choosing |
| Store listing | App name, short and full description, 512×512 icon, 1024×500 feature graphic, at least two landscape screenshots |

## 4. Things only you can decide

- **Name and package id.** "VelocityVerse" is still a working title that has not been checked against trademarks,
  and the package id `com.velocityverse.game` can never be changed once the first build is uploaded. If you want a
  different name, change `applicationId` in `android/app/build.gradle` and `android:label` in the manifest *before*
  the first upload.
- **Screenshots.** Take them from the real game on a phone. The pictures in `design/neon-coast-20261111/` are concept
  art, not the game, and Play does not allow store screenshots that misrepresent the app.

## 5. Honest state of the build

This is an offline WebView game built on the project's own physics and renderer. The 0.8 interface follows the
Neon Coast concepts, but the 3D car and city are still the procedural prototype art, not the photoreal scenes in the
concept images. It is a good closed-test build; it is not yet at the visual level of the big studio racing games.

Sources checked on 11 November 2026:
- Target API requirement: https://support.google.com/googleplay/android-developer/answer/11926878
- Testing requirement for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Families Policy: https://support.google.com/googleplay/android-developer/answer/9893335
