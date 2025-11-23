# Quick Device Testing Checklist

Use this simplified checklist while testing on your device.

## 🤖 Android Testing

### Setup (One-time)
```bash
# 1. Enable USB debugging on your Android device:
#    Settings > About Phone > Tap "Build Number" 7 times
#    Settings > Developer Options > Enable "USB Debugging"

# 2. Connect device and verify
npx cap run android --list

# 3. Build and run
npm run build
npx cap sync android
npx cap run android
```

### Feature Tests
| Feature | Test Action | Expected Result | ✅ |
|---------|-------------|-----------------|---|
| **TTS (Phonetic)** | Tap speaker icon on lyrics | Hear native Android voice pronunciation | [ ] |
| **Speech Recognition** | Use practice mode with mic | Speech recognized, accuracy shown | [ ] |
| **Song Recognition** | Tap mic on home, play music | Song identified, lyrics displayed | [ ] |
| **Lyric Sync** | Play song / scroll manually | Auto-scroll or highlight on scroll | [ ] |
| **Theme Toggle** | Switch dark/light mode | Smooth transition, readable text | [ ] |
| **Authentication** | Login with Replit Auth | Successful login, session persists | [ ] |
| **Permissions** | First mic/speech use | Permission prompt, then works | [ ] |
| **Performance** | Navigate between pages | Smooth, no lag or freezing | [ ] |

### Debug Tools
```bash
# View console logs in Chrome
# 1. Open chrome://inspect in Chrome browser
# 2. Find your device
# 3. Click "inspect" next to Lyric Sensei
```

---

## 🍎 iOS Testing (Requires macOS)

### Setup (One-time)
```bash
# 1. Connect iPhone/iPad via USB
# 2. Trust computer on iOS device

# 3. Open Xcode and configure signing
npx cap open ios
# In Xcode: Select App target > Signing & Capabilities
# Check "Automatically manage signing"
# Select your Team (Apple ID)

# 4. Build and run
npm run build
npx cap sync ios
# Then click Play (▶) in Xcode
```

### Feature Tests
Same checklist as Android (use table above)

**iOS-Specific Notes:**
- TTS voice sounds different (native iOS voice)
- First launch: Trust developer in Settings > General > Device Management
- Microphone permission prompt on first use

### Debug Tools
```bash
# View console logs in Safari
# 1. iOS: Settings > Safari > Advanced > Enable Web Inspector
# 2. Mac: Safari > Develop > [Your Device] > Lyric Sensei
```

---

## 🚨 Common Issues

| Problem | Quick Fix |
|---------|-----------|
| No devices found | Check USB cable, restart `adb kill-server && adb start-server` |
| Build failed | Clear cache: `cd android && ./gradlew clean && cd ..` |
| App crashes | Check console logs (Chrome/Safari inspector) |
| No sound (TTS) | Check device volume, not in silent mode |
| Mic not working | Settings > Apps > Lyric Sensei > Permissions > Allow |

---

## ✅ When All Tests Pass

1. **Report Results:**
   - Note any bugs or unexpected behavior
   - Share feedback on performance and user experience

2. **Next Steps:**
   - Fix any issues found
   - Prepare release builds for app stores
   - Test release builds before submission

---

## 📝 Notes Section

Use this space to jot down observations while testing:

```
Device Model: _______________________
Android/iOS Version: ________________

Issues Found:
- 
- 
- 

Performance Notes:
- 
- 

User Experience Feedback:
- 
- 
```

---

**Need help?** Share:
- Which step you're on
- Error messages (if any)
- Console logs (from Chrome/Safari inspector)
