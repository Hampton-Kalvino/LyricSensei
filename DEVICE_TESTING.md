# Device Testing Guide - Lyric Sensei Native App

This guide will help you test the native Capacitor app on physical Android and iOS devices.

## Prerequisites

### For Android Testing
- **Android device** with USB debugging enabled
- **USB cable** to connect device to computer
- **Android SDK** (already installed with Capacitor)

### For iOS Testing
- **iOS device** (iPhone/iPad)
- **macOS computer** with Xcode installed
- **Apple Developer account** (free account works for testing)
- **USB cable** (Lightning or USB-C depending on device)

---

## Part 1: Android Device Testing

### Step 1: Enable USB Debugging on Your Android Device

1. **Open Settings** on your Android device
2. Scroll to **About Phone** (or About Device)
3. Tap **Build Number** 7 times until you see "You are now a developer!"
4. Go back to main Settings
5. Open **Developer Options** (or System > Advanced > Developer Options)
6. Enable **USB Debugging**
7. Connect your device to your computer via USB
8. When prompted on your device, tap **Allow USB Debugging** and check "Always allow from this computer"

### Step 2: Verify Device Connection

```bash
# Check if your device is detected
npx cap run android --list

# You should see your device listed (e.g., "Samsung Galaxy S21" or similar)
```

### Step 3: Build and Run on Android Device

```bash
# Build the web assets
npm run build

# Sync to Android and run on connected device
npx cap sync android
npx cap run android
```

**What happens:**
- Opens Android Studio (if not already open)
- Builds the APK
- Installs on your connected device
- Launches the app automatically

**Alternative (Manual Method):**
```bash
# Open Android Studio manually
npx cap open android

# Then in Android Studio:
# 1. Select your device from the device dropdown (top toolbar)
# 2. Click the green "Run" button (▶)
```

### Step 4: Test Critical Features on Android

Run through this checklist:

#### ✅ **Text-to-Speech (Phonetic Pronunciation)**
1. Search for a song (or use the recognition feature)
2. View lyrics with phonetic guide
3. **Tap the speaker icon** next to any phonetic line
4. **Expected:** Should hear clear pronunciation (using native Android TTS)
5. **Note:** Voice should sound natural, not robotic

#### ✅ **Speech Recognition (Practice Mode)**
1. Tap the microphone icon to enter practice mode
2. Speak a word/phrase when prompted
3. **Expected:** Should recognize your speech and show accuracy score
4. **Note:** Currently uses Web Speech API, will migrate to Capacitor later

#### ✅ **Song Recognition**
1. Tap the microphone button on home screen
2. Play music near the device
3. **Expected:** Should identify the song and show lyrics
4. **Note:** Requires internet connection

#### ✅ **Lyrics Sync & Scrolling**
1. Play a song (if available)
2. **Expected:** Lyrics highlight and auto-scroll in sync
3. Try manual scrolling - should still highlight correctly

#### ✅ **Dark/Light Theme**
1. Toggle theme in settings/profile
2. **Expected:** Smooth transition, all text remains readable

#### ✅ **Authentication**
1. Log in with Replit Auth (Google/GitHub/Email)
2. **Expected:** Should redirect correctly and persist session

---

## Part 2: iOS Device Testing

### Step 1: Prerequisites Check

**⚠️ Important:** iOS testing requires macOS. If you don't have a Mac, you can:
- Skip iOS testing for now
- Use a cloud Mac service (MacStadium, MacinCloud)
- Ask a friend with a Mac to help

### Step 2: Configure Xcode Signing (macOS Only)

```bash
# Open the iOS project in Xcode
npx cap open ios
```

**In Xcode:**
1. Select the **"App" target** in the project navigator (left sidebar)
2. Go to **Signing & Capabilities** tab
3. Check **"Automatically manage signing"**
4. Select your **Team** (your Apple ID)
   - If no team, click "Add Account" and sign in with your Apple ID
5. Xcode will automatically create a provisioning profile

### Step 3: Connect iOS Device

1. **Connect your iPhone/iPad** via USB
2. **Trust this computer:**
   - On your iOS device, you'll see "Trust This Computer?"
   - Tap **Trust** and enter your device passcode
3. In Xcode, select your device from the **device dropdown** (top toolbar)

### Step 4: Build and Run on iOS Device

```bash
# First, sync the latest build
npm run build
npx cap sync ios

# Open in Xcode
npx cap open ios
```

**In Xcode:**
1. Ensure your device is selected (not a simulator)
2. Click the **Play button** (▶) or press `Cmd + R`
3. Wait for build to complete (~1-2 minutes first time)
4. App will install and launch on your device

**⚠️ First Launch Issue:**
If you see "Untrusted Developer" on your device:
1. Go to **Settings > General > VPN & Device Management**
2. Tap your developer profile
3. Tap **Trust "[Your Name]"**
4. Relaunch the app

### Step 5: Test Critical Features on iOS

Use the same checklist as Android (see Step 4 above), with these iOS-specific notes:

- **TTS:** Should use native iOS voice (sounds different from Android)
- **Microphone permissions:** iOS will ask for permission first time
- **Performance:** Should feel smooth and responsive

---

## Part 3: Debugging Common Issues

### Issue: "No devices found" (Android)

**Solutions:**
1. Check USB cable (try different cable/port)
2. Verify USB debugging is enabled
3. Check device is authorized:
   ```bash
   adb devices
   # Should show your device (not "unauthorized")
   ```
4. Restart ADB:
   ```bash
   adb kill-server
   adb start-server
   ```

### Issue: "Build failed" (Android)

**Solutions:**
1. Clear build cache:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```
2. Rebuild:
   ```bash
   npm run build
   npx cap sync android
   ```

### Issue: App crashes on launch (Android/iOS)

**Solutions:**
1. Check device logs:
   ```bash
   # Android
   npx cap run android --target [device-id]
   # Then watch logcat in Android Studio

   # iOS
   # Check Console.app on Mac, filter by "Lyric Sensei"
   ```
2. Verify all environment secrets are set (Azure keys, etc.)

### Issue: TTS not working on device

**Check:**
1. Device volume is up
2. Device is not in silent mode
3. Check browser console (if using web view debug):
   ```bash
   # Android: Chrome DevTools for Android WebView
   chrome://inspect

   # iOS: Safari > Develop > [Your Device] > Lyric Sensei
   ```

### Issue: Microphone permission denied

**Solutions:**
- **Android:** Settings > Apps > Lyric Sensei > Permissions > Microphone > Allow
- **iOS:** Settings > Lyric Sensei > Microphone > Allow

---

## Part 4: Viewing Console Logs (Advanced Debugging)

### Android (Chrome DevTools)

1. On your computer, open **Chrome browser**
2. Navigate to `chrome://inspect`
3. Your device should appear under "Remote Target"
4. Click **"inspect"** next to Lyric Sensei
5. You'll see the Chrome DevTools with console logs, network requests, etc.

### iOS (Safari Web Inspector)

1. On iOS device: Settings > Safari > Advanced > **Enable Web Inspector**
2. On Mac: Safari > Preferences > Advanced > **Show Develop menu**
3. Connect device to Mac
4. Safari > Develop > [Your Device Name] > **Lyric Sensei**
5. Web Inspector opens with console, network, etc.

---

## Testing Checklist Summary

Copy this checklist and mark items as you test:

### Android Device
- [ ] USB debugging enabled
- [ ] Device detected by computer
- [ ] App builds and installs successfully
- [ ] App launches without crashes
- [ ] TTS (speaker icon) works with native voice
- [ ] Speech recognition works (practice mode)
- [ ] Song recognition works
- [ ] Lyrics sync and scroll correctly
- [ ] Dark/light theme toggles properly
- [ ] Authentication works (login/logout)
- [ ] No console errors in Chrome DevTools

### iOS Device (if available)
- [ ] Device trusted by Mac
- [ ] Signing configured in Xcode
- [ ] App builds and installs successfully
- [ ] App launches without crashes
- [ ] TTS works with native iOS voice
- [ ] Speech recognition works
- [ ] Song recognition works
- [ ] Lyrics sync and scroll correctly
- [ ] Dark/light theme toggles properly
- [ ] Authentication works
- [ ] No console errors in Safari Web Inspector

---

## Next Steps After Testing

Once you've verified everything works on devices:

1. **Document any issues** you find (I can help fix them!)
2. **Prepare for production:**
   - Create signed release builds (see CAPACITOR.md)
   - Test release builds on devices
   - Submit to Google Play / Apple App Store

3. **Optional enhancements:**
   - Add app icon and splash screen customization
   - Implement deep linking for sharing songs
   - Add native notifications for practice reminders

---

## Need Help?

If you encounter any issues during testing, let me know:
- What step you're on
- What error message you see
- Whether it's Android or iOS
- Any console errors from Chrome DevTools / Safari Inspector

I'm here to help debug and fix any issues! 🚀
