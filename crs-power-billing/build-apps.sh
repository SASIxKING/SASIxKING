#!/usr/bin/env bash
#
# C.R.S Power Solution — build the Android APK and the Windows installer.
#
#   ./build-apps.sh --ci        build both on GitHub Actions (nothing to install)
#   ./build-apps.sh android     build the APK locally   (needs JDK 17 + Android SDK)
#   ./build-apps.sh windows     build the .exe locally  (run this ON Windows)
#   ./build-apps.sh web         production web bundle
#
# The Windows installer must be produced on Windows (or on Linux with wine).
# Building it on a plain Linux box will not work — that is a limitation of
# electron-builder's NSIS packaging, not of this project.

set -euo pipefail
cd "$(dirname "$0")"

TARGET="${1:-}"

banner() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

need_deps() {
  [[ -d node_modules ]] || { banner "Installing dependencies"; npm install; }
}

case "$TARGET" in
  --ci|ci)
    if [[ -f ../.github/workflows/build-apps.yml ]]; then
      echo "GitHub Actions build is already enabled."
    else
      mkdir -p ../.github/workflows
      cp ci/build-apps.yml ../.github/workflows/build-apps.yml
      git -C .. add .github/workflows/build-apps.yml
      if git -C .. config user.email >/dev/null; then
        git -C .. commit -m "Enable Android + Windows build workflow"
      else
        git -C .. -c user.email="apps@crspower.local" -c user.name="CRS Build" \
          commit -m "Enable Android + Windows build workflow"
      fi
      git -C .. push
      echo
      echo "Done — the APK and the Windows installer are building now."
    fi
    echo "Watch:    https://github.com/SASIxKING/SASIxKING/actions"
    echo "Download: the 'CRS-Power-Billing-Android' and"
    echo "          'CRS-Power-Billing-Windows' artifacts on the finished run."
    ;;

  android)
    need_deps
    command -v java >/dev/null 2>&1 || [[ -n "${JAVA_HOME:-}" ]] \
      || die "JDK 17 not found. Install it, or use './build-apps.sh --ci'."
    [[ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]] || [[ -d "$HOME/Android/Sdk" ]] \
      || die "Android SDK not found. Install Android Studio, or use './build-apps.sh --ci'."

    banner "Running tests"
    npm test

    banner "Building offline web bundle"
    npx cross-env VITE_APP_TARGET=android vite build

    banner "Syncing the Android project"
    npx cap sync android

    if [[ ! -f keystore/crs-release.jks ]]; then
      banner "Creating a signing keystore"
      mkdir -p keystore
      keytool -genkeypair -v \
        -keystore keystore/crs-release.jks \
        -alias crspower -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass crspower -keypass crspower \
        -dname "CN=C.R.S Power Solution, OU=Sales, O=CRS Power, L=Pondicherry, S=Puducherry, C=IN"
      echo "    Keep keystore/crs-release.jks safe — updates must use the same key."
    fi

    banner "Assembling the APK"
    export CRS_KEYSTORE="$PWD/keystore/crs-release.jks"
    (cd android && chmod +x gradlew && ./gradlew assembleRelease --no-daemon)

    mkdir -p dist-apk
    find android/app/build/outputs/apk -name "*.apk" -exec cp {} dist-apk/ \;
    banner "Done"
    ls -lh dist-apk/*.apk
    echo "Copy the APK to the phone/tablet and open it (allow 'Install unknown apps')."
    ;;

  windows)
    need_deps
    if [[ "$(uname -s)" != *"NT"* && "$(uname -s)" != "MINGW"* && "$(uname -s)" != "MSYS"* ]]; then
      command -v wine >/dev/null 2>&1 \
        || die "Windows installers must be built on Windows (or on Linux with wine installed). Use './build-apps.sh --ci' to build it on a GitHub Windows runner."
    fi

    banner "Running tests"
    npm test

    banner "Building offline web bundle"
    npx cross-env VITE_APP_TARGET=windows vite build

    banner "Packaging the Windows app"
    npx electron-builder --win --publish never

    banner "Done"
    ls -lh release/*.exe 2>/dev/null || true
    echo "Run the Setup .exe to install, or use the Portable .exe directly from a pen drive."
    ;;

  web)
    need_deps
    banner "Building the web bundle"
    npm test
    npx vite build
    banner "Done — deploy the dist/ folder, and run 'npm start' for the API"
    ls -lh dist
    ;;

  *)
    cat <<'USAGE'
C.R.S Power Solution — application builder

  ./build-apps.sh --ci        Build the Android APK and Windows installer on
                              GitHub Actions. Nothing to install locally.

  ./build-apps.sh android     Build the APK on this machine.
                              Needs JDK 17 + Android SDK.

  ./build-apps.sh windows     Build the Windows installer.
                              Must be run on Windows (or Linux with wine).

  ./build-apps.sh web         Build the hosted web version.

Tip: --ci is the easiest route, and it is the only way to produce the Windows
installer if you are not on a Windows machine.
USAGE
    ;;
esac
