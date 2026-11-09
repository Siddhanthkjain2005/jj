#!/bin/sh
# Builds the current offline prototype into a debug Android app. No store upload.
set -eu
VV_REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VV_ANDROID_SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-"$HOME/.cache/velocityverse-android/sdk"}}
if [ ! -f "$VV_ANDROID_SDK/platforms/android-36/android.jar" ]; then
  printf '%s\n' 'Android SDK Platform 36 and Build Tools 36.0.0 are required.' 'Install them using Android Studio or sdkmanager, then set ANDROID_HOME.' >&2
  exit 1
fi
cd "$VV_REPO_DIR"
npm run build
cd android
ANDROID_HOME="$VV_ANDROID_SDK" ./gradlew --no-daemon :app:assembleDebug :app:lintDebug
printf '\n%s\n' "Debug APK: $VV_REPO_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
