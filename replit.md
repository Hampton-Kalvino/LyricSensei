# Lyric Sensei - AI Music Translation & Phonetic Learning

## Overview
Lyric Sensei is an AI-powered music translation application designed to enhance music enjoyment and language learning. It identifies songs, displays real-time synchronized lyrics, and offers phonetic learning guides in multiple languages. The platform operates on a freemium model, providing ad-supported free access and a premium subscription via Stripe for an ad-free, unlimited experience.

**Native App Conversion (November 2025)**: The application has been converted from a PWA to a native mobile app using Capacitor. This provides robust native speech features on all platforms, bypassing Android PWA limitations. The app maintains full backward compatibility as a web application while supporting native Android and iOS builds.

**Custom Domain (November 2025)**: Domain **lyricsensei.com** purchased and connected. Android app backend URLs are configured to use https://lyricsensei.com for all API calls. Web app uses relative URLs (same origin). DNS records configured through domain registrar for custom domain deployment.

## User Preferences
I prefer iterative development with clear communication on significant changes. Please ask before making major architectural changes or introducing new external dependencies. For code, I lean towards clear, maintainable, and well-documented solutions. Ensure all user-facing text is internationalized and that the application is responsive across devices.

## System Architecture

### UI/UX Decisions
- **Theming**: Dark/Light theme with purple gradients, clean backgrounds, and soft purple accents.
- **Typography**: Inter for primary text, JetBrains Mono for phonetic text.
- **Responsiveness**: Fully responsive design using Tailwind CSS and Shadcn UI.
- **Internationalization (i18n)**: Supports English, Spanish, French, German, Japanese, Korean, Chinese, with automatic browser detection and persistent user preferences.
- **Interactions**: Smooth transitions, hover effects, auto-scrolling lyrics, and pulsing animations.
- **Branding**: Prominent "Lyric Sensei" logo (purple music note) across all pages.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter, React Query, Tailwind CSS + Shadcn UI, and react-i18next.
- **Backend**: Express.js, integrated with Azure Translator and Zod for validation.
- **Data Storage**: PostgreSQL for user data, recognition history, and subscriptions.
- **Authentication**: Multi-provider auth system (November 2025):
  - **Guest Mode**: Users can browse and enjoy songs without creating an account
  - **Password Auth**: Traditional email/password signup and login with bcrypt hashing
  - **Google OAuth**: Sign in with Google account for seamless authentication
  - **User Profiles**: Visible usernames, profile pictures, customizable profile information (first/last name, country)
  - **Session Management**: Persistent sessions with PostgreSQL store, 7-day TTL
- **Monetization**: Stripe for subscriptions and a custom ad system for free users.
- **Translation Service**: Azure Translator API for lyric translation and phonetic guide generation with intelligent pre-detection and post-detection correction. OpenAI (GPT-4o-mini) fallback for romanized Punjabi/Hindi/Urdu when Azure cannot translate.
- **Pronunciation Assessment**: Azure Speech Services for professional-grade pronunciation scoring with hybrid cost model:
  - **Free Tier**: Browser Web Speech API only (instant feedback, no Azure costs)
  - **Premium Tier ($4.99/month)**: Hybrid model with probabilistic gating (90% browser, 10% Azure)
  - **Cost Model**: $0.075/month per premium user with 98.5% profit margin
  - **Azure Features**: Word/syllable/phoneme-level scoring, miscue detection, fluency metrics
  - **Audio Optimization**: 40-60% cost savings via mono conversion, 16kHz downsampling, silence trimming
  - **Smart Caching**: 14-day assessment cache with hash-based deduplication (70% reduction in redundant calls)
  - **Quota Protection**: 10,000 assessments/month premium limit with probabilistic gating (race-condition free)
- **Mobile Share**: Web Share API with Instagram integration; desktop uses standard download.
- **Native App (Capacitor)**: Hybrid web/native app using Capacitor framework for Android and iOS. Provides native speech APIs, better performance, and app store distribution while maintaining web compatibility.
  - **Text-to-Speech**: Uses `@capacitor-community/text-to-speech` for reliable phonetic pronunciation on all platforms
  - **Speech Recognition**: Uses Web Speech API (planning Capacitor migration for word-level practice mode)
  - **Build Targets**: Web (Vite), Android (Capacitor), iOS (Capacitor)
- **Core Features**:
    - **Song Recognition**: Real-time ACRCloud integration via microphone with history tracking.
    - **Song Metadata**: Displays album artwork, title, artist, album, duration, and language with links to streaming platforms.
    - **Top Researched Songs**: Homepage displays the top 10 most recognized songs.
    - **Search Functionality**: Multi-location search system with consistent UX across devices.
    - **Real-Time Lyrics**: Synchronized, auto-scrolling, karaoke-style display with translations and phonetic guides. Supports scroll-based highlighting for non-playback modes using IntersectionObserver for smooth center-detection.
    - **Favorites System**: Users can mark and manage favorite songs.
    - **Social Sharing**: Generates shareable Instagram/Facebook Story images and provides Open Graph meta tags for link sharing.
    - **Freemium Model**: Daily translation limits for free users, unlimited for premium subscribers.
    - **Recognition History**: Tracks and displays previously recognized songs.
    - **Phonetic Guide System**: Rule-based converters for Spanish, French, Portuguese, Zulu, Xhosa, Punjabi, and Hindi, with Azure transliteration for non-Latin scripts (e.g., Japanese, Korean, Chinese, Arabic). Includes mixed-language cleanup and syllable separation.
    - **Lyric Sync Detection**: Differentiates between accurately synced and estimated lyrics.
    - **User Profile Management**: Allows users to customize username, country, name, and profile picture.
    - **Practice Stats Tracking**: Tracks pronunciation practice progress per song with accuracy metrics and medal tiers, including achievement sharing.

### System Design Choices
- **API Endpoints**: RESTful API for core functionalities (songs, lyrics, translations, recognition, history, favorites, practice stats, user profile).
- **Data Model**: Includes `Song`, `LyricLine`, `Translation`, `RecognitionResult`, `RecognitionHistory`, `UserFavorites`, `PracticeStats`, and an extended `User` model.
- **Environment Variables**: Used for secure configurations.
- **Lyric Timing & Scrolling**: Absolute time positioning and container-based scrolling for lyrics with IntersectionObserver-based center detection for scroll highlighting. Handles duplicate mobile/desktop containers by checking clientHeight > 0 before observer creation.
- **Album Artwork**: Fetched from Spotify API, with a placeholder fallback.

### New Features (November 2025)
- **Guest Mode Authentication**: Users can start using the app without registration. Guest accounts provide:
  - Access to song recognition and search
  - Ability to view lyrics and translations
  - Option to upgrade to a full account anytime
  - Prompt to create account when accessing premium features
- **Password-Based Authentication**: Users can sign up with email and password:
  - Bcrypt password hashing with 10 rounds
  - Email validation and uniqueness checks
  - Password confirmation during signup
  - Secure password verification during login
- **Google OAuth Integration**: One-click sign-in with Google:
  - Automatically creates user profile with Google account info (email, name, profile picture)
  - Seamless account linking if email already exists
  - No password required for Google accounts
- **User Profiles & Customization**:
  - Visible username (unique, 3-30 characters)
  - Profile pictures with upload support
  - First name, last name, and country information
  - Profile edit page accessible from sidebar
  - Profile display on home page and throughout app
- **New Frontend Pages**:
  - `/auth/login` - Unified login/signup page with password and Google options
  - `/profile` - User profile management page with editing capabilities
  - Guest mode option on landing page

### Recent Bug Fixes (November 2025)
- **Scroll-Based Lyric Highlighting**: Fixed IntersectionObserver not updating highlighted line when user scrolls. Solution: Added `lyrics.length` dependency to ensure observer is created after container ref is populated, skip creation for hidden containers (clientHeight=0), and disconnect existing observer before recreating to handle responsive layout duplicates.
- **Auto-Scroll Playback-Only**: Fixed auto-scroll triggering after manual scroll. Solution: Modified auto-scroll useEffect to only trigger during active playback (`isActivePlayback=true`), not during manual scrolling. Removed `manualScrollLineIndex` and `activeIndex` from dependencies. Now: playback auto-scrolls to keep current line centered, manual scroll controls highlighting passively via IntersectionObserver without auto-scroll interference.
- **Practice Mode Banner Timing**: Fixed "Speak now..." banner disappearing instantly when microphone errors occur. Solution: Added `bannerStartTime` timestamp tracking and calculate `remainingTime` in onerror handler to ensure minimum 2-second display even if recognition.onerror fires immediately.
- **Practice Mode Toast Conflicts**: Fixed toast notifications competing with listening banner causing brief flashes. Solution: Delayed all error toasts until after banner clears (using calculated `remainingTime`). Error messages (microphone access, no speech, audio-capture, network, generic) now appear after minimum 2-second banner display, preserving user feedback while avoiding visual conflicts. Applied consistently to all error paths: onerror handler, try/catch recognition.start(), and initial guards.
- **Practice Mode Timing Consistency**: Fixed try/catch error handler using hardcoded 2000ms delay instead of calculated `remainingTime`. Solution: Calculate elapsed time from `bannerStartTime` in all error paths (onerror, try/catch) to ensure toast appears exactly when banner clears, regardless of when error occurs. Prevents toasts from appearing too early or too late.
- **Practice Mode Timeout Banner**: Fixed accuracy banner not appearing after microphone listening timeout in practice mode. Solution: Added `maxListeningTimeoutRef` with 10-second timeout that calls `recognition.stop()`, modified onend fallback to show score banner with 0% accuracy and "Keep Practicing" message, includes cleanup of timeout in onresult, onerror, and cleanupPracticeMode.
- **Practice Mode Session Guard**: Fixed session invalidation from duplicate calls (double-clicks, React strict mode). Solution: Modified practiceWord guard to return early without cleanup when detecting concurrent calls, preventing session invalidation while active recognition is running.
- **Database Upsert Logic**: Fixed unique constraint violations on email during user upsert. Solution: Check if user with email exists before insert, update existing record if found instead of inserting duplicate.
- **Speaker Icon Glitching (Android)**: Fixed speaker button appearing selected but not animating on Android devices. Solution: Set `isSpeaking` state immediately when button is clicked (before speech starts) instead of waiting for `onstart` event, which doesn't fire reliably on Android. Added 30-second safety timeout to reset state if speech fails silently.
- **Android PWA Speech Limitations**: Converted app from PWA to native using Capacitor to eliminate Android PWA Web Speech API restrictions. Native text-to-speech now works reliably on all platforms.
- **Code Cleanup**: Removed dead `startListening` function and associated state variables (`isListening`, `recognizedText`, `recognitionRef`) - ~85 lines of unused code. Removed PWA detection code as app is now native. App uses Capacitor TTS for phonetic pronunciation.
- **Capacitor Migration (November 2025)**: Converted text-to-speech to use Capacitor's native TTS plugin, providing robust speech on all platforms including Android. Speech recognition for practice mode still uses Web Speech API pending full Capacitor migration.

## External Dependencies
- **ACRCloud**: Music recognition service.
- **Azure Translator**: Microsoft Cognitive Services for translation and transliteration.
- **Azure Speech Services**: Microsoft Cognitive Services for pronunciation assessment with word/syllable/phoneme-level scoring.
- **Spotify API**: For fetching album artwork and metadata.
- **Stripe**: Subscription management and payment processing.
- **Passport.js**: Multi-strategy authentication framework
  - `passport-local`: Email/password authentication
  - `passport-google-oauth20`: Google OAuth 2.0 authentication
- **Bcryptjs**: Password hashing and verification
- **PostgreSQL**: Relational database with session storage via `connect-pg-simple`.