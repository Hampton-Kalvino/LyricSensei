# Lyric Sensei - Capacitor Native App Setup

This document explains how to build and deploy Lyric Sensei as a native mobile app using Capacitor.

## Overview

Lyric Sensei has been converted from a PWA to a hybrid native app using Capacitor. This provides:
- ✅ Native speech features that work reliably on all platforms
- ✅ Bypasses Android PWA speech API limitations
- ✅ App store distribution (Google Play, Apple App Store)
- ✅ Better performance and offline capabilities
- ✅ Maintains full web compatibility

## Architecture

### Hybrid TTS Implementation
The app uses a dual-path text-to-speech system:
- **Native platforms**: Capacitor's `@capacitor-community/text-to-speech` plugin
- **Web browser**: Standard Web Speech API

This ensures speech works everywhere without degradation.

### Speech Recognition
Currently uses Web Speech API for pronunciation practice mode. Future migration to Capacitor speech recognition is planned.

## Development Workflow

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Web Version (Development)
```bash
npm run dev
```
The web version runs on http://localhost:5000

### 3. Build Web Assets
Before syncing to native platforms, build the web assets:
```bash
npm run build
```

### 4. Sync to Native Platforms
Sync the built web assets to Android and iOS:
```bash
# Sync to Android
npx cap sync android

# Sync to iOS (requires macOS)
npx cap sync ios
```

## Android Build

### Prerequisites
- Android Studio installed
- Android SDK (API level 21+)
- Java Development Kit (JDK 11+)

### Build Steps

1. **Open in Android Studio**
   ```bash
   npx cap open android
   ```

2. **Build APK**
   - In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
   - Or via command line:
     ```bash
     cd android
     ./gradlew assembleDebug
     ```
   - Output: `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Build Release APK** (for Play Store)
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   - Requires signing configuration in `android/app/build.gradle`

### Install on Device
```bash
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or drag and drop APK to emulator
```

## iOS Build

### Prerequisites
- macOS with Xcode installed
- Apple Developer account (for app store distribution)
- CocoaPods installed: `sudo gem install cocoapods`

### Build Steps

1. **Install iOS dependencies**
   ```bash
   cd ios/App
   pod install
   ```

2. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

3. **Build and Run**
   - Select your target device/simulator
   - Click the "Play" button or press Cmd+R
   - For App Store: Product > Archive

## Permissions

### Android Permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

### iOS Permissions (Info.plist)
Add these to `ios/App/App/Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access for pronunciation practice</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>This app needs speech recognition for pronunciation assessment</string>
```

## Configuration Files

### capacitor.config.ts
```typescript
{
  appId: 'com.lyricsensei.app',
  appName: 'Lyric Sensei',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#7c3aed",
    },
    SpeechRecognition: {
      language: 'en-US',
      maxResults: 5,
      popup: true,
      partialResults: true,
    },
  },
  server: {
    androidScheme: 'https',
  },
}
```

## Troubleshooting

### Android Build Issues

**Gradle sync failed**
```bash
cd android
./gradlew clean
./gradlew build
```

**Plugin not found**
```bash
npx cap sync android
```

### iOS Build Issues

**Pods not found**
```bash
cd ios/App
pod install --repo-update
```

**Xcode signing errors**
- Ensure you have a valid Apple Developer account
- Configure signing in Xcode: Signing & Capabilities tab

## Testing

### Test on Physical Device

**Android:**
1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect via USB
4. Run: `npx cap run android`

**iOS:**
1. Connect iPhone/iPad via USB
2. Trust the device in Xcode
3. Run: `npx cap run ios`

### Test Speech Features
1. Open the app on native device
2. Navigate to any song with phonetics
3. Tap a speaker icon → Should hear clear pronunciation
4. Enter practice mode → Should be able to use microphone
5. Check logs for "Native" vs "Web" platform detection

## Updating the App

After making code changes:

```bash
# 1. Build web assets
npm run build

# 2. Sync to native platforms
npx cap sync

# 3. Rebuild native apps
# Android: Open Android Studio and rebuild
# iOS: Open Xcode and rebuild
```

## Live Reload (Development)

For faster development, use Capacitor's live reload:

```bash
# Start dev server
npm run dev

# In another terminal, run on device with live reload
npx cap run android --livereload --external
npx cap run ios --livereload --external
```

## Publishing

### Google Play Store
1. Build signed release APK
2. Create app listing in Play Console
3. Upload APK and fill required information
4. Submit for review

### Apple App Store
1. Archive build in Xcode
2. Upload to App Store Connect
3. Create app listing
4. Submit for review

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio](https://developer.android.com/studio)
- [Xcode](https://developer.apple.com/xcode/)
