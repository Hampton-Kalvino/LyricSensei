# Lyric Sensei

## Overview
Lyric Sensei is an AI-powered mobile and web application designed to enhance music enjoyment and language learning. It identifies songs, displays real-time synchronized lyrics, and offers phonetic learning guides in multiple languages. The platform operates on a freemium model with ad-supported free access and a premium subscription for an ad-free, unlimited experience. It functions as a native mobile app via Capacitor while maintaining backward compatibility as a web application.

## User Preferences
I prefer iterative development with clear communication on significant changes. Please ask before making major architectural changes or introducing new external dependencies. For code, I lean towards clear, maintainable, and well-documented solutions. Ensure all user-facing text is internationalized and that the application is responsive across devices.

## System Architecture

### UI/UX Decisions
- **Theming**: Dark/Light theme with purple gradients, clean backgrounds, and soft purple accents.
- **Typography**: Inter for primary text, JetBrains Mono for phonetic text.
- **Responsiveness**: Fully responsive design using Tailwind CSS and Shadcn UI, including adaptive layouts for landscape orientation.
- **Internationalization (i18n)**: Supports English, Spanish, French, German, Japanese, Korean, Chinese, with automatic browser detection and persistent user preferences.
- **Interactions**: Smooth transitions, hover effects, auto-scrolling lyrics, and pulsing animations.
- **Branding**: Prominent "Lyric Sensei" logo (purple music note) across all pages.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter, React Query, Tailwind CSS + Shadcn UI, and react-i18next.
- **Backend**: Express.js, integrated with Azure Translator and Zod for validation.
- **Data Storage**: PostgreSQL for user data, recognition history, and subscriptions.
- **Authentication**: Multi-provider system including Guest Mode, Password Auth (bcrypt hashing), and Google OAuth, with persistent sessions and a password reset flow.
- **Monetization**: Stripe for subscriptions and a custom ad system for free users (Google AdSense integrated).
- **Translation Service**: Azure Translator API with OpenAI (GPT-4o-mini) fallback.
- **Pronunciation Assessment**: Azure Speech Services for scoring, utilizing a hybrid cost model (browser Web Speech API for free, hybrid browser/Azure for premium) and smart caching.
- **Social Media Sharing**: Native mobile share sheet for Instagram, Facebook, Twitter, WhatsApp, Telegram via Web Share API and Capacitor.Share API. Desktop web share dialogs. Generates visual story cards with `html-to-image` and Canvas fallback.
- **Native App (Capacitor)**: Hybrid web/native app for Android and iOS using Capacitor for native speech APIs and app store distribution. Uses `@capacitor-community/text-to-speech` and `@capacitor-community/speech-recognition`.
- **Speech Recognition**: Dual-platform implementation using Web Speech API on browsers and native Capacitor speech recognition on mobile.
- **Core Features**:
    - **Song Recognition**: Real-time ACRCloud integration with history tracking.
    - **Song Metadata**: Displays artwork, title, artist, album, duration, language with streaming links.
    - **Search Functionality**: Multi-location search system.
    - **Real-Time Lyrics**: Synchronized, auto-scrolling, karaoke-style display with translations and phonetic guides.
    - **Favorites System**: Users can mark and manage favorite songs.
    - **Freemium Model**: Daily translation limits for free users, unlimited for premium.
    - **Phonetic Guide System**: Rule-based converters and Azure transliteration for various languages, including mixed-language cleanup and syllable separation.
    - **Lyric Sync Detection**: Differentiates between accurately synced and estimated lyrics.
    - **User Profile Management**: Allows customization of username, country, name, and profile picture.
    - **Practice Stats Tracking**: Tracks pronunciation progress with accuracy metrics and achievements.

### System Design Choices
- **API Endpoints**: RESTful API for all core functionalities.
- **Data Model**: Includes `Song`, `LyricLine`, `Translation`, `RecognitionResult`, `RecognitionHistory`, `UserFavorites`, `PracticeStats`, `password_reset_tokens`, and an extended `User` model.
- **Environment Variables**: Used for secure configurations.
- **Lyric Timing & Scrolling**: Absolute time positioning and container-based scrolling with IntersectionObserver.
- **Album Artwork**: Fetched from Spotify API with fallback.

## External Dependencies
- **ACRCloud**: Music recognition service.
- **Azure Translator**: Microsoft Cognitive Services for translation and transliteration.
- **Azure Speech Services**: Microsoft Cognitive Services for pronunciation assessment.
- **Spotify API**: For fetching album artwork and metadata.
- **Stripe**: Subscription management and payment processing.
- **Passport.js**: Multi-strategy authentication framework (`passport-local`, `passport-google-oauth20`).
- **Bcryptjs**: Password hashing and verification.
- **PostgreSQL**: Relational database with session storage via `connect-pg-simple`.
- **Resend**: Email service for password reset notifications and transactional emails.
- **Google AdSense**: Advertising platform for free-tier users.