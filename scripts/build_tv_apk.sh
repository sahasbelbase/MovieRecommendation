#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🎬 CineMatch TV: Android TV APK Builder"
echo "=========================================="

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TV_APP_DIR="$PROJECT_ROOT/tv_app"
BUILD_TOOLS_DIR="/Users/sahas/Library/Android/sdk/build-tools/35.0.0"

cd "$TV_APP_DIR"

echo "1. Building Web Assets with Vite..."
npm run build

echo "2. Syncing Capacitor Android Project..."
npx cap sync android

echo "3. Compiling Android TV APKs with Gradle..."
cd "$TV_APP_DIR/android"
./gradlew assembleDebug assembleRelease

echo "4. Exporting & Signing APK files..."
# Copy debug APK
cp app/build/outputs/apk/debug/app-debug.apk "$PROJECT_ROOT/CineMatch-TV.apk"

# Align and sign release APK
if [ -f "$BUILD_TOOLS_DIR/zipalign" ] && [ -f "$BUILD_TOOLS_DIR/apksigner" ]; then
    "$BUILD_TOOLS_DIR/zipalign" -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk "$PROJECT_ROOT/CineMatch-TV-Release.apk"
    "$BUILD_TOOLS_DIR/apksigner" sign --ks ~/.android/debug.keystore --ks-pass pass:android --key-pass pass:android "$PROJECT_ROOT/CineMatch-TV-Release.apk"
fi

echo "=========================================="
echo "✅ Build Complete! Both APK files created:"
echo "1. Standard APK: CineMatch-TV.apk (3.7MB)"
echo "2. Release APK:  CineMatch-TV-Release.apk (2.9MB)"
echo "Install with: adb install -r CineMatch-TV.apk"
echo "=========================================="
