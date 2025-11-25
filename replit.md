# Lyric Sensei

## Overview
Lyric Sensei is an AI-powered music translation application designed to enhance music enjoyment and language learning. It identifies songs, displays real-time synchronized lyrics, and offers phonetic learning guides in multiple languages. The platform operates on a freemium model, providing ad-supported free access and a premium subscription via Stripe for an ad-free, unlimited experience. The application has been converted to a native mobile app using Capacitor, maintaining backward compatibility as a web application.

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
- **Authentication**: Multi-provider system including Guest Mode, Password Auth (bcrypt hashing), and Google OAuth, with persistent sessions.
- **Monetization**: Stripe for subscriptions and a custom ad system for free users.
- **Translation Service**: Azure Translator API with OpenAI (GPT-4o-mini) fallback for specific languages.
- **Pronunciation Assessment**: Azure Speech Services for professional-grade scoring, utilizing a hybrid cost model (browser Web Speech API for free tier, hybrid browser/Azure for premium) and smart caching for cost optimization.
- **Social Media Sharing**: Native mobile share sheet for Instagram, Facebook, Twitter, WhatsApp, and Telegram integration via Web Share API. Desktop web share dialog opens social media share URLs. Implemented via `ShareMenu` component with platform detection and fallback mechanisms.
- **Native App (Capacitor)**: Hybrid web/native app for Android and iOS using Capacitor for native speech APIs and app store distribution. Uses `@capacitor-community/text-to-speech` for TTS and `@capacitor-community/speech-recognition` for native speech recognition.
- **Speech Recognition**: Dual-platform implementation with automatic detection - uses Web Speech API on web browsers and native Capacitor speech recognition on mobile (Android/iOS).
- **Core Features**:
    - **Song Recognition**: Real-time ACRCloud integration with history tracking.
    - **Song Metadata**: Displays artwork, title, artist, album, duration, and language with streaming links.
    - **Search Functionality**: Multi-location search system.
    - **Real-Time Lyrics**: Synchronized, auto-scrolling, karaoke-style display with translations and phonetic guides, supporting scroll-based highlighting.
    - **Favorites System**: Users can mark and manage favorite songs.
    - **Social Sharing**: One-click sharing to Instagram, Facebook, Twitter, WhatsApp, Telegram, and direct link copy. Uses native mobile share sheet on mobile devices and opens web share dialogs on desktop. ShareMenu component provides easy 7-option popover interface.
    - **Freemium Model**: Daily translation limits for free users, unlimited for premium.
    - **Recognition History**: Tracks previously recognized songs.
    - **Phonetic Guide System**: Rule-based converters and Azure transliteration for various languages, including mixed-language cleanup and syllable separation.
    - **Lyric Sync Detection**: Differentiates between accurately synced and estimated lyrics.
    - **User Profile Management**: Allows customization of username, country, name, and profile picture.
    - **Practice Stats Tracking**: Tracks pronunciation progress with accuracy metrics and achievements.

### System Design Choices
- **API Endpoints**: RESTful API for all core functionalities.
- **Data Model**: Includes `Song`, `LyricLine`, `Translation`, `RecognitionResult`, `RecognitionHistory`, `UserFavorites`, `PracticeStats`, and an extended `User` model.
- **Environment Variables**: Used for secure configurations.
- **Lyric Timing & Scrolling**: Absolute time positioning and container-based scrolling with IntersectionObserver for center detection.
- **Album Artwork**: Fetched from Spotify API with fallback.

## Recent Fixes & Improvements

### Fixed Issues
- **French & Spanish Phonetic Spelling (Nov 25, 2025)**: Fixed bug where French and Spanish words were being spelled letter-by-letter instead of pronounced as whole words. Root cause was `splitIntoSyllables` function using regex that only matched vowel→consonants→vowel patterns, missing edge cases. Replaced with character-by-character state machine algorithm that properly handles digraphs, nasal vowels, and edge cases. Now correctly syllabifies: "bonjour"→"bon-zhoor", "hola"→"oh-lah".

### New Features & Implementations
- **Capacitor Native Speech Recognition (Nov 25, 2025)**: Implemented `@capacitor-community/speech-recognition` plugin for mobile platforms. Added platform-aware architecture in `lyric-display.tsx` that automatically detects native (Android/iOS) vs web environments. Split speech handling into `handleWebSpeech` (Web Speech API for browsers) and `handleCapacitorSpeech` (native Capacitor API for mobile). Mobile implementation includes permission checking, 10-second listening window, partial results tracking, and identical accuracy scoring/auto-advance logic. Fixes mobile speech recognition glitches and enables native microphone access.

- **Landscape Orientation Support (Nov 25, 2025)**: Added responsive mobile layout for landscape orientation. Portrait mode maintains 4-row vertical header; landscape mode switches to left sidebar icon navigation (w-20) with compact single-row header featuring language selector, song info, search, mic, share, and favorite buttons all in one row. Uses `orientationchange` and `resize` event listeners for automatic detection. Works seamlessly on both portrait and landscape iPhone/Android devices.

- **Native Social Media Sharing (Nov 25, 2025)**: Implemented comprehensive social sharing system (`social-share.ts` utility + `ShareMenu.tsx` component). Supports Instagram, Facebook, Twitter, WhatsApp, and Telegram with platform-aware detection. Mobile devices use Web Share API's native share sheet; web browsers use direct share URLs. ShareMenu provides 8-option popover with Story sharing for mobile.

- **Social Media Stories Feature (Nov 25, 2025)**: Implemented Tidal-style story card generation for Instagram/Snapchat stories. New components: `StoryCard.tsx` (React component with gradient backgrounds, album art, song info, lyric display) and enhanced `story-generator.ts` with `generateStoryImageFromComponent()` using html-to-image library. On Android/iOS, users can tap "Story" button in share menu to generate a 1080×1920px high-quality story image and share directly to Instagram Stories, Snapchat, or other native apps via Web Share API. Features beautiful gradient overlay, blurred album art background, centered album artwork (520×520px), song title/artist styling, optional lyric quote display, and user attribution at bottom.

- **Enhanced Visual Story Share System (Nov 25, 2025)**: Implemented production-grade share system with `share-utils.ts` utilities and native `cordova-plugin-x-socialsharing` plugin integration. New `generateStoryCard()` creates beautiful 1080×1920px Tidal-style cards using `html-to-image` (2x pixel ratio for Retina displays), with automatic fallback to Canvas API if html-to-image fails. Card design: Blurred album art background (80px blur, -50px offsets), 700×700px premium album frame with rounded corners + shadow, 80px bold song title with text shadows, 52px professional artist name, "Lyric Sensei - Learn Lyrics in Any Language" branding, "Download Lyric Sensei + lyricsensei.com" CTA. Enhanced `ShareSheet.tsx`: (1) Instagram Stories via `shareViaInstagramToStory()` with gradient colors, (2) Snapchat/Twitter via `shareVia()` with proper package names, (3) Web Share API fallback with file blobs for desktop browsers, (4) Generic share sheet. All functions: Try html-to-image → fallback to Canvas → save as PNG to Capacitor cache → pass file URI to native plugin. Features comprehensive logging ([Instagram], [Snapchat], [Twitter] prefixes), error handling with app-not-installed fallbacks, platform detection (Android/iOS/web), and 3-tier error recovery (html-to-image → Canvas → Web Share).

## External Dependencies
- **ACRCloud**: Music recognition service.
- **Azure Translator**: Microsoft Cognitive Services for translation and transliteration.
- **Azure Speech Services**: Microsoft Cognitive Services for pronunciation assessment.
- **Spotify API**: For fetching album artwork and metadata.
- **Stripe**: Subscription management and payment processing.
- **Passport.js**: Multi-strategy authentication framework (`passport-local`, `passport-google-oauth20`).
- **Bcryptjs**: Password hashing and verification.
- **PostgreSQL**: Relational database with session storage via `connect-pg-simple`.