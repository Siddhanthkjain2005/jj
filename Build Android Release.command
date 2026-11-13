#!/bin/bash
# Double-click this file on your Mac to build the Play Store bundle and an installable APK.
cd "$(dirname "$0")" || exit 1
bash tools/android-release.sh
echo
read -n 1 -s -r -p "Press any key to close this window."
echo
