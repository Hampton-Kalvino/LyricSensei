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
- **Mobile Share**: Web Share API with Instagram integration.
- **Native App (Capacitor)**: Hybrid web/native app for Android and iOS using Capacitor for native speech APIs and app store distribution. Uses `@capacitor-community/text-to-speech` for TTS and `@capacitor-community/speech-recognition` for native speech recognition.
- **Speech Recognition**: Dual-platform implementation with automatic detection - uses Web Speech API on web browsers and native Capacitor speech recognition on mobile (Android/iOS).
- **Core Features**:
    - **Song Recognition**: Real-time ACRCloud integration with history tracking.
    - **Song Metadata**: Displays artwork, title, artist, album, duration, and language with streaming links.
    - **Search Functionality**: Multi-location search system.
    - **Real-Time Lyrics**: Synchronized, auto-scrolling, karaoke-style display with translations and phonetic guides, supporting scroll-based highlighting.
    - **Favorites System**: Users can mark and manage favorite songs.
    - **Social Sharing**: Generates shareable Instagram/Facebook Story images.
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

- **Auto-Scrolling Synced Lyrics (Nov 25, 2025)**: Fully integrated free LRC library-based synced lyrics with Musixmatch/Tidal-style auto-scrolling. Recognition and manual selection endpoints now fetch synced lyrics from LRCLIB API with accurate timestamps. LyricDisplay component implements smooth auto-scroll that centers current line in viewport using requestAnimationFrame and IntersectionObserver. Manual scroll pauses auto-scroll for 3 seconds (debounced), then resumes automatically. Click any lyric line to seek to that timestamp. Mobile layout refactored to 4-row header: (1) Language selector, (2) Song info with 16×16px album art, (3) Search + recognition, (4) Menu/Lyrics/Album tabs. Content areas now full-width with hidden scrollbars (scrolling preserved). Maintains CSS integrity with responsive text sizing (3xl mobile / 4xl desktop for active lines). Works seamlessly across web and mobile with proper touch interactions.

## External Dependencies
- **ACRCloud**: Music recognition service.
- **Azure Translator**: Microsoft Cognitive Services for translation and transliteration.
- **Azure Speech Services**: Microsoft Cognitive Services for pronunciation assessment.
- **Spotify API**: For fetching album artwork and metadata.
- **Stripe**: Subscription management and payment processing.
- **Passport.js**: Multi-strategy authentication framework (`passport-local`, `passport-google-oauth20`).
- **Bcryptjs**: Password hashing and verification.
- **PostgreSQL**: Relational database with session storage via `connect-pg-simple`.