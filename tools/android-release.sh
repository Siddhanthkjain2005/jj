#!/bin/bash
# Builds the signed Play Store bundle (.aab) and a matching installable .apk.
# Run on the Mac that has the Android SDK:  bash tools/android-release.sh   (or double-click "Build Android Release.command")
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/.cache/velocityverse-android/sdk}}"
[ -f "$SDK/platforms/android-36/android.jar" ] || SDK="$HOME/Library/Android/sdk"
if [ ! -f "$SDK/platforms/android-36/android.jar" ]; then
  echo "Android SDK Platform 36 was not found."
  echo "Install it with Android Studio (SDK Manager > Android 16, API 36, and Build-Tools 36.0.0), then run this again."
  exit 1
fi
# Finder-launched shells often lack the user's PATH; add the usual Node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null || { echo "Node.js is not installed. Get it from https://nodejs.org and run this again."; exit 1; }
# Gradle 9 and Android Gradle Plugin 9 need JDK 17 or newer. Prefer an explicit JAVA_HOME, then macOS's java_home.
java_major() { "$1/bin/java" -version 2>&1 | awk -F'"' '/version/ {split($2,v,"."); print (v[1]=="1"?v[2]:v[1]); exit}'; }
if [ -z "${JAVA_HOME:-}" ] || [ "$(java_major "$JAVA_HOME" 2>/dev/null || echo 0)" -lt 17 ]; then
  JAVA_HOME=""
  if [ -x /usr/libexec/java_home ]; then
    for v in 21 22 23 24 25 17 18 19 20; do
      cand="$(/usr/libexec/java_home -v "$v" 2>/dev/null || true)"
      if [ -n "$cand" ] && [ "$(java_major "$cand" 2>/dev/null || echo 0)" -ge 17 ]; then JAVA_HOME="$cand"; break; fi
    done
  fi
  [ -z "$JAVA_HOME" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ] && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
if [ -z "${JAVA_HOME:-}" ]; then echo "A JDK 17 or newer was not found. Install Temurin 21 from https://adoptium.net and run this again."; exit 1; fi
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"
echo "Using Java $(java_major "$JAVA_HOME") at $JAVA_HOME"

echo "1/4  Building the game bundle"
[ -d node_modules/gsap ] || npm install --no-audit --no-fund
node tools/build.mjs

KEYSTORE="android/upload-keystore.jks"
PROPS="android/keystore.properties"
if [ ! -f "$PROPS" ] || [ ! -f "$KEYSTORE" ]; then
  echo "2/4  Creating your upload key (first run only)"
  PASS="$(uuidgen | tr -d '-')"
  rm -f "$KEYSTORE"
  keytool -genkeypair -storetype PKCS12 -keystore "$KEYSTORE" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=VelocityVerse, O=VelocityVerse" >/dev/null
  printf 'storeFile=upload-keystore.jks\nstorePassword=%s\nkeyAlias=upload\nkeyPassword=%s\n' "$PASS" "$PASS" > "$PROPS"
  chmod 600 "$PROPS" "$KEYSTORE"
  NEWKEY=1
else
  echo "2/4  Using your existing upload key"
  NEWKEY=0
fi

echo "3/4  Building the Android release (a few minutes the first time)"
( cd android && ANDROID_HOME="$SDK" ./gradlew --no-daemon :app:bundleRelease :app:assembleRelease )

echo "4/4  Collecting the files"
VERSION="$(node -p "require('./package.json').version")"
mkdir -p release
cp android/app/build/outputs/bundle/release/app-release.aab "release/VelocityVerse-$VERSION.aab"
cp android/app/build/outputs/apk/release/app-release.apk "release/VelocityVerse-$VERSION.apk"
echo
echo "Done."
echo "  Play Store upload:   $ROOT/release/VelocityVerse-$VERSION.aab"
echo "  Install on a phone:  $ROOT/release/VelocityVerse-$VERSION.apk"
if [ "$NEWKEY" = "1" ]; then
  echo
  echo "IMPORTANT: back up these two files somewhere safe. Every future update must be signed with them:"
  echo "  $ROOT/$KEYSTORE"
  echo "  $ROOT/$PROPS"
fi
command -v open >/dev/null && open release || true
