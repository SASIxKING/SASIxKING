#!/usr/bin/env bash
#
# VoltBill Pro — one-command APK build.
#
#   ./build-apk.sh              build a signed release APK (and a debug APK)
#   ./build-apk.sh --ci         enable the GitHub Actions build instead (no local SDK needed)
#
# Local build needs: JDK 17 and the Android SDK.
# Everything else (Gradle itself, all libraries) is fetched by the wrapper.

set -euo pipefail
cd "$(dirname "$0")"

KEYSTORE="keystore/voltbill.jks"
STOREPASS="${VOLTBILL_STORE_PASSWORD:-voltbill}"
ALIAS="${VOLTBILL_KEY_ALIAS:-voltbill}"
KEYPASS="${VOLTBILL_KEY_PASSWORD:-voltbill}"

# ---------------------------------------------------------------- CI mode ----
if [[ "${1:-}" == "--ci" ]]; then
  if [[ -f .github/workflows/android-build.yml ]]; then
    echo "GitHub Actions build is already enabled."
  else
    mkdir -p .github/workflows
    cp ci/android-build.yml .github/workflows/android-build.yml
    git add .github/workflows/android-build.yml
    if ! git config user.email >/dev/null; then
      git -c user.email="apk@voltbill.local" -c user.name="VoltBill Build" \
        commit -m "Enable APK build workflow"
    else
      git commit -m "Enable APK build workflow"
    fi
    git push
    echo
    echo "Done. The APK is building now."
  fi
  echo "Watch it:    https://github.com/SASIxKING/SASIxKING/actions"
  echo "When it finishes, download the 'VoltBillPro-APK' artifact."
  exit 0
fi

# ------------------------------------------------------------- local build ---
echo "==> Checking prerequisites"

if ! command -v java >/dev/null 2>&1 && [[ -z "${JAVA_HOME:-}" ]]; then
  echo "ERROR: Java not found. Install JDK 17, or run './build-apk.sh --ci' to build on GitHub." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]] \
   && [[ ! -d "$HOME/Android/Sdk" ]] && [[ ! -d "$HOME/Library/Android/sdk" ]] \
   && [[ ! -f local.properties ]]; then
  echo "ERROR: Android SDK not found." >&2
  echo "       Install Android Studio, or set ANDROID_HOME," >&2
  echo "       or run './build-apk.sh --ci' to build it on GitHub instead." >&2
  exit 1
fi

if [[ ! -f "$KEYSTORE" ]]; then
  echo "==> Creating signing keystore ($KEYSTORE)"
  mkdir -p keystore
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STOREPASS" -keypass "$KEYPASS" \
    -dname "CN=VoltBill Pro, OU=Sales, O=VoltBill, L=Puducherry, S=Puducherry, C=IN"
  echo "    Keep this file safe — you need the same key to ship updates."
fi

echo "==> Running GST engine tests"
./gradlew :app:testDebugUnitTest --no-daemon

echo "==> Building APKs"
VOLTBILL_KEYSTORE="$KEYSTORE" \
VOLTBILL_STORE_PASSWORD="$STOREPASS" \
VOLTBILL_KEY_ALIAS="$ALIAS" \
VOLTBILL_KEY_PASSWORD="$KEYPASS" \
  ./gradlew :app:assembleDebug :app:assembleRelease --no-daemon

mkdir -p dist
cp app/build/outputs/apk/debug/app-debug.apk dist/VoltBillPro-debug.apk 2>/dev/null || true
cp app/build/outputs/apk/release/app-release.apk dist/VoltBillPro-release.apk 2>/dev/null \
  || cp app/build/outputs/apk/release/app-release-unsigned.apk dist/ 2>/dev/null || true

echo
echo "==> Done. Install file(s):"
ls -lh dist/*.apk
echo
echo "Copy the release APK to your phone and open it."
echo "(Enable 'Install unknown apps' for your file manager when Android asks.)"
